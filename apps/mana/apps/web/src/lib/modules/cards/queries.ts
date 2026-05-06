/**
 * Reactive queries & pure helpers for Cards — uses Dexie liveQuery on the unified DB.
 *
 * Uses table names: cardDecks, cards.
 */

import { liveQuery } from 'dexie';
import { deriveUpdatedAt } from '$lib/data/sync';
import { db } from '$lib/data/database';
import { scopedForModule } from '$lib/data/scope';
import { decryptRecord, decryptRecords } from '$lib/data/crypto';
import type {
	CardFields,
	CardType,
	LocalDeck,
	LocalCard,
	LocalCardReview,
	Deck,
	Card,
	CardReview,
} from './types';

// ─── Type Converters ───────────────────────────────────────

export function toDeck(local: LocalDeck): Deck {
	return {
		id: local.id,
		title: local.name,
		description: local.description ?? undefined,
		color: local.color,
		visibility: local.visibility ?? 'space',
		tags: [],
		cardCount: local.cardCount,
		createdAt: local.createdAt ?? new Date().toISOString(),
		updatedAt: deriveUpdatedAt(local),
	};
}

/**
 * Promote any LocalCard row — including legacy pre-Phase-0 ones — to
 * the canonical {type, fields} shape. Readers must go through this so
 * the rest of the app sees one schema.
 *
 *   - Phase-0+ rows: returned as-is, with `front`/`back` derived from
 *     fields for the convenience accessors on the DTO.
 *   - Legacy rows  (only `front`/`back` set): synthesised as
 *     {type: 'basic', fields: {front, back}}.
 */
export function toLogicalCard(local: LocalCard): {
	type: CardType;
	fields: CardFields;
	front: string;
	back: string;
} {
	const type: CardType = local.type ?? 'basic';
	const fields: CardFields = local.fields ?? {
		front: local.front ?? '',
		back: local.back ?? '',
	};
	const front = fields.front ?? local.front ?? '';
	const back = fields.back ?? local.back ?? '';
	return { type, fields, front, back };
}

export function toCard(local: LocalCard): Card {
	const { type, fields, front, back } = toLogicalCard(local);
	return {
		id: local.id,
		deckId: local.deckId,
		type,
		fields,
		front,
		back,
		order: local.order,
		createdAt: local.createdAt ?? new Date().toISOString(),
		updatedAt: deriveUpdatedAt(local),
		// Legacy fields surfaced for pre-Phase-0 UI. Populated only when the
		// underlying row carries them.
		difficulty: local.difficulty,
		nextReview: local.nextReview ?? undefined,
		reviewCount: local.reviewCount,
	};
}

// ─── Live Queries ──────────────────────────────────────────

/** All decks, auto-updates on any change. */
export function useAllDecks() {
	return liveQuery(async () => {
		const visible = (
			await scopedForModule<LocalDeck, string>('cards', 'cardDecks').toArray()
		).filter((d) => !d.deletedAt);
		const decrypted = await decryptRecords('cardDecks', visible);
		return decrypted.map(toDeck);
	});
}

/** Single deck by ID. Auto-updates on any change. */
export function useDeck(deckId: string) {
	return liveQuery(async () => {
		const local = await db.table<LocalDeck>('cardDecks').get(deckId);
		if (!local || local.deletedAt) return null;
		const decrypted = await decryptRecord('cardDecks', { ...local });
		return toDeck(decrypted);
	});
}

/** All cards for a specific deck, sorted by order. Auto-updates on any change. */
export function useCardsByDeck(deckId: string) {
	return liveQuery(async () => {
		const visible = (
			await db.table<LocalCard>('cards').where('deckId').equals(deckId).sortBy('order')
		).filter((c) => !c.deletedAt);
		const decrypted = await decryptRecords('cards', visible);
		return decrypted.map(toCard);
	});
}

/**
 * All reviews that are due now (or overdue), optionally filtered by
 * deck. Joined with the parent card so the UI can render the prompt
 * immediately without a second lookup.
 *
 * Sorted by `due` ascending so the oldest-due learnable unit comes
 * first — that's the natural session order.
 */
export function useDueReviews(deckId?: string) {
	return liveQuery(async () => {
		const nowIso = new Date().toISOString();
		const due = await db
			.table<LocalCardReview>('cardReviews')
			.where('due')
			.belowOrEqual(nowIso)
			.toArray();
		const live = due.filter((r) => !r.deletedAt);
		if (live.length === 0) return [] as { review: CardReview; card: Card }[];

		const cardIds = [...new Set(live.map((r) => r.cardId))];
		const cardRows = await db.table<LocalCard>('cards').where('id').anyOf(cardIds).toArray();
		const decryptedCards = await decryptRecords(
			'cards',
			cardRows.filter((c) => !c.deletedAt)
		);
		const cardById = new Map(decryptedCards.map((c) => [c.id, toCard(c)] as const));

		return live
			.filter((r) => {
				const c = cardById.get(r.cardId);
				if (!c) return false;
				if (deckId && c.deckId !== deckId) return false;
				return true;
			})
			.sort((a, b) => (a.due < b.due ? -1 : a.due > b.due ? 1 : 0))
			.map((r) => ({ review: toCardReview(r), card: cardById.get(r.cardId)! }));
	});
}

/** Just the reviews row, no card join — useful in the session UI mid-grade. */
export function useReview(reviewId: string) {
	return liveQuery(async () => {
		const r = await db.table<LocalCardReview>('cardReviews').get(reviewId);
		if (!r || r.deletedAt) return null;
		return toCardReview(r);
	});
}

function toCardReview(r: LocalCardReview): CardReview {
	return {
		id: r.id,
		cardId: r.cardId,
		subIndex: r.subIndex,
		state: r.state,
		stability: r.stability,
		difficulty: r.difficulty,
		due: r.due,
		reps: r.reps,
		lapses: r.lapses,
		lastReview: r.lastReview,
		elapsedDays: r.elapsedDays,
		scheduledDays: r.scheduledDays,
	};
}

// ─── Pure Helper Functions ─────────────────────────────────

export function getDeckById(decks: Deck[], id: string): Deck | undefined {
	return decks.find((d) => d.id === id);
}

export function getPublicDecks(decks: Deck[]): Deck[] {
	return decks.filter((d) => d.visibility === 'public');
}

export function getCardCountForDeck(cards: Card[], deckId: string): number {
	return cards.filter((c) => c.deckId === deckId).length;
}

export function getDueCards(cards: Card[]): Card[] {
	const now = new Date().toISOString();
	return cards.filter((c) => c.nextReview && c.nextReview <= now);
}
