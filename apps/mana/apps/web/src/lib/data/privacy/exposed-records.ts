/**
 * Visibility overview helpers — read-side aggregator for the
 * /settings privacy section.
 *
 * Walks every visibility-aware Dexie table and returns a flat list of
 * records currently flipped to 'public' or 'unlisted', so the user has
 * a single dashboard to audit "what am I exposing right now". Pairs
 * with `setRecordVisibility` for one-click downgrade and
 * `resetAllPublicToSpace` for the kill-switch.
 *
 * Adding a new visibility-aware module: append to TABLES below.
 * The reader is generic — it just needs to know the collection name,
 * the title-extraction strategy, and the fixer (which downgrade
 * action to call).
 */

import { db } from '$lib/data/database';
import { decryptRecords } from '$lib/data/crypto';
import { emitDomainEvent } from '$lib/data/events';
import { getEffectiveUserId } from '$lib/data/current-user';
import type { VisibilityLevel } from '@mana/shared-privacy';

export interface ExposedRecord {
	module: string;
	moduleLabel: string;
	collection: string;
	id: string;
	title: string;
	visibility: 'public' | 'unlisted';
	unlistedToken?: string;
	/** Best-effort module route the user can open to manage the record. */
	openHref?: string;
}

interface TableConfig {
	module: string;
	collection: string;
	moduleLabel: string;
	/** True when the table holds encrypted user content needing decrypt. */
	encrypted: boolean;
	/** Pull a human-readable label out of the (possibly decrypted) row. */
	title: (row: Record<string, unknown>) => string;
	/** Build a deep-link to the record. */
	href?: (id: string) => string;
	/**
	 * Invoke the module's setVisibility flow. We dynamic-import the
	 * store so the settings page doesn't pay the bundle cost upfront.
	 */
	setVisibility: (id: string, next: VisibilityLevel) => Promise<unknown>;
}

function asString(v: unknown, fallback = 'Ohne Titel'): string {
	if (typeof v === 'string' && v.trim().length > 0) return v.trim();
	return fallback;
}

const TABLES: TableConfig[] = [
	{
		module: 'library',
		collection: 'libraryEntries',
		moduleLabel: 'Bibliothek',
		encrypted: true,
		title: (r) => asString(r.title),
		href: (id) => `/library/entry/${id}`,
		setVisibility: async (id, next) => {
			const { libraryEntriesStore } = await import('$lib/modules/library/stores/entries.svelte');
			return libraryEntriesStore.setVisibility(id, next);
		},
	},
	{
		module: 'picture',
		collection: 'boards',
		moduleLabel: 'Bilder (Boards)',
		encrypted: false,
		title: (r) => asString(r.name ?? r.title),
		href: (id) => `/picture/board/${id}`,
		setVisibility: async (id, next) => {
			const { boardsStore } = await import('$lib/modules/picture/stores/boards.svelte');
			return boardsStore.setVisibility(id, next);
		},
	},
	{
		module: 'calendar',
		collection: 'events',
		moduleLabel: 'Kalender',
		encrypted: true,
		title: (r) => asString(r.title),
		href: (id) => `/calendar/event/${id}`,
		setVisibility: async (id, next) => {
			const { eventsStore } = await import('$lib/modules/calendar/stores/events.svelte');
			return eventsStore.setVisibility(id, next);
		},
	},
	{
		module: 'todo',
		collection: 'tasks',
		moduleLabel: 'Aufgaben',
		encrypted: true,
		title: (r) => asString(r.title),
		href: () => '/todo',
		setVisibility: async (id, next) => {
			const { tasksStore } = await import('$lib/modules/todo/stores/tasks.svelte');
			return tasksStore.setVisibility(id, next);
		},
	},
	{
		module: 'goals',
		collection: 'goals',
		moduleLabel: 'Ziele',
		encrypted: false,
		title: (r) => asString(r.title),
		href: () => '/goals',
		setVisibility: async (id, next) => {
			const { goalStore } = await import('$lib/companion/goals/store');
			return goalStore.setVisibility(id, next);
		},
	},
	{
		module: 'places',
		collection: 'places',
		moduleLabel: 'Orte',
		encrypted: true,
		title: (r) => asString(r.name),
		href: (id) => `/places/place/${id}`,
		setVisibility: async (id, next) => {
			const { placesStore } = await import('$lib/modules/places/stores/places.svelte');
			return placesStore.setVisibility(id, next);
		},
	},
	{
		module: 'recipes',
		collection: 'recipes',
		moduleLabel: 'Rezepte',
		encrypted: true,
		title: (r) => asString(r.title),
		href: () => '/recipes',
		setVisibility: async (id, next) => {
			const { recipesStore } = await import('$lib/modules/recipes/stores/recipes.svelte');
			return recipesStore.setVisibility(id, next);
		},
	},
	{
		module: 'comic',
		collection: 'comicStories',
		moduleLabel: 'Comics',
		encrypted: true,
		title: (r) => asString(r.title),
		href: () => '/comic',
		setVisibility: async (id, next) => {
			const { comicStoriesStore } = await import('$lib/modules/comic/stores/stories.svelte');
			return comicStoriesStore.setVisibility(id, next);
		},
	},
	{
		module: 'habits',
		collection: 'habits',
		moduleLabel: 'Habits',
		encrypted: true,
		title: (r) => asString(r.title),
		href: () => '/habits',
		setVisibility: async (id, next) => {
			const { habitsStore } = await import('$lib/modules/habits/stores/habits.svelte');
			return habitsStore.setVisibility(id, next);
		},
	},
	{
		module: 'quiz',
		collection: 'quizzes',
		moduleLabel: 'Quizze',
		encrypted: true,
		title: (r) => asString(r.title),
		href: (id) => `/quiz/${id}/edit`,
		setVisibility: async (id, next) => {
			const { quizzesStore } = await import('$lib/modules/quiz/stores/quizzes.svelte');
			return quizzesStore.setVisibility(id, next);
		},
	},
	{
		module: 'events',
		collection: 'socialEvents',
		moduleLabel: 'Events (RSVP)',
		encrypted: true,
		title: (r) => asString(r.title),
		href: (id) => `/events/${id}`,
		setVisibility: async (id, next) => {
			const { eventsStore } = await import('$lib/modules/events/stores/events.svelte');
			return eventsStore.setVisibility(id, next);
		},
	},
	{
		module: 'presi',
		collection: 'presiDecks',
		moduleLabel: 'Präsentationen',
		encrypted: true,
		title: (r) => asString(r.title),
		href: (id) => `/presi/deck/${id}`,
		setVisibility: async (id, next) => {
			const { decksStore } = await import('$lib/modules/presi/stores/decks.svelte');
			return decksStore.setVisibility(id, next);
		},
	},
	{
		module: 'augur',
		collection: 'augurEntries',
		moduleLabel: 'Augur (Omen / Wahrsagungen)',
		encrypted: true,
		title: (r) => asString(r.claim),
		href: (id) => `/augur/entry/${id}`,
		setVisibility: async (id, next) => {
			const { augurStore } = await import('$lib/modules/augur/stores/entries.svelte');
			return augurStore.setVisibility(id, next);
		},
	},
];

/**
 * Walk every visibility-aware table and return all records currently
 * flipped to 'public' or 'unlisted'. Decrypts encrypted titles so the
 * user can recognize what they're looking at.
 */
export async function listExposedRecords(): Promise<ExposedRecord[]> {
	const out: ExposedRecord[] = [];

	for (const cfg of TABLES) {
		try {
			const all = await db.table(cfg.collection).toArray();
			const exposed = all.filter(
				(r: Record<string, unknown>) =>
					!r.deletedAt && (r.visibility === 'public' || r.visibility === 'unlisted')
			);
			if (exposed.length === 0) continue;

			const rows = cfg.encrypted
				? ((await decryptRecords(cfg.collection, exposed)) as Record<string, unknown>[])
				: exposed;

			for (const row of rows) {
				const id = String(row.id ?? '');
				if (!id) continue;
				out.push({
					module: cfg.module,
					moduleLabel: cfg.moduleLabel,
					collection: cfg.collection,
					id,
					title: cfg.title(row),
					visibility: row.visibility as 'public' | 'unlisted',
					unlistedToken: row.unlistedToken as string | undefined,
					openHref: cfg.href?.(id),
				});
			}
		} catch (e) {
			// Don't let one broken module take down the whole overview.
			console.warn(`[privacy] reading ${cfg.collection} failed`, e);
		}
	}

	return out.sort((a, b) => a.module.localeCompare(b.module) || a.title.localeCompare(b.title));
}

/**
 * Downgrade a single record to 'space' via its module's setVisibility
 * flow — preserves the proper revoke-server-snapshot behavior for
 * unlisted records (calendar/library/places).
 */
export async function setRecordVisibility(
	collection: string,
	id: string,
	next: VisibilityLevel
): Promise<void> {
	const cfg = TABLES.find((t) => t.collection === collection);
	if (!cfg) {
		// Generic fallback — write directly so unknown collections still
		// move out of public when the kill-switch fires.
		const stamp = new Date().toISOString();
		await db.table(collection).update(id, {
			visibility: next,
			visibilityChangedAt: stamp,
			visibilityChangedBy: getEffectiveUserId(),
			updatedAt: stamp,
		});
		emitDomainEvent('VisibilityChanged', collection, collection, id, {
			recordId: id,
			collection,
			before: 'unknown',
			after: next,
		});
		return;
	}
	await cfg.setVisibility(id, next);
}

/**
 * Kill-switch: flip every public/unlisted record back to 'space' in
 * one shot. Errors on individual records are logged but don't abort
 * the sweep — the user expects "make me private" to be best-effort
 * thorough, not a transaction.
 */
export async function resetAllExposedToSpace(): Promise<{ flipped: number; failed: number }> {
	const exposed = await listExposedRecords();
	let flipped = 0;
	let failed = 0;
	for (const rec of exposed) {
		try {
			await setRecordVisibility(rec.collection, rec.id, 'space');
			flipped++;
		} catch (e) {
			failed++;
			console.error(`[privacy] reset ${rec.collection}/${rec.id} failed`, e);
		}
	}
	return { flipped, failed };
}

export const VISIBILITY_AWARE_MODULE_COUNT = TABLES.length;
