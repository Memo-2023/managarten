/**
 * Unified Dexie Database — Single IndexedDB for all Mana apps.
 *
 * All collections from all app modules are registered in one database.
 * Table names that collide across apps are prefixed (e.g., pictureTags, storageTags).
 *
 * Sync routing (which table belongs to which appId, which tables are renamed
 * for the backend) lives in `module-registry.ts`. Each module owns its own
 * `module.config.ts` and the registry aggregates them — so adding a new
 * module is one file edit, not three.
 *
 * Schema migrations (db.version(N).stores()) intentionally remain hardcoded
 * here because they are versioned snapshots that must never change after
 * shipping — they are not derived from the registry.
 */

import Dexie, { type EntityTable } from 'dexie';
import { trackFirstContent } from '$lib/stores/funnel-tracking';
import { fire as fireTrigger } from '$lib/triggers/registry';
import { checkInlineSuggestion } from '$lib/triggers/inline-suggest';
import { getEffectiveUserId, GUEST_USER_ID } from './current-user';
import { getEffectiveSpaceId } from './scope/active-space.svelte';
import { getCurrentActor, makeFieldMeta, originFromActor } from './events/actor';
import type { Actor, FieldMeta } from './events/actor';
import { isQuotaError, notifyQuotaExceeded } from './quota-detect';
import {
	SYNC_APP_MAP,
	TABLE_TO_SYNC_NAME,
	TABLE_TO_APP,
	SYNC_NAME_TO_TABLE,
	toSyncName,
	fromSyncName,
} from './module-registry';

// Re-export the registry-derived maps so existing consumers
// (sync.ts, quota.ts, guest-migration.ts, etc.) keep working unchanged.
export {
	SYNC_APP_MAP,
	TABLE_TO_SYNC_NAME,
	TABLE_TO_APP,
	SYNC_NAME_TO_TABLE,
	toSyncName,
	fromSyncName,
};

// ─── Database ──────────────────────────────────────────────

export const db = new Dexie('mana');

// Schema version 1 — the pre-launch canonical schema. Collapsed from
// historical v1–v10 during cleanup (see docs/PRE_LAUNCH_CLEANUP.md).
//
// IMPORTANT: this block is FROZEN. Any new tables MUST go into a new
// `db.version(N)` block below (currently v2=body, v3=who, v4=news).
// Adding tables here instead of in a new version causes silent schema
// drift: Dexie only runs the upgrade if the version number bumps, so
// existing IndexedDB instances would never see the new tables until
// the user clears storage.
db.version(1).stores({
	// ─── Sync Infrastructure (local-only, NOT in SYNC_APP_MAP) ───
	_pendingChanges: '++id, appId, collection, recordId, createdAt',
	_syncMeta: '[appId+collection]',
	_eventsTombstones: 'id, token, attempts, createdAt',
	_activity:
		'++id, createdAt, appId, collection, recordId, op, [appId+createdAt], [collection+recordId], userId',

	// ─── Core / Mana (appId: 'mana') ───
	userSettings: 'id, key',
	dashboardConfigs: 'id',
	workbenchScenes: 'id, order',
	automations: 'id, sourceApp, targetApp, enabled, [sourceApp+sourceCollection]',

	// ─── Todo (appId: 'todo') ───
	// `scheduledBlockId` is the link to the unified timeBlocks table.
	tasks:
		'id, dueDate, isCompleted, priority, order, projectId, scheduledBlockId, [isCompleted+order], [projectId+order]',
	todoProjects: 'id, order, isArchived, isDefault',
	taskLabels: 'id, taskId, labelId', // junction to globalTags (labelId = tagId)
	reminders: 'id, taskId',
	boardViews: 'id, order, groupBy',

	// ─── Calendar (appId: 'calendar') ───
	// Scheduling fields (startDate / endDate / allDay) live on the linked
	// timeBlocks row, not on `events` itself — see time-blocks/service.ts.
	calendars: 'id, isDefault, isVisible',
	events: 'id, calendarId, timeBlockId',
	eventTags: 'id, eventId, tagId, [eventId+tagId]',

	// ─── Contacts (appId: 'contacts') ───
	contacts: 'id, firstName, lastName, email, company, isFavorite, isArchived',
	contactTags: 'id, contactId, tagId, [contactId+tagId]',

	// ─── Chat (appId: 'chat') ───
	conversations: 'id, isArchived, isPinned, spaceId, templateId, updatedAt',
	messages: 'id, conversationId, sender, [conversationId+sender]',
	chatTemplates: 'id, isDefault',
	conversationTags: 'id, conversationId, tagId, [conversationId+tagId]',

	// ─── Picture (appId: 'picture') ───
	images: 'id, isFavorite, isPublic, isArchived, prompt, updatedAt',
	boards: 'id, isPublic',
	boardItems: 'id, boardId, itemType, zIndex, [boardId+zIndex]',
	imageTags: 'id, imageId, tagId, [imageId+tagId]', // junction to globalTags

	// ─── Cards (appId: 'cards') ───
	cardDecks: 'id, isPublic',
	cards: 'id, deckId, difficulty, nextReview, order, [deckId+order]',
	deckTags: 'id, deckId, tagId, [deckId+tagId]',

	// ─── Quotes (appId: 'quotes') ───
	quotesFavorites: 'id, quoteId',
	quotesLists: 'id',
	quotesListTags: 'id, listId, tagId, [listId+tagId]',

	// ─── Music (appId: 'music') ───
	songs: 'id, artist, album, genre, favorite, title, updatedAt',
	mukkePlaylists: 'id, name, updatedAt',
	playlistSongs: 'id, playlistId, songId, sortOrder, [playlistId+sortOrder]',
	mukkeProjects: 'id, title, songId',
	markers: 'id, beatId, type, sortOrder',
	songTags: 'id, songId, tagId, [songId+tagId]',

	// ─── Storage (appId: 'storage') ───
	files: 'id, parentFolderId, mimeType, isFavorite, isDeleted, name',
	storageFolders: 'id, parentFolderId, path, depth, isFavorite, isDeleted',
	fileTags: 'id, fileId, tagId, [fileId+tagId]', // junction to globalTags

	// ─── Presi (appId: 'presi') ───
	presiDecks: 'id, isPublic, updatedAt',
	slides: 'id, deckId, order, [deckId+order]',
	presiDeckTags: 'id, deckId, tagId, [deckId+tagId]',

	// ─── Inventar (appId: 'inventar') ───
	invCollections: 'id, order, templateId',
	invItems: 'id, collectionId, locationId, categoryId, status, name, [collectionId+order]',
	invLocations: 'id, parentId, path, depth, order',
	invCategories: 'id, parentId, order',
	invItemTags: 'id, itemId, tagId, [itemId+tagId]',

	// ─── Photos (appId: 'photos') ───
	albums: 'id, isAutoGenerated, name',
	albumItems: 'id, albumId, mediaId, sortOrder, [albumId+sortOrder]',
	photoFavorites: 'id, mediaId',
	photoMediaTags: 'id, mediaId, tagId, [mediaId+tagId]', // junction to globalTags

	// ─── SkillTree (appId: 'skilltree') ───
	skills: 'id, branch, parentId, level',
	activities: 'id, skillId, timestamp',
	achievements: 'id, key, unlockedAt',
	skillTags: 'id, skillId, tagId, [skillId+tagId]',

	// ─── CityCorners (appId: 'citycorners') ───
	cities: 'id, slug, country, name',
	ccLocations: 'id, cityId, category, name',
	ccFavorites: 'id, locationId',
	ccLocationTags: 'id, locationId, tagId, [locationId+tagId]',

	// ─── Times (appId: 'times') ───
	// Like calendar events, time entries store their scheduling on the
	// linked timeBlocks row, not on the row itself.
	timeClients: 'id, order, isArchived, shortCode',
	timeProjects: 'id, clientId, isArchived, isBillable, guildId, visibility, order',
	timeEntries: 'id, projectId, clientId, timeBlockId, guildId, visibility',
	timeTemplates: 'id, usageCount, lastUsedAt, projectId',
	timeSettings: 'id',
	timeAlarms: 'id, enabled, time',
	timeCountdownTimers: 'id, status',
	timeWorldClocks: 'id, sortOrder, timezone',
	entryTags: 'id, entryId, tagId, [entryId+tagId]',

	// ─── Questions (appId: 'questions') ───
	qCollections: 'id, sortOrder, isDefault',
	questions: 'id, collectionId, status, priority, [collectionId+status]',
	answers: 'id, questionId, isAccepted',
	questionTags: 'id, questionId, tagId, [questionId+tagId]',

	// ─── Food (appId: 'food') ───
	meals: 'id, date, mealType, [date+mealType]',
	goals: 'id',
	foodFavorites: 'id, mealType, usageCount',
	mealTags: 'id, mealId, tagId, [mealId+tagId]',

	// ─── Plants (appId: 'plants') ───
	plants: 'id, isActive, healthStatus',
	plantPhotos: 'id, plantId, isPrimary, [plantId+isPrimary]',
	wateringSchedules: 'id, plantId, nextWateringAt',
	wateringLogs: 'id, plantId, wateredAt',
	plantTags: 'id, plantId, tagId, [plantId+tagId]',

	// ─── uLoad (appId: 'uload') ───
	links: 'id, shortCode, isActive, folderId, order, clickCount, [folderId+order], [isActive+order]',
	uloadTags: 'id, slug, name',
	uloadFolders: 'id, order',
	linkTags: 'id, linkId, tagId, [linkId+tagId]',

	// ─── Calc (appId: 'calc') ───
	calculations: 'id, mode',
	savedFormulas: 'id, mode, name',

	// ─── Moodlit (appId: 'moodlit') ───
	moods: 'id, name, animation, isDefault',
	sequences: 'id, name',
	moodTags: 'id, moodId, tagId, [moodId+tagId]',

	// ─── Memoro (appId: 'memoro') ───
	memos: 'id, processingStatus, isArchived, isPinned, language, [isArchived+createdAt]',
	memories: 'id, memoId',
	memoTags: 'id, memoId, tagId', // junction to globalTags
	memoroSpaces: 'id, ownerId',
	spaceMembers: 'id, spaceId, userId',
	memoSpaces: 'id, memoId, spaceId',

	// ─── Guides (appId: 'guides') ───
	guides: 'id, category, difficulty, collectionId, tags',
	sections: 'id, guideId, order',
	steps: 'id, guideId, sectionId, order, [guideId+order]',
	guideCollections: 'id',
	runs: 'id, guideId, startedAt, completedAt',
	guideTags: 'id, guideId, tagId, [guideId+tagId]',

	// ─── Playground (appId: 'playground') ───
	playgroundConversations: 'id, model, isPinned, updatedAt',
	playgroundMessages: 'id, conversationId, role, order, [conversationId+order]',

	// ─── Habits (appId: 'habits') ───
	habits: 'id, order, isArchived, color',
	habitLogs: 'id, habitId, timeBlockId, [habitId+timeBlockId]',

	// ─── Journal (appId: 'journal') ───
	journalEntries: 'id, entryDate, mood, isPinned, isArchived, isFavorite, updatedAt',

	// ─── Dreams (appId: 'dreams') ───
	dreams: 'id, dreamDate, mood, isLucid, isPinned, isArchived, updatedAt',
	dreamSymbols: 'id, name, count, updatedAt',
	dreamTags: 'id, dreamId, tagId, [dreamId+tagId]',

	// ─── Period (appId: 'period') ───
	periods: 'id, startDate, endDate, isPredicted, isArchived, updatedAt',
	periodDayLogs: 'id, logDate, periodId, flow, [periodId+logDate]',
	periodSymptoms: 'id, name, category, count, updatedAt',

	// ─── Social Events (appId: 'events') ───
	// `socialEvents` is named distinctly to avoid colliding with calendar.events.
	socialEvents: 'id, status, timeBlockId, hostContactId, isPublished, [status+createdAt]',
	eventGuests: 'id, eventId, contactId, rsvpStatus, [eventId+rsvpStatus], [eventId+contactId]',
	eventInvitations: 'id, eventId, guestId, channel, [eventId+guestId]',
	// Bring-list ("wer bringt was?") — assignedGuestId points at a local
	// guest the host picked manually; claimedByName is set by a public
	// RSVP visitor who reserved the item from the share-link page.
	eventItems: 'id, eventId, assignedGuestId, done, order, [eventId+order], [eventId+done]',

	// ─── Notes (appId: 'notes') ───
	notes: 'id, isPinned, isArchived, color, title, updatedAt',
	noteTags: 'id, noteId, tagId, [noteId+tagId]',

	// ─── Finance (appId: 'finance') ───
	transactions: 'id, type, categoryId, date, amount, [date+type], [categoryId+date]',
	financeCategories: 'id, type, order',
	budgets: 'id, categoryId, month, [month+categoryId]',

	// ─── Places (appId: 'places') ───
	places: 'id, name, category, isFavorite, isArchived, latitude, longitude',
	locationLogs: 'id, placeId, timestamp, [placeId+timestamp]',
	placeTags: 'id, placeId, tagId, [placeId+tagId]',

	// ─── Playground (appId: 'playground') ───
	// Saved system-prompt snippets. `name` IS encrypted but no .where('name')
	// call site exists — same rationale as files.name / places.name above.
	playgroundSnippets: 'id, isPinned, order, [isPinned+order]',

	// ─── TimeBlocks (appId: 'timeblocks') — unified time model ───
	// Cross-cutting scheduling table that calendar events, time entries,
	// habit logs and scheduled tasks all project into. See PROD_READINESS
	// notes in time-blocks/service.ts for the design rationale.
	timeBlocks:
		'id, startDate, kind, type, sourceModule, sourceId, parentBlockId, [sourceModule+sourceId], [type+startDate], [kind+startDate], [parentBlockId+recurrenceDate]',
	timeBlockTags: 'id, blockId, tagId, [blockId+tagId]',

	// ─── News tables intentionally NOT in v1 ───
	// Originally added here, but that violates Dexie's "never edit a
	// published version" rule. Existing browsers stuck at db.version(3)
	// would never trigger an upgrade for v1 changes, so the news tables
	// would only appear on a fresh-cleared IndexedDB. Moved into
	// db.version(4) below — see comment there for rationale + indexes.

	// ─── Shared: Global Tags (appId: 'tags') ───
	globalTags: 'id, name, groupId',
	tagGroups: 'id',

	// ─── Shared: Links (appId: 'links') ───
	manaLinks: 'id, sourceAppId, sourceRecordId, targetAppId, targetRecordId',
});

// Schema version 2 — adds the unified Body module (combined fitness training
// + body composition tracking). Additive only; no v1 tables touched.
//
// Index strategy:
//   - bodySets indexes [workoutId+order] so the per-workout view can do a
//     range scan instead of loading every set and filtering in JS.
//   - bodyMeasurements indexes [type+date] for the per-metric trend chart
//     (e.g. "weight over time").
//   - bodyChecks indexes `date` so the daily upsert can `.where('date')`.
//   - bodyPhases indexes `endDate` to find the active (open) phase quickly.
db.version(2).stores({
	bodyExercises: 'id, muscleGroup, equipment, isArchived, isPreset',
	bodyRoutines: 'id, order, isArchived',
	bodyWorkouts: 'id, startedAt, endedAt, routineId, [endedAt+startedAt]',
	bodySets: 'id, workoutId, exerciseId, order, [workoutId+order], [exerciseId+createdAt]',
	bodyMeasurements: 'id, date, type, [type+date]',
	bodyChecks: 'id, date',
	bodyPhases: 'id, kind, startDate, endDate',
});

// Schema version 3 — adds the Who module (LLM character-guessing game).
// Additive only; no v1/v2 tables touched.
//
// Index strategy:
//   - whoGames indexes status + startedAt + the [status+startedAt] composite
//     so the past-games ListView can sort active vs finished cleanly without
//     loading the full set every render.
//   - whoMessages indexes [gameId+createdAt] for the chat scrollback query
//     (range scan inside one game's messages, ordered by time).
db.version(3).stores({
	whoGames: 'id, status, deckId, startedAt, finishedAt, [status+startedAt]',
	whoMessages: 'id, gameId, sender, createdAt, [gameId+createdAt]',
});

// Schema version 4 — adds the News module (curated public feed + saved
// reading list + per-user preferences/reactions + a local cache of the
// server pool). Additive only; no v1/v2/v3 tables touched.
//
// `newsArticles` is the user's personal reading list (saved from the
// curated pool or pasted URLs). `newsCategories` are user-defined
// folders. `newsPreferences` is a singleton row keyed on 'singleton'
// holding selected topics, blocklist, languages and the learned topic
// + source weights. `newsReactions` records per-article feedback
// (interested / not_interested / source_blocked / hidden) and is what
// the feed engine uses to suppress already-rated items. `newsCachedFeed`
// is a local mirror of the server's curated pool, capped to ~400 rows
// for offline reading — intentionally NOT in module.config.ts and
// therefore not synced.
//
// Index strategy:
//   - newsArticles indexes type/categoryId/sourceCuratedId for the
//     reading-list filter strip and the saveFromCurated() dedupe lookup
//     ([type+isArchived] for the unread/archive tab queries)
//   - newsReactions indexes [reaction+createdAt] so the feed engine can
//     range-scan "what did the user dismiss" without loading every row
//   - newsCachedFeed indexes [topic+publishedAt] so the topic-filter
//     pass in rankFeed() can do a single index walk instead of N scans
db.version(4).stores({
	newsArticles:
		'id, type, isArchived, isRead, isFavorite, categoryId, originalUrl, sourceCuratedId, [type+isArchived], [categoryId+createdAt]',
	newsCategories: 'id, sortOrder',
	newsPreferences: 'id',
	newsReactions: 'id, articleId, reaction, sourceSlug, topic, [reaction+createdAt]',
	newsCachedFeed: 'id, topic, sourceSlug, language, publishedAt, [topic+publishedAt]',
});

// Schema version 5 — adds timeBlockId index to bodyWorkouts so the
// calendar/timeline integration (createBlock in startWorkout) can
// look up "which workout owns this TimeBlock" via a Dexie index
// instead of a full-table scan + filter. Additive only.
db.version(5).stores({
	bodyWorkouts: 'id, startedAt, endedAt, routineId, timeBlockId, [endedAt+startedAt]',
});

// v5: Quotes custom quotes — user-created quotes stored locally.
db.version(5).stores({
	customQuotes: 'id, author, category',
});

// Schema version 6 — Firsts module: track first-time experiences.
// `status` indexed for dream/lived filtering, `category` for grouping,
// `date` for chronological sort of lived entries, `priority` for dream
// ranking. `isPinned`/`isArchived` for standard meta-filtering.
db.version(6).stores({
	firsts: 'id, status, category, date, priority, isPinned, isArchived',
});

// Schema version 7 — adds the Drink module (beverage tracking).
// Additive only; no prior tables touched.
//
// Index strategy:
//   - drinkEntries indexes [date+time] for the daily timeline view
//     (range scan on date, sorted by time within a day).
//   - drinkPresets indexes `order` for the preset-picker sort.
db.version(7).stores({
	drinkEntries: 'id, date, drinkType, presetId, [date+time]',
	drinkPresets: 'id, order, drinkType, isArchived',
});

// Schema version 8 — adds the Recipes module.
// *tags is a Dexie MultiEntry index for tag-based filtering.
db.version(8).stores({
	recipes: 'id, difficulty, isFavorite, *tags',
});

// Schema version 9 — adds the Stretch module (guided stretching routines
// with mobility assessments, session tracking, and reminders).
// Additive only; no prior tables touched.
//
// Index strategy:
//   - stretchExercises indexes bodyRegion + difficulty for the exercise picker
//     filter strip, isPreset to separate seeds from custom.
//   - stretchRoutines indexes routineType for the type-based filter tabs,
//     order for the user's custom sort.
//   - stretchSessions indexes startedAt for the history timeline view
//     (range scan descending).
//   - stretchAssessments indexes assessedAt for the trend chart.
//   - stretchReminders indexes isActive so the reminder engine can quickly
//     find enabled reminders without scanning the full table.
db.version(9).stores({
	stretchExercises: 'id, bodyRegion, difficulty, isPreset, isArchived, order',
	stretchRoutines: 'id, routineType, order, isPinned, isPreset',
	stretchSessions: 'id, routineId, startedAt, [startedAt]',
	stretchAssessments: 'id, assessedAt',
	stretchReminders: 'id, isActive',
});

// v10 — Domain Event Store for the Companion Brain.
// Append-only log of semantic events emitted by module stores.
// NOT synced (local intelligence only). Replaces _activity long-term.
db.version(10).stores({
	_events:
		'++seq, type, meta.appId, meta.timestamp, meta.recordId, [meta.appId+meta.timestamp], [type+meta.timestamp]',
});

// v14 — Companion Brain: Goals, Memory, Feedback, Chat, Rituals.
// Bumped to v14 (past mail/stretch/meditate/sleep) to ensure schema
// upgrade runs even if the browser already saw an earlier v10.
db.version(14).stores({
	companionGoals: 'id, moduleId, status, [moduleId+status]',
	_memory: 'id, category, confidence, lastConfirmed, [category+confidence]',
	_nudgeOutcomes: '++id, nudgeId, nudgeType, outcome, timestamp, [nudgeType+outcome]',
	companionConversations: 'id, createdAt',
	companionMessages: 'id, conversationId, role, createdAt, [conversationId+createdAt]',
	rituals: 'id, status, createdAt',
	ritualSteps: 'id, ritualId, order, [ritualId+order]',
	ritualLogs: '++id, ritualId, date, [ritualId+date]',
	_streakState: 'id, lastActiveDate',
});

// Schema version 15 — adds the Mood module (multi-daily mood tracking with
// emotions, context, and pattern detection). Additive only.
//
// Index strategy:
//   - moodEntries indexes date + emotion for the daily view and emotion
//     distribution queries. [date+time] for chronological sort within a day.
//   - moodSettings is a singleton (id-only).
db.version(15).stores({
	moodEntries: 'id, date, emotion, level, activity, [date+time]',
	moodSettings: 'id',
});

// Schema version 11 — adds the Mail module (local draft cache).
// Mail content lives server-side in Stalwart (JMAP). Only drafts are local-first.
db.version(11).stores({
	mailDrafts: 'id, accountId, replyToMessageId',
});

// Schema version 12 — adds the Meditate module (guided meditation, breathing
// exercises, body scans). Presets index category+order for the picker grid.
// Sessions index startedAt for the history timeline (reverse range scan).
db.version(12).stores({
	meditatePresets: 'id, category, isPreset, isArchived, order',
	meditateSessions: 'id, presetId, startedAt, [startedAt+presetId]',
	meditateSettings: 'id',
});

// Schema version 13 — adds the Sleep module (sleep tracking with hygiene
// checklists). Additive only; no prior tables touched.
//
// Index strategy:
//   - sleepEntries indexes date for the daily lookup + quality for the
//     heatmap view (range scan on date descending).
//   - sleepHygieneLogs indexes date for the daily upsert.
//   - sleepHygieneChecks indexes order for the checklist sort, isActive
//     for filtering active checks.
//   - sleepSettings is a singleton (id-only index).
db.version(13).stores({
	sleepEntries: 'id, date, quality, [date+quality]',
	sleepHygieneLogs: 'id, date',
	sleepHygieneChecks: 'id, category, isActive, isPreset, order',
	sleepSettings: 'id',
});

// v16 — BYOK (Bring Your Own Key) storage for user-provided LLM API keys.
// Encrypted at rest via the user's master key (AES-GCM). NOT synced.
// Keys stay device-local — user must add them on each device.
db.version(16).stores({
	_byokKeys: 'id, provider, isDefault, [provider+isDefault]',
});

// v17 — Kontext module (user-authored markdown doc keyed by 'singleton')
// + AI proposals (staged intents awaiting user approval).
//
// `pendingProposals` is local-only and does NOT participate in mana-sync —
// the approved write itself syncs through the normal module path. Indexes
// support "all pending ordered by creation" (approval inbox) and
// "all proposals for mission X" (workbench).
db.version(17).stores({
	kontextDoc: 'id',
	pendingProposals: 'id, status, createdAt, missionId, [status+createdAt]',
});

// v18 — AI Missions: long-lived autonomous work items. Syncs cross-device
// (unlike `pendingProposals`) so the user can configure a mission on one
// device and see it run on another. Indexes power the Runner's "due now"
// query and the Workbench's state filters.
db.version(18).stores({
	aiMissions: 'id, state, createdAt, nextRunAt, [state+nextRunAt]',
});

// v19 — AI Agents: named personas that own Missions, carry policy +
// memory, and show up as identities in the Workbench timeline.
// Syncs cross-device so the same agent exists everywhere. Name
// uniqueness is enforced at write time in the store (Dexie's unique
// index would error on the default-agent-backfill race between two
// tabs). See docs/plans/multi-agent-workbench.md §Phase 2b.
db.version(19).stores({
	agents: 'id, state, createdAt, name, [state+name]',
});

// v20 — AI Debug Log: per-iteration capture of the prompt sent to the
// planner LLM, the raw response, the resolved-inputs the planner saw,
// and any pre-step output (e.g. web-research). LOCAL-ONLY, never synced
// (would leak personal context through mana-sync) — that is enforced by
// keeping it out of every module's SYNC_APP_MAP. Capped to ~50 newest
// rows by the writer so a long-running tab doesn't bloat IndexedDB.
db.version(20).stores({
	_aiDebugLog: 'iterationId, capturedAt',
});

// v21 — Quiz module. Three tables: container (`quizzes`), per-quiz items
// (`quizQuestions`, indexed on quizId for the play/edit view), and play-
// through history (`quizAttempts`, indexed on quizId + startedAt for the
// per-quiz leaderboard view). questionCount lives on `quizzes` as a
// denormalised counter so the list view doesn't fan out into per-quiz
// question scans.
db.version(21).stores({
	quizzes: 'id, isPinned, isArchived, updatedAt',
	quizQuestions: 'id, quizId, order, [quizId+order]',
	quizAttempts: 'id, quizId, startedAt, [quizId+startedAt]',
});

// v22 — Notes tag junction (mirrors eventTags/contactTags/taskLabels pattern)
// + per-agent kontext documents (replaces global singleton auto-inject).
db.version(22).stores({
	noteTags: 'id, noteId, tagId, [noteId+tagId]',
	agentKontextDocs: 'id, agentId',
});

// v23 — User context: structured profile + freeform markdown.
// Singleton record ('id') holding structured sections (about, interests,
// routine, nutrition, goals, social), freeform markdown, and interview
// progress. Replaces kontextDoc as the central "who is the user?" store.
db.version(23).stores({
	userContext: 'id',
});

// v24 — Wishes module: wishlists with price tracking.
// wishesItems indexes [listId+order] for the per-list view,
// status for the active/fulfilled filter tabs.
// wishesPriceChecks indexes [wishId+checkedAt] for the per-wish
// price history timeline (reverse range scan).
db.version(24).stores({
	wishesItems: 'id, listId, status, priority, category, [listId+order], [status+order]',
	wishesLists: 'id, order, isArchived',
	wishesPriceChecks: 'id, wishId, checkedAt, [wishId+checkedAt]',
});

// v25 — Wetter module: saved locations and user preferences.
db.version(25).stores({
	wetterLocations: 'id, isDefault, order',
	wetterSettings: 'id',
});

// v26 — Library module: single-table media log with a `kind` discriminator.
// v24 + v25 are reserved for the wishes + wetter modules being developed
// in parallel; library jumps to v26 to avoid colliding with those.
// Index strategy:
//   - kind indexes the tab filter (book / movie / series / comic) — hottest path.
//   - status powers the "Läuft / Fertig / Geplant" filter strip.
//   - completedAt gives the Jahresrückblick a cheap range scan of completed items.
//   - isFavorite supports the favourites-only toggle without a full-table filter.
db.version(26).stores({
	libraryEntries: 'id, kind, status, completedAt, isFavorite',
});

// v27 — Invoices module: outbound finance (issuing invoices to clients).
// See docs/plans/invoices-module.md. Three tables:
//   - invoices: the invoice records (status/dueDate/clientId indexed for
//     the "overdue per client" + "open per status" queries that drive the
//     ListView + dashboard widgets).
//   - invoiceClients: optional per-user client book; only userId needed
//     since listing is always scoped to the current user.
//   - invoiceSettings: singleton sender profile (one row per user, id is
//     the stable sentinel INVOICE_SETTINGS_ID so sync dedupes on it).
db.version(27).stores({
	invoices: 'id, number, status, clientId, issueDate, dueDate',
	invoiceClients: 'id',
	invoiceSettings: 'id',
});

// v28 — Spaces foundation: stamp every sync-relevant record with
// `spaceId`, `authorId`, `visibility` so queries can be partitioned by
// Space (Better Auth organization) instead of by user. See
// `docs/plans/spaces-foundation.md`.
//
// No schema/index changes in this version — the new fields live on the
// record shape only. The scope wrapper (follow-up task) can still
// partition via `.filter(r => r.spaceId === ...)`; indexes for hot tables
// will land per-table in follow-up migrations once the scope layer ships.
//
// Sentinel: `_personal:<userId>` is used as a placeholder until the
// bootstrap step resolves it to the real personal-space organization id
// returned by Better Auth. The bootstrap runs once per login and rewrites
// every sentinel across every table in one pass.
db.version(28).upgrade(async (tx) => {
	// Touch only sync-relevant tables — the `_`-prefixed infra tables
	// (`_pendingChanges`, `_syncMeta`, `_activity`, `_eventsTombstones`)
	// don't belong to a space.
	const appTableNames = new Set<string>();
	for (const tables of Object.values(SYNC_APP_MAP)) {
		for (const t of tables) appTableNames.add(t);
	}

	for (const table of tx.db.tables) {
		if (!appTableNames.has(table.name)) continue;
		await tx
			.table(table.name)
			.toCollection()
			.modify((record: Record<string, unknown>) => {
				const ownerId =
					typeof record.userId === 'string' && record.userId ? record.userId : GUEST_USER_ID;
				if (record.spaceId === undefined || record.spaceId === null) {
					record.spaceId = `_personal:${ownerId}`;
				}
				if (record.authorId === undefined || record.authorId === null) {
					record.authorId = ownerId;
				}
				if (record.visibility === undefined || record.visibility === null) {
					record.visibility = 'space';
				}
			});
	}
});

// v29 — Drop the legacy `pendingProposals` table. Proposals are no
// longer created: the planner executes tool_calls directly under the
// AI actor, and the Workbench Timeline plus per-iteration revert is
// the review surface. Passing `null` to .stores() deletes the table on
// open. Safe because the system hasn't shipped; no user data is lost.
// See docs/plans/planner-function-calling.md.
db.version(29).stores({
	pendingProposals: null,
});

// v30 — Local-only marker for server-iteration execution. When mana-ai
// plans a mission iteration in the background, it syncs down with
// source='server' and plan[].status='planned'. A sync-listener on the
// client (data/ai/missions/server-iteration-executor.ts) runs those
// planned tool_calls locally and flips the status. This marker table
// guarantees idempotency across sync replays and page reloads — once
// an iteration id lands here, the listener skips it. Never synced.
db.version(30).stores({
	_serverIterationExecutions: 'iterationId, missionId, executedAt',
});

// v31 — Rename the legacy `spaceId` field to `contextSpaceId` on three
// tables that owned the term before the multi-tenancy Spaces foundation
// arrived (v28):
//   - conversations (chat module's reference to a context-space folder)
//   - spaceMembers   (memoro's members of a context-space)
//   - memoSpaces     (memoro's memo ↔ context-space join)
//
// The v28 upgrade did NOT overwrite pre-existing `spaceId` values, so
// records in these tables still carry context-space references under
// the old name. After this migration, `spaceId` belongs exclusively to
// the multi-tenancy primitive; the context-space reference has its own
// disambiguated field. Scope queries that previously would have been
// confused by the collision now work cleanly.
//
// The upgrade also stamps the fresh `spaceId` with the personal-space
// sentinel for these rows so they immediately participate in scope
// filtering instead of staying invisible until the next write.
//
// See docs/plans/spaces-foundation.md §"Legacy spaceId collision".
db.version(31)
	.stores({
		conversations: 'id, isArchived, isPinned, contextSpaceId, templateId, updatedAt',
		spaceMembers: 'id, contextSpaceId, userId',
		memoSpaces: 'id, memoId, contextSpaceId',
	})
	.upgrade(async (tx) => {
		const tables = ['conversations', 'spaceMembers', 'memoSpaces'] as const;
		for (const name of tables) {
			await tx
				.table(name)
				.toCollection()
				.modify((record: Record<string, unknown>) => {
					if (record.contextSpaceId !== undefined) return;
					const legacy = record.spaceId;
					if (typeof legacy === 'string' && legacy && !legacy.startsWith('_personal:')) {
						// Genuine context-space reference — move to the new field name.
						record.contextSpaceId = legacy;
					} else {
						record.contextSpaceId = null;
					}
					const ownerId =
						typeof record.userId === 'string' && record.userId ? record.userId : GUEST_USER_ID;
					// Reset spaceId so scope filtering matches the user's personal
					// space (post-bootstrap it's rewritten to the real personal-space id).
					record.spaceId = `_personal:${ownerId}`;
				});
		}
	});

// v32 — Broadcast module: 1:N email campaigns (newsletters).
// See docs/plans/broadcast-module.md. Three tables:
//   - broadcastCampaigns: the campaigns themselves. status + scheduledAt
//     indexed because the two hot queries are "show me drafts" and
//     "what's scheduled in the next 24h" (server cron picks those up).
//   - broadcastTemplates: reusable content templates. isBuiltIn indexed
//     so the picker can split user-created vs. shipped-with-app.
//   - broadcastSettings: singleton per user (sender defaults + DNS check
//     cache). id is the BROADCAST_SETTINGS_ID sentinel.
db.version(32).stores({
	broadcastCampaigns: 'id, status, scheduledAt, sentAt',
	broadcastTemplates: 'id, isBuiltIn',
	broadcastSettings: 'id',
});

// v33 — Articles module: Pocket-style read-it-later.
// See docs/plans/articles-module.md. Three tables:
//   - articles: saved URLs + extracted Readability content. `originalUrl`
//     indexed for O(1) dedupe at save time. `status` + `savedAt` drive
//     the ListView's main filter + sort. `isFavorite` + `siteName` are
//     indexed for the "favourites" + "group by source" views.
//   - articleHighlights: per-selection rows. [articleId+startOffset]
//     gives sorted range scans per article for the reader overlay.
//   - articleTags: pure junction into globalTags (appId 'tags').
//     [articleId+tagId] matches the pattern used by noteTags / eventTags
//     / contactTags / placeTags and is what `createTagLinkOps` expects.
db.version(33).stores({
	articles: 'id, userId, status, savedAt, isFavorite, siteName, originalUrl',
	articleHighlights: 'id, userId, articleId, [articleId+startOffset]',
	articleTags: 'id, userId, articleId, tagId, [articleId+tagId]',
});

// v34 — Phase 2b of the space-scoped data model migration.
// See docs/plans/space-scoped-data-model.md.
//
// Adds two things:
//
// 1. `userTagPresets` — user-level templates for seeding tags into newly-
//    created Spaces. Deliberately user-scoped, NOT space-scoped: the UI
//    that picks a preset runs from ANY Space when the user creates a new
//    one, so filtering by active-space would hide presets created elsewhere.
//    Indexed on `userId` for the trivial "my presets" query and on
//    `isDefault` so the preset picker can highlight the default.
//    Intentionally NOT added to SYNC_APP_MAP yet — cross-device sync for
//    presets is a Phase 2d concern once the store API lands.
//
// 2. `[spaceId+sortOrder]` + `[spaceId+name]` compound indexes on
//    `globalTags` + `tagGroups`. Tags/tagGroups already carry `spaceId`
//    (v28 stamped, creating-hook keeps stamping) — the compound indexes
//    let the per-Space "sorted tag list" and "dedup-by-name-within-space"
//    queries skip the client-side filter that `scopedForModule` does today.
//    Plain `spaceId` is redundant in a compound index, so the existing
//    `id` + `name` + `groupId` indexes stay as first-tuple indexes.
db.version(34).stores({
	userTagPresets: 'id, userId, isDefault, updatedAt',
	globalTags: 'id, name, groupId, [spaceId+sortOrder], [spaceId+name]',
	tagGroups: 'id, [spaceId+sortOrder]',
});

// v35 — Phase 2c follow-up: hard drop of the `userId` column from
// every data-record row, and drop the now-unused userId indexes on
// the articles module tables.
//
// Phase 2c (commit e9b9544ea) stopped the creating-hook from stamping
// `userId` on new writes to data tables, leaving existing rows
// untouched (mixed state). This migration completes the cleanup: the
// `no table has both userId AND spaceId` invariant from the plan is
// now truly met on data records.
//
// Migration shape:
//   1. Re-declare articles / articleHighlights / articleTags without
//      the `userId` index so the dropped column stops showing in the
//      Dexie schema. The other indexes stay the same.
//   2. Upgrade function: iterate every table in SYNC_APP_MAP that is
//      NOT in USER_LEVEL_TABLES (see below), and `delete record.userId`
//      on every row.
//
// User-level tables (userSettings, userContext, newsPreferences,
// meditateSettings, sleepSettings, moodSettings, timeSettings,
// invoiceSettings, broadcastSettings, wetterSettings, userTagPresets)
// keep their userId — their ownership model is user-scoped by design.
//
// This migration is destructive at the row level (field is removed).
// Downstream converters (tags-local's toTag / toTagGroup, calc's
// toCalculation / toSavedFormula) already fall back to `'guest'` /
// `''` when userId is absent, so public-type consumers don't break.
// Rollback plan: revert to v34 + restore-from-backup; the `userId`
// field can't be recovered from a forward revert alone.
db.version(35)
	.stores({
		articles: 'id, status, savedAt, isFavorite, siteName, originalUrl',
		articleHighlights: 'id, articleId, [articleId+startOffset]',
		articleTags: 'id, articleId, tagId, [articleId+tagId]',
	})
	.upgrade(async (tx) => {
		// Mirror of USER_LEVEL_TABLES below — duplicated here because the
		// hook-registration loop hasn't run yet when the upgrade fires
		// (Dexie applies upgrades before `db.table(...).hook()` calls).
		// Keep this list in sync with the one at the hook site.
		const USER_LEVEL = new Set([
			'userSettings',
			'userContext',
			'newsPreferences',
			'meditateSettings',
			'sleepSettings',
			'moodSettings',
			'timeSettings',
			'invoiceSettings',
			'broadcastSettings',
			'wetterSettings',
			'userTagPresets',
		]);

		const dataTables = new Set<string>();
		for (const tables of Object.values(SYNC_APP_MAP)) {
			for (const t of tables) if (!USER_LEVEL.has(t)) dataTables.add(t);
		}

		for (const name of dataTables) {
			if (!tx.db.tables.find((t) => t.name === name)) continue;
			await tx
				.table(name)
				.toCollection()
				.modify((record: Record<string, unknown>) => {
					if ('userId' in record) delete record.userId;
				});
		}
	});

// v36 — Phase 2c-followup #2: strip the Space-scope fields from
// user-level singleton tables. v28 blanket-stamped every row with
// `spaceId=_personal:<userId>` + `authorId` + `visibility`, but
// user-level tables (userSettings, invoiceSettings, …) are genuinely
// user-scoped — they're never queried through scopedTable. Those
// fields were dead weight + a subtle invariant violation ("user-level
// table with a spaceId stamp is either user-level or space-level,
// pick one"). Hook was updated in the same commit to stop stamping
// them on user-level tables going forward; this upgrade cleans up
// the historical rows.
//
// Grep verified: zero callers use `scopedTable(<user-level-table>)`
// or `.where('spaceId')` against these tables, so dropping is safe.
// No schema change — the columns weren't indexed on user-level
// tables, so there's nothing to re-declare in .stores().
db.version(36).upgrade(async (tx) => {
	const USER_LEVEL = [
		'userSettings',
		'userContext',
		'newsPreferences',
		'meditateSettings',
		'sleepSettings',
		'moodSettings',
		'timeSettings',
		'invoiceSettings',
		'broadcastSettings',
		'wetterSettings',
		'userTagPresets',
	];

	for (const name of USER_LEVEL) {
		if (!tx.db.tables.find((t) => t.name === name)) continue;
		await tx
			.table(name)
			.toCollection()
			.modify((record: Record<string, unknown>) => {
				if ('spaceId' in record) delete record.spaceId;
				if ('authorId' in record) delete record.authorId;
				if ('visibility' in record) delete record.visibility;
			});
	}
});

// v37 — Website builder module (docs/plans/website-builder.md).
// Three tables for the block-tree CMS. All space-scoped; all plaintext
// (public content by design — see plan decision D4).
//   - websites: root per space. `slug` indexed for the eventual public
//     resolver + dedupe-within-space. `publishedVersion` indexed so the
//     editor can fast-filter unpublished drafts.
//   - websitePages: `[siteId+order]` for the ordered page list in the
//     editor. `[siteId+path]` for the public path resolver (page by URL).
//   - websiteBlocks: `[pageId+parentBlockId+order]` is the canonical tree
//     scan — ordered children of a parent within a page. `[pageId+order]`
//     is kept separately for the flat render path.
db.version(37).stores({
	websites: 'id, slug, publishedVersion, updatedAt, deletedAt',
	websitePages: 'id, siteId, [siteId+order], [siteId+path], updatedAt, deletedAt',
	websiteBlocks:
		'id, pageId, parentBlockId, [pageId+order], [pageId+parentBlockId+order], type, updatedAt, deletedAt',
});

// v38 — Me-Images: user-owned reference images for AI generation
// (docs/plans/me-images-and-reference-generation.md M1).
//
// User-level table, not space-scoped — see USER_LEVEL_TABLES below.
// The same human uses the same face/body across every Space, so the
// images live once per user and are reused from every Space's Picture
// generator.
//
// Indices:
//   - `kind` for the Settings UI's "all face images" / "all fullbody"
//     filter and for the query hook `useReferenceImages(kind)`.
//   - `primaryFor` for the hot lookup "give me the current avatar /
//     face-ref / body-ref" without a full scan. Null values are
//     dropped by Dexie so the index stays dense.
//   - `createdAt` for stable ordering (newest uploads first).
db.version(38).stores({
	meImages: 'id, kind, primaryFor, createdAt',
});

// v40 — Flip meImages from USER_LEVEL_TABLES to space-scoped data
// (docs/plans/me-images-space-scope-migration.md).
//
// Why: after Wardrobe's decision to be space-scoped across all six
// space types, leaving meImages user-scoped creates a split-brain
// model (space-scoped catalog, user-global input). Unification also
// closes a latent privacy leak in shared spaces — an MCP agent in a
// brand-space would otherwise see the owner's entire private pool.
//
// What the upgrade does to existing rows, in one pass:
//   1. stamps `spaceId = _personal:<userId>` sentinel (reconcileSentinels
//      rewrites it to the real personal-space id on next Better Auth
//      membership load — same path as v28's sentinel population)
//   2. stamps `authorId = userId`
//   3. stamps `visibility = 'space'`
//   4. drops `userId` (meImages is a data-table now, attribution lives
//      on the Actor fields + tenancy on spaceId — same sweep as v35
//      did for the other data-tables, just scoped to this one)
//
// No schema/index change: `spaceId`, `authorId`, `visibility` are
// non-indexed fields, scopedTable filters in-memory. Tiny pool per
// space (typ. 2-10 rows), no compound index warranted.
db.version(40).upgrade(async (tx) => {
	await tx
		.table('meImages')
		.toCollection()
		.modify((record: Record<string, unknown>) => {
			const ownerId =
				typeof record.userId === 'string' && record.userId ? record.userId : GUEST_USER_ID;
			if (record.spaceId === undefined || record.spaceId === null) {
				record.spaceId = `_personal:${ownerId}`;
			}
			if (record.authorId === undefined || record.authorId === null) {
				record.authorId = ownerId;
			}
			if (record.visibility === undefined || record.visibility === null) {
				record.visibility = 'space';
			}
			if ('userId' in record) delete record.userId;
		});
});

// v41 — Wardrobe module (docs/plans/wardrobe-module.md M1).
// Two space-scoped tables — garments (individual clothing items) and
// outfits (named compositions of garment refs). Try-on results live in
// picture.images with a wardrobeOutfitId back-reference; no join table
// here.
//
// Indices:
//   - wardrobeGarments.category for the Category-Tabs filter
//   - wardrobeGarments.createdAt for "newest first" ordering
//   - wardrobeOutfits.createdAt for the grid default sort
//   - wardrobeOutfits.isFavorite for the favorites filter
// Both tables get the standard spaceId/authorId/visibility stamping
// via the Dexie hook (they're NOT in USER_LEVEL_TABLES).
db.version(41).stores({
	wardrobeGarments: 'id, category, createdAt, isArchived',
	wardrobeOutfits: 'id, createdAt, isFavorite, isArchived',
});

// v42 — Index `images.wardrobeOutfitId` + add `images.wardrobeGarmentId`
// index for fast Wardrobe back-reference queries. Until now Try-On
// results in `picture.images` carried a back-ref to `wardrobeOutfits`
// but no index — `useOutfitTryOns` fell back to a linear filter across
// every image in the active space. Solo-Garment Try-Ons (M4.1) didn't
// have a back-ref at all; the result ended up in the Picture gallery
// and was unfindable from the garment detail page.
//
// Both fields are plaintext FKs to Wardrobe rows in the same space.
// Index both together so outfit-detail and garment-detail queries are
// single-field equality lookups (O(log n)) instead of table scans, and
// add the symmetric `wardrobeGarmentId` so Solo-Try-Ons have the same
// first-class back-reference as Outfit-Try-Ons. Invariant (enforced in
// the write path): at most one of the two is set per row.
db.version(42).stores({
	images:
		'id, isFavorite, isPublic, isArchived, prompt, updatedAt, wardrobeOutfitId, wardrobeGarmentId',
});

// v43 — Writing module (docs/plans/writing-module.md M1).
// Four space-scoped tables:
//   - writingDrafts: briefing + currentVersionId pointer. Indices: kind
//     (tab filter), status (chip filter), updatedAt (default sort),
//     isFavorite (favourites toggle).
//   - writingDraftVersions: immutable snapshots of the draft body. Indexed
//     on draftId for version-history fetch, versionNumber for ordering.
//   - writingGenerations: provider-level call records (prompt, status,
//     tokens, model). Indexed on draftId for per-draft runs and status
//     so the UI can find in-flight work on reload.
//   - writingStyles: reusable style definitions (preset + custom). Indexed
//     on source (preset vs custom), isSpaceDefault, isFavorite.
// All four get standard spaceId/authorId/visibility stamping via the Dexie
// hook (NOT in USER_LEVEL_TABLES).
db.version(43).stores({
	writingDrafts: 'id, kind, status, updatedAt, isFavorite',
	writingDraftVersions: 'id, draftId, versionNumber, createdAt',
	writingGenerations: 'id, draftId, status, createdAt',
	writingStyles: 'id, source, isSpaceDefault, isFavorite, updatedAt',
});

// v44 — Comic module (docs/plans/comic-module.md M1).
// Single space-scoped table: each row is a comic story holding an
// ordered `panelImageIds: string[]` pointing at picture.images rows
// generated via /picture/generate-with-reference. No separate panel
// table — the `picture.images` entry IS the panel, with `comicStoryId`
// + `comicPanelIndex` plaintext back-refs (added as type-level fields
// on LocalImage; no schema index needed because the story holds the
// canonical order and loads its panels by id-list, not by scan).
//
// Indices:
//   - comicStories.createdAt for "newest first" grid ordering
//   - comicStories.style for the style-filter query (M5 MCP listStories)
//   - comicStories.isFavorite for the favorites filter
//   - comicStories.isArchived for the archive-hide filter
// Gets standard spaceId/authorId/visibility stamping via the Dexie hook
// (NOT in USER_LEVEL_TABLES).
db.version(44).stores({
	comicStories: 'id, createdAt, style, isFavorite, isArchived',
});

// v45 → v46: scope-cursor bridge superseded by `useScopedLiveQuery`.
//
// v45 introduced a `_scopeCursor` infra table as a Dexie-side beacon
// for active-space / current-user changes — every scoped query touched
// it so Dexie's liveQuery subscribed to it, every setActiveSpace
// bumped it. Worked, but smelled: hidden side-effect inside scopedTable,
// scope state pretending to be a Dexie row, +1 roundtrip per query.
//
// The clean replacement: `data/scope/use-scoped-live-query.svelte.ts`
// wraps liveQuery in a Svelte 5 `$effect` that reads the scope state
// directly. Runes auto-track those reads, so a scope change tears
// down the previous Dexie subscription and creates a fresh one — no
// bridge table needed. Both `active-space.svelte.ts#active` and
// `current-user.svelte.ts#currentUserId` are `$state` so the tracking
// just works.
//
// v45 stays declared so existing Dexie databases keep their version
// chain intact; v46 drops the table by passing `null` (Dexie idiom
// for "delete this store"). Safe because `_scopeCursor` only ever
// held a transient `{id, bumpedAt}` row — no user data lost.
db.version(45).stores({
	_scopeCursor: 'id',
});
db.version(46).stores({
	_scopeCursor: null,
});

// v47 — Augur module (docs/plans/augur-module.md M1).
// Single space-scoped table: each row is a sign — an omen, a fortune,
// or a hunch — with a witness-side capture (source/claim/vibe/feltMeaning)
// and an oracle-side resolution (outcome/outcomeNote/resolvedAt).
//
// Index strategy:
//   - kind for the witness gallery's KindTabs filter
//   - outcome to find unresolved entries fast (Resolve-Reminder + due-for-reveal)
//   - vibe for the vibe-color galleries
//   - sourceCategory for Calibration-per-Source aggregation in OracleView
//   - encounteredAt for chronological sort (default order)
//   - expectedBy for the "fällig" reminder list (M3)
//   - isArchived for the standard archive-hide filter
db.version(47).stores({
	augurEntries: 'id, kind, outcome, vibe, sourceCategory, encounteredAt, expectedBy, isArchived',
});

// v48 — One-shot dedup of duplicate "Home" scenes the seeding race
// accumulated before the per-space-seeds registry shipped. The old
// seeder wrote rows without `spaceId`, so the creating-hook stamped
// them with the personal sentinel and the per-Space dedup check
// (filtering by real Space UUID) never found them — every login added
// another Home row.
//
// Collapses survivors per (spaceId, name='Home') by merging openApps
// (dedup by appId) and soft-deleting losers. User-customised Homes
// (description / wallpaper / agent / scope tags) are excluded from
// grouping so a deliberate two-Home setup stays intact. Survivor pick:
// most openApps wins, ties break by most-recent updatedAt. Mana-sync
// propagates the soft-deletes to other devices.
// See docs/plans/workbench-seeding-cleanup.md.
db.version(48).upgrade(async (tx) => {
	type Row = Record<string, unknown> & { id: string };
	const rows = (await tx.table('workbenchScenes').toArray()) as Row[];

	const groups = new Map<string, Row[]>();
	for (const row of rows) {
		if (row.deletedAt) continue;
		if (row.name !== 'Home') continue;
		if (row.description) continue;
		if (row.wallpaper) continue;
		if (row.viewingAsAgentId) continue;
		const scope = row.scopeTagIds;
		if (Array.isArray(scope) && scope.length > 0) continue;
		const spaceId = row.spaceId;
		if (typeof spaceId !== 'string' || !spaceId) continue;
		let group = groups.get(spaceId);
		if (!group) groups.set(spaceId, (group = []));
		group.push(row);
	}

	const now = new Date().toISOString();
	let removed = 0;

	for (const group of groups.values()) {
		if (group.length <= 1) continue;
		group.sort((a, b) => {
			const aLen = Array.isArray(a.openApps) ? a.openApps.length : 0;
			const bLen = Array.isArray(b.openApps) ? b.openApps.length : 0;
			if (aLen !== bLen) return bLen - aLen;
			return String(b.updatedAt ?? '').localeCompare(String(a.updatedAt ?? ''));
		});
		const [survivor, ...losers] = group;
		const merged: unknown[] = Array.isArray(survivor.openApps) ? [...survivor.openApps] : [];
		const seen = new Set(merged.map((a) => (a as { appId: string }).appId));
		for (const loser of losers) {
			const apps = Array.isArray(loser.openApps) ? loser.openApps : [];
			for (const app of apps) {
				const appId = (app as { appId: string }).appId;
				if (!seen.has(appId)) {
					seen.add(appId);
					merged.push(app);
				}
			}
		}
		const survivorAppCount = Array.isArray(survivor.openApps) ? survivor.openApps.length : 0;
		if (merged.length !== survivorAppCount) {
			await tx.table('workbenchScenes').update(survivor.id, { openApps: merged });
		}
		for (const loser of losers) {
			await tx.table('workbenchScenes').update(loser.id, { deletedAt: now });
			removed += 1;
		}
	}

	if (removed > 0) {
		console.info(`[workbench-scenes v48] deduped ${removed} duplicate Home scenes`);
	}
});

// v49 — Comic-Character sub-system (docs/plans/comic-module.md §11).
// Space-scoped sibling table to comicStories: a `LocalComicCharacter`
// row groups N variant renderings of "the user as a comic-style
// character" generated via gpt-image-2 / Nano Banana edits over the
// raw face/body meImages with a comic-style prefix. One pinned variant
// is the canonical look; stories snapshot that variant's mediaId at
// story-create time so re-pinning later doesn't rewrite history.
//
// Why space-scoped (not user-scoped): the source meImages this builds
// on are themselves space-scoped after v40. A character generated in
// the personal space references face/body refs that don't exist in
// the brand space, so making the character user-global would orphan
// references on space-switch. Same scoping rationale as wardrobe-
// garments — derived assets travel with their source.
//
// Indices:
//   - createdAt for "newest first" grid ordering
//   - style for style-tab filtering on /comic/character (M5 list-tool)
//   - isFavorite for the favorites filter
//   - isArchived for the standard archive-hide filter
db.version(49).stores({
	comicCharacters: 'id, createdAt, style, isFavorite, isArchived',
});

// v50 — Final normalisation step for the workbench-Home seeding
// cleanup. Soft-deletes every uncustomised "Home" row whose id is NOT
// the deterministic `seed-home-<spaceId>`. After this upgrade runs,
// the only surviving Home rows in any Space are either user-customised
// (description / wallpaper / agent / scope) or already on the
// deterministic-id contract. The per-space-seeds registry recreates a
// fresh `seed-home-<spaceId>` row on the next `setActiveSpace` for
// any Space that lost its uncustomised Home, making the system self-
// healing. Together with v48 this leaves zero legacy duplicates or
// random-UUID seeds in the table. See
// docs/plans/workbench-seeding-cleanup.md.
db.version(50).upgrade(async (tx) => {
	const now = new Date().toISOString();
	let removed = 0;
	await tx
		.table('workbenchScenes')
		.toCollection()
		.modify((row: Record<string, unknown>) => {
			if (row.deletedAt) return;
			if (row.name !== 'Home') return;
			if (typeof row.id !== 'string' || row.id.startsWith('seed-home-')) return;
			if (row.description) return;
			if (row.wallpaper) return;
			if (row.viewingAsAgentId) return;
			const scope = row.scopeTagIds;
			if (Array.isArray(scope) && scope.length > 0) return;
			row.deletedAt = now;
			row.updatedAt = now;
			removed += 1;
		});
	if (removed > 0) {
		console.info(
			`[workbench-scenes v50] retired ${removed} legacy Home rows to deterministic-id contract`
		);
	}
});

// v51 — Lasts module (docs/plans/lasts-module.md M1).
// Mirror sibling to firsts: the *last* time you did/felt/saw something —
// either marked manually or surfaced retrospectively by the inference
// scanner that watches places/contacts/food/habits for frequency drops.
//
// Single space-scoped table. Index strategy:
//   - status for the suspected/confirmed/reclaimed tab filter
//   - category for the category tab filter
//   - date for chronological sort + anniversary scans
//   - recognisedAt for the "recognised X years ago" reminder
//   - isPinned, isArchived for the standard meta-filters
db.version(51).stores({
	lasts: 'id, status, category, date, recognisedAt, isPinned, isArchived',
});

// v52 — Lasts inference cooldown (docs/plans/lasts-module.md M3).
// Records dismissed inference candidates so the scanner doesn't keep
// re-suggesting the same place / contact / habit for ~12 months. ID is
// deterministic (`${refTable}:${refId}`) for structural idempotency:
// re-dismissing the same candidate is a Dexie put no-op-equivalent.
//
// Plaintext only — refTable/refId/dismissedAt are all metadata, no
// user-typed content. Indexed by refTable + dismissedAt so the scanner
// can quickly probe "is this place on cooldown?" and the cooldown sweep
// can expire entries by age.
db.version(52).stores({
	lastsCooldown: 'id, refTable, dismissedAt, [refTable+refId]',
});

// v53 — Sync Field-Meta Overhaul F3 (docs/plans/sync-field-meta-overhaul.md).
// `updatedAt` is no longer a synced data field; replaced by a non-synced
// shadow column `_updatedAtIndex` that the Dexie creating/updating hook
// stamps on every write. All 22 tables that previously indexed `updatedAt`
// now index `_updatedAtIndex` so module queries can keep using
// `.orderBy(...)` for sort. The upgrade step copies the existing
// updatedAt value into _updatedAtIndex so existing local rows stay
// orderable across the version bump.
db.version(53)
	.stores({
		conversations: 'id, isArchived, isPinned, spaceId, templateId, _updatedAtIndex',
		images:
			'id, isFavorite, isPublic, isArchived, prompt, _updatedAtIndex, wardrobeOutfitId, wardrobeGarmentId',
		songs: 'id, artist, album, genre, favorite, title, _updatedAtIndex',
		mukkePlaylists: 'id, name, _updatedAtIndex',
		presiDecks: 'id, isPublic, _updatedAtIndex',
		playgroundConversations: 'id, model, isPinned, _updatedAtIndex',
		journalEntries: 'id, entryDate, mood, isPinned, isArchived, isFavorite, _updatedAtIndex',
		dreams: 'id, dreamDate, mood, isLucid, isPinned, isArchived, _updatedAtIndex',
		dreamSymbols: 'id, name, count, _updatedAtIndex',
		periods: 'id, startDate, endDate, isPredicted, isArchived, _updatedAtIndex',
		periodSymptoms: 'id, name, category, count, _updatedAtIndex',
		notes: 'id, isPinned, isArchived, color, title, _updatedAtIndex',
		quizzes: 'id, isPinned, isArchived, _updatedAtIndex',
		userTagPresets: 'id, userId, isDefault, _updatedAtIndex',
		websites: 'id, slug, publishedVersion, _updatedAtIndex, deletedAt',
		websitePages: 'id, siteId, [siteId+order], [siteId+path], _updatedAtIndex, deletedAt',
		websiteBlocks:
			'id, pageId, parentBlockId, [pageId+order], [pageId+parentBlockId+order], type, _updatedAtIndex, deletedAt',
		writingDrafts: 'id, kind, status, _updatedAtIndex, isFavorite',
		writingStyles: 'id, source, isSpaceDefault, isFavorite, _updatedAtIndex',
	})
	.upgrade(async (tx) => {
		// Copy the existing `updatedAt` value into `_updatedAtIndex` for every
		// row in the affected tables so post-upgrade sorts continue to land
		// in the right order. Rows without an updatedAt fall back to
		// `__fieldMeta` argmax, then to createdAt, then to empty string.
		const tables = [
			'conversations',
			'images',
			'songs',
			'mukkePlaylists',
			'presiDecks',
			'playgroundConversations',
			'journalEntries',
			'dreams',
			'dreamSymbols',
			'periods',
			'periodSymptoms',
			'notes',
			'quizzes',
			'userTagPresets',
			'websites',
			'websitePages',
			'websiteBlocks',
			'writingDrafts',
			'writingStyles',
		];
		for (const tableName of tables) {
			await tx
				.table(tableName)
				.toCollection()
				.modify((row: Record<string, unknown>) => {
					const updatedAt =
						(typeof row.updatedAt === 'string' ? row.updatedAt : undefined) ??
						deriveFromFieldMeta(row) ??
						(typeof row.createdAt === 'string' ? row.createdAt : undefined) ??
						'';
					row._updatedAtIndex = updatedAt;
					// Keep `updatedAt` on the row for now — the F3 store/type
					// sweep below renames every read. The next-version
					// upgrade (or a follow-up cleanup) can drop it once all
					// modules read via the type-converter helper.
				});
		}
	});

/** Local helper for the v53 upgrade — read `__fieldMeta` argmax `at`
 *  without importing the sync layer (which would create a cycle here). */
function deriveFromFieldMeta(row: Record<string, unknown>): string | undefined {
	const meta = row[FIELD_META_KEY];
	if (!meta || typeof meta !== 'object') return undefined;
	let max = '';
	for (const fm of Object.values(meta as Record<string, { at?: string }>)) {
		if (fm && typeof fm.at === 'string' && fm.at > max) max = fm.at;
	}
	return max || undefined;
}

// v54 — Sync Field-Meta Overhaul F6 (docs/plans/sync-field-meta-overhaul.md).
// Persistent `_clientIdentity` table so the per-browser-session sync
// client id survives a localStorage wipe. Without this, every browser-
// state clearing (devtools "Clear site data", incognito flush, …)
// produced a fresh client_id from the sync server's perspective —
// which made the local replay of one's own historical writes look
// like "another session overwrote me", driving the false-positive
// conflict toasts F1+F2 already addressed in code.
//
// Single-row table keyed by `id='self'`. Generated on the first run
// where no value exists in either Dexie or localStorage. Migration:
// the bootstrap code in sync.ts reconciles Dexie ↔ localStorage on
// every load — Dexie is the canonical source, localStorage is the
// fast-read cache that gets restored from Dexie when wiped.
db.version(54).stores({
	_clientIdentity: 'id',
});

// v55 — Sync Field-Meta Overhaul F3 cleanup.
// The v53 upgrade kept the legacy `updatedAt` field on existing rows so
// nothing read it during the cut-over (the F3 sweep migrated 121 store
// files + 43 Local-* types in one pass; v53's comment explicitly
// deferred the row-rewrite). All reads now go through
// `deriveUpdatedAt(record)` from `__fieldMeta`, so the orphan field is
// pure waste — bytes per row, encrypted-blob noise on the encrypted
// tables, and a confusing artifact in the IndexedDB inspector.
//
// Walk every sync-relevant table (the `TABLE_TO_APP` registry) and
// delete `updatedAt` from each row. Idempotent: rows without the field
// are a no-op. Local-only tables (_pendingChanges, _activity,
// _clientIdentity, _aiDebugLog, …) never carried `updatedAt` so they
// stay out of the sweep.
db.version(55).upgrade(async (tx) => {
	const tables = Object.keys(TABLE_TO_APP);
	for (const tableName of tables) {
		try {
			await tx
				.table(tableName)
				.toCollection()
				.modify((row: Record<string, unknown>) => {
					if ('updatedAt' in row) {
						delete row.updatedAt;
					}
				});
		} catch {
			// A table may exist in the registry but not in this Dexie
			// version (e.g. a future addition with no upgrade row yet).
			// The sweep is best-effort cleanup, not load-bearing — skip
			// missing tables silently.
		}
	}
});

// v56 — Articles Bulk-Import (docs/plans/articles-bulk-import.md Phase 1).
// Three new tables that ride the standard sync pipeline under the
// articles appId:
//
//   articleImportJobs  — one row per bulk-import the user kicked off.
//     Indexed on `status` for the JobsList tab filter, `[spaceId+status]`
//     for the per-Space active-job query the worker projection runs,
//     and `_updatedAtIndex` for chronological sort. Lease columns are
//     scanned via JS filter — only ~tens of running jobs per user.
//   articleImportItems — one row per URL inside a job. `[jobId+state]`
//     is the hot index: the JobDetailView range-scans pending+running
//     items per job, and the worker pulls "items in state=pending for
//     these jobIds". `idx` is plain so the in-list display order
//     scrolls without an extra sort key. `state` standalone is used by
//     the cross-job retry-failed query.
//   articleExtractPickup — short-lived inbox between server-worker
//     write and client-pickup-consumer read. `itemId` indexed so the
//     consumer can join back to the owning item row. Empty in steady
//     state; server-side GC caps it at 24 h.
//
// All three are plaintext (encryption registry: plaintext-allowlist).
// `articleImportItems.url` and `articleExtractPickup.payload` ARE
// user-typed-adjacent content but stay plaintext by necessity — the
// server-side worker reads them without master-key access. Same
// rationale as articles.originalUrl. Once the article is persisted,
// the encrypted copy lives in `articles` and the item carries only an
// articleId pointer.
db.version(56).stores({
	articleImportJobs: 'id, status, [spaceId+status], _updatedAtIndex',
	articleImportItems: 'id, jobId, [jobId+state], state, idx',
	articleExtractPickup: 'id, itemId, _updatedAtIndex',
});

// v57 — Forms module M1 skeleton (docs/plans/forms-module.md).
// Two tables: `forms` carries the schema definition (fields, branching,
// settings) plus the visibility/unlisted-token surface so the public
// share endpoint can resolve a token to a form without decrypting; the
// indexed `status` powers the draft/published/closed filter and
// `_updatedAtIndex` keeps the workbench sort cheap. `formResponses`
// holds one row per submission — `[formId+status]` is the hot index for
// the responses tab (per-form, filtered by review state); `formId`
// alone is needed for the cross-status response feed; `submittedAt`
// drives the chronological default sort.
db.version(57).stores({
	forms: 'id, status, _updatedAtIndex',
	formResponses: 'id, formId, status, submittedAt, _updatedAtIndex, [formId+status]',
});

// v58 — Replace the per-Space `kontextDoc` singleton with a flagged
// Note. The `notes` table gets an `isSpaceContext` index so the AI
// Mission Runner's resolver can find the flagged row without scanning
// every note; the kontextDoc table is dropped entirely (the kontext
// module's UI was a write-only shell, the table was never edit-able
// from a real surface). Mutex (max 1 flagged note per Space) is
// enforced by `notesStore.markAsSpaceContext`, not by Dexie.
db.version(58).stores({
	notes: 'id, isPinned, isArchived, isSpaceContext, color, title, _updatedAtIndex',
	kontextDoc: null,
});

// v59 — Drop the legacy context module's Dexie tables (no users, no
// data). Cleans up any orphan tables left in local dev IndexedDB
// instances that ran an earlier schema. The module's UI + registry
// refs were removed in this same commit; v59 is the schema-side drop.
db.version(59).stores({
	contextSpaces: null,
	documents: null,
	documentTags: null,
});

// v60 — Articles bulk-import schema cleanup.
// Two changes, both lossless:
//
//   1. articleImportJobs: drop the unused `leasedBy`/`leasedUntil`
//      columns. They were on the original v57 schema as a soft-lease
//      handshake, but the worker uses pg_try_advisory_xact_lock
//      instead and never wrote them. Dexie's index list shrinks but
//      no data is migrated — the columns simply disappear from
//      future writes; existing rows still carry them as zombies (a
//      one-shot row-rewrite to delete the field would be a hard-
//      migration; not worth it for two never-written nulls).
//   2. articleImportItems: drop the standalone `state` index.
//      `[jobId+state]` covers the only hot query (worker's per-job
//      pending scan). The state-solo index had no call site —
//      retryFailed uses [jobId+state]. Trimming the index list saves
//      a bit of write amplification.
//
// Kept on the schema (not dropped here): `idx` standalone index on
// articleImportItems. It's also unused right now, but the
// JobDetailView currently sorts items in JS via .sort((a,b)=>a.idx-b.idx);
// if that view ever switches to a server-side ordered scan we'd want
// the index back, and re-adding indexes after the fact is more
// painful than keeping a small one around.
db.version(60).stores({
	articleImportJobs: 'id, status, [spaceId+status], _updatedAtIndex',
	articleImportItems: 'id, jobId, [jobId+state], idx',
});

// Schema version 61 — Cards Phase 0: FSRS scheduling.
//
// Two new tables back the new spaced-repetition pipeline:
//
//   - `cardReviews`: FSRS state per learnable unit. A basic card has one
//     row (subIndex=0); basic-reverse has two; cloze has one per cluster.
//     Indexes: `cardId` for "all reviews of this card", `due` for the
//     hot "what's fällig now" query, `[cardId+subIndex]` for the
//     direct lookup the scheduler needs after a rating, `state` for
//     deck-stats panels.
//   - `cardStudyBlocks`: per-day aggregate (cardsReviewed + durationMs).
//     `date` is the only secondary index — the streak query scans the
//     last N days.
//
// `cards` itself doesn't change — `type` and `fields` are non-indexed
// columns. Existing v1 indexes (`difficulty`, `nextReview`, `order`,
// `[deckId+order]`) stay for backwards-compat with the legacy renderer.
db.version(61).stores({
	cardReviews: 'id, cardId, due, [cardId+subIndex], state',
	cardStudyBlocks: 'id, date',
});

// v62 — Food + Wardrobe module retirement (2026-05-18).
// Food und Wardrobe sind als Standalone-Apps (Nutriphi, Werdrobe) auf
// eigene Domains gewandert. Tabellen werden hier komplett gedroppt;
// dropped: meals, goals, foodFavorites, mealTags, wardrobeGarments,
// wardrobeOutfits. Picture-Image back-ref-Indices (wardrobeOutfitId /
// wardrobeGarmentId) werden aus dem `images`-Schema entfernt; der
// Upgrade-Step strippt die toten FK-Properties aus existierenden
// Image-Rows, damit kein orphaner FK auf nicht-mehr-existierende
// Wardrobe-Records zurückbleibt.
db.version(62)
	.stores({
		meals: null,
		goals: null,
		foodFavorites: null,
		mealTags: null,
		wardrobeGarments: null,
		wardrobeOutfits: null,
		images: 'id, isFavorite, isPublic, isArchived, prompt, _updatedAtIndex',
	})
	.upgrade(async (tx) => {
		await tx
			.table('images')
			.toCollection()
			.modify((image) => {
				if ('wardrobeOutfitId' in image) delete image.wardrobeOutfitId;
				if ('wardrobeGarmentId' in image) delete image.wardrobeGarmentId;
			});
	});

// v63 — Plants + Who module retirement (2026-05-18).
// Plants → Herbatrium (herbatrium.mana.how) und Who → eigenständiger
// Bun-Stack auf who.mana.how (außerhalb des managarten-Repos). Beide
// Modul-Surfaces sind aus dem unified Mana-Web entfernt; die Tabellen
// werden hier komplett gedroppt.
db.version(63).stores({
	plants: null,
	plantPhotos: null,
	wateringSchedules: null,
	wateringLogs: null,
	plantTags: null,
	whoGames: null,
	whoMessages: null,
});

// v64 — Memoro module retirement (2026-05-18).
// Memoro lebt als eigenständiger Stack auf memoro-app.mana.how /
// memoro-api.mana.how / memoro-audio.mana.how aus Code/memoro/ →
// ~/projects/memoro-deploy/. Die unified-App-Surface (Modul +
// memoro-server-Container im managarten-Compose) wird hier gedroppt.
// dropped: memos, memories, memoTags, memoroSpaces, spaceMembers,
// memoSpaces.
db.version(64).stores({
	memos: null,
	memories: null,
	memoTags: null,
	memoroSpaces: null,
	spaceMembers: null,
	memoSpaces: null,
});

// v65 — News module retirement (2026-05-18).
// News-Reader-Surface ist nach Pageta (pageta.mana.how) umgezogen,
// das mit eigener Postgres-DB + eigenem Article-Store läuft. Der
// kuratierte Pool selbst lebt im Plattform-Service `mana-news-pool`
// und wird via news-research (in managarten) + Pageta-Reader (extern)
// weiterhin genutzt.
// dropped: newsArticles, newsCategories, newsPreferences, newsReactions,
//          newsCachedFeed (war NICHT synced, nur local-mirror).
db.version(65).stores({
	newsArticles: null,
	newsCategories: null,
	newsPreferences: null,
	newsReactions: null,
	newsCachedFeed: null,
});

// v66 — Comic module retirement (2026-05-18).
// Comic-Surface ist nach Comicello (comicello.mana.how / comicello.com)
// umgezogen, das mit eigener Postgres-DB läuft. Tabellen werden hier
// komplett gedroppt; Picture-Image back-ref-Properties (comicStoryId /
// comicPanelIndex / comicCharacterId) waren nie indiziert und werden
// per .upgrade() aus alten Image-Rows gestrippt, damit keine orphane
// FKs auf nicht-mehr-existierende Comic-Records zurückbleiben.
db.version(66)
	.stores({
		comicStories: null,
		comicCharacters: null,
	})
	.upgrade(async (tx) => {
		await tx
			.table('images')
			.toCollection()
			.modify((image) => {
				if ('comicStoryId' in image) delete image.comicStoryId;
				if ('comicPanelIndex' in image) delete image.comicPanelIndex;
				if ('comicCharacterId' in image) delete image.comicCharacterId;
			});
	});

// ─── Sync Routing ──────────────────────────────────────────
// SYNC_APP_MAP, TABLE_TO_SYNC_NAME, TABLE_TO_APP, SYNC_NAME_TO_TABLE,
// toSyncName() and fromSyncName() are now derived from per-module
// `module.config.ts` files via `module-registry.ts` (re-exported above).
// To register a new sync table: edit that module's config — no edits in
// this file are needed.

// ─── Change Tracking via Dexie Hooks ─────────────────────────
// Automatically records pending changes for every write to sync-relevant tables.
// This means module stores (taskTable.add(), etc.) don't need manual trackChange() calls.

/**
 * Tables that are currently having server changes applied. Hooks for tables
 * in this set skip pending-change tracking (sync loop guard) — but writes to
 * OTHER tables continue tracking normally, so a user typing into chat while
 * todo is syncing no longer silently drops the chat write.
 *
 * Replaces a single global boolean that previously caused a cross-app race:
 * one app's apply could swallow another app's writes for the duration.
 */
const _applyingTables = new Set<string>();

/**
 * Marks one or more tables as "currently applying server changes".
 * Returned dispose function MUST be called (use try/finally) to clear them.
 */
export function beginApplyingTables(tables: Iterable<string>): () => void {
	const added: string[] = [];
	for (const t of tables) {
		if (!_applyingTables.has(t)) {
			_applyingTables.add(t);
			added.push(t);
		}
	}
	return () => {
		for (const t of added) _applyingTables.delete(t);
	};
}

/** True when a write to `tableName` should bypass the pending-change hook. */
export function isApplyingTable(tableName: string): boolean {
	return _applyingTables.has(tableName);
}

const pendingChangesTable = db.table('_pendingChanges');

/**
 * Fire-and-forget pending-change writer that surfaces quota errors via the
 * QUOTA_EVENT bus. Without this wrapper, a full IndexedDB would silently
 * swallow the change-tracking entry while the user-visible write succeeded
 * — meaning the user types something, sees it, and the edit never syncs.
 *
 * The Dexie creating/updating hook itself is synchronous and cannot await
 * a recovery, so we just dispatch the event and let the UI / sync engine
 * decide what to do (e.g. surface a toast, run cleanupTombstones).
 *
 * IMPORTANT: Dexie hooks fire inside the calling write's implicit transaction
 * which only includes the user-facing table (e.g. `tasks`). Writing to
 * `_pendingChanges` from there hits `NotFoundError: object store not in
 * scope`. We defer the write to a microtask so it runs in a fresh
 * transaction after the user's commit lands.
 *
 * After the row lands, `pendingChangeListener` (set by sync.ts at startup)
 * is invoked with the change's appId so the unified sync engine can push
 * immediately. Without that listener, pending rows would only ever drain
 * on the next page reload via drainLeftoverPending.
 */
let pendingChangeListener: ((appId: string) => void) | null = null;

export function setPendingChangeListener(fn: ((appId: string) => void) | null): void {
	pendingChangeListener = fn;
}

function trackPendingChange(table: string, change: Record<string, unknown>): void {
	// setTimeout (not queueMicrotask) is required: Dexie binds the active
	// transaction to the current Zone via Promise scheduling, and a microtask
	// is still considered "inside" the transaction. setTimeout(0) breaks out
	// completely so the new add() spawns its own implicit transaction.
	setTimeout(() => {
		pendingChangesTable
			.add(change)
			.then(() => {
				const appId = change.appId;
				if (typeof appId === 'string' && pendingChangeListener) {
					pendingChangeListener(appId);
				}
			})
			.catch((err: unknown) => {
				if (isQuotaError(err)) {
					notifyQuotaExceeded({ table, op: 'pending-change', cleaned: 0, recovered: false });
				} else {
					console.error('[mana-sync] failed to record pending change:', err);
				}
			});
	}, 0);
}

/**
 * Append a row to the local activity log. Fire-and-forget, deferred via
 * setTimeout for the same reason as `trackPendingChange` (Dexie hook is
 * inside the user's transaction; we need a fresh one).
 *
 * Lives here in database.ts (rather than activity.ts) so it can share
 * the same `db` reference without causing an import cycle. The
 * `getRecentActivity` / `pruneActivityLog` read+cleanup APIs live in
 * activity.ts.
 *
 * Errors are swallowed: the activity log is a debugging convenience,
 * not load-bearing data, and surfacing the same QuotaError twice (once
 * for the real write, once for the activity row) would just spam the
 * user via the quota toast.
 */
/**
 * @deprecated Replaced by the Domain Event Store (`_events` table).
 * Module stores now emit semantic events via `emitDomainEvent()`.
 * This function is a no-op — kept to avoid removing call sites in
 * the hooks below. The `_activity` table is no longer written to;
 * use `queryEvents()` from `data/events/event-store.ts` instead.
 */
function trackActivity(
	_appId: string,
	_collection: string,
	_recordId: string,
	_op: 'insert' | 'update' | 'delete'
): void {
	// No-op: replaced by Domain Event Store (see data/events/)
}

/**
 * Hidden field on every synced record carrying per-field write metadata.
 *
 * Shape: `{ [fieldKey]: FieldMeta }` where `FieldMeta = { at, actor, origin }`.
 * Replaces the older triple `__fieldTimestamps` + `__fieldActors` +
 * `__lastActor` — same information, single source of truth.
 *
 * Not indexed, never sent to the server as a top-level payload field
 * (the wire format carries it as part of `change.fields[k]` instead).
 *
 * For `__lastActor` consumers: the previous "actor that last wrote the
 * record as a whole" is now derived as `__fieldMeta[argmax(at)].actor`.
 */
export const FIELD_META_KEY = '__fieldMeta';

/**
 * Local-only shadow column the Dexie hook stamps on every create + update
 * write. Holds the latest `now` ISO so module queries can `.orderBy(...)`
 * by it instead of the (now derived) `updatedAt`. Stripped from
 * pending-change payloads so it never travels to mana-sync — it is rebuilt
 * locally on each write, including server-replays via applyServerChanges.
 */
export const UPDATED_AT_INDEX_KEY = '_updatedAtIndex';

function isInternalKey(key: string): boolean {
	return key === 'id' || key === FIELD_META_KEY || key === UPDATED_AT_INDEX_KEY;
}

/**
 * Tables whose rows are scoped to a specific user rather than to a
 * Space. These are singletons or small lookups tied to the signed-in
 * identity (preferences, the profile hub, per-user templates). The
 * creating-hook continues to stamp `userId` on these; data tables
 * (tasks, events, tags, …) stopped carrying `userId` in Phase 2c of
 * the space-scoped data model rollout — attribution there lives on
 * `__fieldMeta` and tenancy on `spaceId`.
 *
 * Keeping this list explicit instead of inferring by naming
 * convention: the audit in docs/plans/space-scoped-data-model.md
 * appendix enumerates exactly which tables need user-level stamping,
 * and a typo here would silently re-introduce `userId` on a data
 * table.
 */
const USER_LEVEL_TABLES: ReadonlySet<string> = new Set([
	'userSettings',
	'userContext',
	'newsPreferences',
	'meditateSettings',
	'sleepSettings',
	'moodSettings',
	'timeSettings',
	'invoiceSettings',
	'broadcastSettings',
	'wetterSettings',
	'userTagPresets',
	// meImages removed in v40 — now space-scoped like every other
	// data-table. See docs/plans/me-images-space-scope-migration.md.
]);

for (const [appId, tables] of Object.entries(SYNC_APP_MAP)) {
	for (const tableName of tables) {
		const table = db.table(tableName);

		table.hook('creating', function (_primKey, obj) {
			if (_applyingTables.has(tableName)) return;
			const now = new Date().toISOString();
			// Capture the actor synchronously — ambient context is only reliable
			// inside the caller's microtask, not across the setTimeout'd
			// trackPendingChange below. Freezing it here is the authoritative step.
			const actor: Actor = getCurrentActor();

			// Auto-stamp the active user. Module stores never set userId
			// themselves. After Phase 2c, user-level tables (userSettings,
			// invoiceSettings, userTagPresets, …) continue to carry a
			// userId column because their records are primarily scoped to
			// the user, not a Space. Data tables (tasks, events, tags, …)
			// no longer get userId stamped — attribution on data records
			// lives on the Actor fields (__lastActor / __fieldActors) and
			// tenancy on spaceId.
			const objRecord = obj as Record<string, unknown>;
			const effectiveUserId = getEffectiveUserId();
			const isUserLevel = USER_LEVEL_TABLES.has(tableName);

			if (isUserLevel) {
				if (objRecord.userId === undefined || objRecord.userId === null) {
					objRecord.userId = effectiveUserId;
				}
				// User-level tables DON'T get Space-scope fields — they're
				// genuinely user-scoped, not tenant-scoped. v28 stamped
				// them anyway as a byproduct of the blanket migration;
				// Phase 2c-followup removed those fields retroactively
				// (see v36 below). Skipping the stamps here keeps future
				// rows clean.
			} else {
				// Auto-stamp Space-scope fields on data tables. The hook
				// resolves `getEffectiveSpaceId()` which returns the
				// currently-active Space's id — so a calendar event
				// created during a Brand-Space session lands under that
				// Brand UUID, not under Personal. During the bootstrap
				// window before `loadActiveSpace` resolves, the helper
				// falls back to the sentinel `_personal:<userId>` which
				// `reconcileSentinels` rewrites once the real id is known.
				//
				// Stores can set `spaceId` explicitly when writing to a
				// space they're not currently active in (e.g. workbench-
				// home seeder writes to a target Space's id, not the
				// active one) — the hook only fills in the gap.
				if (objRecord.spaceId === undefined || objRecord.spaceId === null) {
					objRecord.spaceId = getEffectiveSpaceId();
				}
				if (objRecord.authorId === undefined || objRecord.authorId === null) {
					objRecord.authorId = effectiveUserId;
				}
				if (objRecord.visibility === undefined || objRecord.visibility === null) {
					objRecord.visibility = 'space';
				}
			}

			// Stamp every user-data field with `__fieldMeta[key] = { at, actor, origin }`.
			// `at` drives field-LWW ordering, `actor` carries attribution forward
			// across renames, `origin` distinguishes user edits from system /
			// migration / agent / server-replay writes for conflict-detection.
			// `origin` is derived from `actor.kind`:
			//   user → 'user'
			//   ai → 'agent' (mission-runner / tool executor)
			//   system + SYSTEM_MIGRATION → 'migration' (Dexie upgrades, repair routines)
			//   any other system source → 'system' (projection, rule, stream, …)
			const origin = originFromActor(actor);
			const fieldMeta: Record<string, FieldMeta> = {};
			for (const key of Object.keys(obj)) {
				if (isInternalKey(key)) continue;
				fieldMeta[key] = makeFieldMeta(now, actor, origin);
			}
			objRecord[FIELD_META_KEY] = fieldMeta;
			// Stamp the local-only shadow column for indexed sorts. Stripped
			// from `dataForSync` below so it never lands in pending-changes.
			objRecord[UPDATED_AT_INDEX_KEY] = now;

			// Build payload for pending-change WITHOUT the internal bookkeeping fields.
			const {
				[FIELD_META_KEY]: _fm,
				[UPDATED_AT_INDEX_KEY]: _uai,
				...dataForSync
			} = obj as Record<string, unknown>;

			trackPendingChange(tableName, {
				appId,
				collection: tableName,
				recordId: obj.id,
				op: 'insert',
				data: dataForSync,
				actor,
				origin,
				createdAt: now,
				spaceId: typeof objRecord.spaceId === 'string' ? (objRecord.spaceId as string) : undefined,
			});
			trackActivity(appId, tableName, obj.id, 'insert');
			trackFirstContent(appId);
			fireTrigger(appId, tableName, 'insert', { ...dataForSync });
			// Defer cross-table reads outside the Dexie hook's transaction scope
			const objCopy = { ...dataForSync };
			setTimeout(() => {
				checkInlineSuggestion(appId, tableName, objCopy).then((sug) => {
					if (sug)
						window.dispatchEvent(new CustomEvent('mana:automation-suggest', { detail: sug }));
				});
			}, 0);
		});

		table.hook('updating', function (modifications, primKey, obj) {
			if (_applyingTables.has(tableName)) return undefined;
			const now = new Date().toISOString();
			const actor: Actor = getCurrentActor();
			const origin = originFromActor(actor);
			const fields: Record<string, { value: unknown; at: string }> = {};

			// userId is immutable after creation. Silently strip any attempt to
			// reassign it from a local update so a buggy or malicious caller can
			// never re-parent records to a different user.
			const mods = modifications as Record<string, unknown>;
			if ('userId' in mods) delete mods.userId;

			// spaceId and authorId are likewise immutable. Moving a record
			// between spaces is a different operation (delete + re-create)
			// because it affects encryption key, sync partition and
			// permission-matrix resolution. visibility, by contrast, CAN
			// flip (user toggles a record to 'private' and back), so it is
			// left as a normal field.
			if ('spaceId' in mods) delete mods.spaceId;
			if ('authorId' in mods) delete mods.authorId;

			// Merge __fieldMeta: keep existing entries (so untouched fields
			// retain their original at/actor/origin), overwrite each modified
			// field with the current write's metadata.
			const existingMeta =
				((obj as Record<string, unknown>)[FIELD_META_KEY] as
					| Record<string, FieldMeta>
					| undefined) ?? {};
			const newMeta: Record<string, FieldMeta> = { ...existingMeta };

			for (const [key, value] of Object.entries(modifications)) {
				if (isInternalKey(key)) continue;
				fields[key] = { value, at: now };
				newMeta[key] = makeFieldMeta(now, actor, origin);
			}

			const op = (modifications as Record<string, unknown>).deletedAt ? 'delete' : 'update';
			// spaceId is immutable and therefore not in `fields` for updates —
			// but the server wants it as a first-class column on every row.
			// Read it from the pre-update record so the pending-change row
			// carries the right space for routing even when only a title changed.
			const existingSpaceId =
				typeof (obj as Record<string, unknown>).spaceId === 'string'
					? ((obj as Record<string, unknown>).spaceId as string)
					: undefined;
			trackPendingChange(tableName, {
				appId,
				collection: tableName,
				recordId: primKey as string,
				op,
				fields,
				actor,
				origin,
				deletedAt: (modifications as Record<string, unknown>).deletedAt as string | undefined,
				createdAt: now,
				spaceId: existingSpaceId,
			});
			trackActivity(appId, tableName, primKey as string, op);
			fireTrigger(appId, tableName, op, modifications as Record<string, unknown>);

			// Returning an object from a Dexie 'updating' hook merges it into the
			// modifications applied to the record — use this to persist the merged
			// __fieldMeta alongside the user's data update, plus refresh the
			// local-only `_updatedAtIndex` shadow so indexed sorts see the
			// latest write.
			return {
				[FIELD_META_KEY]: newMeta,
				[UPDATED_AT_INDEX_KEY]: now,
			};
		});
	}
}
