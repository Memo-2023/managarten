import type { ModuleConfig } from '$lib/data/module-registry';

export const cardsModuleConfig: ModuleConfig = {
	appId: 'cards',
	tables: [
		{ name: 'cardDecks', syncName: 'decks' },
		{ name: 'cards' },
		{ name: 'deckTags' },
		{ name: 'cardReviews' },
		{ name: 'cardStudyBlocks' },
	],
};
