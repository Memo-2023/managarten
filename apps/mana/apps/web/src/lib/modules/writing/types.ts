/**
 * Writing module types — an AI-first Ghostwriter surface for intentionally
 * produced prose. A `Draft` carries briefing + references + a pointer to its
 * current version; every full (re)generation writes a new immutable
 * `DraftVersion`; `Generation` records capture the provider-level call so
 * we can show live progress and audit which model/prompt produced what.
 * `WritingStyle` lives as its own table so a style can be reused across
 * drafts, trained from samples, and (later) linked from agent personas.
 *
 * Plan: `docs/plans/writing-module.md`.
 */

import type { BaseRecord } from '@mana/local-store';
import type { VisibilityLevel } from '@mana/shared-privacy';

// ─── Discriminators & Enums ──────────────────────────────

export type DraftKind =
	| 'blog'
	| 'essay'
	| 'email'
	| 'social'
	| 'story'
	| 'letter'
	| 'speech'
	| 'cover-letter'
	| 'product-description'
	| 'press-release'
	| 'bio'
	| 'other';

export type DraftStatus = 'draft' | 'refining' | 'complete' | 'published';

export type DraftLengthUnit = 'words' | 'chars' | 'minutes';

export type GenerationStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export type GenerationKind =
	| 'outline'
	| 'draft-from-brief'
	| 'draft-from-outline'
	| 'selection-rewrite'
	| 'selection-shorten'
	| 'selection-expand'
	| 'selection-tone'
	| 'selection-translate'
	| 'full-regenerate';

export type GenerationProvider = 'mana-ai' | 'mana-llm' | 'local-llm';

export type StyleSource = 'preset' | 'custom-description' | 'sample-trained' | 'self-trained';

export type DraftReferenceKind = 'note' | 'library' | 'kontext' | 'goal' | 'url' | 'me-image';

export type DraftPublishModule = 'website' | 'social-relay' | 'mail' | 'presi';

// ─── Sub-objects ─────────────────────────────────────────

export interface DraftBriefing {
	topic: string;
	audience?: string | null;
	tone?: string | null;
	/** ISO language code; default 'de'. */
	language: string;
	targetLength?: {
		type: DraftLengthUnit;
		value: number;
	} | null;
	extraInstructions?: string | null;
	/** When true, the runner injects mana-research results as standing context. */
	useResearch?: boolean;
}

export interface DraftStyleOverrides {
	tone?: string | null;
	styleNotes?: string | null;
}

export interface DraftReference {
	kind: DraftReferenceKind;
	/** Module-local id; present for every kind except 'url'. */
	targetId?: string | null;
	/** External URL; present for kind='url', optional otherwise. */
	url?: string | null;
	/** Free-form note about why this reference matters for the draft. */
	note?: string | null;
}

export interface DraftPublishTarget {
	module: DraftPublishModule;
	targetId: string;
	publishedAt: string;
}

export interface DraftGenerationParams {
	temperature?: number | null;
	maxTokens?: number | null;
}

export interface DraftSelection {
	start: number;
	end: number;
}

export interface DraftTokenUsage {
	input: number;
	output: number;
}

export interface StyleSample {
	label: string;
	text: string;
	/** Optional pointer back to the source (e.g. 'journal:abc', 'articles:xyz'). */
	sourceRef?: string | null;
}

export interface StyleExtractedPrinciples {
	toneTraits: string[];
	sentenceLengthAvg?: number | null;
	vocabulary?: string[];
	examples?: string[];
	rawAnalysis?: string | null;
	extractedAt: string;
}

// ─── Local Records (Dexie) ───────────────────────────────

export interface LocalDraft extends BaseRecord {
	kind: DraftKind;
	status: DraftStatus;
	title: string;
	briefing: DraftBriefing;
	/** FK to writingStyles; null = ad-hoc (no saved style). */
	styleId?: string | null;
	styleOverrides?: DraftStyleOverrides | null;
	references: DraftReference[];
	/** Points at the current LocalDraftVersion.id; null until first generation. */
	currentVersionId?: string | null;
	visibility?: VisibilityLevel;
	visibilityChangedAt?: string;
	visibilityChangedBy?: string;
	unlistedToken?: string;
	publishedTo?: DraftPublishTarget[];
	isFavorite: boolean;
}

export interface LocalDraftVersion extends BaseRecord {
	draftId: string;
	versionNumber: number;
	/** Markdown body of this version. */
	content: string;
	wordCount: number;
	generationId?: string | null;
	isAiGenerated: boolean;
	parentVersionId?: string | null;
	/** Short auto-summary for the version-history panel. */
	summary?: string | null;
}

export interface LocalGeneration extends BaseRecord {
	draftId: string;
	kind: GenerationKind;
	status: GenerationStatus;
	prompt: string;
	provider: GenerationProvider;
	model?: string | null;
	params?: DraftGenerationParams | null;
	/** Only set for selection-* kinds. */
	inputSelection?: DraftSelection | null;
	output?: string | null;
	outputVersionId?: string | null;
	startedAt?: string | null;
	completedAt?: string | null;
	durationMs?: number | null;
	tokenUsage?: DraftTokenUsage | null;
	error?: string | null;
	/** FK into a mana-ai mission when the generation ran server-side. */
	missionId?: string | null;
}

export interface LocalWritingStyle extends BaseRecord {
	name: string;
	description: string;
	source: StyleSource;
	presetId?: string | null;
	samples?: StyleSample[];
	extractedPrinciples?: StyleExtractedPrinciples | null;
	/** True when this style is the Space-wide default for team spaces. */
	isSpaceDefault: boolean;
	isFavorite: boolean;
}

// ─── Domain Types (plaintext, for UI) ────────────────────

export interface Draft {
	id: string;
	kind: DraftKind;
	status: DraftStatus;
	title: string;
	briefing: DraftBriefing;
	styleId: string | null;
	styleOverrides: DraftStyleOverrides | null;
	references: DraftReference[];
	currentVersionId: string | null;
	visibility: VisibilityLevel;
	/** 32-char token minted on first flip to 'unlisted'. Null otherwise. */
	unlistedToken: string | null;
	publishedTo: DraftPublishTarget[];
	isFavorite: boolean;
	createdAt: string;
	updatedAt: string;
}

export interface DraftVersion {
	id: string;
	draftId: string;
	versionNumber: number;
	content: string;
	wordCount: number;
	generationId: string | null;
	isAiGenerated: boolean;
	parentVersionId: string | null;
	summary: string | null;
	createdAt: string;
}

export interface Generation {
	id: string;
	draftId: string;
	kind: GenerationKind;
	status: GenerationStatus;
	prompt: string;
	provider: GenerationProvider;
	model: string | null;
	params: DraftGenerationParams | null;
	inputSelection: DraftSelection | null;
	output: string | null;
	outputVersionId: string | null;
	startedAt: string | null;
	completedAt: string | null;
	durationMs: number | null;
	tokenUsage: DraftTokenUsage | null;
	error: string | null;
	missionId: string | null;
	createdAt: string;
}

export interface WritingStyle {
	id: string;
	name: string;
	description: string;
	source: StyleSource;
	presetId: string | null;
	samples: StyleSample[];
	extractedPrinciples: StyleExtractedPrinciples | null;
	isSpaceDefault: boolean;
	isFavorite: boolean;
	createdAt: string;
	updatedAt: string;
}
