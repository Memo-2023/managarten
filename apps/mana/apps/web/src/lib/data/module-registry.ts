/**
 * Module Registry — Single source of truth for app/table/sync mappings.
 *
 * Each module declares its sync surface in a `module.config.ts` file. This
 * registry aggregates all configs and exposes derived maps that the rest of
 * the data layer (database.ts, sync.ts) consumes.
 *
 * Adding a new module = create one config file. The legacy hardcoded
 * SYNC_APP_MAP / TABLE_TO_SYNC_NAME blocks in database.ts are now generated
 * from this registry, so a single edit per module replaces edits in three
 * different places.
 *
 * Schema migrations (db.version(N).stores()) intentionally remain in
 * database.ts because they are versioned snapshots that must never change
 * after release — they are not derived from this registry.
 */

// ─── Types ─────────────────────────────────────────────────

/**
 * Declares one Dexie table that participates in sync.
 *
 * `name` is the unified Dexie table name (e.g., `todoProjects`). If the
 * backend (mana-sync) expects a different collection name, set `syncName`
 * (e.g., `projects`). Tables without a rename omit `syncName`.
 */
export interface SyncTableConfig {
	name: string;
	syncName?: string;
}

export interface ModuleConfig {
	/** Stable app identifier used for sync routing (POST /sync/{appId}). */
	appId: string;
	/** All Dexie tables owned by this module that should be tracked + synced. */
	tables: SyncTableConfig[];
}

// ─── Module Configs ────────────────────────────────────────
//
// Each entry is imported from a module's own `module.config.ts`. Modules
// without a config (purely UI / stateless, e.g. playground) are simply
// absent from this list.
//
// `core` is the home for cross-cutting tables that don't belong to any
// product module (mana settings, global tags, manaLinks, timeBlocks).

import {
	manaCoreConfig,
	tagsCoreConfig,
	linksCoreConfig,
	timeblocksCoreConfig,
} from '$lib/modules/core/module.config';
import { todoModuleConfig } from '$lib/modules/todo/module.config';
import { calendarModuleConfig } from '$lib/modules/calendar/module.config';
import { contactsModuleConfig } from '$lib/modules/contacts/module.config';
import { chatModuleConfig } from '$lib/modules/chat/module.config';
import { pictureModuleConfig } from '$lib/modules/picture/module.config';
import { cardsModuleConfig } from '$lib/modules/cards/module.config';
import { quotesModuleConfig } from '$lib/modules/quotes/module.config';
import { musicModuleConfig } from '$lib/modules/music/module.config';
import { storageModuleConfig } from '$lib/modules/storage/module.config';
import { presiModuleConfig } from '$lib/modules/presi/module.config';
import { inventoryModuleConfig } from '$lib/modules/inventory/module.config';
import { photosModuleConfig } from '$lib/modules/photos/module.config';
import { skilltreeModuleConfig } from '$lib/modules/skilltree/module.config';
import { citycornersModuleConfig } from '$lib/modules/citycorners/module.config';
import { timesModuleConfig } from '$lib/modules/times/module.config';
import { questionsModuleConfig } from '$lib/modules/questions/module.config';
import { foodModuleConfig } from '$lib/modules/food/module.config';
import { plantsModuleConfig } from '$lib/modules/plants/module.config';
import { uloadModuleConfig } from '$lib/modules/uload/module.config';
import { calcModuleConfig } from '$lib/modules/calc/module.config';
import { moodlitModuleConfig } from '$lib/modules/moodlit/module.config';
import { memoroModuleConfig } from '$lib/modules/memoro/module.config';
import { guidesModuleConfig } from '$lib/modules/guides/module.config';
import { habitsModuleConfig } from '$lib/modules/habits/module.config';
import { notesModuleConfig } from '$lib/modules/notes/module.config';
import { journalModuleConfig } from '$lib/modules/journal/module.config';
import { dreamsModuleConfig } from '$lib/modules/dreams/module.config';
import { periodModuleConfig } from '$lib/modules/period/module.config';
import { eventsModuleConfig } from '$lib/modules/events/module.config';
import { financeModuleConfig } from '$lib/modules/finance/module.config';
import { placesModuleConfig } from '$lib/modules/places/module.config';
import { playgroundModuleConfig } from '$lib/modules/playground/module.config';
import { newsModuleConfig } from '$lib/modules/news/module.config';
import { bodyModuleConfig } from '$lib/modules/body/module.config';
import { firstsModuleConfig } from '$lib/modules/firsts/module.config';
import { lastsModuleConfig } from '$lib/modules/lasts/module.config';
import { drinkModuleConfig } from '$lib/modules/drink/module.config';
import { recipesModuleConfig } from '$lib/modules/recipes/module.config';
import { stretchModuleConfig } from '$lib/modules/stretch/module.config';
import { mailModuleConfig } from '$lib/modules/mail/module.config';
import { meditateModuleConfig } from '$lib/modules/meditate/module.config';
import { sleepModuleConfig } from '$lib/modules/sleep/module.config';
import { moodModuleConfig } from '$lib/modules/mood/module.config';
import { quizModuleConfig } from '$lib/modules/quiz/module.config';
import { profileModuleConfig } from '$lib/modules/profile/module.config';
import { libraryModuleConfig } from '$lib/modules/library/module.config';
import { articlesModuleConfig } from '$lib/modules/articles/module.config';
import { invoicesModuleConfig } from '$lib/modules/invoices/module.config';
import { broadcastModuleConfig } from '$lib/modules/broadcasts/module.config';
import { wetterModuleConfig } from '$lib/modules/wetter/module.config';
import { websiteModuleConfig } from '$lib/modules/website/module.config';
import { wardrobeModuleConfig } from '$lib/modules/wardrobe/module.config';
import { writingModuleConfig } from '$lib/modules/writing/module.config';
import { comicModuleConfig } from '$lib/modules/comic/module.config';
import { augurModuleConfig } from '$lib/modules/augur/module.config';
import { formsModuleConfig } from '$lib/modules/forms/module.config';
import { aiModuleConfig } from '$lib/data/ai/module.config';

export const MODULE_CONFIGS: readonly ModuleConfig[] = [
	manaCoreConfig,
	tagsCoreConfig,
	linksCoreConfig,
	timeblocksCoreConfig,
	todoModuleConfig,
	calendarModuleConfig,
	contactsModuleConfig,
	chatModuleConfig,
	pictureModuleConfig,
	cardsModuleConfig,
	quotesModuleConfig,
	musicModuleConfig,
	storageModuleConfig,
	presiModuleConfig,
	inventoryModuleConfig,
	photosModuleConfig,
	skilltreeModuleConfig,
	citycornersModuleConfig,
	timesModuleConfig,
	questionsModuleConfig,
	foodModuleConfig,
	plantsModuleConfig,
	uloadModuleConfig,
	calcModuleConfig,
	moodlitModuleConfig,
	memoroModuleConfig,
	guidesModuleConfig,
	habitsModuleConfig,
	notesModuleConfig,
	journalModuleConfig,
	dreamsModuleConfig,
	periodModuleConfig,
	eventsModuleConfig,
	financeModuleConfig,
	placesModuleConfig,
	playgroundModuleConfig,
	newsModuleConfig,
	bodyModuleConfig,
	firstsModuleConfig,
	lastsModuleConfig,
	drinkModuleConfig,
	recipesModuleConfig,
	stretchModuleConfig,
	mailModuleConfig,
	meditateModuleConfig,
	sleepModuleConfig,
	moodModuleConfig,
	quizModuleConfig,
	profileModuleConfig,
	libraryModuleConfig,
	articlesModuleConfig,
	invoicesModuleConfig,
	broadcastModuleConfig,
	wetterModuleConfig,
	websiteModuleConfig,
	wardrobeModuleConfig,
	writingModuleConfig,
	comicModuleConfig,
	augurModuleConfig,
	formsModuleConfig,
	aiModuleConfig,
];

// ─── Derived Maps ──────────────────────────────────────────

/**
 * appId → list of unified Dexie table names. Mirrors the legacy
 * `SYNC_APP_MAP` shape so existing consumers (sync.ts) need no changes.
 */
export const SYNC_APP_MAP: Record<string, string[]> = (() => {
	const map: Record<string, string[]> = {};
	for (const mod of MODULE_CONFIGS) {
		if (map[mod.appId]) {
			throw new Error(
				`[module-registry] duplicate appId "${mod.appId}" — two module configs share the same id`
			);
		}
		map[mod.appId] = mod.tables.map((t) => t.name);
	}
	return map;
})();

/**
 * Unified Dexie table name → backend sync collection name.
 * Only tables that need a rename are present.
 */
export const TABLE_TO_SYNC_NAME: Record<string, string> = (() => {
	const map: Record<string, string> = {};
	for (const mod of MODULE_CONFIGS) {
		for (const t of mod.tables) {
			if (t.syncName && t.syncName !== t.name) {
				map[t.name] = t.syncName;
			}
		}
	}
	return map;
})();

/**
 * Reverse map: unified table name → owning appId. Built once at startup;
 * used by the Dexie hooks to tag pending changes with the correct appId.
 */
export const TABLE_TO_APP: Record<string, string> = (() => {
	const map: Record<string, string> = {};
	for (const mod of MODULE_CONFIGS) {
		for (const t of mod.tables) {
			if (map[t.name]) {
				throw new Error(
					`[module-registry] table "${t.name}" is registered by both "${map[t.name]}" and "${mod.appId}"`
				);
			}
			map[t.name] = mod.appId;
		}
	}
	return map;
})();

/** Get the backend collection name for a unified table. */
export function toSyncName(tableName: string): string {
	return TABLE_TO_SYNC_NAME[tableName] ?? tableName;
}

/**
 * Per-app reverse map: backend collection name → unified table name.
 * Used when applying server changes pulled per appId.
 */
export const SYNC_NAME_TO_TABLE: Record<string, Record<string, string>> = (() => {
	const out: Record<string, Record<string, string>> = {};
	for (const [appId, tables] of Object.entries(SYNC_APP_MAP)) {
		const map: Record<string, string> = {};
		for (const tableName of tables) {
			map[toSyncName(tableName)] = tableName;
		}
		out[appId] = map;
	}
	return out;
})();

/** Get the unified table name for a backend collection + appId. */
export function fromSyncName(appId: string, syncCollection: string): string {
	return SYNC_NAME_TO_TABLE[appId]?.[syncCollection] ?? syncCollection;
}
