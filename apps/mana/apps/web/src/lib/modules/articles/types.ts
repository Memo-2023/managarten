/**
 * Articles module — Pocket-style read-it-later.
 *
 * Six Dexie tables:
 *
 *   articles           — saved URLs + extracted Readability content
 *                        (encrypted: title, excerpt, content, htmlContent,
 *                        author, userNote). Reading state + dedupe key
 *                        stay plaintext for indexing.
 *   articleHighlights  — per-selection rows with plain-text offsets.
 *                        Encrypted: text, note, context snippets.
 *   articleTags        — pure junction into globalTags. No user-typed
 *                        content lives here — tag names/colors are in
 *                        the global tag system (appId: 'tags').
 *
 *   articleImportJobs   — Bulk-Import job header. Plaintext: counters,
 *                         status, lease metadata. See
 *                         docs/plans/articles-bulk-import.md.
 *   articleImportItems  — One row per URL in a bulk job. URL stays
 *                         plaintext (server-worker reads it without
 *                         master-key access — same rationale as
 *                         articles.originalUrl). State machine:
 *                         pending → extracting → extracted →
 *                         (saved | duplicate | consent-wall | error |
 *                         cancelled).
 *   articleExtractPickup — Server-write inbox: the worker drops the
 *                          extracted payload here, the client picks it
 *                          up, runs encryptRecord + articleTable.add,
 *                          then deletes the row. Plaintext by necessity
 *                          (server has no master key); empty in steady
 *                          state.
 */

import type { BaseRecord } from '@mana/local-store';

// ─── Discriminators ──────────────────────────────────────

export type ArticleStatus = 'unread' | 'reading' | 'finished' | 'archived';

export type HighlightColor = 'yellow' | 'green' | 'blue' | 'pink';

// ─── Local Records (Dexie) ───────────────────────────────

export interface LocalArticle extends BaseRecord {
	originalUrl: string;
	title: string;
	excerpt: string | null;
	content: string;
	htmlContent: string | null;
	author: string | null;
	siteName: string | null;
	imageUrl: string | null;
	wordCount: number | null;
	readingTimeMinutes: number | null;
	publishedAt: string | null;
	status: ArticleStatus;
	/** 0..1 scroll position so the reader can restore where the user stopped. */
	readingProgress: number;
	isFavorite: boolean;
	savedAt: string;
	readAt: string | null;
	userNote: string | null;
	/** Bumped when the article is re-extracted so highlight re-anchoring
	 *  can decide whether to trust cached offsets. */
	extractedVersion: number;
}

export interface LocalHighlight extends BaseRecord {
	articleId: string;
	text: string;
	note: string | null;
	color: HighlightColor;
	/** Plain-text char offsets into `LocalArticle.content`. The reader maps
	 *  these back to DOM ranges over the rendered htmlContent. */
	startOffset: number;
	endOffset: number;
	/** Short fragments (~50 chars) around the selection — used to
	 *  re-anchor the highlight if the article gets re-extracted and
	 *  the offsets shift. */
	contextBefore: string | null;
	contextAfter: string | null;
}

/**
 * Junction row linking one article to one global tag. Same shape as
 * noteTags / eventTags / contactTags / placeTags — zero user-typed
 * content, so the row stays out of the encryption registry and lives
 * on the plaintext allowlist. Tag name/color/group come from globalTags
 * via @mana/shared-stores helpers.
 */
export interface LocalArticleTag extends BaseRecord {
	articleId: string;
	tagId: string;
}

// ─── Public DTOs (rendered by views) ─────────────────────

export interface Article {
	id: string;
	originalUrl: string;
	title: string;
	excerpt: string | null;
	content: string;
	htmlContent: string | null;
	author: string | null;
	siteName: string | null;
	imageUrl: string | null;
	wordCount: number | null;
	readingTimeMinutes: number | null;
	publishedAt: string | null;
	status: ArticleStatus;
	readingProgress: number;
	isFavorite: boolean;
	savedAt: string;
	readAt: string | null;
	userNote: string | null;
	extractedVersion: number;
	createdAt: string;
	updatedAt: string;
}

export interface Highlight {
	id: string;
	articleId: string;
	text: string;
	note: string | null;
	color: HighlightColor;
	startOffset: number;
	endOffset: number;
	contextBefore: string | null;
	contextAfter: string | null;
	createdAt: string;
	updatedAt: string;
}

// ─── Bulk Import (docs/plans/articles-bulk-import.md) ─────

/**
 * Job status — drives the index list filter and the JobDetailView's
 * action bar. `running` is the only state where the worker actively
 * pulls items; `paused` lets the user stop progress without losing the
 * remaining queue, `cancelled` is a hard stop with all pending items
 * flipped to terminal `cancelled`.
 */
export type ArticleImportJobStatus = 'queued' | 'running' | 'paused' | 'done' | 'cancelled';

/**
 * Item state machine. Server-side transitions: pending → extracting →
 * extracted (worker has dropped a pickup row). Client-side transitions:
 * extracted → saved | duplicate | consent-wall (pickup-consumer
 * applied the result). Both sides may transition to error (worker after
 * 3 retries, client if encryptRecord/add fails). cancelled is terminal
 * and only set when the parent job is cancelled before the item ran.
 */
export type ArticleImportItemState =
	| 'pending'
	| 'extracting'
	| 'extracted'
	| 'saved'
	| 'duplicate'
	| 'consent-wall'
	| 'error'
	| 'cancelled';

export interface LocalArticleImportJob extends BaseRecord {
	totalUrls: number;
	status: ArticleImportJobStatus;
	startedAt: string | null;
	finishedAt: string | null;
	/** Counters mirror the per-item terminal states. Cache for fast list
	 *  rendering — truth lives in the item rows. Worker stamps these on
	 *  each transition. */
	savedCount: number;
	duplicateCount: number;
	errorCount: number;
	warningCount: number;
	// NOTE: `leasedBy` + `leasedUntil` were defined on the original
	// schema as a soft-lease handshake but the worker uses
	// pg_try_advisory_xact_lock instead, so they were never written.
	// Removed in Dexie v58 — see database.ts.
}

export interface LocalArticleImportItem extends BaseRecord {
	jobId: string;
	/** Original position in the user-provided URL list. Drives display order. */
	idx: number;
	/** Plaintext — server worker reads it without master-key access. Same
	 *  rationale as articles.originalUrl / newsArticles.originalUrl. */
	url: string;
	state: ArticleImportItemState;
	/** Pointer into `articles` table once the article is persisted. */
	articleId: string | null;
	warning: 'probable_consent_wall' | null;
	/** Plaintext technical error message ("502 Bad Gateway", "timeout"). */
	error: string | null;
	attempts: number;
	lastAttemptAt: string | null;
}

/**
 * Server → client handoff. Lives only between worker-write and
 * pickup-consumer-read. Empty in steady state.
 */
export interface LocalArticleExtractPickup extends BaseRecord {
	itemId: string;
	/** The server's ExtractedArticle JSON, plaintext. Mirrors the shape
	 *  in articles/api.ts but lives here as a structural type so the
	 *  database layer doesn't import the API client.  */
	payload: {
		originalUrl: string;
		title: string;
		excerpt: string | null;
		content: string;
		htmlContent: string;
		author: string | null;
		siteName: string | null;
		wordCount: number;
		readingTimeMinutes: number;
		warning?: 'probable_consent_wall';
	};
}

// Public DTOs used by views (livequery converters strip the BaseRecord
// internals + map state to display-friendly shapes).

export interface ArticleImportJob {
	id: string;
	totalUrls: number;
	status: ArticleImportJobStatus;
	startedAt: string | null;
	finishedAt: string | null;
	savedCount: number;
	duplicateCount: number;
	errorCount: number;
	warningCount: number;
	createdAt: string;
	updatedAt: string;
}

export interface ArticleImportItem {
	id: string;
	jobId: string;
	idx: number;
	url: string;
	state: ArticleImportItemState;
	articleId: string | null;
	warning: 'probable_consent_wall' | null;
	error: string | null;
	attempts: number;
	lastAttemptAt: string | null;
	createdAt: string;
	updatedAt: string;
}
