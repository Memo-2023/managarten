/**
 * Scoped Dexie — drop-in replacement for `db.<table>` that auto-applies
 * the active-space filter on every query and stamps the active-space id
 * on every create.
 *
 * Module code moves from:
 *   `db.table('tasks').where({ isCompleted: 0 }).toArray()`
 * to:
 *   `scoped.table('tasks').where({ isCompleted: 0 }).toArray()`
 *
 * Under the hood the wrapped table adds `.and(r => r.spaceId === activeId)`
 * to every query. No schema changes — the spaceId index lands per-table
 * in follow-ups once hot paths are identified. See
 * docs/plans/spaces-foundation.md.
 *
 * Visibility ('private' records) is filtered in a layer above this (see
 * visibility.ts). This module only enforces space boundaries.
 */

import type { Collection, Table } from 'dexie';
import { db } from '../database';
import { getEffectiveUserId } from '../current-user';
import { getActiveSpaceId } from './active-space.svelte';
import { personalSpaceSentinel } from './bootstrap';
import { isModuleAllowedInSpace, type SpaceModuleId, type SpaceType } from '@mana/shared-types';
import { getActiveSpace } from './active-space.svelte';

export class ScopeNotReadyError extends Error {
	constructor() {
		super('No active space — call loadActiveSpace() before querying scoped data.');
		this.name = 'ScopeNotReadyError';
	}
}

export class ModuleNotInSpaceError extends Error {
	constructor(moduleId: SpaceModuleId, type: SpaceType) {
		super(`Module "${moduleId}" is not available in a ${type} space.`);
		this.name = 'ModuleNotInSpaceError';
	}
}

/**
 * Return the set of spaceId values a record must match to be considered
 * "in scope" right now.
 *
 * Always uses `getEffectiveUserId()` (which returns the GUEST_USER_ID
 * sentinel `'guest'` when no user is signed in) so the filter we apply
 * here matches what the creating-hook in `database.ts` stamps on new
 * rows. The hook always stamps `_personal:${effectiveUserId}` — if the
 * filter used `getCurrentUserId()` (which is null for guests), guest-
 * mode data would be written but never readable until sign-in, which
 * breaks the first-run "try the app without an account" flow.
 *
 * Authenticated path returns either `[active]` (Space-loaded) or
 * `[active, sentinel]` when both differ (covers the bootstrap window
 * where a row was stamped with the personal sentinel before
 * `loadActiveSpace` resolved the real organisation id).
 */
export function getInScopeSpaceIds(): string[] {
	const active = getActiveSpaceId();
	const effectiveUserId = getEffectiveUserId();
	const sentinel = personalSpaceSentinel(effectiveUserId);
	if (active) {
		return sentinel !== active ? [active, sentinel] : [active];
	}
	return [sentinel];
}

/**
 * Return a Collection that applies the space filter — chainable with any
 * further `.where()`, `.filter()`, `.toArray()`, `.modify()`.
 *
 * Use this when you need the whole table filtered; for an indexed where-
 * clause, use `scoped.where(tableName, clause)` so the index is used
 * first and the spaceId filter runs on the narrowed set.
 */
export function scopedTable<T, PK>(tableName: string): Collection<T, PK> {
	const table = db.table(tableName) as Table<T, PK>;
	const ids = getInScopeSpaceIds();
	const check = (record: unknown) => {
		const r = record as { spaceId?: unknown };
		return typeof r.spaceId === 'string' && ids.includes(r.spaceId);
	};
	return table.filter(check);
}

/**
 * Assert the given module is allowed in the active space type; throws
 * ModuleNotInSpaceError if not. Use at the entry point of a module's
 * query / store functions so bypassing the UI gate still hits this
 * structural guard.
 */
export function assertModuleAllowed(moduleId: SpaceModuleId): void {
	const space = getActiveSpace();
	if (!space) throw new ScopeNotReadyError();
	if (!isModuleAllowedInSpace(moduleId, space.type)) {
		throw new ModuleNotInSpaceError(moduleId, space.type);
	}
}

/**
 * Wrap a single-table operation in both scope and module checks. Returns
 * the filtered Collection ready for further chaining. Preferred entry
 * point for module queries:
 *
 *   const tasks = await scopedForModule<LocalTask, string>('todo', 'tasks').toArray();
 */
export function scopedForModule<T, PK>(
	moduleId: SpaceModuleId,
	tableName: string
): Collection<T, PK> {
	assertModuleAllowed(moduleId);
	return scopedTable<T, PK>(tableName);
}

/**
 * Apply the scope filter to an existing Dexie Collection produced by an
 * indexed query. Use this when a module needs the performance of an
 * indexed `where(...)` and wants to narrow the result to the active
 * space as the second step.
 *
 *   const recent = await scopedAnd(
 *     db.table<LocalTask>('tasks').where('updatedAt').aboveOrEqual(since),
 *   ).toArray();
 *
 * The wrapper accepts any Collection so the caller can freely build
 * compound queries with `.or()`, `.and()`, `.reverse()` first.
 */
export function scopedAnd<T, PK>(collection: Collection<T, PK>): Collection<T, PK> {
	const ids = getInScopeSpaceIds();
	return collection.and((record) => {
		const r = record as { spaceId?: unknown };
		return typeof r.spaceId === 'string' && ids.includes(r.spaceId);
	});
}

/**
 * Read a single record by primary key with a scope check. Returns undefined
 * if the record doesn't exist OR if its spaceId isn't in the current
 * in-scope set — i.e. the user manipulated a URL parameter and tried to
 * peek at a record from a space they don't have active.
 *
 * Uses the Dexie primary-key fast path under the hood; the scope check
 * is a single field comparison on the one row returned.
 */
export async function scopedGet<T>(tableName: string, id: string | number): Promise<T | undefined> {
	const record = (await db.table(tableName).get(id)) as T | undefined;
	if (!record) return undefined;
	const rec = record as { spaceId?: unknown };
	const ids = getInScopeSpaceIds();
	if (typeof rec.spaceId !== 'string' || !ids.includes(rec.spaceId)) {
		return undefined;
	}
	return record;
}
