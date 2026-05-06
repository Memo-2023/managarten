/**
 * Cards sync engine — talks to mana-sync (POST /sync/cards, GET /sync/cards/pull).
 *
 * Two loops, both polling-based for the Phase-1 MVP. WebSocket
 * notifications can replace the pull poll later without changing
 * anything outside this file.
 *
 *   Push: drain `_pendingChanges` every 1s when there's anything queued.
 *         On success, delete drained rows and apply any server-changes
 *         the response carried back. Failures keep the rows queued —
 *         the next tick retries.
 *
 *   Pull: every 5s, ask each sync table for changes since its cursor.
 *         Apply with suppression so the apply doesn't re-enqueue a push.
 *         Cursor lives in localStorage per table.
 *
 * Cursor format: ISO timestamp string. The server returns
 * `syncedUntil` on push and we store that as a global push cursor; pull
 * uses one cursor per collection.
 */

import { browser } from '$app/environment';
import {
	beginApplying,
	endApplying,
	db,
	pendingChangesTable,
	type PendingChange,
} from './database';
import { encryptRecord } from './crypto';

const APP_ID = 'cards';
const PUSH_INTERVAL_MS = 1_000;
const PULL_INTERVAL_MS = 5_000;
const SYNC_TABLES = ['cardDecks', 'cards', 'cardReviews', 'cardStudyBlocks', 'deckTags'];

// ─── URL + Auth wiring ─────────────────────────────────────

function getSyncUrl(): string {
	if (browser && typeof window !== 'undefined') {
		const injected = (window as unknown as { __PUBLIC_MANA_SYNC_URL__?: string })
			.__PUBLIC_MANA_SYNC_URL__;
		if (injected) return injected;
	}
	return import.meta.env.DEV ? 'http://localhost:3050' : '';
}

interface AuthLike {
	getValidToken?: () => Promise<string | null>;
	readonly isAuthenticated: boolean;
}

let authProvider: AuthLike | null = null;

// ─── Client ID ─────────────────────────────────────────────

const CLIENT_ID_KEY = 'mana.cards.clientId';

function getClientId(): string {
	if (!browser) return 'ssr';
	let id = localStorage.getItem(CLIENT_ID_KEY);
	if (!id) {
		id = crypto.randomUUID();
		localStorage.setItem(CLIENT_ID_KEY, id);
	}
	return id;
}

// ─── Cursors ───────────────────────────────────────────────

const PUSH_CURSOR_KEY = 'mana.cards.pushCursor';
const PULL_CURSOR_KEY = (table: string) => `mana.cards.pullCursor.${table}`;

function getPushCursor(): string {
	if (!browser) return '';
	return localStorage.getItem(PUSH_CURSOR_KEY) || '1970-01-01T00:00:00.000Z';
}
function setPushCursor(at: string) {
	if (browser) localStorage.setItem(PUSH_CURSOR_KEY, at);
}
function getPullCursor(table: string): string {
	if (!browser) return '';
	return localStorage.getItem(PULL_CURSOR_KEY(table)) || '1970-01-01T00:00:00.000Z';
}
function setPullCursor(table: string, at: string) {
	if (browser) localStorage.setItem(PULL_CURSOR_KEY(table), at);
}

// ─── Server-Change shape ───────────────────────────────────

interface ServerChange {
	eventId?: string;
	schemaVersion?: number;
	table: string;
	id: string;
	op: 'insert' | 'update' | 'delete';
	fields?: Record<string, { value: unknown; at: string }>;
	data?: Record<string, unknown>;
	deletedAt?: string;
}

interface SyncResponse {
	serverChanges: ServerChange[];
	conflicts: unknown[];
	syncedUntil: string;
	hasMore?: boolean;
}

// ─── Apply server changes ──────────────────────────────────

async function applyServerChanges(changes: ServerChange[]) {
	if (changes.length === 0) return;
	const byTable = new Map<string, ServerChange[]>();
	for (const c of changes) {
		const arr = byTable.get(c.table) ?? [];
		arr.push(c);
		byTable.set(c.table, arr);
	}

	for (const [table, list] of byTable) {
		if (!SYNC_TABLES.includes(table)) continue;
		const t = db.table(table);
		beginApplying(table);
		try {
			for (const c of list) {
				try {
					if (c.op === 'delete') {
						await t.update(c.id, { deletedAt: c.deletedAt ?? new Date().toISOString() });
						continue;
					}
					if (c.op === 'insert' && c.data) {
						const row = { ...c.data, id: c.id };
						// Server data may already be ciphertext-on-the-wire when
						// encryption flips on. Re-running encryptRecord on it is a
						// safe no-op today (Phase-1 stub) and the right hook in
						// Phase-2 because existing-ciphertext values are detected
						// upstream via `isEncrypted(...)`.
						await encryptRecord(table, row);
						await t.put(row);
						continue;
					}
					// update — merge fields
					if (c.fields) {
						const existing = (await t.get(c.id)) ?? { id: c.id };
						const merged: Record<string, unknown> = { ...existing };
						for (const [k, v] of Object.entries(c.fields)) {
							merged[k] = v.value;
						}
						await encryptRecord(table, merged);
						await t.put(merged);
					}
				} catch (err) {
					console.error('[cards-sync] apply failed', { table, id: c.id, op: c.op, err });
				}
			}
		} finally {
			endApplying(table);
		}
	}
}

// ─── Push ──────────────────────────────────────────────────

async function flushPush(): Promise<void> {
	if (!authProvider?.isAuthenticated) return;

	const queued = await pendingChangesTable.orderBy('queuedAt').limit(500).toArray();
	if (queued.length === 0) return;

	const token = (await authProvider.getValidToken?.()) ?? null;
	if (!token) return;

	const since = getPushCursor();
	const body = {
		clientId: getClientId(),
		appId: APP_ID,
		since,
		schemaVersion: 1,
		changes: queued.map(toWireChange),
	};

	let res: Response;
	try {
		res = await fetch(`${getSyncUrl()}/sync/${APP_ID}`, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				'X-Client-Id': getClientId(),
				Authorization: `Bearer ${token}`,
			},
			body: JSON.stringify(body),
		});
	} catch (err) {
		console.warn('[cards-sync] push network error', err);
		return;
	}

	if (!res.ok) {
		console.warn('[cards-sync] push HTTP', res.status, await res.text().catch(() => ''));
		return;
	}

	const json = (await res.json()) as SyncResponse;
	await pendingChangesTable.bulkDelete(queued.map((q) => q.pk!).filter((pk) => pk !== undefined));
	setPushCursor(json.syncedUntil);
	await applyServerChanges(json.serverChanges ?? []);
}

function toWireChange(p: PendingChange): ServerChange {
	const out: ServerChange = { table: p.table, id: p.id, op: p.op };
	if (p.fields) out.fields = p.fields;
	if (p.data) out.data = p.data;
	if (p.deletedAt) out.deletedAt = p.deletedAt;
	return out;
}

// ─── Pull ──────────────────────────────────────────────────

async function pollPull(): Promise<void> {
	if (!authProvider?.isAuthenticated) return;
	const token = (await authProvider.getValidToken?.()) ?? null;
	if (!token) return;

	for (const table of SYNC_TABLES) {
		const since = getPullCursor(table);
		const url =
			`${getSyncUrl()}/sync/${APP_ID}/pull?collection=${encodeURIComponent(table)}` +
			`&since=${encodeURIComponent(since)}`;

		let res: Response;
		try {
			res = await fetch(url, {
				headers: {
					'X-Client-Id': getClientId(),
					Authorization: `Bearer ${token}`,
				},
			});
		} catch (err) {
			console.warn('[cards-sync] pull network error', err);
			continue;
		}

		if (!res.ok) {
			console.warn('[cards-sync] pull HTTP', res.status, table);
			continue;
		}

		const json = (await res.json()) as SyncResponse;
		await applyServerChanges(json.serverChanges ?? []);
		if (json.syncedUntil) setPullCursor(table, json.syncedUntil);
	}
}

// ─── Lifecycle ─────────────────────────────────────────────

let pushTimer: ReturnType<typeof setInterval> | null = null;
let pullTimer: ReturnType<typeof setInterval> | null = null;
let pushBusy = false;
let pullBusy = false;

export function startSync(authStore: AuthLike) {
	authProvider = authStore;
	if (!browser) return;
	stopSync();
	pushTimer = setInterval(async () => {
		if (pushBusy) return;
		pushBusy = true;
		try {
			await flushPush();
		} finally {
			pushBusy = false;
		}
	}, PUSH_INTERVAL_MS);
	pullTimer = setInterval(async () => {
		if (pullBusy) return;
		pullBusy = true;
		try {
			await pollPull();
		} finally {
			pullBusy = false;
		}
	}, PULL_INTERVAL_MS);
}

export function stopSync() {
	if (pushTimer) clearInterval(pushTimer);
	if (pullTimer) clearInterval(pullTimer);
	pushTimer = null;
	pullTimer = null;
}
