/**
 * Forms module types.
 *
 * Two tables: `forms` (the schema definition + settings) and
 * `formResponses` (one row per submitted answer set). Plan: see
 * docs/plans/forms-module.md.
 *
 * Field semantics intentionally diverge from the Quiz module's options
 * (no `isCorrect` flag, no answer scoring). The plan to extract a shared
 * `@mana/shared-form-schema` package is a follow-up to M1.
 */

import type { BaseRecord } from '@mana/local-store';
import type { VisibilityLevel } from '@mana/shared-privacy';

// ─── Field-Type Catalogue ───────────────────────────────────

export type FieldType =
	| 'short_text'
	| 'long_text'
	| 'single_choice'
	| 'multi_choice'
	| 'number'
	| 'date'
	| 'email'
	| 'yes_no'
	| 'rating'
	| 'section'
	| 'consent';

export interface FieldOption {
	id: string;
	label: string;
}

export interface FieldConfig {
	minLength?: number;
	maxLength?: number;
	min?: number;
	max?: number;
	ratingScale?: 5 | 10;
}

export interface FormField {
	id: string;
	type: FieldType;
	label: string;
	helpText?: string;
	required: boolean;
	options?: FieldOption[];
	config?: FieldConfig;
}

// ─── Branching ──────────────────────────────────────────────

export type BranchOperator = 'equals' | 'not_equals' | 'contains' | 'is_empty';
export type BranchAction = 'show' | 'hide' | 'skip_to';

export interface BranchingRule {
	id: string;
	ifFieldId: string;
	ifOperator: BranchOperator;
	ifValue?: string | string[];
	thenAction: BranchAction;
	thenFieldIds?: string[];
	thenSkipToFieldId?: string;
}

// ─── Settings ───────────────────────────────────────────────

export type AutoSyncTarget = 'contacts' | 'events' | 'feedback' | 'library' | 'space_member';

export interface AutoSyncConfig {
	target: AutoSyncTarget;
	/** Optional anchor — for `events` this is the eventId the response RSVPs to. */
	targetId?: string;
	mapping: Record<string, string>;
}

/**
 * Recurring-form configuration (M10). When set, public-submit attaches
 * a cohort label (`YYYY-WNN` for weekly, `YYYY-MM` for monthly) to
 * each response so the ResponsesView can group + compare waves.
 *
 * The `sendVia` field anchors a future cron-worker (M10b) that will
 * blast the share-link via broadcasts; today the field is recorded
 * but the cron is not yet implemented.
 */
export interface RecurrenceConfig {
	frequency: 'weekly' | 'monthly';
	/** ISO timestamp the recurrence started — informational only today. */
	startedAt?: string;
	/** M10b: how the share-link gets distributed when a wave is due. */
	sendVia?: 'broadcast' | 'manual';
	/**
	 * M10b — recipient emails, one per element. Capped at 50 (mailto-bridge
	 * realism). For larger groups the user copies the link manually until a
	 * proper bulk-send integration lands (M10c).
	 */
	recipientEmails?: string[];
	/** ISO timestamp of the last wave the user fired. Drives the due-banner. */
	lastSentAt?: string;
}

export interface FormSettings {
	submitButtonLabel: string;
	successMessage: string;
	allowMultipleSubmissions: boolean;
	requireEmail: boolean;
	anonymous: boolean;
	zkMode: boolean;
	closedAt?: string;
	responseLimit?: number;
	autoSync?: AutoSyncConfig;
	responsesPublic?: boolean;
	recurrence?: RecurrenceConfig;
}

export type FormStatus = 'draft' | 'published' | 'closed';

// ─── Local (Dexie) Records ──────────────────────────────────

export interface LocalForm extends BaseRecord {
	title: string;
	description: string | null;
	fields: FormField[];
	branching: BranchingRule[];
	status: FormStatus;
	settings: FormSettings;
	responseCount: number;
	visibility?: VisibilityLevel;
	visibilityChangedAt?: string;
	visibilityChangedBy?: string;
	unlistedToken?: string;
	unlistedExpiresAt?: string | null;
}

export type ResponseStatus = 'new' | 'reviewed' | 'archived' | 'spam';

export type AnswerValue = string | string[] | number | boolean | null;

export interface SubmitterMeta {
	userAgent?: string;
	referrer?: string;
	ipHash?: string;
}

export interface SyncedTarget {
	target: AutoSyncTarget;
	recordId: string;
}

export interface LocalFormResponse extends BaseRecord {
	formId: string;
	submittedAt: string;
	answers: Record<string, AnswerValue>;
	submitterEmail?: string;
	submitterName?: string;
	submitterMeta?: SubmitterMeta;
	status: ResponseStatus;
	syncedTargets?: SyncedTarget[];
	/** Recurrence bucket label (M10). Empty/undefined = ungrouped. */
	cohort?: string;
}

// ─── Domain Types ───────────────────────────────────────────

export interface Form {
	id: string;
	title: string;
	description: string | null;
	fields: FormField[];
	branching: BranchingRule[];
	status: FormStatus;
	settings: FormSettings;
	responseCount: number;
	visibility: VisibilityLevel;
	unlistedToken: string;
	unlistedExpiresAt: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface FormResponse {
	id: string;
	formId: string;
	submittedAt: string;
	answers: Record<string, AnswerValue>;
	submitterEmail: string | null;
	submitterName: string | null;
	submitterMeta: SubmitterMeta | null;
	status: ResponseStatus;
	syncedTargets: SyncedTarget[];
	cohort: string | null;
	createdAt: string;
	updatedAt: string;
}

// ─── Constants ──────────────────────────────────────────────

export const FIELD_TYPE_LABELS: Record<FieldType, { de: string; en: string }> = {
	short_text: { de: 'Kurzer Text', en: 'Short text' },
	long_text: { de: 'Langer Text', en: 'Long text' },
	single_choice: { de: 'Einfachauswahl', en: 'Single choice' },
	multi_choice: { de: 'Mehrfachauswahl', en: 'Multiple choice' },
	number: { de: 'Zahl', en: 'Number' },
	date: { de: 'Datum', en: 'Date' },
	email: { de: 'E-Mail', en: 'Email' },
	yes_no: { de: 'Ja / Nein', en: 'Yes / No' },
	rating: { de: 'Bewertung', en: 'Rating' },
	section: { de: 'Abschnitt', en: 'Section' },
	consent: { de: 'Einwilligung', en: 'Consent' },
};

export const FORM_STATUS_LABELS: Record<FormStatus, { de: string; en: string }> = {
	draft: { de: 'Entwurf', en: 'Draft' },
	published: { de: 'Veröffentlicht', en: 'Published' },
	closed: { de: 'Geschlossen', en: 'Closed' },
};

export const RESPONSE_STATUS_LABELS: Record<ResponseStatus, { de: string; en: string }> = {
	new: { de: 'Neu', en: 'New' },
	reviewed: { de: 'Gesichtet', en: 'Reviewed' },
	archived: { de: 'Archiviert', en: 'Archived' },
	spam: { de: 'Spam', en: 'Spam' },
};

export const DEFAULT_FORM_SETTINGS: FormSettings = {
	submitButtonLabel: 'Senden',
	successMessage: 'Danke! Deine Antwort wurde übermittelt.',
	allowMultipleSubmissions: false,
	requireEmail: false,
	anonymous: false,
	zkMode: false,
};
