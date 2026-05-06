/**
 * Cards module — types are now sourced from `@mana/cards-core` so the
 * standalone cards.mana.how app and this in-mana module stay in sync.
 *
 * This file is a thin re-export to keep existing
 * `from './types'` / `from '$lib/modules/cards/types'` imports working.
 */

export type {
	CardType,
	CardFields,
	LocalDeck,
	LocalCard,
	LocalCardReview,
	LocalCardStudyBlock,
	Deck,
	Card,
	CardReview,
	CreateDeckInput,
	UpdateDeckInput,
	CreateCardInput,
	UpdateCardInput,
	ReviewGrade,
} from '@mana/cards-core';
