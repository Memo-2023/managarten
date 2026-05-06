/**
 * Reactive queries — standalone.
 *
 * Wraps Dexie's liveQuery so Svelte components get auto-updates whenever
 * the underlying tables change. Type converters mirror the mana-modul
 * shape so component code stays portable.
 */

import { liveQuery } from 'dexie';
import { db, cardDeckTable, cardTable, cardReviewTable } from './data/database';
import { decryptRecord, decryptRecords } from './data/crypto';
import type {
	CardFields,
	CardType,
	Card,
	CardReview,
	Deck,
	LocalCard,
	LocalCardReview,
	LocalDeck,
} from '@mana/cards-core';

// ─── Type Converters ───────────────────────────────────────

export function toDeck(local: LocalDeck): Deck {
	return {
		id: local.id,
		title: local.name,
		description: local.description ?? undefined,
		color: local.color,
		visibility: local.visibility ?? 'private',
		tags: [],
		cardCount: local.cardCount,
		createdAt: local.createdAt ?? new Date().toISOString(),
		updatedAt: local.updatedAt ?? local.createdAt ?? new Date().toISOString(),
	};
}

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
		updatedAt: local.updatedAt ?? local.createdAt ?? new Date().toISOString(),
	};
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

// ─── Live Queries ──────────────────────────────────────────

export function useAllDecks() {
	return liveQuery(async () => {
		const all = await cardDeckTable.toArray();
		const visible = all.filter((d) => !d.deletedAt);
		const decrypted = await decryptRecords('cardDecks', visible);
		return decrypted.map(toDeck);
	});
}

export function useDeck(deckId: string) {
	return liveQuery(async () => {
		const local = await cardDeckTable.get(deckId);
		if (!local || local.deletedAt) return null;
		const decrypted = await decryptRecord('cardDecks', { ...local });
		return toDeck(decrypted);
	});
}

export function useCardsByDeck(deckId: string) {
	return liveQuery(async () => {
		const visible = (await cardTable.where('deckId').equals(deckId).sortBy('order')).filter(
			(c) => !c.deletedAt
		);
		const decrypted = await decryptRecords('cards', visible);
		return decrypted.map(toCard);
	});
}

/**
 * All reviews due now (or overdue) optionally filtered by deck. Joined
 * with the parent card so the learn session can render immediately.
 */
export function useDueReviews(deckId?: string) {
	return liveQuery(async () => {
		const nowIso = new Date().toISOString();
		const due = await cardReviewTable.where('due').belowOrEqual(nowIso).toArray();
		const live = due.filter((r) => !r.deletedAt);
		if (live.length === 0) return [] as { review: CardReview; card: Card }[];

		const cardIds = [...new Set(live.map((r) => r.cardId))];
		const cardRows = await db.cards.where('id').anyOf(cardIds).toArray();
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

export function useReview(reviewId: string) {
	return liveQuery(async () => {
		const r = await cardReviewTable.get(reviewId);
		if (!r || r.deletedAt) return null;
		return toCardReview(r);
	});
}
