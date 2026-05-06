/**
 * Study-Block Store — daily aggregate of learning activity.
 *
 * One row per local date with counters. The streak query walks back
 * from today; finding a gap (no row, or cardsReviewed=0) ends the
 * streak. Plaintext, no encryption.
 *
 * Why a daily aggregate row instead of just summing cardReviews?
 * Because the streak is a UI-hot read — we want it cheap (≤ 30 row
 * lookups) regardless of how many reviews exist in total.
 */

import { cardStudyBlockTable } from '../collections';
import type { LocalCardStudyBlock } from '../types';

let error = $state<string | null>(null);

function localDateKey(d: Date = new Date()): string {
	// YYYY-MM-DD in the user's local timezone — matches LocalCardStudyBlock.date.
	const y = d.getFullYear();
	const m = `${d.getMonth() + 1}`.padStart(2, '0');
	const day = `${d.getDate()}`.padStart(2, '0');
	return `${y}-${m}-${day}`;
}

export const studyBlockStore = {
	get error() {
		return error;
	},

	/**
	 * Record one review against today's block. Creates the row on the
	 * first review of the day. Idempotent across concurrent calls only
	 * within a Dexie transaction — for now we accept the small chance of
	 * an off-by-one race; real users grade one card at a time.
	 */
	async recordReview(durationMs: number, count: number = 1): Promise<void> {
		error = null;
		try {
			const date = localDateKey();
			const existing = await cardStudyBlockTable.where('date').equals(date).first();
			if (existing && !existing.deletedAt) {
				await cardStudyBlockTable.update(existing.id, {
					cardsReviewed: existing.cardsReviewed + count,
					durationMs: existing.durationMs + durationMs,
				});
			} else {
				const row: LocalCardStudyBlock = {
					id: crypto.randomUUID(),
					date,
					cardsReviewed: count,
					durationMs,
				};
				await cardStudyBlockTable.add(row);
			}
		} catch (err: any) {
			error = err.message || 'Failed to record review';
			console.error('Record review error:', err);
		}
	},

	/**
	 * Walk back from today; return how many consecutive days have at
	 * least one reviewed card. Stops at the first gap. Caps at 365 days
	 * to keep the worst case bounded.
	 */
	async getRecentStreak(): Promise<number> {
		const today = new Date();
		let streak = 0;
		for (let i = 0; i < 365; i++) {
			const d = new Date(today);
			d.setDate(d.getDate() - i);
			const row = await cardStudyBlockTable.where('date').equals(localDateKey(d)).first();
			if (!row || row.deletedAt || row.cardsReviewed <= 0) break;
			streak++;
		}
		return streak;
	},

	clearError() {
		error = null;
	},
};
