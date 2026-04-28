/**
 * Tests for the sync engine.
 *
 * Two layers:
 *   1. Pure tests for the wire-format guards and helpers — no IndexedDB
 *      needed, run anywhere vitest runs.
 *   2. Integration tests for `applyServerChanges` against an in-memory
 *      Dexie db via `fake-indexeddb/auto`. These exercise the field-level
 *      LWW logic that Sprint 1 introduced.
 *
 * NOTE on running locally: the monorepo's vitest install is currently
 * tangled across multiple `@vitest/*` versions in the lockfile (3.x and
 * 4.x mixed). The pure tests below are written so they pass on any vitest
 * 4.x; the integration block additionally needs `fake-indexeddb` (already
 * a devDependency). Once vitest is realigned, `pnpm test` should pick this
 * file up automatically — no separate config required.
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, vi } from 'vitest';

// Stub the side-effect modules the Dexie hooks reach into so importing
// `database.ts` doesn't try to load funnel-tracking, automation triggers,
// or inline suggestions. The hooks themselves still run; their side
// effects are just no-ops.
vi.mock('$lib/stores/funnel-tracking', () => ({
	trackFirstContent: vi.fn(),
}));
vi.mock('$lib/triggers/registry', () => ({
	fire: vi.fn(),
}));
vi.mock('$lib/triggers/inline-suggest', () => ({
	checkInlineSuggestion: vi.fn().mockResolvedValue(null),
}));

import {
	isValidSyncChange,
	readFieldMeta,
	applyServerChanges,
	subscribeSyncConflicts,
	deriveUpdatedAt,
	type SyncChange,
	type SyncConflictPayload,
} from './sync';
import { db, FIELD_META_KEY, UPDATED_AT_INDEX_KEY } from './database';
import {
	makeFieldMeta,
	USER_ACTOR,
	makeSystemActor,
	SYSTEM_BOOTSTRAP,
	runAsAsync,
} from './events/actor';

// ─── Pure tests ──────────────────────────────────────────────────

describe('isValidSyncChange', () => {
	const baseInsert: SyncChange = {
		table: 'tasks',
		id: 'task-1',
		op: 'insert',
		data: { title: 'hello' },
	};

	it('accepts a well-formed insert change', () => {
		expect(isValidSyncChange(baseInsert)).toBe(true);
	});

	it('accepts a well-formed update change with field timestamps', () => {
		const change: SyncChange = {
			table: 'tasks',
			id: 'task-1',
			op: 'update',
			fields: {
				title: { value: 'updated', at: '2026-04-01T10:00:00Z' },
				priority: { value: 'high', at: '2026-04-01T10:01:00Z' },
			},
		};
		expect(isValidSyncChange(change)).toBe(true);
	});

	it('accepts a delete change with deletedAt', () => {
		const change: SyncChange = {
			table: 'tasks',
			id: 'task-1',
			op: 'delete',
			deletedAt: '2026-04-01T10:00:00Z',
		};
		expect(isValidSyncChange(change)).toBe(true);
	});

	it('rejects null and primitives', () => {
		expect(isValidSyncChange(null)).toBe(false);
		expect(isValidSyncChange(undefined)).toBe(false);
		expect(isValidSyncChange('not an object')).toBe(false);
		expect(isValidSyncChange(42)).toBe(false);
	});

	it('rejects when table is missing or empty', () => {
		expect(isValidSyncChange({ ...baseInsert, table: '' })).toBe(false);
		expect(isValidSyncChange({ ...baseInsert, table: undefined })).toBe(false);
	});

	it('rejects when id is missing or empty', () => {
		expect(isValidSyncChange({ ...baseInsert, id: '' })).toBe(false);
		expect(isValidSyncChange({ ...baseInsert, id: undefined })).toBe(false);
	});

	it('rejects unknown op values', () => {
		expect(isValidSyncChange({ ...baseInsert, op: 'upsert' })).toBe(false);
		expect(isValidSyncChange({ ...baseInsert, op: '' })).toBe(false);
	});

	it('rejects malformed fields map', () => {
		// Inner value is not a FieldChange object
		expect(
			isValidSyncChange({
				...baseInsert,
				op: 'update',
				fields: { title: 'just a string' },
			})
		).toBe(false);

		// `at` must be a string when present
		expect(
			isValidSyncChange({
				...baseInsert,
				op: 'update',
				fields: { title: { value: 'x', at: 12345 } },
			})
		).toBe(false);
	});

	it('rejects when data is a primitive', () => {
		expect(isValidSyncChange({ ...baseInsert, data: 'not an object' })).toBe(false);
	});

	it('rejects when deletedAt is not a string', () => {
		expect(isValidSyncChange({ ...baseInsert, deletedAt: 123 })).toBe(false);
	});
});

describe('readFieldMeta', () => {
	it('returns the field-meta map when present', () => {
		const fieldMeta = {
			title: makeFieldMeta('2026-04-01T10:00:00Z', USER_ACTOR, 'user'),
			priority: makeFieldMeta('2026-04-01T11:00:00Z', USER_ACTOR, 'user'),
		};
		const record = { id: 'x', [FIELD_META_KEY]: fieldMeta };
		expect(readFieldMeta(record)).toEqual(fieldMeta);
	});

	it('returns an empty map when the field is missing (legacy record)', () => {
		expect(readFieldMeta({ id: 'x' })).toEqual({});
	});

	it('handles null and non-object inputs gracefully', () => {
		expect(readFieldMeta(null)).toEqual({});
		expect(readFieldMeta(undefined)).toEqual({});
		expect(readFieldMeta(42)).toEqual({});
	});

	it('returns an empty map if __fieldMeta is not an object', () => {
		expect(readFieldMeta({ id: 'x', [FIELD_META_KEY]: 'not-a-map' })).toEqual({});
	});
});

// ─── Integration tests against the unified Dexie db ─────────────

describe('applyServerChanges (Dexie integration)', () => {
	beforeEach(async () => {
		// Wipe every sync-tracked table plus the bookkeeping ones so each
		// test starts from a clean slate.
		const tables = ['tasks', '_pendingChanges', '_syncMeta'];
		for (const t of tables) {
			try {
				await db.table(t).clear();
			} catch {
				// Table may not exist in this Dexie version — ignore.
			}
		}
	});

	it('inserts a new record with __fieldMeta populated', async () => {
		await applyServerChanges('todo', [
			{
				table: 'tasks',
				id: 'task-A',
				op: 'insert',
				data: {
					id: 'task-A',
					title: 'Buy milk',
					priority: 'medium',
					isCompleted: false,
					order: 0,
					updatedAt: '2026-04-01T10:00:00Z',
				},
			},
		]);

		const stored = await db.table('tasks').get('task-A');
		expect(stored).toBeDefined();
		expect(stored.title).toBe('Buy milk');
		const fm = readFieldMeta(stored);
		expect(fm.title?.at).toBe('2026-04-01T10:00:00Z');
		expect(fm.priority?.at).toBe('2026-04-01T10:00:00Z');
		// applyServerChanges stamps replays with origin='server-replay'
		expect(fm.title?.origin).toBe('server-replay');
	});

	it('field-level LWW: server wins per-field when newer', async () => {
		// Seed a local record via the regular Dexie API so the creating-hook
		// stamps it. We can't use applyServerChanges to seed because it
		// suppresses the hook; we want a *real* local record here.
		await db.table('tasks').add({
			id: 'task-B',
			title: 'old title',
			priority: 'low',
			isCompleted: false,
			order: 0,
		});

		// Server sends an update with NEWER timestamps for both fields.
		await applyServerChanges('todo', [
			{
				table: 'tasks',
				id: 'task-B',
				op: 'update',
				fields: {
					title: { value: 'new title', at: '2099-01-01T00:00:00Z' },
					priority: { value: 'high', at: '2099-01-01T00:00:00Z' },
				},
			},
		]);

		const stored = await db.table('tasks').get('task-B');
		expect(stored.title).toBe('new title');
		expect(stored.priority).toBe('high');

		const fm = readFieldMeta(stored);
		expect(fm.title?.at).toBe('2099-01-01T00:00:00Z');
		expect(fm.priority?.at).toBe('2099-01-01T00:00:00Z');
	});

	it('field-level LWW: split outcome when one field is newer and one older', async () => {
		// Seed local with field timestamps slightly in the future.
		await db.table('tasks').add({
			id: 'task-C',
			title: 'local title',
			priority: 'low',
			isCompleted: false,
			order: 0,
		});

		// Manually overwrite __fieldTimestamps so we can test the comparison
		// against precise values. Use the in-progress applyingServerChanges
		// flag indirectly by going through applyServerChanges with an insert
		// op that overwrites field timestamps. Easier: just patch via update
		// which the hook will handle by merging.
		await db.table('tasks').update('task-C', {
			title: 'local title v2',
			priority: 'urgent',
		});

		// Now apply a server change where:
		//   - title server timestamp is OLDER → local wins
		//   - priority server timestamp is NEWER → server wins
		await applyServerChanges('todo', [
			{
				table: 'tasks',
				id: 'task-C',
				op: 'update',
				fields: {
					title: { value: 'server title (loser)', at: '1970-01-01T00:00:00Z' },
					priority: { value: 'medium (winner)', at: '2099-01-01T00:00:00Z' },
				},
			},
		]);

		const stored = await db.table('tasks').get('task-C');
		expect(stored.title).toBe('local title v2'); // local field kept
		expect(stored.priority).toBe('medium (winner)'); // server field applied
	});

	it('soft delete is applied when server timestamp is newer than local', async () => {
		await db.table('tasks').add({
			id: 'task-D',
			title: 'doomed',
			priority: 'low',
			isCompleted: false,
			order: 0,
		});

		await applyServerChanges('todo', [
			{
				table: 'tasks',
				id: 'task-D',
				op: 'update',
				deletedAt: '2099-01-01T00:00:00Z',
			},
		]);

		const stored = await db.table('tasks').get('task-D');
		expect(stored).toBeDefined();
		expect(stored.deletedAt).toBe('2099-01-01T00:00:00Z');
	});

	it('drops malformed entries but still applies the valid ones in the same batch', async () => {
		const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
		try {
			await applyServerChanges('todo', [
				// Malformed: missing id
				{ table: 'tasks', op: 'insert', data: { title: 'orphan' } },
				// Valid
				{
					table: 'tasks',
					id: 'task-E',
					op: 'insert',
					data: {
						id: 'task-E',
						title: 'survives',
						priority: 'low',
						isCompleted: false,
						order: 0,
					},
				},
			]);

			expect(warn).toHaveBeenCalledOnce();
			const stored = await db.table('tasks').get('task-E');
			expect(stored).toBeDefined();
			expect(stored.title).toBe('survives');
		} finally {
			warn.mockRestore();
		}
	});

	it('does not generate _pendingChanges entries for server-applied writes (sync loop guard)', async () => {
		await applyServerChanges('todo', [
			{
				table: 'tasks',
				id: 'task-F',
				op: 'insert',
				data: {
					id: 'task-F',
					title: 'echo me not',
					priority: 'low',
					isCompleted: false,
					order: 0,
				},
			},
		]);

		const pendingForTaskF = await db
			.table('_pendingChanges')
			.filter((p: { recordId?: string }) => p.recordId === 'task-F')
			.toArray();
		expect(pendingForTaskF).toEqual([]);
	});

	// ─── Sync conflict event detection (Backlog C) ─────────────

	describe('sync-conflict events', () => {
		// Helper: collect every conflict event fired during the body
		// of `fn`, then resolve to the captured payloads. Cleans up the
		// listener even on test failure.
		async function captureConflicts(fn: () => Promise<void>): Promise<SyncConflictPayload[]> {
			const captured: SyncConflictPayload[] = [];
			// In-module pub/sub from sync.ts — works in node-vitest +
			// browser without DOM EventTarget polyfills.
			const unsubscribe = subscribeSyncConflicts((payload) => {
				captured.push(payload);
			});
			try {
				await fn();
			} finally {
				unsubscribe();
			}
			return captured;
		}

		it('fires when the server overwrites a non-empty local field with a strictly newer value', async () => {
			await db.table('tasks').add({
				id: 'task-conflict-1',
				title: 'my version',
				priority: 'low',
				isCompleted: false,
				order: 0,
			});

			const conflicts = await captureConflicts(async () => {
				await applyServerChanges('todo', [
					{
						table: 'tasks',
						id: 'task-conflict-1',
						op: 'update',
						fields: {
							title: { value: 'their version', at: '2099-01-01T00:00:00Z' },
						},
					},
				]);
			});

			expect(conflicts).toHaveLength(1);
			expect(conflicts[0]).toMatchObject({
				tableName: 'tasks',
				recordId: 'task-conflict-1',
				field: 'title',
				wasLocal: 'my version',
				nowServer: 'their version',
			});
		});

		it('does NOT fire when the local field is null/undefined (no edit to lose)', async () => {
			await db.table('tasks').add({
				id: 'task-conflict-2',
				title: null,
				priority: 'low',
				isCompleted: false,
				order: 0,
			});

			const conflicts = await captureConflicts(async () => {
				await applyServerChanges('todo', [
					{
						table: 'tasks',
						id: 'task-conflict-2',
						op: 'update',
						fields: {
							title: { value: 'first server title', at: '2099-01-01T00:00:00Z' },
						},
					},
				]);
			});

			expect(conflicts).toHaveLength(0);
		});

		it('does NOT fire when the values are equal (idempotent server replay)', async () => {
			await db.table('tasks').add({
				id: 'task-conflict-3',
				title: 'same value',
				priority: 'low',
				isCompleted: false,
				order: 0,
			});

			const conflicts = await captureConflicts(async () => {
				await applyServerChanges('todo', [
					{
						table: 'tasks',
						id: 'task-conflict-3',
						op: 'update',
						fields: {
							title: { value: 'same value', at: '2099-01-01T00:00:00Z' },
						},
					},
				]);
			});

			expect(conflicts).toHaveLength(0);
		});

		it('fires once per overwritten field (multi-field conflicts)', async () => {
			await db.table('tasks').add({
				id: 'task-conflict-4',
				title: 'local title',
				priority: 'low',
				isCompleted: false,
				order: 0,
			});

			const conflicts = await captureConflicts(async () => {
				await applyServerChanges('todo', [
					{
						table: 'tasks',
						id: 'task-conflict-4',
						op: 'update',
						fields: {
							title: { value: 'server title', at: '2099-01-01T00:00:00Z' },
							priority: { value: 'high', at: '2099-01-01T00:00:00Z' },
						},
					},
				]);
			});

			expect(conflicts).toHaveLength(2);
			expect(conflicts.map((c) => c.field).sort()).toEqual(['priority', 'title']);
		});

		it('does NOT fire when the server timestamp equals the local one (LWW tie)', async () => {
			// Seed with a known timestamp via the insert path so we can
			// match the server time exactly.
			await applyServerChanges('todo', [
				{
					table: 'tasks',
					id: 'task-conflict-5',
					op: 'insert',
					data: {
						id: 'task-conflict-5',
						title: 'tied title',
						priority: 'low',
						isCompleted: false,
						order: 0,
						updatedAt: '2026-04-01T00:00:00Z',
					},
				},
			]);

			const conflicts = await captureConflicts(async () => {
				await applyServerChanges('todo', [
					{
						table: 'tasks',
						id: 'task-conflict-5',
						op: 'update',
						fields: {
							title: { value: 'changed', at: '2026-04-01T00:00:00Z' }, // exact tie
						},
					},
				]);
			});

			// Tied — LWW lets server win silently (no edit-loss to surface)
			expect(conflicts).toHaveLength(0);
		});

		// ─── F2: Origin-gated conflict detection ─────────────────

		it('does NOT fire on a sequential server-replay burst (history-replay)', async () => {
			// Reproduces the original bug: a fresh client pulls history of
			// 10 distinct server changes for the same record across N
			// pseudo-sessions. None of them is a local user edit; all
			// applyServerChanges writes are stamped origin='server-replay'.
			// No conflict toast must fire — the surface is reserved for
			// user edits that lose to a later server overwrite.
			const conflicts = await captureConflicts(async () => {
				// Initial insert (server-replay).
				await applyServerChanges('todo', [
					{
						table: 'tasks',
						id: 'task-replay-burst',
						op: 'insert',
						data: {
							id: 'task-replay-burst',
							title: 'gen-0',
							priority: 'low',
							isCompleted: false,
							order: 0,
							updatedAt: '2026-04-01T00:00:00Z',
						},
					},
				]);
				// 10 follow-up updates with monotonically increasing timestamps.
				for (let i = 1; i <= 10; i++) {
					const ts = `2026-04-01T00:0${i}:00Z`;
					await applyServerChanges('todo', [
						{
							table: 'tasks',
							id: 'task-replay-burst',
							op: 'update',
							fields: { title: { value: `gen-${i}`, at: ts } },
						},
					]);
				}
			});

			expect(conflicts).toHaveLength(0);
		});

		it('does NOT fire when the local write came from an AI agent (origin=agent)', async () => {
			const { runAs } = await import('./events/actor');
			const { makeAgentActor } = await import('@mana/shared-ai');

			const agent = makeAgentActor({
				agentId: 'agent-test',
				displayName: 'Test-Agent',
				missionId: 'mission-1',
				iterationId: 'iter-1',
				rationale: 'unit-test',
			});

			// Seed locally under the agent actor — the creating-hook
			// stamps origin='agent' for every field.
			runAs(agent, () => {
				void db.table('tasks').add({
					id: 'task-agent-write',
					title: 'agent-typed value',
					priority: 'low',
					isCompleted: false,
					order: 0,
				});
			});
			// Wait for the (synchronous) Dexie put to drain.
			await db.table('tasks').get('task-agent-write');

			const conflicts = await captureConflicts(async () => {
				await applyServerChanges('todo', [
					{
						table: 'tasks',
						id: 'task-agent-write',
						op: 'update',
						fields: {
							title: { value: 'their version', at: '2099-01-01T00:00:00Z' },
						},
					},
				]);
			});

			// Agent writes are visible in the proposal/mission UI, not the
			// conflict toast — server overwriting them is silent.
			expect(conflicts).toHaveLength(0);
		});

		it('does NOT fire when isInitialHydration is set (belt-and-suspenders)', async () => {
			// Even with a real local user edit present, the hydration mode
			// suppresses the entire conflict surface for the round.
			await db.table('tasks').add({
				id: 'task-hydration',
				title: 'my draft',
				priority: 'low',
				isCompleted: false,
				order: 0,
			});

			const conflicts = await captureConflicts(async () => {
				await applyServerChanges(
					'todo',
					[
						{
							table: 'tasks',
							id: 'task-hydration',
							op: 'update',
							fields: {
								title: { value: 'server overwrite', at: '2099-01-01T00:00:00Z' },
							},
						},
					],
					{ isInitialHydration: true }
				);
			});

			expect(conflicts).toHaveLength(0);
		});

		it('fires for a real user edit getting overwritten (origin=user)', async () => {
			// Belt: the existing "fires when..." test at the top of the
			// suite already covers this — restated here so the F2 block
			// reads as a complete spec for the gating rules.
			await db.table('tasks').add({
				id: 'task-real-conflict',
				title: 'I typed this',
				priority: 'low',
				isCompleted: false,
				order: 0,
			});

			const conflicts = await captureConflicts(async () => {
				await applyServerChanges('todo', [
					{
						table: 'tasks',
						id: 'task-real-conflict',
						op: 'update',
						fields: {
							title: { value: 'somebody else', at: '2099-01-01T00:00:00Z' },
						},
					},
				]);
			});

			expect(conflicts).toHaveLength(1);
			expect(conflicts[0].field).toBe('title');
		});
	});

	// ─── F1-F4-fu cross-cutting integration ──────────────────────
	// Sanity checks that verify the architectural promises of the
	// 2026-04-26 sync field-meta overhaul still hold from end to end:
	//   - `deriveUpdatedAt(record)` returns max(__fieldMeta[*].at) so
	//     the public `updatedAt` stays correct after F3.
	//   - The Dexie creating/updating hook stamps `__fieldMeta` AND
	//     `_updatedAtIndex` on every local write.
	//   - The SYSTEM_BOOTSTRAP fallback path stamps origin='system'
	//     so the server's matching bootstrap pull doesn't fight with
	//     the local fallback row (no false-positive conflict toast).
	//   - The bootstrap-twin race scenario: local fallback row + later
	//     server pull collapse via field-LWW with no conflict surface.
	describe('field-meta overhaul (F1-F4-fu)', () => {
		it('deriveUpdatedAt returns max __fieldMeta[*].at', () => {
			const record = {
				id: 'x',
				[FIELD_META_KEY]: {
					title: makeFieldMeta('2026-04-01T10:00:00Z', USER_ACTOR, 'user'),
					priority: makeFieldMeta('2026-04-01T11:00:00Z', USER_ACTOR, 'user'),
					notes: makeFieldMeta('2026-03-01T10:00:00Z', USER_ACTOR, 'user'),
				},
			};
			expect(deriveUpdatedAt(record)).toBe('2026-04-01T11:00:00Z');
		});

		it('deriveUpdatedAt returns empty string when no __fieldMeta', () => {
			expect(deriveUpdatedAt({ id: 'x', title: 'no meta yet' })).toBe('');
			expect(deriveUpdatedAt({})).toBe('');
			expect(deriveUpdatedAt(null)).toBe('');
			expect(deriveUpdatedAt(undefined)).toBe('');
		});

		it('Dexie creating-hook stamps __fieldMeta + _updatedAtIndex on local writes', async () => {
			await db.table('tasks').add({
				id: 'task-hook-create',
				title: 'first',
				priority: 'low',
				isCompleted: false,
				order: 0,
			});
			const stored = await db.table('tasks').get('task-hook-create');
			const meta = readFieldMeta(stored);

			expect(meta.title?.at).toBeTruthy();
			expect(meta.title?.origin).toBe('user');
			// _updatedAtIndex equals max meta.at on a fresh insert.
			expect(stored[UPDATED_AT_INDEX_KEY]).toBe(deriveUpdatedAt(stored));
		});

		it('Dexie updating-hook stamps __fieldMeta only for changed fields and bumps _updatedAtIndex', async () => {
			await db.table('tasks').add({
				id: 'task-hook-update',
				title: 'first',
				priority: 'low',
				isCompleted: false,
				order: 0,
			});
			const before = await db.table('tasks').get('task-hook-update');
			const beforeMeta = readFieldMeta(before);
			const beforePriorityAt = beforeMeta.priority?.at;
			expect(beforePriorityAt).toBeTruthy();

			// Wait a millisecond so the hook's at-stamp on update is strictly later.
			await new Promise((r) => setTimeout(r, 5));
			await db.table('tasks').update('task-hook-update', { title: 'changed' });

			const after = await db.table('tasks').get('task-hook-update');
			const afterMeta = readFieldMeta(after);
			expect(afterMeta.title?.at).not.toBe(beforeMeta.title?.at); // bumped
			expect(afterMeta.priority?.at).toBe(beforePriorityAt); // unchanged
			expect(after[UPDATED_AT_INDEX_KEY]).toBe(afterMeta.title?.at);
		});

		it('SYSTEM_BOOTSTRAP-stamped local insert uses origin=system, not user', async () => {
			const bootstrapActor = makeSystemActor(SYSTEM_BOOTSTRAP);
			await runAsAsync(bootstrapActor, async () => {
				await db.table('tasks').add({
					id: 'task-bootstrap-twin',
					title: '',
					priority: 'low',
					isCompleted: false,
					order: 0,
				});
			});
			const stored = await db.table('tasks').get('task-bootstrap-twin');
			const meta = readFieldMeta(stored);
			expect(meta.title?.origin).toBe('system');
			expect(meta.priority?.origin).toBe('system');
		});

		it('bootstrap-twin race: local SYSTEM_BOOTSTRAP row + later server insert → no conflict, LWW wins', async () => {
			// 1. Client-side fallback creates an empty row stamped origin='system'.
			//    This is what `getOrCreateLocalDoc()` does in userContextStore
			//    when a write lands before the first sync pull.
			const bootstrapActor = makeSystemActor(SYSTEM_BOOTSTRAP);
			await runAsAsync(bootstrapActor, async () => {
				await db.table('tasks').add({
					id: 'task-bootstrap-race',
					title: '',
					priority: 'low',
					isCompleted: false,
					order: 0,
				});
			});

			// 2. Server's bootstrap pull arrives later. mana-auth's
			//    bootstrap-singletons stamps the same record id with the
			//    real default values from emptyUserContext()/emptyKontextDocData().
			const conflicts: SyncConflictPayload[] = [];
			const unsubscribe = subscribeSyncConflicts((p) => conflicts.push(p));
			try {
				await applyServerChanges('todo', [
					{
						table: 'tasks',
						id: 'task-bootstrap-race',
						op: 'insert',
						data: {
							id: 'task-bootstrap-race',
							title: '',
							priority: 'low',
							isCompleted: false,
							order: 0,
							updatedAt: '2026-04-01T10:00:00Z',
						},
					},
				]);
			} finally {
				unsubscribe();
			}

			// No conflict surface — local origin='system' would be exempt
			// even if values differed. With identical empty values, the
			// equality short-circuit also kicks in. Belt-and-suspenders.
			expect(conflicts).toHaveLength(0);
			const stored = await db.table('tasks').get('task-bootstrap-race');
			expect(stored).toBeDefined();
		});
	});
});
