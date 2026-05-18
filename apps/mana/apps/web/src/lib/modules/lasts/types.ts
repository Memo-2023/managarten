import type { BaseRecord } from '@mana/local-store';
import type { VisibilityLevel } from '@mana/shared-privacy';
import type { MilestoneCategory } from '$lib/data/milestones/categories';

export { CATEGORY_LABELS, CATEGORY_COLORS } from '$lib/data/milestones/categories';

// ─── Enums ────────────────────────────────────────────────

/**
 * Lifecycle of a `Last`.
 *
 * - `suspected` — vermutet (vom User markiert oder von der Inferenz vorgeschlagen,
 *    noch nicht bestätigt). Standard für AI-Vorschläge in der Inbox.
 * - `confirmed` — bestätigt mit Datum und Reflexion.
 * - `reclaimed` — aufgehoben: doch wieder passiert. Bleibt in der History,
 *    erscheint aber nicht mehr im Hauptfeed.
 */
export type LastStatus = 'suspected' | 'confirmed' | 'reclaimed';

/** Sicherheit, dass es das letzte Mal war. */
export type LastConfidence = 'probably' | 'likely' | 'certain';

export type LastCategory = MilestoneCategory;

export type WouldReclaim = 'no' | 'maybe' | 'yes';

/**
 * Provenance für AI-inferred Vorschläge: woher der Scanner den Last-Kandidaten
 * abgeleitet hat. `null` für manuell angelegte Einträge.
 */
export interface InferredFrom {
	tool: string; // e.g. 'suggest_lasts'
	refTable: string; // 'places' | 'contacts' | 'habits' | …
	refId: string;
	frequencyHint?: string; // human-readable: '3x/week → 0 in 18mo'
	scannedAt: string; // ISO
}

// ─── Cooldown ─────────────────────────────────────────────

/**
 * Records a dismissed inference candidate so the scanner skips it for
 * ~12 months. ID is `${refTable}:${refId}` for structural idempotency.
 */
export interface LocalLastsCooldown extends BaseRecord {
	refTable: string;
	refId: string;
	dismissedAt: string; // ISO
}

// ─── Local Record Types (Dexie) ───────────────────────────

export interface LocalLast extends BaseRecord {
	title: string;
	status: LastStatus;
	category: LastCategory;

	// Recognition phase
	confidence: LastConfidence | null;
	inferredFrom: InferredFrom | null;

	// Confirmed phase (Reflexion)
	date: string | null; // ISO date — vermutet oder bestätigt
	meaning: string | null; // "was hat es bedeutet"
	note: string | null;
	whatIKnewThen: string | null;
	whatIKnowNow: string | null;
	tenderness: number | null; // 1-5
	wouldReclaim: WouldReclaim | null;

	// Reclaimed phase
	reclaimedAt: string | null;
	reclaimedNote: string | null;

	// Social
	personIds: string[];
	sharedWith: string | null;

	// Rich media
	mediaIds: string[];
	audioNoteId: string | null;
	placeId: string | null;

	// Meta
	recognisedAt: string; // wann wurde der Last erkannt (≠ createdAt für AI-inferred)
	isPinned: boolean;
	isArchived: boolean;

	// Visibility / unlisted-sharing (M6) — optional on the local record
	// because legacy rows pre-date the field; the default is `'private'`
	// (intim default for lasts, anders als firsts). `toLast` narrows to a
	// non-optional VisibilityLevel for callers.
	visibility?: VisibilityLevel;
	visibilityChangedAt?: string;
	visibilityChangedBy?: string;
	unlistedToken?: string;
	unlistedExpiresAt?: string | null;
}

// ─── Domain Types ─────────────────────────────────────────

export interface Last {
	id: string;
	title: string;
	status: LastStatus;
	category: LastCategory;
	confidence: LastConfidence | null;
	inferredFrom: InferredFrom | null;
	date: string | null;
	meaning: string | null;
	note: string | null;
	whatIKnewThen: string | null;
	whatIKnowNow: string | null;
	tenderness: number | null;
	wouldReclaim: WouldReclaim | null;
	reclaimedAt: string | null;
	reclaimedNote: string | null;
	personIds: string[];
	sharedWith: string | null;
	mediaIds: string[];
	audioNoteId: string | null;
	placeId: string | null;
	recognisedAt: string;
	isPinned: boolean;
	isArchived: boolean;
	visibility: VisibilityLevel;
	/** Server-issued share token. Empty when not 'unlisted'. */
	unlistedToken: string;
	/** ISO timestamp when the unlisted snapshot expires, or null = never. */
	unlistedExpiresAt: string | null;
	createdAt: string;
	updatedAt: string;
}

// ─── Constants ────────────────────────────────────────────

export const CONFIDENCE_LABELS: Record<LastConfidence, { de: string; en: string }> = {
	probably: { de: 'Wahrscheinlich', en: 'Probably' },
	likely: { de: 'Recht sicher', en: 'Likely' },
	certain: { de: 'Sicher', en: 'Certain' },
};

export const STATUS_LABELS: Record<LastStatus, { de: string; en: string }> = {
	suspected: { de: 'Vermutet', en: 'Suspected' },
	confirmed: { de: 'Bestätigt', en: 'Confirmed' },
	reclaimed: { de: 'Aufgehoben', en: 'Reclaimed' },
};
