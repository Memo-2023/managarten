/**
 * Guest Seed Registry — central aggregation point for all module seed data.
 *
 * Each module defines a `*_GUEST_SEED` constant in its `collections.ts`
 * file. This registry imports them all and provides a single
 * `seedAllGuestData()` function that the local-store initialization
 * path calls on first visit (when IndexedDB is empty).
 *
 * Adding a new module's seed: import its GUEST_SEED constant and add
 * an entry to `MODULE_SEEDS` below. The table names must match the
 * Dexie schema in database.ts.
 */

import { db } from './database';

// ─── Module Seed Imports ─────────────────────────────────────
import { HABITS_GUEST_SEED } from '$lib/modules/habits/collections';
import { BODY_GUEST_SEED } from '$lib/modules/body/collections';
import { JOURNAL_GUEST_SEED } from '$lib/modules/journal/collections';
import { DREAMS_GUEST_SEED } from '$lib/modules/dreams/collections';
import { CONTACTS_GUEST_SEED } from '$lib/modules/contacts/collections';
import { CALENDAR_GUEST_SEED } from '$lib/modules/calendar/collections';
import { CHAT_GUEST_SEED } from '$lib/modules/chat/collections';
import { SKILLTREE_GUEST_SEED } from '$lib/modules/skilltree/collections';
import { TODO_GUEST_SEED } from '$lib/modules/todo/collections';
import { NOTES_GUEST_SEED } from '$lib/modules/notes/collections';
import { TIMES_GUEST_SEED } from '$lib/modules/times/collections';
import { DRINK_GUEST_SEED } from '$lib/modules/drink/collections';
import { RECIPES_GUEST_SEED } from '$lib/modules/recipes/collections';
import { STRETCH_GUEST_SEED } from '$lib/modules/stretch/collections';
import { MEDITATE_GUEST_SEED } from '$lib/modules/meditate/collections';
import { SLEEP_GUEST_SEED } from '$lib/modules/sleep/collections';
import { MOOD_GUEST_SEED } from '$lib/modules/mood/collections';
import { QUIZ_GUEST_SEED } from '$lib/modules/quiz/collections';
import { WISHES_GUEST_SEED } from '$lib/modules/wishes/collections';
import { AUGUR_GUEST_SEED } from '$lib/modules/augur/collections';

/**
 * Flat list of { tableName, rows } entries. Only modules with non-empty
 * seed arrays are listed — modules whose GUEST_SEED has only empty
 * arrays (e.g. calc, storage, finance) are omitted because there's
 * nothing to insert.
 */
const MODULE_SEEDS: { table: string; rows: Record<string, unknown>[] }[] = [];

function register(seed: Record<string, Record<string, unknown>[]>) {
	for (const [table, rows] of Object.entries(seed)) {
		if (rows.length > 0) {
			MODULE_SEEDS.push({ table, rows });
		}
	}
}

// Register all module seeds
register(HABITS_GUEST_SEED);
register(BODY_GUEST_SEED);
register(JOURNAL_GUEST_SEED);
register(DREAMS_GUEST_SEED);
register(CONTACTS_GUEST_SEED);
register(CALENDAR_GUEST_SEED);
register(CHAT_GUEST_SEED);
register(SKILLTREE_GUEST_SEED);
register(TODO_GUEST_SEED);
register(NOTES_GUEST_SEED);
register(TIMES_GUEST_SEED);
register(DRINK_GUEST_SEED);
register(RECIPES_GUEST_SEED);
register(STRETCH_GUEST_SEED);
register(MEDITATE_GUEST_SEED);
register(SLEEP_GUEST_SEED);
register(MOOD_GUEST_SEED);
register(QUIZ_GUEST_SEED);
register(WISHES_GUEST_SEED);
register(AUGUR_GUEST_SEED);

/**
 * Seed all module guest data into empty tables. Idempotent: tables
 * that already have rows are skipped. Called once during
 * `manaStore.initialize()`.
 */
export async function seedAllGuestData(): Promise<void> {
	for (const { table, rows } of MODULE_SEEDS) {
		try {
			const count = await db.table(table).count();
			if (count === 0) {
				await db.table(table).bulkPut(rows);
			}
		} catch (err) {
			// Non-fatal: seed failure shouldn't block app startup.
			// The table might not exist yet (schema drift) or the DB
			// might be in a read-only state (quota exceeded).
			console.debug(`[seed-registry] failed to seed ${table}:`, err);
		}
	}
}
