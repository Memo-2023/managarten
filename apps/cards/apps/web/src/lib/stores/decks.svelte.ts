/**
 * Deck Store — standalone.
 *
 * Slim version of the mana-modul decks store: no time-blocks, no
 * domain-events, no Mana-wide visibility hooks. Just CRUD against the
 * standalone Dexie DB.
 */

import { cardDeckTable, cardTable, db } from '../data/database';
import { encryptRecord } from '../data/crypto';
import type { CreateDeckInput, UpdateDeckInput, LocalDeck } from '@mana/cards-core';

let error = $state<string | null>(null);

export const deckStore = {
	get error() {
		return error;
	},

	async createDeck(input: CreateDeckInput): Promise<LocalDeck | null> {
		error = null;
		try {
			const now = new Date().toISOString();
			const newLocal: LocalDeck = {
				id: crypto.randomUUID(),
				name: input.title,
				description: input.description ?? null,
				color: '#6366f1',
				cardCount: 0,
				visibility: 'private',
				createdAt: now,
				updatedAt: now,
			};
			await encryptRecord('cardDecks', newLocal);
			await cardDeckTable.add(newLocal);
			return newLocal;
		} catch (err: any) {
			error = err.message || 'Failed to create deck';
			console.error('Create deck error:', err);
			return null;
		}
	},

	async updateDeck(id: string, updates: UpdateDeckInput) {
		error = null;
		try {
			const diff: Partial<LocalDeck> = { updatedAt: new Date().toISOString() };
			if (updates.title !== undefined) diff.name = updates.title;
			if (updates.description !== undefined) diff.description = updates.description;
			await encryptRecord('cardDecks', diff as Record<string, unknown>);
			await cardDeckTable.update(id, diff);
		} catch (err: any) {
			error = err.message || 'Failed to update deck';
			console.error('Update deck error:', err);
		}
	},

	async deleteDeck(id: string) {
		error = null;
		try {
			const now = new Date().toISOString();
			await db.transaction('rw', cardDeckTable, cardTable, async () => {
				const cards = await cardTable.where('deckId').equals(id).toArray();
				for (const card of cards) {
					await cardTable.update(card.id, { deletedAt: now });
				}
				await cardDeckTable.update(id, { deletedAt: now });
			});
		} catch (err: any) {
			error = err.message || 'Failed to delete deck';
			console.error('Delete deck error:', err);
		}
	},

	clearError() {
		error = null;
	},
};
