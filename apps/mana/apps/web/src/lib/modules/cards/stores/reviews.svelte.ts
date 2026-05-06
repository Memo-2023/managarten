/**
 * Card-Review Store — FSRS scheduling state.
 *
 * Reviews are plaintext (no encryptRecord) — cardReviews is in
 * `plaintext-allowlist.ts` because the scheduler must query by `due`
 * to find what's fällig today.
 *
 * Three operations the rest of the module needs:
 *   - ensureReviewsForCard: create the right number of subIndex rows
 *     for a card, soft-delete obsolete ones (e.g. when a cloze cluster
 *     gets removed). Idempotent — safe to call after every card edit.
 *   - grade: apply a user rating, persist the next FSRS state.
 *   - softDeleteForCard: cascade soft-delete when a card is deleted.
 */

import { cardReviewTable } from '../collections';
import { newReview, gradeReview as fsrsGrade } from '../fsrs';
import { subIndexesFor } from '../card-reviews';
import type { CardFields, CardType, LocalCardReview, ReviewGrade } from '../types';

let error = $state<string | null>(null);

export const reviewStore = {
	get error() {
		return error;
	},

	/**
	 * Reconcile the cardReviews rows for a card with what the card
	 * structurally needs. New subIndexes get a fresh review; obsolete
	 * ones get soft-deleted. Returns the live set of reviews.
	 */
	async ensureReviewsForCard(card: {
		id: string;
		type: CardType;
		fields: CardFields;
	}): Promise<LocalCardReview[]> {
		error = null;
		try {
			const existing = await cardReviewTable.where('cardId').equals(card.id).toArray();
			const live = existing.filter((r) => !r.deletedAt);
			const liveByIdx = new Map(live.map((r) => [r.subIndex, r]));

			const wanted = subIndexesFor(card);
			const wantedSet = new Set(wanted);
			const nowIso = new Date().toISOString();

			for (const subIndex of wanted) {
				if (!liveByIdx.has(subIndex)) {
					const r = newReview({ cardId: card.id, subIndex });
					await cardReviewTable.add(r);
					liveByIdx.set(subIndex, r);
				}
			}

			for (const r of live) {
				if (!wantedSet.has(r.subIndex)) {
					await cardReviewTable.update(r.id, { deletedAt: nowIso });
					liveByIdx.delete(r.subIndex);
				}
			}

			return [...liveByIdx.values()].sort((a, b) => a.subIndex - b.subIndex);
		} catch (err: any) {
			error = err.message || 'Failed to ensure reviews';
			console.error('Ensure reviews error:', err);
			return [];
		}
	},

	async grade(reviewId: string, grade: ReviewGrade): Promise<LocalCardReview | null> {
		error = null;
		try {
			const existing = await cardReviewTable.get(reviewId);
			if (!existing) return null;
			const next = fsrsGrade(existing, grade);
			await cardReviewTable.put(next);
			return next;
		} catch (err: any) {
			error = err.message || 'Failed to grade review';
			console.error('Grade review error:', err);
			return null;
		}
	},

	async softDeleteForCard(cardId: string): Promise<void> {
		const reviews = await cardReviewTable.where('cardId').equals(cardId).toArray();
		const now = new Date().toISOString();
		for (const r of reviews) {
			if (!r.deletedAt) await cardReviewTable.update(r.id, { deletedAt: now });
		}
	},

	clearError() {
		error = null;
	},
};
