/**
 * Cards module — collection accessors and guest seed data.
 *
 * Tables in the unified DB: cardDecks, cards, cardReviews, cardStudyBlocks.
 */

import { db } from '$lib/data/database';
import type { LocalDeck, LocalCard, LocalCardReview, LocalCardStudyBlock } from './types';

// ─── Collection Accessors ──────────────────────────────────

export const cardDeckTable = db.table<LocalDeck>('cardDecks');
export const cardTable = db.table<LocalCard>('cards');
export const cardReviewTable = db.table<LocalCardReview>('cardReviews');
export const cardStudyBlockTable = db.table<LocalCardStudyBlock>('cardStudyBlocks');

// ─── Guest Seed ────────────────────────────────────────────

const ONBOARDING_DECK_ID = 'onboarding-deck';

export const CARDS_GUEST_SEED = {
	cardDecks: [
		{
			id: ONBOARDING_DECK_ID,
			name: 'Erste Schritte',
			description: 'Lerne Cards kennen mit diesen Beispiel-Karteikarten.',
			color: '#6366f1',
			cardCount: 3,
		},
	],
	cards: [
		{
			id: 'card-1',
			deckId: ONBOARDING_DECK_ID,
			front: 'Was ist Cards?',
			back: 'Cards ist eine Karteikarten-App zum effizienten Lernen mit Spaced Repetition.',
			difficulty: 1,
			reviewCount: 0,
			order: 0,
		},
		{
			id: 'card-2',
			deckId: ONBOARDING_DECK_ID,
			front: 'Wie funktioniert Spaced Repetition?',
			back: 'Karten, die du gut kennst, werden seltener gezeigt. Schwierige Karten erscheinen haufiger, bis du sie beherrschst.',
			difficulty: 2,
			reviewCount: 0,
			order: 1,
		},
		{
			id: 'card-3',
			deckId: ONBOARDING_DECK_ID,
			front: 'Wie erstelle ich ein neues Deck?',
			back: 'Klicke auf den + Button auf der Decks-Seite, um ein neues Deck mit eigenen Karteikarten zu erstellen.',
			difficulty: 1,
			reviewCount: 0,
			order: 2,
		},
	],
};
