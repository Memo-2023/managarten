/**
 * Module registry validation tests.
 *
 * These tests are the safety net behind the per-module config refactor:
 * if someone adds a new sync table to a module config but forgets to add
 * the matching index in `database.ts` (or vice versa), one of these tests
 * fails loudly instead of letting sync silently drop the table.
 *
 * The "snapshot" tests pin the *exact* registry shape that existed before
 * the refactor. Any intentional change to a module's tables / sync names
 * should update both the module config AND the corresponding entry below
 * in the same commit — this makes such changes visible in code review.
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, vi } from 'vitest';

// Same Dexie-hook side-effect stubs as sync.test.ts so importing
// database.ts doesn't pull in unrelated runtime modules.
vi.mock('$lib/stores/funnel-tracking', () => ({ trackFirstContent: vi.fn() }));
vi.mock('$lib/triggers/registry', () => ({ fire: vi.fn() }));
vi.mock('$lib/triggers/inline-suggest', () => ({
	checkInlineSuggestion: vi.fn().mockResolvedValue(null),
}));

import {
	SYNC_APP_MAP,
	TABLE_TO_SYNC_NAME,
	TABLE_TO_APP,
	SYNC_NAME_TO_TABLE,
	toSyncName,
	fromSyncName,
	MODULE_CONFIGS,
} from './module-registry';
import { db } from './database';

// ─── Internal Dexie tables that are intentionally NOT in SYNC_APP_MAP ───
// These hold local-only state (sync metadata, retry queues, activity log)
// that must never leave the device.
const INTERNAL_TABLES = new Set([
	'_pendingChanges',
	'_syncMeta',
	'_eventsTombstones',
	'_activity',
	// Local-only AI Workbench staging; approvals run the underlying tool
	// which writes via its module's sync path — proposals themselves never
	// leave the device.
	'pendingProposals',
]);

describe('module-registry — structural invariants', () => {
	it('every appId is unique across module configs', () => {
		const seen = new Set<string>();
		for (const mod of MODULE_CONFIGS) {
			expect(seen.has(mod.appId), `duplicate appId: ${mod.appId}`).toBe(false);
			seen.add(mod.appId);
		}
	});

	it('every table name is owned by exactly one module', () => {
		const owners = new Map<string, string>();
		for (const mod of MODULE_CONFIGS) {
			for (const t of mod.tables) {
				const existing = owners.get(t.name);
				expect(
					existing,
					`table "${t.name}" registered by both "${existing}" and "${mod.appId}"`
				).toBeUndefined();
				owners.set(t.name, mod.appId);
			}
		}
	});

	it('TABLE_TO_APP covers every registered table', () => {
		for (const [appId, tables] of Object.entries(SYNC_APP_MAP)) {
			for (const t of tables) {
				expect(TABLE_TO_APP[t], `${t} missing from TABLE_TO_APP`).toBe(appId);
			}
		}
	});

	it('TABLE_TO_SYNC_NAME never maps a table to itself (would be a no-op)', () => {
		for (const [unified, sync] of Object.entries(TABLE_TO_SYNC_NAME)) {
			expect(unified, `${unified} maps to itself in TABLE_TO_SYNC_NAME`).not.toBe(sync);
		}
	});

	it('toSyncName / fromSyncName round-trip for every renamed table', () => {
		for (const [unified] of Object.entries(TABLE_TO_SYNC_NAME)) {
			const appId = TABLE_TO_APP[unified];
			expect(appId, `no appId for ${unified}`).toBeDefined();
			const sync = toSyncName(unified);
			expect(fromSyncName(appId, sync)).toBe(unified);
		}
	});

	it('SYNC_NAME_TO_TABLE has an entry for every sync app', () => {
		for (const appId of Object.keys(SYNC_APP_MAP)) {
			expect(SYNC_NAME_TO_TABLE[appId]).toBeDefined();
		}
	});
});

describe('module-registry — Dexie schema alignment', () => {
	it('every sync-tracked table exists as a real Dexie table', () => {
		const dexieTables = new Set(db.tables.map((t) => t.name));
		for (const [appId, tables] of Object.entries(SYNC_APP_MAP)) {
			for (const t of tables) {
				expect(
					dexieTables.has(t),
					`SYNC_APP_MAP[${appId}] references "${t}" but no such Dexie table exists`
				).toBe(true);
			}
		}
	});

	it('every Dexie table is either internal or registered with an appId', () => {
		const registered = new Set(Object.keys(TABLE_TO_APP));
		for (const t of db.tables) {
			if (INTERNAL_TABLES.has(t.name)) continue;
			expect(
				registered.has(t.name),
				`Dexie table "${t.name}" is not registered in any module.config.ts — sync will silently skip it`
			).toBe(true);
		}
	});
});

// ─── Snapshot of the registry shape ───────────────────────────────
//
// This is the exact set of (appId → tables) and (unified → sync) mappings
// that the legacy hardcoded blocks in database.ts had pre-refactor. If you
// intentionally change a module's sync surface, update the matching entry
// here in the same commit so the change is reviewable.

describe('module-registry — pre-refactor snapshot', () => {
	it('SYNC_APP_MAP matches the legacy hardcoded shape', () => {
		expect(SYNC_APP_MAP).toEqual({
			mana: ['userSettings', 'dashboardConfigs', 'automations'],
			todo: ['tasks', 'todoProjects', 'taskLabels', 'reminders', 'boardViews'],
			calendar: ['calendars', 'events', 'eventTags'],
			contacts: ['contacts', 'contactTags'],
			chat: ['conversations', 'messages', 'chatTemplates', 'conversationTags'],
			picture: ['images', 'boards', 'boardItems', 'imageTags'],
			cards: ['cardDecks', 'cards', 'deckTags'],
			quotes: ['quotesFavorites', 'quotesLists', 'quotesListTags'],
			music: ['songs', 'mukkePlaylists', 'playlistSongs', 'mukkeProjects', 'markers', 'songTags'],
			storage: ['files', 'storageFolders', 'fileTags'],
			presi: ['presiDecks', 'slides', 'presiDeckTags'],
			inventory: ['invCollections', 'invItems', 'invLocations', 'invCategories', 'invItemTags'],
			photos: ['albums', 'albumItems', 'photoFavorites', 'photoMediaTags'],
			skilltree: ['skills', 'activities', 'achievements', 'skillTags'],
			citycorners: ['cities', 'ccLocations', 'ccFavorites', 'ccLocationTags'],
			times: [
				'timeClients',
				'timeProjects',
				'timeEntries',
				'timeTemplates',
				'timeSettings',
				'timeAlarms',
				'timeCountdownTimers',
				'timeWorldClocks',
				'entryTags',
			],
			questions: ['qCollections', 'questions', 'answers', 'questionTags'],
			food: ['meals', 'goals', 'foodFavorites', 'mealTags'],
			plants: ['plants', 'plantPhotos', 'wateringSchedules', 'wateringLogs', 'plantTags'],
			uload: ['links', 'uloadTags', 'uloadFolders', 'linkTags'],
			calc: ['calculations', 'savedFormulas'],
			moodlit: ['moods', 'sequences', 'moodTags'],
			memoro: ['memos', 'memories', 'memoTags', 'memoroSpaces', 'spaceMembers', 'memoSpaces'],
			guides: ['guides', 'sections', 'steps', 'guideCollections', 'runs', 'guideTags'],
			habits: ['habits', 'habitLogs'],
			notes: ['notes', 'noteTags'],
			dreams: ['dreams', 'dreamSymbols', 'dreamTags'],
			period: ['periods', 'periodDayLogs', 'periodSymptoms'],
			events: ['socialEvents', 'eventGuests', 'eventInvitations', 'eventItems'],
			finance: ['transactions', 'financeCategories', 'budgets'],
			places: ['places', 'locationLogs', 'placeTags'],
			tags: ['globalTags', 'tagGroups'],
			links: ['manaLinks'],
			timeblocks: ['timeBlocks', 'timeBlockTags'],
		});
	});

	it('TABLE_TO_SYNC_NAME matches the legacy hardcoded shape', () => {
		expect(TABLE_TO_SYNC_NAME).toEqual({
			todoProjects: 'projects',
			chatTemplates: 'templates',
			cardDecks: 'decks',
			quotesFavorites: 'favorites',
			quotesLists: 'lists',
			mukkePlaylists: 'playlists',
			mukkeProjects: 'projects',
			storageFolders: 'folders',
			presiDecks: 'decks',
			invCollections: 'collections',
			invItems: 'items',
			invLocations: 'locations',
			invCategories: 'categories',
			photoFavorites: 'favorites',
			photoMediaTags: 'photoTags',
			ccLocations: 'locations',
			ccFavorites: 'favorites',
			timeClients: 'clients',
			timeProjects: 'projects',
			timeTemplates: 'templates',
			timeSettings: 'settings',
			timeAlarms: 'alarms',
			timeCountdownTimers: 'countdownTimers',
			timeWorldClocks: 'worldClocks',
			qCollections: 'collections',
			foodFavorites: 'favorites',
			memoroSpaces: 'spaces',
			uloadTags: 'tags',
			uloadFolders: 'folders',
			guideCollections: 'collections',
			financeCategories: 'categories',
			socialEvents: 'events',
			globalTags: 'tags',
			// `tagGroups` is intentionally absent — it has no rename in the registry
			// (the legacy hardcoded block had a redundant tagGroups→tagGroups entry
			// which was a no-op; toSyncName() returns the same value either way).
			manaLinks: 'links',
		});
	});
});
