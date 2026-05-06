/**
 * Study-Block Store — standalone.
 *
 * Local daily-aggregate row for streak + per-day-stats.
 */

import { cardStudyBlockTable } from '../data/database';
import type { LocalCardStudyBlock } from '@mana/cards-core';

let error = $state<string | null>(null);

function localDateKey(d: Date = new Date()): string {
	const y = d.getFullYear();
	const m = `${d.getMonth() + 1}`.padStart(2, '0');
	const day = `${d.getDate()}`.padStart(2, '0');
	return `${y}-${m}-${day}`;
}

export const studyBlockStore = {
	get error() {
		return error;
	},

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
