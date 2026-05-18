/**
 * Encryption registry — single source of truth for which fields on which
 * tables get encrypted.
 *
 * Strict allowlist semantics: anything not listed here stays plaintext.
 * Adding a new module = adding an entry here OR an entry in
 * `plaintext-allowlist.ts` (explicit "this table genuinely holds no
 * sensitive data"). The `pnpm run check:crypto` audit script enforces
 * that every Dexie table appears in exactly one of the two — forgetting
 * a new table now fails CI instead of silently shipping plaintext.
 *
 * Why a central registry instead of per-module config?
 *   - One pull request to audit ahead of a release: "what is encrypted?"
 *   - The Dexie hook in database.ts iterates this map once at startup
 *     instead of looking up per-module config files at write time
 *   - Keeps the encryption surface visible to security review without
 *     hunting through 27 module directories
 *
 * Phasing:
 *   `enabled: false` is the safe default for Phase 1. The actual flip
 *   to `true` happens in Phase 3, table by table, after the server-side
 *   vault is wired up and the key provider is no longer NullKeyProvider.
 *   This means Phase 1 can land on main without changing app behaviour.
 *
 * Field selection rules:
 *   - Encrypt: user-typed text, transcripts, PII, free-form notes,
 *     anything that would embarrass or harm the user if it leaked
 *   - Plaintext: IDs, foreign keys, timestamps, status flags, sort keys,
 *     enum discriminators, anything indexed for queries
 *   - When in doubt about a free-form field, encrypt it
 *   - When in doubt about a structural field, leave it plaintext (the
 *     query layer needs it)
 *
 * Authoring pattern — use `entry<LocalType>()` for type-safety:
 *
 *   import type { LocalNote } from '$lib/modules/notes/types';
 *   notes: entry<LocalNote>(['title', 'content']),
 *
 * TypeScript rejects field names that don't exist on the row type. This
 * catches the #1 silent-failure mode: a registry typo (wrong case, wrong
 * name) → the field quietly ships in plaintext forever, with no error
 * anywhere. Plain object-literal entries (`{ enabled, fields }`) still
 * compile — migrate them opportunistically, new entries should always use
 * the helper. A dev-only runtime check in `record-helpers.ts` catches
 * typos for untyped entries as a fallback.
 */

export interface EncryptionConfig {
	/** Field names that get encrypted on write, decrypted on read. */
	readonly fields: readonly string[];
	/** Phase 1 hard-default: false. Flipped table by table in Phase 3. */
	readonly enabled: boolean;
}

/**
 * Type-safe registry entry. Pass the Local* row type explicitly — TypeScript
 * rejects field names that don't exist on the type, catching the most common
 * silent failure mode (registry typo → field stays plaintext forever).
 *
 *   import type { LocalMessage } from '$lib/modules/chat/types';
 *   messages: entry<LocalMessage>(['messageText']),
 *
 * Object-literal entries still work (untyped) so this can be adopted
 * incrementally, one module at a time. New entries should always use `entry`.
 */
export function entry<T extends object>(
	fields: readonly (keyof T & string)[],
	opts: { enabled?: boolean } = {}
): EncryptionConfig {
	return { enabled: opts.enabled ?? true, fields };
}

// Typed imports for migrated entries. Kept as `import type` so this file
// produces no runtime dependencies on the module tree — the registry must
// stay bootable during Dexie schema init, before any module code runs.
import type { LocalMessage, LocalConversation, LocalTemplate } from '../../modules/chat/types';
import type { LocalNote } from '../../modules/notes/types';
import type { LocalDream, LocalDreamSymbol } from '../../modules/dreams/types';
import type { LocalJournalEntry } from '../../modules/journal/types';
import type { LocalMemo } from '../../modules/memoro/types';
import type {
	LocalInvoice,
	LocalInvoiceClient,
	LocalInvoiceSettings,
} from '../../modules/invoices/types';
import type {
	LocalCampaign,
	LocalBroadcastTemplate,
	LocalBroadcastSettings,
} from '../../modules/broadcasts/types';
import type { LocalArticle, LocalHighlight } from '../../modules/articles/types';
import type { LocalMeImage } from '../../modules/profile/types';
import type {
	LocalDraft,
	LocalDraftVersion,
	LocalGeneration,
	LocalWritingStyle,
} from '../../modules/writing/types';
import type { LocalComicStory, LocalComicCharacter } from '../../modules/comic/types';
import type { LocalAugurEntry } from '../../modules/augur/types';
import type { LocalForm, LocalFormResponse } from '../../modules/forms/types';

export const ENCRYPTION_REGISTRY: Record<string, EncryptionConfig> = {
	// ─── Chat ────────────────────────────────────────────────
	// Phase 5: messageText is the highest-value target in the entire app.
	messages: entry<LocalMessage>(['messageText']),
	conversations: entry<LocalConversation>(['title']),
	chatTemplates: entry<LocalTemplate>(['name', 'description', 'systemPrompt', 'initialQuestion']),

	// ─── Who (LLM character guessing game) ──────────────────
	// Conversation content + the revealed character name + free-form
	// notes count as user-typed content. Plaintext: ids, FK, status,
	// timestamps, message counts (all needed for query/sort/filter).
	whoGames: { enabled: true, fields: ['revealedName', 'notes'] },
	whoMessages: { enabled: true, fields: ['content'] },

	// ─── Notes ───────────────────────────────────────────────
	// Phase 4 pilot — first table flipped to enabled:true. The schema
	// uses `title` + `content` (no separate `body` column).
	notes: entry<LocalNote>(['title', 'content']),

	// ─── Journal ─────────────────────────────────────────────
	// Daily freeform entries — title and content are the user-typed parts.
	// entryDate, mood (enum), tags (string[]), isPinned/isArchived/isFavorite,
	// wordCount stay plaintext for indexing, sorting, and insights.
	journalEntries: entry<LocalJournalEntry>(['title', 'content']),

	// ─── Dreams ──────────────────────────────────────────────
	// LocalDream uses content + transcript + interpretation, no `notes`.
	dreams: entry<LocalDream>([
		'title',
		'content',
		'transcript',
		'interpretation',
		'aiInterpretation',
		'location',
	]),
	// Symbol `name` stays plaintext — it's used as the unique lookup key
	// in touchSymbols / updateSymbol via where('name').equals(...). Only
	// the user-written `meaning` (which is the actually sensitive part)
	// is encrypted.
	dreamSymbols: entry<LocalDreamSymbol>(['meaning']),

	// ─── Memoro ──────────────────────────────────────────────
	// Voice transcripts are typically the largest plaintext blobs in the
	// whole app — encrypting them yields the biggest disk-footprint win
	// of any single field.
	memos: entry<LocalMemo>(['title', 'intro', 'transcript']),
	memories: { enabled: true, fields: ['title', 'content'] },

	// ─── Contacts ────────────────────────────────────────────
	contacts: {
		enabled: true,
		fields: [
			'firstName',
			'lastName',
			'email',
			'phone',
			'mobile',
			'birthday',
			'street',
			'city',
			'postalCode',
			'country',
			'notes',
			'website',
			'linkedin',
			'twitter',
			'instagram',
			'github',
		],
	},

	// ─── Tasks ───────────────────────────────────────────────
	// Phase 7.1: tasks coordinated with timeBlocks below — title and
	// description are duplicated to the TimeBlock for calendar display,
	// so both sides have to be encrypted in lockstep.
	tasks: { enabled: true, fields: ['title', 'description', 'subtasks', 'metadata'] },

	// ─── Calendar ────────────────────────────────────────────
	// Same coordination as tasks: events.title/description/location are
	// mirrored onto a TimeBlock; encrypting only the calendar copy
	// would still leak via the timeBlocks table.
	events: { enabled: true, fields: ['title', 'description', 'location'] },

	// ─── Period ──────────────────────────────────────────────
	// Health data — GDPR Art. 9 sensitive personal data category.
	// `symptoms` stays plaintext: it's a string-array of standardised
	// labels (cramps, headache, ...) used as a Set in the symptom
	// counter store; encrypting it would break the diff loop in
	// dayLogsStore.logDay. `mood` is a single enum but with the same
	// privacy sensitivity as `notes` — encrypt it.
	periods: { enabled: true, fields: ['notes'] },
	periodDayLogs: { enabled: true, fields: ['notes', 'mood'] },

	// ─── Cards ───────────────────────────────────────────────
	// User-typed content lives in three places on LocalCard:
	//   - legacy `front`/`back` columns (pre-Phase-0 rows still use them)
	//   - new `fields` map (Phase 0+, holds basic.{front,back} or cloze.{text,extra})
	// All three encrypt; wrapValue handles object payloads transparently.
	// cardDecks uses `name` (not `title`) on the schema even though the
	// public DTO translates it to `title`.
	cards: { enabled: true, fields: ['front', 'back', 'fields'] },
	cardDecks: { enabled: true, fields: ['name', 'description'] },

	// ─── Presi ───────────────────────────────────────────────
	// LocalSlide only has `content` (SlideContent object) — no separate
	// notes column on the schema. JSON-stringify in wrapValue handles
	// the nested object cleanly.
	presiDecks: { enabled: true, fields: ['title', 'description'] },
	slides: { enabled: true, fields: ['content'] },

	// ─── Storage ─────────────────────────────────────────────
	// `name` IS indexed but no .where('name') call site exists in the
	// app — encryption is safe, the index just becomes a no-op for
	// content lookups (the file browser scans+filters in JS anyway).
	// LocalFile has no `notes` column on the schema; the user-typed
	// values are name (display name) + originalName (uploaded filename).
	// mimeType / size / storagePath / checksum stay plaintext for the
	// thumbnail + storage-layer code paths.
	files: { enabled: true, fields: ['name', 'originalName'] },

	// ─── Picture ─────────────────────────────────────────────
	// LocalImage has prompt + negativePrompt as the user-typed text.
	// The Phase 1 placeholder also listed `revisedPrompt` and `notes`
	// but neither column exists on the schema. `prompt` IS indexed but
	// no .where('prompt') call site exists — same as files.name above.
	// model / style / format / blurhash stay plaintext (technical
	// metadata, not user content).
	images: { enabled: true, fields: ['prompt', 'negativePrompt'] },
	// Picture boards live next to images. `name` + `description` on the
	// board itself are user-typed and protected. `textContent` on
	// LocalBoardItem is the freeform text the user types when they add
	// a sticky-note style item to a canvas (only set when
	// itemType === 'text'). For image-type items the field is null and
	// encryptRecord is a pass-through. Coordinates / dimensions /
	// z-index / opacity stay plaintext for the canvas renderer.
	boards: { enabled: true, fields: ['name', 'description'] },
	boardItems: { enabled: true, fields: ['textContent'] },

	// ─── Music ───────────────────────────────────────────────
	// Music metadata is borderline-sensitive: technical ID3 tags vs
	// user listening history. Encrypting `title` (which uniquely
	// identifies a track) gives meaningful privacy; leaving artist /
	// album / albumArtist / genre PLAINTEXT keeps the album+artist
	// browsing views fast (they aggregate by those fields and would
	// otherwise force a per-song decrypt to render the index).
	// `lyrics` / `notes` listed in the Phase 1 placeholder don't
	// exist on LocalSong.
	songs: { enabled: true, fields: ['title'] },
	mukkePlaylists: { enabled: true, fields: ['name', 'description'] },

	// ─── Questions ───────────────────────────────────────────
	// LocalQuestion uses `title` + `description`; LocalAnswer uses
	// `content` (not `body`). The view-driven write sites are wrapped
	// directly via encryptRecord at each call site since this module
	// has no central store yet.
	questions: { enabled: true, fields: ['title', 'description'] },
	answers: { enabled: true, fields: ['content'] },

	// ─── Events (social gatherings) ──────────────────────────
	// Distinct from calendar.events — these have guest lists, RSVPs,
	// and shareable invitation tokens. None of the encrypted columns
	// are indexed (status / timeBlockId / hostContactId carry the
	// browsing keys), so the rollout is straightforward. Phase 1
	// placeholder listed a `notes` column on socialEvents that doesn't
	// exist; the actual user-typed text is title/description/location.
	// On eventGuests the user-typed text is name/email/phone/note
	// (singular).
	socialEvents: { enabled: true, fields: ['title', 'description', 'location'] },
	eventGuests: { enabled: true, fields: ['name', 'email', 'phone', 'note'] },

	// ─── Finance ─────────────────────────────────────────────
	// Transactions are budget-grade PII — amount/date/categoryId stay
	// plaintext for indexing + aggregation, only the user-typed text
	// fields (description + note) are encrypted. The schema uses
	// `note` (singular), not `notes` or `merchant`.
	transactions: { enabled: true, fields: ['description', 'note'] },

	// ─── uLoad ───────────────────────────────────────────────
	// `originalUrl` STAYS PLAINTEXT — the redirect handler resolves
	// shortCode → originalUrl on every click, encrypting it would force
	// the public redirect path to do an async decrypt before the 302.
	// shortCode is a public lookup key. We encrypt the user-typed
	// metadata (title + description) which is the part the user actually
	// expects to be private, and leave the routing primitives alone.
	links: { enabled: true, fields: ['title', 'description'] },
	// NOTE: `manaLinks` is intentionally NOT in the registry. Despite
	// the name it's the cross-app link table — pure foreign keys
	// (sourceAppId / sourceRecordId / targetAppId / targetRecordId)
	// with zero user-typed content. The Phase 1 placeholder listed
	// label/url/notes which don't exist on the schema.

	// ─── Inventar ────────────────────────────────────────────
	// `name` is indexed (used in where()/sortBy queries). `notes` is an
	// array of {id, content, createdAt} that addNote/deleteNote splice
	// in place — encrypting it would force every mutation to decrypt+
	// re-encrypt the whole array. Encrypt only the description field
	// for now; broader coverage is a Phase 7 concern that needs a
	// different storage layout.
	invItems: { enabled: true, fields: ['description'] },

	// ─── Places ──────────────────────────────────────────────
	// Location data is GDPR-sensitive PII. The split between the two tables:
	//   - `places` holds user-named POIs. We encrypt the user-typed text
	//     (name/description/address) but leave lat/lng plaintext so the
	//     proximity matcher in tracking.svelte.ts can run without a vault
	//     unlock during background geolocation logging. lat/lng on a
	//     handful of saved POIs is far less sensitive than the full
	//     movement trail in locationLogs below.
	//   - `locationLogs` IS the movement trail — every coordinate gets
	//     encrypted. Indexed columns (timestamp, placeId, [placeId+timestamp])
	//     stay plaintext for the time-range scans in the log view.
	// `name` on `places` IS schema-indexed but no .where('name') call site
	// exists (search filters in JS over the decrypted DTO array) — same
	// rationale as files.name and plants.name above.
	places: { enabled: true, fields: ['name', 'description', 'address'] },
	locationLogs: {
		enabled: true,
		fields: ['latitude', 'longitude', 'accuracy', 'altitude', 'speed', 'heading'],
	},
	// `placeTags` is intentionally NOT in the registry — pure foreign-key
	// join table (placeId / tagId), zero user-typed content. Same pattern
	// as manaLinks.

	// ─── Playground ──────────────────────────────────────────
	// Saved system-prompt snippets. `name` is the user's label and
	// `systemPrompt` is the actual prompt body — both are user-typed
	// free-form text and the whole point of having a vault. Indexed
	// columns (isPinned, order) stay plaintext for sort.
	playgroundSnippets: { enabled: true, fields: ['name', 'systemPrompt'] },
	playgroundConversations: { enabled: true, fields: ['title', 'systemPrompt'] },
	playgroundMessages: { enabled: true, fields: ['content'] },

	// ─── News ────────────────────────────────────────────────
	// Saved articles are reading-behavior data (sensitive). The body
	// fields (title/excerpt/content/htmlContent/author) are encrypted
	// at rest. The structural columns — type, isRead, isArchived,
	// originalUrl, sourceCuratedId, sourceSlug, categoryId, image, the
	// numeric metrics — stay plaintext for indexing, dedupe, and the
	// reader's reading-progress logic.
	//
	// `newsCategories.name` is the user-named folder label and gets the
	// same treatment as note titles.
	//
	// `newsPreferences` holds selected topics + blocklist + learned
	// weights. The lists themselves leak less than the *contents* of
	// the user's reading; still, the topic-weight map is a noisy proxy
	// for interests, so we encrypt it.
	//
	// `newsReactions` records "what did the user say about article X";
	// the meaningful payload is the (articleId, reaction) tuple. We
	// encrypt the reaction enum to avoid leaking aggregate "user thumbs
	// down N% of articles from source X" signals to anyone with raw DB
	// access. The articleId itself stays plaintext because it's used as
	// the join key to suppress already-rated articles in the feed scorer.
	//
	// `newsCachedFeed` is intentionally NOT registered — it's a local
	// mirror of the public server pool, the same content already lives
	// unencrypted in news.curated_articles, and encrypting it would
	// break the [topic+publishedAt] index used for the feed query.
	newsArticles: {
		enabled: true,
		fields: ['title', 'excerpt', 'content', 'htmlContent', 'author'],
	},
	newsCategories: { enabled: true, fields: ['name'] },
	newsPreferences: {
		enabled: true,
		fields: ['selectedTopics', 'blockedSources', 'topicWeights', 'sourceWeights', 'customFeeds'],
	},
	newsReactions: { enabled: true, fields: ['reaction', 'sourceSlug', 'topic'] },

	// ─── Body (combined fitness + bodylog) ───────────────────
	// Health/fitness data is GDPR-sensitive (Art. 9 special category).
	// What's encrypted:
	//   - Free-text everywhere: notes / description / title fields are
	//     user-typed and the most obviously private bits.
	//   - bodyMeasurements.value: weight + body-fat + circumference numbers
	//     are the headline sensitive fields. Encrypting the value while
	//     leaving (date, type) plaintext keeps the per-metric trend chart's
	//     [type+date] range scan working — only the projection step has to
	//     decrypt, not the index lookup.
	//   - bodySets.weight + reps: same rationale. The (workoutId, exerciseId)
	//     plaintext indexes still resolve "which sets did I do" without
	//     leaking how heavy or how many.
	//   - bodyChecks.energy/sleep/soreness/mood: 1-5 mood-style ratings with
	//     the same sensitivity as periodDayLogs.mood.
	//   - bodyPhases.startWeight/targetWeight: identical reasoning to
	//     measurement values.
	// Plaintext (intentional):
	//   - All ids, foreign keys, ordering, dates, kind/type discriminators,
	//     muscleGroup/equipment enums — needed by the index layer and the
	//     pure aggregation helpers in queries.ts.
	//   - bodyExercises.name on PRESETS would ideally stay plaintext to
	//     avoid a per-record decrypt for the exercise picker, but since
	//     user-created exercises share the same column we encrypt the
	//     whole field and the picker pays the decrypt cost in JS. The
	//     library is small (dozens, not thousands) so this is fine.
	bodyExercises: { enabled: true, fields: ['name', 'notes'] },
	bodyRoutines: { enabled: true, fields: ['name', 'description'] },
	bodyWorkouts: { enabled: true, fields: ['title', 'notes'] },
	bodySets: { enabled: true, fields: ['weight', 'reps', 'notes'] },
	bodyMeasurements: { enabled: true, fields: ['value', 'notes'] },
	bodyChecks: {
		enabled: true,
		fields: ['energy', 'sleep', 'soreness', 'mood', 'notes'],
	},
	bodyPhases: {
		enabled: true,
		fields: ['startWeight', 'targetWeight', 'notes'],
	},

	// ─── TimeBlocks (cross-module hub) ───────────────────────
	// Phase 7.1: encrypted alongside tasks + calendar.events + habits
	// because the consumer modules denormalize their title/description
	// into the timeBlock for cheap calendar rendering. Encrypting only
	// the source records would still leak the same fields here.
	// Indexed columns (startDate, endDate, kind, type, sourceModule,
	// sourceId, parentBlockId, recurrenceDate) all stay plaintext —
	// the calendar query layer needs them for range scans.
	timeBlocks: { enabled: true, fields: ['title', 'description'] },

	// ─── Firsts ──────────────────────────────────────────────
	// User-typed text fields (title, motivation, note, expectation, reality,
	// sharedWith) are encrypted. Status, category, priority, date, rating,
	// wouldRepeat, personIds, mediaIds, placeId stay plaintext for indexing
	// and filtering.
	firsts: {
		enabled: true,
		fields: ['title', 'motivation', 'note', 'expectation', 'reality', 'sharedWith'],
	},

	// ─── Lasts ───────────────────────────────────────────────
	// Mirror sibling to firsts (docs/plans/lasts-module.md). User-typed text
	// fields are encrypted. Status, category, confidence, dates, tenderness,
	// wouldReclaim, personIds, mediaIds, placeId, inferredFrom stay plaintext
	// for indexing/filtering and so the inference scanner can read provenance
	// without master-key access. Visibility metadata + unlistedToken stay
	// plaintext — they're routing fields the server-side share endpoint
	// must read without the master key.
	lasts: {
		enabled: true,
		fields: [
			'title',
			'meaning',
			'note',
			'whatIKnewThen',
			'whatIKnowNow',
			'reclaimedNote',
			'sharedWith',
		],
	},

	// ─── Lasts inference cooldown ───────────────────────────
	// Plaintext metadata table — records dismissed inference candidates by
	// (refTable, refId) so the scanner skips them for ~12 months. No
	// user-typed content lives here.
	lastsCooldown: { enabled: false, fields: [] },

	// ─── Guides ──────────────────────────────────────────────
	guides: { enabled: true, fields: ['title', 'description'] },
	sections: { enabled: true, fields: ['title', 'content'] },
	steps: { enabled: true, fields: ['title', 'content'] },

	// ─── Drink ───────────────────────────────────────────────
	// User-typed content (drink names, notes) → encrypted.
	// Structural fields (date, time, drinkType, quantityMl, presetId) →
	// plaintext for indexing and daily aggregation queries.
	drinkEntries: { enabled: true, fields: ['name', 'note'] },
	drinkPresets: { enabled: true, fields: ['name'] },

	// ─── Recipes ─────────────────────────────────────────────
	// User-typed content (title, description, ingredients list, steps)
	// encrypted. `ingredients` is Ingredient[] and `steps` is string[] —
	// aes.ts JSON-stringifies before wrap, same as food's `foods`.
	// Plaintext (intentional): difficulty, tags, servings, times,
	// isFavorite, photo refs — needed for indexing and filtering.
	recipes: { enabled: true, fields: ['title', 'description', 'ingredients', 'steps'] },

	// ─── Stretch ──────────────────────────────────────────────
	// Health/wellness data — GDPR Art. 9 sensitive. Exercise names/descriptions
	// are encrypted (user-created ones contain personal context). Routines
	// encrypt the exercises array (contains per-slot notes). Sessions encrypt
	// the routine name snapshot + user notes. Assessments encrypt the full
	// test results + pain regions. Reminders encrypt only the user-given name.
	// Plaintext: bodyRegion, difficulty, routineType, order, timestamps,
	// bilateral, isPreset, isPinned, isActive, days, time — all needed for
	// indexing/filtering.
	stretchExercises: { enabled: true, fields: ['name', 'description'] },
	stretchRoutines: { enabled: true, fields: ['name', 'description', 'exercises'] },
	stretchSessions: { enabled: true, fields: ['routineName', 'notes'] },
	stretchAssessments: { enabled: true, fields: ['tests', 'painRegions', 'notes'] },
	stretchReminders: { enabled: true, fields: ['name'] },

	// ─── Mail ────────────────────────────────────────────────
	// Only drafts are stored locally (threads/messages come from server).
	// Encrypt all user-typed content in drafts.
	mailDrafts: { enabled: true, fields: ['to', 'cc', 'subject', 'body', 'htmlBody'] },

	// ─── Meditate ────────────────────────────────────────────
	// Meditation presets encrypt user-typed names, descriptions, and body scan
	// step text. Sessions encrypt only the optional reflection notes.
	// Plaintext: category, breathPattern, defaultDurationSec, order, startedAt,
	// durationSec, completed, moodBefore, moodAfter — needed for stats/filtering.
	// Settings are structural only (no user-typed text), so encryption is off.
	meditatePresets: { enabled: true, fields: ['name', 'description', 'bodyScanSteps'] },
	meditateSessions: { enabled: true, fields: ['notes'] },
	meditateSettings: { enabled: false, fields: [] },

	// ─── Sleep ───────────────────────────────────────────────
	// Health data — GDPR Art. 9 sensitive. Only user-typed text fields
	// (notes) are encrypted on sleep entries. Quality/duration/interruptions
	// stay plaintext for stats aggregation. Hygiene check names/descriptions
	// are encrypted (user-created ones contain personal context). Hygiene
	// logs and settings are structural only.
	sleepEntries: { enabled: true, fields: ['notes'] },
	sleepHygieneLogs: { enabled: false, fields: [] },
	sleepHygieneChecks: { enabled: true, fields: ['name', 'description'] },
	sleepSettings: { enabled: false, fields: [] },

	// ─── Mood ────────────────────────────────────────────────
	// User-typed content: withWhom (free text about people) and notes are
	// encrypted. Emotion/level/activity/tags stay plaintext for aggregation
	// and pattern detection. Settings are structural only.
	moodEntries: { enabled: true, fields: ['withWhom', 'notes'] },
	moodSettings: { enabled: false, fields: [] },

	// ─── User Context (profile hub) ──────────────────────────
	// Structured profile sections + freeform markdown. Everything
	// except the fixed id and interview progress is user-typed content.
	userContext: {
		enabled: true,
		fields: [
			'about',
			'interests',
			'routine',
			'nutrition',
			'leisure',
			'goals',
			'social',
			'freeform',
		],
	},

	// ─── Me-Images (AI reference pool) ───────────────────────
	// docs/plans/me-images-and-reference-generation.md M1.
	// Encrypted: `label` (user-typed — "Portrait Juni", "Outfit Studio")
	// and `tags` (string[] — free-form tags like "ohne-brille", "studio").
	// Plaintext (intentional): `kind`, `primaryFor`, `usage`, mediaId,
	// storagePath, publicUrl, thumbnailUrl, width, height — all indexed
	// or structural metadata the query layer needs. The image blob itself
	// lives in MinIO behind owner-RLS, not in Dexie.
	meImages: entry<LocalMeImage>(['label', 'tags']),

	// ─── Comic (stories + inline panel metadata) ─────────────
	// docs/plans/comic-module.md M1. Single space-scoped table.
	//
	// `title`, `description`, `storyContext`, `tags` are user-typed
	// prose and get the same treatment as journal.title / notes.content.
	// `panelMeta` is the per-panel sidecar (Record<panelImageId,
	// {caption, dialogue, promptUsed, sourceInput}>) — aes.ts JSON-
	// stringifies the whole blob before wrap, same pattern as
	// food.foods / recipes.ingredients / quiz.options. Caption +
	// dialogue are prose fragments the user authored; promptUsed is
	// the reproduce-key (would-be-convenient for regeneration but
	// leaks story content if plaintext); sourceInput FKs are
	// low-risk but ship inside the encrypted blob anyway because
	// splitting the Record per-field would double the storage cost.
	//
	// Plaintext (intentional): id, style enum (drives listStories
	// filter + per-style prompt-prefix lookup), characterMediaIds
	// (FKs to meImages / wardrobeGarments), panelImageIds (ordered
	// FKs to picture.images), isFavorite / isArchived / visibility
	// fields — all needed by the index or query layer.
	comicStories: entry<LocalComicStory>([
		'title',
		'description',
		'storyContext',
		'tags',
		'panelMeta',
	]),

	// ─── Comic-Characters (variant pool + pinned identity) ────
	// docs/plans/comic-module.md §11. User-scoped sibling table to
	// comicStories. Encrypted: `name` (display label), `description`
	// (optional context), `addPrompt` (the user's free-text prompt
	// add-on like "freundlicher Ausdruck"), `tags`. Plaintext:
	// `style` (filter discriminator), `sourceFaceMediaId` /
	// `sourceBodyMediaId` (FKs to meImages), `variantMediaIds` (FK
	// array to picture.images), `pinnedVariantId`, booleans.
	// Same encryption envelope as a wardrobe-outfit — name + free-
	// text + tags travel encrypted, structural fields stay plaintext
	// for query/sort.
	comicCharacters: entry<LocalComicCharacter>(['name', 'description', 'addPrompt', 'tags']),

	// ─── Augur (signs: omens / fortunes / hunches) ───────────
	// docs/plans/augur-module.md M1. Single space-scoped table.
	//
	// User-typed prose is the sensitive surface — `source` (free-text
	// label like "schwarze Katze" or "Mutter"), `claim` (what the sign
	// said), `feltMeaning` (the user's interpretation), `expectedOutcome`
	// (the prediction), `outcomeNote` (the resolve write-up),
	// `livingOracleSnapshot` (the deterministic reflection cached at
	// capture time), and free-form `tags`. All travel encrypted.
	//
	// Plaintext (intentional):
	//   - kind, vibe, outcome, sourceCategory: enum discriminators that
	//     drive the kind-tabs filter, vibe-galleries, the resolve-reminder
	//     list (`outcome === 'open'`), and Calibration-per-Source
	//     aggregation in OracleView. Encrypting any of them would force a
	//     full table scan + decrypt loop on every render.
	//   - encounteredAt, expectedBy, resolvedAt: ISO dates the index layer
	//     uses for sort + the due-for-reveal range scan.
	//   - probability: nullable 0..1 forecaster number — used by the Brier
	//     score computation in `lib/calibration.ts`. No prose value.
	//   - relatedDreamId / relatedDecisionId: foreign keys (standard
	//     "IDs are plaintext" rule).
	//   - isPrivate / isArchived: structural flags.
	augurEntries: entry<LocalAugurEntry>([
		'source',
		'claim',
		'feltMeaning',
		'expectedOutcome',
		'outcomeNote',
		'tags',
		'livingOracleSnapshot',
	]),

	// Per-agent kontext documents — free-form markdown, keyed per agent.
	// Distinct from the (retired) per-Space kontextDoc; this one stays
	// because per-agent context is still injected by the persona-runner.
	agentKontextDocs: { enabled: true, fields: ['content'] },

	// ─── Quiz ────────────────────────────────────────────────
	// User-typed text on the container (title, description, category, tags)
	// plus the whole question payload (questionText, explanation, options).
	// `options` is QuestionOption[] — aes.ts JSON-stringifies before wrap,
	// same as food.foods / recipes.ingredients. The correctness flag inside
	// each option ships encrypted alongside the text, which is intentional:
	// a passive attacker with raw DB access should not be able to build an
	// answer key without the user's vault.
	// Plaintext (intentional): quizId foreign key, order, type discriminator,
	// questionCount denorm counter, isPinned / isArchived — all needed for
	// index/sort/filter.
	quizzes: { enabled: true, fields: ['title', 'description', 'category', 'tags'] },
	quizQuestions: { enabled: true, fields: ['questionText', 'explanation', 'options'] },
	// `quizAttempts` is intentionally NOT registered — only boolean `correct`
	// flags + a numeric score + timestamps + a small text-answer echo for
	// review. If post-launch review shows textAnswer should be encrypted,
	// add an entry here with fields: ['answers'].

	// ─── AI Agents ───────────────────────────────────────────
	// Named AI personas (docs/plans/multi-agent-workbench.md). `name` +
	// `role` + `avatar` stay plaintext because `name` is the display-key
	// (search + picker + historic Actor.displayName cache) and the role
	// is a short label. `systemPrompt` + `memory` carry user-specific
	// context — often referencing private goals / projects / people —
	// and belong under encryption. Policy + budgets + state are pure
	// structural fields.
	agents: { enabled: true, fields: ['systemPrompt', 'memory'] },

	// ─── AI Missions ─────────────────────────────────────────
	// docs/plans/space-scoped-data-model.md §2e — encryption enabled.
	// User-typed content on missions: `title` (display label the user
	// types at create time), `conceptMarkdown` (free-form context the
	// planner reads), `objective` (the actionable goal string). State,
	// cadence, inputs (FK-only), nextRunAt, iterations, agentId all
	// stay plaintext — needed for the Runner's "due now" index walk
	// and mission-detail filters.
	aiMissions: { enabled: true, fields: ['title', 'conceptMarkdown', 'objective'] },

	// ─── User-level Tag Presets ──────────────────────────────
	// Named templates the user applies when creating a new Space. The
	// preset `name` (e.g. "Mein Standard") and the entire `tags` array
	// (which contains per-entry tag names) are user-authored personal
	// content that leaks categorization intent — encrypt both. `userId`,
	// `isDefault`, timestamps stay plaintext for the indexed query path.
	// AES wrapping handles `tags` as an array via JSON-stringify (same
	// pattern as food.foods / recipes.ingredients).
	// See docs/plans/space-scoped-data-model.md §5.
	userTagPresets: { enabled: true, fields: ['name', 'tags'] },

	// ─── Tags (shared-stores) ────────────────────────────────
	// docs/plans/space-scoped-data-model.md §2e — encryption enabled.
	// Tag names like "Therapie" or "Finanzen-privat" can leak personal
	// categorization. `color` + `icon` + `groupId` + `sortOrder` stay
	// plaintext: they're visual metadata + the group FK, none of which
	// leak sensitive taxonomy. `name` is NOT indexed for .where()
	// lookups today, so encrypting it is safe — dedupe-within-space
	// lookups go through the [spaceId+name] index from 2b and run over
	// already-decrypted rows in the scoped store.
	//
	// Pre-live migration note: decryptRecords is lenient (isEncrypted()
	// gate skips plaintext values), so existing rows from before the
	// flip stay readable. New writes encrypt; existing rows get
	// encrypted the next time they're edited. A post-login
	// "encrypt-at-rest sweep" over the pre-existing rows is a Phase 2e
	// follow-up if we want hard at-rest coverage before launch.
	globalTags: { enabled: true, fields: ['name'] },
	tagGroups: { enabled: true, fields: ['name'] },

	// ─── Workbench Scenes ────────────────────────────────────
	// docs/plans/space-scoped-data-model.md §2e — encryption enabled.
	// `name` is the user-visible scene label ("Heute", "Q2-Launch")
	// and `description` is the short subtitle — both are user-typed
	// free text that can leak Space-specific context. openApps /
	// order / wallpaper / viewingAsAgentId / scopeTagIds stay
	// plaintext (structural / indexed / foreign-key data).
	workbenchScenes: { enabled: true, fields: ['name', 'description'] },

	// ─── Articles (Pocket-style read-it-later) ──────────────
	// Reading-behaviour data — same sensitivity class as newsArticles.
	// Encrypted:
	//   - title / excerpt / content / htmlContent / author: the Readability
	//     extract body. Leaking this would be the same as leaking the user's
	//     bookmark history + full article texts.
	//   - userNote: the user's own note about the saved article.
	// Plaintext (intentional):
	//   - originalUrl: dedupe key. Indexed + used by saveFromUrl to avoid
	//     duplicate ingestion. Same rationale as newsArticles.originalUrl /
	//     uLoad.links.originalUrl.
	//   - siteName: powers the "group by source" view and stays cheap to
	//     aggregate without decrypting every row. Not a secret — the site
	//     name is recoverable from originalUrl anyway.
	//   - imageUrl: opaque pointer; the bytes are already public at that URL.
	//   - status / readingProgress / isFavorite / savedAt / readAt /
	//     wordCount / readingTimeMinutes / publishedAt / extractedVersion:
	//     all structural, needed for filtering/sorting/stats.
	//
	// Highlights carry the marked text + the surrounding context fragments
	// (re-anchor substrates). Both are fragments of the encrypted content
	// and are themselves encrypted. Offsets + color + articleId are
	// structural — the reader needs them for range scans and rendering.
	//
	// articleTags is intentionally NOT registered — pure FK junction
	// (articleId, tagId), zero user-typed content. Tag names live in
	// globalTags, which has its own encryption policy. Lives on the
	// plaintext-allowlist alongside noteTags / eventTags / placeTags.
	articles: entry<LocalArticle>([
		'title',
		'excerpt',
		'content',
		'htmlContent',
		'author',
		'userNote',
	]),
	articleHighlights: entry<LocalHighlight>(['text', 'note', 'contextBefore', 'contextAfter']),

	// ─── Library ─────────────────────────────────────────────
	// Reading / watching log with a kind discriminator (book / movie /
	// series / comic) in one table. User-typed text (title, original
	// title, creators, review, tags) is encrypted; structural fields
	// (kind, status, year, rating, completedAt, genres, isFavorite,
	// times, externalIds, details) stay plaintext — they drive the
	// tab filter, the status chips, the Jahresrückblick query, and
	// the episode/page progress UI.
	//
	// `details` is the discriminated union and sometimes carries
	// free-text (publisher, director). Those are factual metadata,
	// not user-typed reflection, so they ship plaintext alongside the
	// other structural fields. If a future feature adds free-text
	// notes *inside* details, add that specific path here.
	libraryEntries: {
		enabled: true,
		fields: ['title', 'originalTitle', 'creators', 'review', 'tags'],
	},

	// ─── Writing ─────────────────────────────────────────────
	// Ghostwriter module — drafts, version snapshots, generation records,
	// and user-defined styles. The full prose is the most sensitive
	// surface: a draft's content, briefing (topic / audience / extra
	// instructions) and any user-supplied reference notes can disclose
	// anything from unannounced launches to personal letters.
	//
	// Plaintext (intentional):
	//   - kind, status, publish targets, isFavorite, visibility fields
	//     drive tabs / chips / sort — query-critical.
	//   - versionNumber, wordCount, generationId, isAiGenerated — used
	//     for ordering and the history panel.
	//   - generation.status, provider, model, params, tokenUsage,
	//     durationMs, missionId — purely operational, no user content.
	//   - style.source, presetId, isSpaceDefault, isFavorite — query.
	//
	// `references` on a draft is an array of { kind, targetId/url, note }.
	// targetId + url + kind are plaintext (FKs and public URLs); the
	// per-reference `note` travels encrypted with the whole array via
	// array-path encryption (same pattern as food.foods / quiz.options).
	writingDrafts: entry<LocalDraft>(['title', 'briefing', 'styleOverrides', 'references']),
	writingDraftVersions: entry<LocalDraftVersion>(['content', 'summary']),
	writingGenerations: entry<LocalGeneration>(['prompt', 'output']),
	writingStyles: entry<LocalWritingStyle>([
		'name',
		'description',
		'samples',
		'extractedPrinciples',
	]),

	// ─── Invoices ────────────────────────────────────────────
	// Outbound finance. Sensitive surface is non-trivial: client name and
	// address, the free-text subject/notes/terms, and the line items
	// themselves (title/description carry service names or project codes
	// that leak who the user works for + what they're paid to do).
	//
	// Plaintext (intentional):
	//   - number, status, clientId, clientSource, currency, issueDate,
	//     dueDate, sentAt, paidAt, referenceNumber, pdfBlobKey: all
	//     structural, used for indexing/filter/aggregation.
	//   - totals (net/vat/gross): kept plaintext so the dashboard's
	//     "open" and "overdue" sums can be computed in a liveQuery
	//     without decrypting every row. The sum-across-customers is
	//     business-useful info the user sees at a glance; encrypting it
	//     would defeat the local-first reactive layer.
	//   - lines is encrypted as a whole blob (see below): the numeric
	//     subfields would be plaintext-eligible, but serialising the
	//     whole array in one pass keeps the encryption boundary simple
	//     and lets per-line titles travel encrypted alongside.
	invoices: entry<LocalInvoice>(['clientSnapshot', 'subject', 'notes', 'terms', 'lines']),

	// Optional per-user client book. Everything user-typed is sensitive —
	// name, postal address, email, VAT number, IBAN, free-text notes.
	// defaultCurrency / defaultDueDays stay plaintext (structural enums).
	invoiceClients: entry<LocalInvoiceClient>([
		'name',
		'address',
		'email',
		'vatNumber',
		'iban',
		'notes',
	]),

	// ─── Broadcast ─────────────────────────────────────────
	// Newsletter / campaign content. Every field the user typed — subject,
	// body JSON/HTML, audience filter values, sender profile — is sensitive
	// *until sent*. Post-send the content itself becomes semi-public (it
	// went out to N recipients), but pre-send the draft is confidential
	// marketing copy. Audience definitions always stay sensitive — the
	// recipient graph is a leakable business secret (who's on the list).
	//
	// Plaintext (intentional):
	//   - status, scheduledAt, sentAt, templateId, serverJobId: structural,
	//     indexed for the "drafts vs scheduled vs sent" filter.
	//   - stats: cached counters mirrored from the server tracking tables;
	//     not sensitive by design (they describe aggregate behaviour).
	//   - isBuiltIn on templates: controls whether the user can delete the
	//     row; structural, no privacy value.
	//   - dnsCheck on settings: public DNS state, not user-typed content.
	broadcastCampaigns: entry<LocalCampaign>([
		'name',
		'subject',
		'preheader',
		'fromName',
		'fromEmail',
		'replyTo',
		'content',
		'audience',
	]),
	broadcastTemplates: entry<LocalBroadcastTemplate>(['name', 'description', 'subject', 'content']),
	broadcastSettings: entry<LocalBroadcastSettings>([
		'defaultFromName',
		'defaultFromEmail',
		'defaultReplyTo',
		'defaultFooter',
		'legalAddress',
		'unsubscribeLandingCopy',
	]),

	// ─── Website Builder ─────────────────────────────────────
	// docs/plans/website-builder.md §D4 — content is PUBLIC by design.
	// Site name, page titles, block props, theme config: the whole point
	// is that published sites are served to anonymous visitors over SSR.
	// Encrypting the draft would be security theater — the user publishes
	// the same content seconds later as plaintext into published_snapshots.
	// Form submissions (M4) land in target modules (contacts, todo, …)
	// which carry their own encryption; the submissions-audit row holds
	// the payload only briefly and gets scrubbed after delivery (M7).
	websites: { enabled: false, fields: [] },
	websitePages: { enabled: false, fields: [] },
	websiteBlocks: { enabled: false, fields: [] },

	// Singleton sender profile. The user's legal address + IBAN live here
	// and are the most sensitive fields in the module (appear on every PDF
	// the user issues). logoMediaId / accentColor / number sequence state
	// are plaintext — structural, no privacy value.
	// Structured address fields (senderStreet/Zip/City/Country) get the
	// same treatment as the legacy senderAddress blob.
	invoiceSettings: entry<LocalInvoiceSettings>([
		'senderName',
		'senderAddress',
		'senderStreet',
		'senderZip',
		'senderCity',
		'senderCountry',
		'senderEmail',
		'senderVatNumber',
		'senderIban',
		'senderBic',
		'footer',
		'defaultTerms',
	]),

	// ─── Forms ──────────────────────────────────────────────
	// User-defined questionnaires + the answers people submit. Plan: see
	// docs/plans/forms-module.md. The schema (title, description, fields,
	// branching, settings) carries the full text of every prompt the user
	// wrote — encrypted. Plaintext (intentional): status drives the
	// draft/published/closed filter; responseCount is a denormalized UI
	// counter; visibility/visibilityChanged*/unlistedToken/unlistedExpiresAt
	// are the share-routing surface the server-side public-submit
	// endpoint must read without the master key.
	forms: entry<LocalForm>(['title', 'description', 'fields', 'branching', 'settings']),

	// Answers travel encrypted as one blob — `answers` is a free-form
	// Record<fieldId, value> that may carry PII (names, emails, free text).
	// `submitterEmail` / `submitterName` / `submitterMeta` are encrypted
	// separately so the audit log can selectively decrypt only what the
	// owner asked for. Plaintext: formId (FK), submittedAt (sort), status
	// (review filter), syncedTargets (no PII, just internal IDs).
	formResponses: entry<LocalFormResponse>([
		'answers',
		'submitterEmail',
		'submitterName',
		'submitterMeta',
	]),
};

/**
 * Returns the field allowlist for `tableName`, or `null` if the table is
 * either not registered, currently disabled, or has an empty field list.
 * Hot-path helper used by the Dexie hooks — must stay synchronous and
 * allocation-free for the common (non-encrypted) case.
 */
export function getEncryptedFields(tableName: string): readonly string[] | null {
	const config = ENCRYPTION_REGISTRY[tableName];
	if (!config || !config.enabled || config.fields.length === 0) return null;
	return config.fields;
}

/** True if at least one table is currently flipped to encrypted. Used by
 *  the Phase 3 boot path to decide whether to fetch the master key at
 *  all — no point asking the server for a key when nothing uses it. */
export function hasAnyEncryption(): boolean {
	for (const config of Object.values(ENCRYPTION_REGISTRY)) {
		if (config.enabled) return true;
	}
	return false;
}

/** All table names that have an encryption entry, regardless of whether
 *  they're currently enabled. Used by the rollout audit and the
 *  DATA_LAYER_AUDIT.md doc to confirm coverage. */
export function getRegisteredTables(): string[] {
	return Object.keys(ENCRYPTION_REGISTRY);
}
