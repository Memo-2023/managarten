/**
 * Reactive queries — standalone.
 *
 * Wraps Dexie's liveQuery so Svelte components get auto-updates whenever
 * the underlying tables change. Type converters mirror the mana-modul
 * shape so component code stays portable.
 */

import { liveQuery } from 'dexie';
import {
	db,
	cardDeckTable,
	cardTable,
	cardReviewTable,
	cardStudyBlockTable,
} from './data/database';
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

/**
 * Map of deckId → count of currently-due reviews. Used by the deck list
 * so the user can see at a glance which deck wants attention without
 * opening it.
 */
export function useDueCountByDeck() {
	return liveQuery(async () => {
		const nowIso = new Date().toISOString();
		const due = await cardReviewTable.where('due').belowOrEqual(nowIso).toArray();
		const live = due.filter((r) => !r.deletedAt);
		if (live.length === 0) return new Map<string, number>();

		const cardIds = [...new Set(live.map((r) => r.cardId))];
		const cards = await cardTable.where('id').anyOf(cardIds).toArray();
		const cardToDeck = new Map(cards.filter((c) => !c.deletedAt).map((c) => [c.id, c.deckId]));

		const counts = new Map<string, number>();
		for (const r of live) {
			const deckId = cardToDeck.get(r.cardId);
			if (!deckId) continue;
			counts.set(deckId, (counts.get(deckId) ?? 0) + 1);
		}
		return counts;
	});
}

/**
 * Per-day review counts for the last `weeks * 7` days (default 12 weeks
 * = 84 days). Used by the GitHub-style heatmap on the dashboard. Days
 * with no row in cardStudyBlocks come back as count=0 so the renderer
 * doesn't have to fill gaps itself.
 */
export function useStudyHeatmap(weeks: number = 12) {
	return liveQuery(async () => {
		const today = new Date();
		const localKey = (d: Date) => {
			const y = d.getFullYear();
			const m = `${d.getMonth() + 1}`.padStart(2, '0');
			const day = `${d.getDate()}`.padStart(2, '0');
			return `${y}-${m}-${day}`;
		};

		const days = weeks * 7;
		const rows = await cardStudyBlockTable.toArray();
		const byDate = new Map<string, number>();
		for (const r of rows) {
			if (r.deletedAt) continue;
			byDate.set(r.date, (byDate.get(r.date) ?? 0) + r.cardsReviewed);
		}

		const out: { date: string; count: number }[] = [];
		for (let i = days - 1; i >= 0; i--) {
			const d = new Date(today);
			d.setDate(d.getDate() - i);
			const key = localKey(d);
			out.push({ date: key, count: byDate.get(key) ?? 0 });
		}
		return out;
	});
}

/**
 * Days-in-a-row with at least one review. Walks back from today; the
 * first day with no row (or a soft-deleted/empty one) ends the count.
 * Capped at 365 to bound the worst-case scan.
 */
export function useStreak() {
	return liveQuery(async () => {
		const today = new Date();
		const localKey = (d: Date) => {
			const y = d.getFullYear();
			const m = `${d.getMonth() + 1}`.padStart(2, '0');
			const day = `${d.getDate()}`.padStart(2, '0');
			return `${y}-${m}-${day}`;
		};

		let streak = 0;
		for (let i = 0; i < 365; i++) {
			const d = new Date(today);
			d.setDate(d.getDate() - i);
			const row = await cardStudyBlockTable.where('date').equals(localKey(d)).first();
			if (!row || row.deletedAt || row.cardsReviewed <= 0) break;
			streak++;
		}
		return streak;
	});
}
