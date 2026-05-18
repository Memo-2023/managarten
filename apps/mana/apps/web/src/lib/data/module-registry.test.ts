/**
 * Module registry validation tests.
 *
 * These tests are the safety net behind the per-module config refactor:
 * if someone adds a new sync table to a module config but forgets to add
 * the matching index in `database.ts` (or vice versa), one of these tests
 * fails loudly instead of letting sync silently drop the table.
 *
 * The "snapshot" tests pin the *exact* registry shape that exists today.
 * Any intentional change to a module's tables / sync names should update
 * both the module config AND the corresponding entry below in the same
 * commit — this makes such changes visible in code review.
 *
 * Last full snapshot refresh: 2026-05-18 (food + wardrobe module retirement;
 * citycorners + cards modules already retired before).
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
// These hold local-only state (sync metadata, retry queues, activity log,
// AI debug capture, BYOK key material, …) that must never leave the device.
const INTERNAL_TABLES = new Set([
	'_pendingChanges',
	'_syncMeta',
	'_eventsTombstones',
	'_activity',
	'_events',
	'_memory',
	'_streakState',
	'_aiDebugLog',
	'_byokKeys',
	'_clientIdentity',
	'_nudgeOutcomes',
	'_serverIterationExecutions',
	// Local-only AI Workbench staging; approvals run the underlying tool
	// which writes via its module's sync path — proposals themselves never
	// leave the device.
	'pendingProposals',
]);

// ─── Dexie tables that survive in the schema for backwards-compat with
// existing user databases, but whose owning module has been retired and
// is no longer expected to register them. These rows are stranded until
// a future Dexie version() call drops them explicitly. Tracked here so
// the "every Dexie table is registered" guard doesn't break on legacy
// schema history.
const LEGACY_TABLES = new Set([
	// Cards → wordeck.com (2026-05-17 rebrand)
	'cardDecks',
	'cards',
	'deckTags',
	'cardReviews',
	'cardStudyBlocks',
	// CityCorners → seepuls.mana.how (2026-05 retired)
	'cities',
	'ccLocations',
	'ccFavorites',
	'ccLocationTags',
	// Moodlit → mood module split (legacy tables still in Dexie history)
	'moods',
	'sequences',
	'moodTags',
	// Companion module — surfaces still live but tables predate the
	// per-module registry refactor; tracked in the agents/missions registry
	// today.
	'companionConversations',
	'companionGoals',
	'companionMessages',
	// Rituals — local-only state for the AI Workbench ritual runner; not
	// yet promoted into a module config but writes happen via the workbench
	// pathway.
	'rituals',
	'ritualSteps',
	'ritualLogs',
	// Wishes — module surface exists, registry adoption pending.
	'wishesItems',
	'wishesLists',
	'wishesPriceChecks',
	// User-level legacy table from the v40 tag-preset migration; lives
	// outside the module-registry by design (cross-module shared shape).
	'userTagPresets',
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

	it('every Dexie table is either internal, legacy, or registered with an appId', () => {
		const registered = new Set(Object.keys(TABLE_TO_APP));
		for (const t of db.tables) {
			if (INTERNAL_TABLES.has(t.name)) continue;
			if (LEGACY_TABLES.has(t.name)) continue;
			expect(
				registered.has(t.name),
				`Dexie table "${t.name}" is not registered in any module.config.ts — sync will silently skip it`
			).toBe(true);
		}
	});
});

// ─── Snapshot of the registry shape ───────────────────────────────
//
// Exact (appId → tables) and (unified → sync) shape of the current registry.
// If you intentionally change a module's sync surface, update the matching
// entry here in the same commit so the change is reviewable.

describe('module-registry — snapshot', () => {
	it('SYNC_APP_MAP matches the current registry shape', () => {
		expect(SYNC_APP_MAP).toEqual({
			mana: ['userSettings', 'dashboardConfigs', 'workbenchScenes', 'automations'],
			tags: ['globalTags', 'tagGroups'],
			links: ['manaLinks'],
			timeblocks: ['timeBlocks', 'timeBlockTags'],
			todo: ['tasks', 'todoProjects', 'taskLabels', 'reminders', 'boardViews'],
			calendar: ['calendars', 'events', 'eventTags'],
			contacts: ['contacts', 'contactTags'],
			chat: ['conversations', 'messages', 'chatTemplates', 'conversationTags'],
			picture: ['images', 'boards', 'boardItems', 'imageTags'],
			quotes: ['quotesFavorites', 'quotesLists', 'quotesListTags', 'customQuotes'],
			music: ['songs', 'mukkePlaylists', 'playlistSongs', 'mukkeProjects', 'markers', 'songTags'],
			storage: ['files', 'storageFolders', 'fileTags'],
			presi: ['presiDecks', 'slides', 'presiDeckTags'],
			inventory: ['invCollections', 'invItems', 'invLocations', 'invCategories', 'invItemTags'],
			photos: ['albums', 'albumItems', 'photoFavorites', 'photoMediaTags'],
			skilltree: ['skills', 'activities', 'achievements', 'skillTags'],
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
			uload: ['links', 'uloadTags', 'uloadFolders', 'linkTags'],
			calc: ['calculations', 'savedFormulas'],
			guides: ['guides', 'sections', 'steps', 'guideCollections', 'runs', 'guideTags'],
			habits: ['habits', 'habitLogs'],
			notes: ['notes', 'noteTags'],
			journal: ['journalEntries'],
			dreams: ['dreams', 'dreamSymbols', 'dreamTags'],
			period: ['periods', 'periodDayLogs', 'periodSymptoms'],
			events: ['socialEvents', 'eventGuests', 'eventInvitations', 'eventItems'],
			finance: ['transactions', 'financeCategories', 'budgets'],
			places: ['places', 'locationLogs', 'placeTags'],
			playground: ['playgroundSnippets', 'playgroundConversations', 'playgroundMessages'],
			body: [
				'bodyExercises',
				'bodyRoutines',
				'bodyWorkouts',
				'bodySets',
				'bodyMeasurements',
				'bodyChecks',
				'bodyPhases',
			],
			firsts: ['firsts'],
			lasts: ['lasts', 'lastsCooldown'],
			drink: ['drinkEntries', 'drinkPresets'],
			recipes: ['recipes'],
			stretch: [
				'stretchExercises',
				'stretchRoutines',
				'stretchSessions',
				'stretchAssessments',
				'stretchReminders',
			],
			mail: ['mailDrafts'],
			meditate: ['meditatePresets', 'meditateSessions', 'meditateSettings'],
			sleep: ['sleepEntries', 'sleepHygieneLogs', 'sleepHygieneChecks', 'sleepSettings'],
			mood: ['moodEntries', 'moodSettings'],
			quiz: ['quizzes', 'quizQuestions', 'quizAttempts'],
			profile: ['userContext', 'meImages'],
			library: ['libraryEntries'],
			articles: [
				'articles',
				'articleHighlights',
				'articleTags',
				'articleImportJobs',
				'articleImportItems',
				'articleExtractPickup',
			],
			invoices: ['invoices', 'invoiceClients', 'invoiceSettings'],
			broadcasts: ['broadcastCampaigns', 'broadcastTemplates', 'broadcastSettings'],
			wetter: ['wetterLocations', 'wetterSettings'],
			website: ['websites', 'websitePages', 'websiteBlocks'],
			writing: ['writingDrafts', 'writingDraftVersions', 'writingGenerations', 'writingStyles'],
			augur: ['augurEntries'],
			forms: ['forms', 'formResponses'],
			ai: ['aiMissions', 'agents', 'agentKontextDocs'],
		});
	});

	it('TABLE_TO_SYNC_NAME matches the current registry shape', () => {
		expect(TABLE_TO_SYNC_NAME).toEqual({
			globalTags: 'tags',
			manaLinks: 'links',
			todoProjects: 'projects',
			chatTemplates: 'templates',
			quotesFavorites: 'favorites',
			quotesLists: 'lists',
			customQuotes: 'custom-quotes',
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
			timeClients: 'clients',
			timeProjects: 'projects',
			timeTemplates: 'templates',
			timeSettings: 'settings',
			timeAlarms: 'alarms',
			timeCountdownTimers: 'countdownTimers',
			timeWorldClocks: 'worldClocks',
			qCollections: 'collections',
			uloadTags: 'tags',
			uloadFolders: 'folders',
			guideCollections: 'collections',
			socialEvents: 'events',
			financeCategories: 'categories',
			playgroundSnippets: 'snippets',
			playgroundConversations: 'conversations',
			playgroundMessages: 'messages',
			quizQuestions: 'questions',
			quizAttempts: 'attempts',
			articleHighlights: 'highlights',
			articleImportJobs: 'importJobs',
			articleImportItems: 'importItems',
			articleExtractPickup: 'extractPickup',
			wetterLocations: 'locations',
			wetterSettings: 'settings',
		});
	});
});
