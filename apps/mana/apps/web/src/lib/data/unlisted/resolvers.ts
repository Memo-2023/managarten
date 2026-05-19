/**
 * Unlisted-snapshot resolvers — client-side blob builders.
 *
 * When a user flips a record to `visibility === 'unlisted'`, the store
 * calls `buildUnlistedBlob(collection, recordId)` here to produce the
 * whitelist-filtered plaintext payload that gets pushed to the
 * unlisted-snapshots table via `publishUnlistedSnapshot`.
 *
 * Whitelist is mandatory per module. What isn't listed explicitly does
 * NOT make it into the snapshot — protection against accidentally
 * leaking encrypted fields like description / guest-lists / private
 * notes. Same principle as `website/embeds.ts` for public snapshots.
 *
 * See docs/plans/unlisted-sharing.md §3.
 */

import { db } from '$lib/data/database';
import { decryptRecord } from '$lib/data/crypto';
import { mediaFileUrl } from '$lib/modules/website/upload';
import type { LocalEvent } from '$lib/modules/calendar/types';
import type { LocalLibraryEntry } from '$lib/modules/library/types';
import type { LocalTimeBlock } from '$lib/data/time-blocks/types';
import type { LocalAugurEntry } from '$lib/modules/augur/types';
import type { LocalLast } from '$lib/modules/lasts/types';
import type { LocalForm } from '$lib/modules/forms/types';

export class UnsupportedCollectionError extends Error {
	constructor(collection: string) {
		super(`Unlisted sharing is not supported for collection "${collection}"`);
		this.name = 'UnsupportedCollectionError';
	}
}

export class RecordNotFoundError extends Error {
	constructor(collection: string, recordId: string) {
		super(`${collection}/${recordId} not found`);
		this.name = 'RecordNotFoundError';
	}
}

/**
 * Build the whitelist-filtered blob for a record. Dispatcher —
 * delegates to per-collection builders.
 */
export async function buildUnlistedBlob(
	collection: string,
	recordId: string
): Promise<Record<string, unknown>> {
	switch (collection) {
		case 'events':
			return buildEventBlob(recordId);
		case 'libraryEntries':
			return buildLibraryEntryBlob(recordId);
		case 'augurEntries':
			return buildAugurEntryBlob(recordId);
		case 'lasts':
			return buildLastBlob(recordId);
		case 'forms':
			return buildFormBlob(recordId);
		default:
			throw new UnsupportedCollectionError(collection);
	}
}

/**
 * Calendar event → snapshot blob.
 *
 * Whitelist: title, location, startTime, endTime, allDay, timezone.
 * Decryption happens client-side here (events table carries encrypted
 * title/description/location). Time dimension comes from the linked
 * TimeBlock — LocalEvent only stores the `timeBlockId` reference.
 *
 * NOT inlined:
 *   - description  (often holds agenda, private notes, guest info)
 *   - reminders    (implementation detail)
 *   - tagIds       (internal labels)
 *   - calendarId   (internal routing)
 *   - color        (cosmetic, the share page picks its own scheme)
 */
async function buildEventBlob(recordId: string): Promise<Record<string, unknown>> {
	const raw = await db.table<LocalEvent>('events').get(recordId);
	if (!raw || raw.deletedAt) {
		throw new RecordNotFoundError('events', recordId);
	}

	const decrypted = (await decryptRecord('events', { ...raw })) as LocalEvent;

	let startTime: string | null = null;
	let endTime: string | null = null;
	let isAllDay = false;
	let timezone: string | null = null;

	if (decrypted.timeBlockId) {
		const block = await db.table<LocalTimeBlock>('timeBlocks').get(decrypted.timeBlockId);
		if (block && !block.deletedAt) {
			startTime = block.startDate;
			endTime = block.endDate ?? block.startDate;
			isAllDay = block.allDay;
			timezone = block.timezone ?? null;
		}
	}

	if (!startTime || !endTime) {
		throw new Error(`Event ${recordId} is missing a time-block — cannot build share snapshot`);
	}

	return {
		// Keep the field names stable — the SSR renderer (SharedEventView)
		// reads these directly.
		title: decrypted.title,
		location: decrypted.location ?? null,
		startTime,
		endTime,
		isAllDay,
		timezone,
	};
}

/**
 * Library entry → snapshot blob.
 *
 * Whitelist: title, kind, creators, year, coverUrl, rating.
 *
 * NOT inlined:
 *   - review        (free-text, often very personal)
 *   - tags, genres  (organisational metadata, not content)
 *   - status        (in-progress is private detail)
 *   - startedAt / completedAt / isFavorite / times (reading habits)
 *   - details.*     (current-page progress, episode tracker, etc.)
 *   - originalTitle (fine in theory but skip for noise reduction)
 *   - externalIds   (ISBN/TMDB linkage — useful only for re-import)
 */
async function buildLibraryEntryBlob(recordId: string): Promise<Record<string, unknown>> {
	const raw = await db.table<LocalLibraryEntry>('libraryEntries').get(recordId);
	if (!raw || raw.deletedAt) {
		throw new RecordNotFoundError('libraryEntries', recordId);
	}

	const decrypted = (await decryptRecord('libraryEntries', { ...raw })) as LocalLibraryEntry;

	// Resolve the cover to an absolute URL: prefer coverUrl (already a
	// full http(s) URL the user pasted in), otherwise transform a
	// mana-media id into the canonical media-host URL.
	const coverUrl =
		decrypted.coverUrl ??
		(decrypted.coverMediaId ? mediaFileUrl(decrypted.coverMediaId, 'medium') : null);

	return {
		title: decrypted.title,
		kind: decrypted.kind,
		creators: decrypted.creators ?? [],
		year: decrypted.year ?? null,
		coverUrl,
		rating: decrypted.rating ?? null,
	};
}

/**
 * Augur entry → snapshot blob.
 *
 * Whitelist: source, claim, kind, vibe, encounteredAt, outcome,
 * outcomeNote (only when resolved). Defensive about what counts as
 * "shareable" for a divinatory record — this is sensitive territory.
 *
 * EXPLICITLY NOT inlined:
 *   - feltMeaning            (the user's private interpretation —
 *                              "soll den Job nicht annehmen" — never share)
 *   - expectedOutcome        (private prediction)
 *   - probability            (the user's forecaster number)
 *   - livingOracleSnapshot   (data-derived hint, not narrative)
 *   - tags                   (organisational, can leak topology)
 *   - relatedDreamId / Decision (FK references would dox other modules)
 *   - sourceCategory         (small-cardinality leak of method)
 */
async function buildAugurEntryBlob(recordId: string): Promise<Record<string, unknown>> {
	const raw = await db.table<LocalAugurEntry>('augurEntries').get(recordId);
	if (!raw || raw.deletedAt) {
		throw new RecordNotFoundError('augurEntries', recordId);
	}

	const decrypted = (await decryptRecord('augurEntries', { ...raw })) as LocalAugurEntry;

	const isResolved = decrypted.outcome && decrypted.outcome !== 'open';

	return {
		source: decrypted.source,
		claim: decrypted.claim,
		kind: decrypted.kind,
		vibe: decrypted.vibe,
		encounteredAt: decrypted.encounteredAt,
		outcome: decrypted.outcome ?? 'open',
		// Only inline the post-mortem note when the user actually resolved
		// the sign — open entries' outcomeNote is always null anyway, but
		// being explicit keeps the contract clear.
		outcomeNote: isResolved ? (decrypted.outcomeNote ?? null) : null,
		resolvedAt: isResolved ? (decrypted.resolvedAt ?? null) : null,
	};
}

/**
 * Last → snapshot blob.
 *
 * Whitelist: only the *reflective core* — the parts a user might actually
 * want to share publicly without exposing their full inner monologue.
 *
 * IN: title, status, category, date, meaning, whatIKnewThen, whatIKnowNow,
 *     tenderness, wouldReclaim
 * OUT: note (often raw stream-of-consciousness), inferredFrom (internal
 *      provenance), confidence (internal flag), reclaimedAt/reclaimedNote
 *      (later state, complicated to render publicly), personIds /
 *      sharedWith / mediaIds / audioNoteId / placeId (private refs),
 *      recognisedAt (internal timeline), pin/archive flags.
 *
 * Tone-decision: lasts are intim. Reclaimed lasts are NOT shared (would
 * leak the "this is back" emotion that's even more vulnerable). The
 * whitelist already drops `reclaimedNote` but we additionally refuse to
 * publish a blob whose status is 'reclaimed' to make the intent explicit.
 */
async function buildLastBlob(recordId: string): Promise<Record<string, unknown>> {
	const raw = await db.table<LocalLast>('lasts').get(recordId);
	if (!raw || raw.deletedAt) {
		throw new RecordNotFoundError('lasts', recordId);
	}
	if (raw.status === 'reclaimed') {
		throw new RecordNotFoundError('lasts', recordId);
	}

	const decrypted = (await decryptRecord('lasts', { ...raw })) as LocalLast;

	return {
		title: decrypted.title,
		status: decrypted.status,
		category: decrypted.category,
		date: decrypted.date ?? null,
		meaning: decrypted.meaning ?? null,
		whatIKnewThen: decrypted.whatIKnewThen ?? null,
		whatIKnowNow: decrypted.whatIKnowNow ?? null,
		tenderness: decrypted.tenderness ?? null,
		wouldReclaim: decrypted.wouldReclaim ?? null,
	};
}

/**
 * Form → public-submit snapshot blob.
 *
 * Whitelist: title, description, fields, branching,
 * settings.submitButtonLabel, settings.successMessage. The blob is
 * what an unauthenticated submitter sees when they hit
 * `/forms/<token>` — it's the form schema plus the two pieces of
 * settings copy that surface in the public UI.
 *
 * Hard-blocked from the snapshot:
 *   - `responseCount`        — internal counter, leaks scale
 *   - `settings.requireEmail`/`allowMultipleSubmissions`/`anonymous`/
 *     `zkMode`/`autoSync`/`responseLimit`/`closedAt` — these are
 *     authoritative server-side checks in the public-submit endpoint
 *     (M3.b) and should not be discoverable via the public blob;
 *     leaking them invites enumeration probes.
 *   - `responsesPublic` — explicitly omitted; the public view shows
 *     the form, not the answers. M-future will need a separate share
 *     token + endpoint for response-aggregate publication.
 *
 * Refuses to serialise closed forms (status === 'closed') so revoked
 * tokens can't be brought back via a snapshot replay. Draft forms are
 * also refused — only `published` forms have a public surface.
 */
async function buildFormBlob(recordId: string): Promise<Record<string, unknown>> {
	const raw = await db.table<LocalForm>('forms').get(recordId);
	if (!raw || raw.deletedAt) {
		throw new RecordNotFoundError('forms', recordId);
	}
	if (raw.status !== 'published') {
		throw new RecordNotFoundError('forms', recordId);
	}

	const decrypted = (await decryptRecord('forms', { ...raw })) as LocalForm;

	const settings = decrypted.settings ?? {
		submitButtonLabel: 'Senden',
		successMessage: 'Danke! Deine Antwort wurde übermittelt.',
		allowMultipleSubmissions: false,
		requireEmail: false,
		anonymous: false,
		zkMode: false,
	};

	// Whitelisted snapshot fields. `recurrence` is intentionally
	// included even though most settings are redacted: the server-side
	// public-submit endpoint reads it to compute the response cohort
	// (M10), and the frequency itself is not sensitive metadata.
	const blob: Record<string, unknown> = {
		title: decrypted.title,
		description: decrypted.description ?? null,
		fields: decrypted.fields ?? [],
		branching: decrypted.branching ?? [],
		settings: {
			submitButtonLabel: settings.submitButtonLabel,
			successMessage: settings.successMessage,
		},
	};
	if (settings.recurrence?.frequency) {
		blob.recurrence = { frequency: settings.recurrence.frequency };
	}
	// M9 — `experience` controls the public render mode (classic vs
	// conversation). Whitelisted so the public dispatcher can pick the
	// right view; the value is just an enum, no PII.
	if (settings.experience) {
		blob.experience = settings.experience;
	}
	return blob;
}
