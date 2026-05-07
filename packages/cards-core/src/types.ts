/**
 * Cards — shared types.
 *
 * Used by both the mana cards module (apps/mana/.../modules/cards/) and
 * the cards.mana.how standalone app. Pure type definitions, no runtime
 * imports beyond `BaseRecord` and `VisibilityLevel` from the shared
 * Mana packages.
 */

import type { BaseRecord } from '@mana/local-store';
import type { VisibilityLevel } from '@mana/shared-privacy';

// ─── Card Types ────────────────────────────────────────────

/**
 * Discriminator for the card's render/learn behaviour. Phase 1 ships
 * basic, basic-reverse, cloze, type-in. Future types are reserved here
 * so storage already understands them — UI can light up later without
 * a schema change.
 */
export type CardType =
	| 'basic'
	| 'basic-reverse'
	| 'cloze'
	| 'type-in'
	| 'image-occlusion'
	| 'audio'
	| 'multiple-choice';

/**
 * Free-form key/value bag with the user-typed content. Schema by type:
 *   basic / basic-reverse / type-in: { front, back }
 *   cloze:                           { text, extra? }
 */
export type CardFields = Record<string, string>;

// ─── Local (IndexedDB) Records ─────────────────────────────

export interface LocalDeck extends BaseRecord {
	name: string;
	description?: string | null;
	color: string;
	cardCount: number;
	lastStudied?: string | null;
	visibility?: VisibilityLevel;
	visibilityChangedAt?: string;
	visibilityChangedBy?: string;
	activeStudyBlockId?: string | null;

	/**
	 * Marketplace-subscription markers. Set on decks that the user
	 * pulled from cards.mana.how/d/<slug> rather than created
	 * themselves. The pair (slug + version) lets the client compute
	 * a smart-merge diff against the server's latest version.
	 *
	 * Subscribed decks are read-only locally — the editor hides its
	 * mutate buttons. Forking instead makes a separate own-deck row.
	 */
	subscribedFromSlug?: string;
	subscribedAtVersion?: string;
}

export interface LocalCard extends BaseRecord {
	deckId: string;
	type?: CardType;
	fields?: CardFields;
	order: number;

	// Legacy columns (pre-Phase-0). Still written for basic cards so
	// older mana-app builds keep rendering.
	front?: string;
	back?: string;
	difficulty?: number;
	nextReview?: string | null;
	reviewCount?: number;

	/**
	 * For cards pulled from a marketplace subscription: the server-
	 * computed SHA-256 of (type, fields). Powers smart-merge — when
	 * an updated version arrives, cards whose hash matches keep their
	 * FSRS state; cards whose hash changes get refreshed content but
	 * also keep their FSRS state (better for the learner than a reset).
	 */
	serverContentHash?: string;
}

/**
 * FSRS state for one *learnable unit*. A basic card has one review
 * (subIndex=0). A basic-reverse card has two (0=front→back, 1=back→front).
 * A cloze card has one per cluster (1=c1, 2=c2, …).
 *
 * Plaintext on purpose: the scheduler must query by `due` to find what's
 * fällig today.
 */
export interface LocalCardReview extends BaseRecord {
	cardId: string;
	subIndex: number;
	state: 'new' | 'learning' | 'review' | 'relearning';
	stability: number;
	difficulty: number;
	due: string;
	reps: number;
	lapses: number;
	lastReview?: string;
	elapsedDays: number;
	scheduledDays: number;
}

/**
 * Daily aggregate of learning activity for streak + stats. One row per
 * user per local date. All plaintext (numbers + dates).
 */
export interface LocalCardStudyBlock extends BaseRecord {
	date: string;
	cardsReviewed: number;
	durationMs: number;
}

// ─── View Types (DTOs returned to UI) ──────────────────────

export interface Deck {
	id: string;
	title: string;
	description?: string;
	color: string;
	visibility: VisibilityLevel;
	tags: string[];
	cardCount: number;
	createdAt: string;
	updatedAt: string;
	/** Marketplace slug if this deck was pulled from a subscription. */
	subscribedFromSlug?: string;
	/** Semver of the subscribed-from version that's currently local. */
	subscribedAtVersion?: string;
}

export interface Card {
	id: string;
	deckId: string;
	type: CardType;
	fields: CardFields;
	order: number;
	createdAt: string;
	updatedAt: string;

	front: string;
	back: string;

	/** @deprecated legacy DTO field — read from cardReviews going forward. */
	difficulty?: number;
	/** @deprecated legacy DTO field — read from cardReviews going forward. */
	nextReview?: string;
	/** @deprecated legacy DTO field — read from cardReviews going forward. */
	reviewCount?: number;

	/**
	 * For cards from a subscribed deck: the server's content-hash for
	 * the card as it was published. The PR-creation flow uses this as
	 * `previousContentHash` when proposing a "modify" diff.
	 */
	serverContentHash?: string;
}

export interface CardReview {
	id: string;
	cardId: string;
	subIndex: number;
	state: LocalCardReview['state'];
	stability: number;
	difficulty: number;
	due: string;
	reps: number;
	lapses: number;
	lastReview?: string;
	elapsedDays: number;
	scheduledDays: number;
}

// ─── Inputs ────────────────────────────────────────────────

export interface CreateDeckInput {
	title: string;
	description?: string;
}

export interface UpdateDeckInput {
	title?: string;
	description?: string;
}

export interface CreateCardInput {
	deckId: string;
	type?: CardType;
	fields?: CardFields;
	front?: string;
	back?: string;
}

export interface UpdateCardInput {
	type?: CardType;
	fields?: CardFields;
	front?: string;
	back?: string;
	order?: number;
	/** @deprecated legacy field — use cardReviews going forward. */
	difficulty?: number;
}

/**
 * Self-grading scale used by the learner during a session. Values match
 * FSRS's Rating enum (1=Again, 2=Hard, 3=Good, 4=Easy).
 */
export type ReviewGrade = 1 | 2 | 3 | 4;
