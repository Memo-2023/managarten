/**
 * Plaintext allowlist — Dexie tables that are intentionally NOT encrypted.
 *
 * Counterpart to ENCRYPTION_REGISTRY in crypto/registry.ts. The audit script
 * (`scripts/audit-crypto-registry.mjs`, wired as `pnpm run check:crypto`)
 * fails if a Dexie table is in neither list.
 *
 * Why a separate file: adding a table here is a conscious security decision
 * ("this genuinely holds no user-sensitive data") and should be reviewable
 * as its own diff, not buried inside database.ts.
 *
 * Auto-seeded from current state on 2026-04-20 — every entry below was
 * introduced before the audit script existed. The `// TODO: audit` markers
 * are an invitation to review each one: does this table really hold nothing
 * that would embarrass the user if it leaked? If not, move it to the
 * encryption registry.
 */

export const PLAINTEXT_ALLOWLIST: readonly string[] = [
	'achievements', // TODO: audit
	'activities', // TODO: audit
	'albumItems', // TODO: audit
	'albums', // TODO: audit
	'articleTags', // FK-only junction into globalTags (articleId, tagId). Tag names live in globalTags.
	'articleImportJobs', // Bulk-import job header (counters, status, lease metadata). Pure operational state, no user-typed content. See docs/plans/articles-bulk-import.md.
	'articleImportItems', // One row per URL in a bulk job. URL is plaintext by necessity — server-worker reads it without master-key access (same rationale as articles.originalUrl).
	'articleExtractPickup', // Short-lived server-write inbox; the client picks up the extracted payload, encrypts it into the articles table, deletes the row. Plaintext by necessity (server has no master key); empty in steady state.
	'automations', // TODO: audit
	'boardViews', // TODO: audit
	'budgets', // TODO: audit
	'calculations', // TODO: audit
	'calendars', // TODO: audit
	'ccFavorites', // TODO: audit
	'ccLocationTags', // TODO: audit
	'ccLocations', // TODO: audit
	'cities', // TODO: audit
	'companionConversations', // TODO: audit
	'companionGoals', // TODO: audit
	'companionMessages', // TODO: audit
	'contactTags', // TODO: audit
	'conversationTags', // TODO: audit
	'customQuotes', // TODO: audit
	'dashboardConfigs', // TODO: audit
	'deckTags', // TODO: audit
	'documentTags', // TODO: audit
	'dreamTags', // TODO: audit
	'entryTags', // TODO: audit
	'eventInvitations', // TODO: audit
	'eventItems', // TODO: audit
	'eventTags', // TODO: audit
	'fileTags', // TODO: audit
	'financeCategories', // TODO: audit
	'foodFavorites', // TODO: audit
	'goals', // TODO: audit
	'guideCollections', // TODO: audit
	'guideTags', // TODO: audit
	'habitLogs', // TODO: audit
	'habits', // TODO: audit
	'imageTags', // TODO: audit
	'invCategories', // TODO: audit
	'invCollections', // TODO: audit
	'invItemTags', // TODO: audit
	'invLocations', // TODO: audit
	'linkTags', // TODO: audit
	'manaLinks', // TODO: audit
	'markers', // TODO: audit
	'mealTags', // TODO: audit
	'memoSpaces', // TODO: audit
	'memoTags', // TODO: audit
	'memoroSpaces', // TODO: audit
	'moodTags', // TODO: audit
	'moods', // TODO: audit
	'mukkeProjects', // TODO: audit
	'newsCachedFeed', // TODO: audit
	'noteTags', // TODO: audit
	'periodSymptoms', // TODO: audit
	'photoFavorites', // TODO: audit
	'photoMediaTags', // TODO: audit
	'placeTags', // TODO: audit
	'plantPhotos', // TODO: audit
	'plantTags', // TODO: audit
	'playlistSongs', // TODO: audit
	'presiDeckTags', // TODO: audit
	'qCollections', // TODO: audit
	'questionTags', // TODO: audit
	'quizAttempts', // TODO: audit
	'quotesFavorites', // TODO: audit
	'quotesListTags', // TODO: audit
	'quotesLists', // TODO: audit
	'reminders', // TODO: audit
	'ritualLogs', // TODO: audit
	'ritualSteps', // TODO: audit
	'rituals', // TODO: audit
	'runs', // TODO: audit
	'savedFormulas', // TODO: audit
	'sequences', // TODO: audit
	'skillTags', // TODO: audit
	'skills', // TODO: audit
	'songTags', // TODO: audit
	'spaceMembers', // TODO: audit
	'storageFolders', // TODO: audit
	'taskLabels', // TODO: audit
	'timeAlarms', // TODO: audit
	'timeBlockTags', // TODO: audit
	'timeClients', // TODO: audit
	'timeCountdownTimers', // TODO: audit
	'timeEntries', // TODO: audit
	'timeProjects', // TODO: audit
	'timeSettings', // TODO: audit
	'timeTemplates', // TODO: audit
	'timeWorldClocks', // TODO: audit
	'todoProjects', // TODO: audit
	'uloadFolders', // TODO: audit
	'uloadTags', // TODO: audit
	'userSettings', // TODO: audit
	'wateringLogs', // TODO: audit
	'wateringSchedules', // TODO: audit
	'wetterLocations', // TODO: audit
	'wetterSettings', // TODO: audit
	'wishesItems', // TODO: audit
	'wishesLists', // TODO: audit
	'wishesPriceChecks', // TODO: audit
];
