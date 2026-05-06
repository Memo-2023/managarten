/**
 * FSRS wrapper — Free Spaced Repetition Scheduler v6 via `ts-fsrs`.
 *
 * Translates between ts-fsrs's `Card` (Date objects, snake_case) and
 * our `LocalCardReview` (ISO strings, camelCase). Stores never see
 * ts-fsrs types directly. One place to swap params for per-user-tuning
 * later.
 */

import { fsrs, createEmptyCard, State, type Card, type Grade } from 'ts-fsrs';
import type { LocalCardReview, ReviewGrade } from './types';

const STATE_TO_STRING: Record<State, LocalCardReview['state']> = {
	[State.New]: 'new',
	[State.Learning]: 'learning',
	[State.Review]: 'review',
	[State.Relearning]: 'relearning',
};

const STRING_TO_STATE: Record<LocalCardReview['state'], State> = {
	new: State.New,
	learning: State.Learning,
	review: State.Review,
	relearning: State.Relearning,
};

function toLocalReview(id: string, cardId: string, subIndex: number, card: Card): LocalCardReview {
	return {
		id,
		cardId,
		subIndex,
		state: STATE_TO_STRING[card.state],
		stability: card.stability,
		difficulty: card.difficulty,
		due: card.due.toISOString(),
		reps: card.reps,
		lapses: card.lapses,
		lastReview: card.last_review ? card.last_review.toISOString() : undefined,
		elapsedDays: card.elapsed_days,
		scheduledDays: card.scheduled_days,
	};
}

function toFsrsCard(review: LocalCardReview): Card {
	return {
		due: new Date(review.due),
		stability: review.stability,
		difficulty: review.difficulty,
		elapsed_days: review.elapsedDays,
		scheduled_days: review.scheduledDays,
		learning_steps: 0,
		reps: review.reps,
		lapses: review.lapses,
		state: STRING_TO_STATE[review.state],
		last_review: review.lastReview ? new Date(review.lastReview) : undefined,
	};
}

/**
 * Build a fresh review row for a new learnable unit (basic card,
 * one cloze cluster, one direction of basic-reverse).
 */
export function newReview(opts: { cardId: string; subIndex: number; now?: Date }): LocalCardReview {
	const id = crypto.randomUUID();
	const empty = createEmptyCard(opts.now ?? new Date());
	return toLocalReview(id, opts.cardId, opts.subIndex, empty);
}

/**
 * Apply a grade to a review and return the next-state row.
 */
export function gradeReview(
	review: LocalCardReview,
	grade: ReviewGrade,
	now: Date = new Date()
): LocalCardReview {
	const scheduler = getScheduler();
	const fsrsCard = toFsrsCard(review);
	const result = scheduler.next(fsrsCard, now, gradeToRating(grade));
	return toLocalReview(review.id, review.cardId, review.subIndex, result.card);
}

function gradeToRating(grade: ReviewGrade): Grade {
	return grade as unknown as Grade;
}

let cached: ReturnType<typeof fsrs> | null = null;
function getScheduler() {
	if (!cached) cached = fsrs();
	return cached;
}
