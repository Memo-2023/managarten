/**
 * Card Store — Mutations Only
 *
 * Reads come from liveQuery hooks in queries.ts.
 * This store only handles writes to IndexedDB via the unified database.
 *
 * Phase 0+: writes the new {type, fields} shape AND mirrors basic-card
 * content to the legacy front/back columns so older mana builds keep
 * rendering. Every create/update fans out to cardReviews via
 * reviewStore.ensureReviewsForCard().
 */

import { CardsEvents } from '@mana/shared-utils/analytics';
import { cardTable, cardDeckTable } from '../collections';
import { toCard, toLogicalCard } from '../queries';
import { encryptRecord, decryptRecord } from '$lib/data/crypto';
import { emitDomainEvent } from '$lib/data/events';
import type {
	CardFields,
	CardType,
	LocalCard,
	Card,
	CreateCardInput,
	UpdateCardInput,
} from '../types';
import { reviewStore } from './reviews.svelte';

let error = $state<string | null>(null);

/**
 * Build the {type, fields} pair from a CreateCardInput. Accepts the
 * convenience `front`/`back` shortcut for basic cards and falls back
 * to an explicit `fields` map for cloze and friends.
 */
function resolveTypeAndFields(input: CreateCardInput): {
	type: CardType;
	fields: CardFields;
} {
	const type = input.type ?? 'basic';
	if (input.fields) return { type, fields: input.fields };
	if (type === 'cloze') return { type, fields: { text: input.front ?? '' } };
	return { type, fields: { front: input.front ?? '', back: input.back ?? '' } };
}

/** Mirror basic-card text into the legacy columns for older clients. */
function legacyMirror(type: CardType, fields: CardFields): { front?: string; back?: string } {
	if (type === 'basic' || type === 'basic-reverse' || type === 'type-in') {
		return { front: fields.front ?? '', back: fields.back ?? '' };
	}
	if (type === 'cloze') {
		// Surface the cloze source on `front` so legacy list-views show
		// something meaningful rather than an empty row.
		return { front: fields.text ?? '', back: '' };
	}
	return {};
}

export const cardStore = {
	get error() {
		return error;
	},

	async createCard(input: CreateCardInput, currentCardCount: number = 0): Promise<Card | null> {
		error = null;
		try {
			const { type, fields } = resolveTypeAndFields(input);
			const legacy = legacyMirror(type, fields);

			const newLocal: LocalCard = {
				id: crypto.randomUUID(),
				deckId: input.deckId,
				type,
				fields,
				order: currentCardCount,
				...legacy,
			};

			const plaintextSnapshot = toCard(newLocal);
			await encryptRecord('cards', newLocal);
			await cardTable.add(newLocal);

			const deck = await cardDeckTable.get(input.deckId);
			if (deck) {
				await cardDeckTable.update(input.deckId, {
					cardCount: (deck.cardCount || 0) + 1,
				});
			}

			await reviewStore.ensureReviewsForCard({ id: newLocal.id, type, fields });

			emitDomainEvent('CardCreated', 'cards', 'cards', newLocal.id, {
				cardId: newLocal.id,
				deckId: input.deckId,
			});
			CardsEvents.cardCreated();
			return plaintextSnapshot;
		} catch (err: any) {
			error = err.message || 'Failed to create card';
			console.error('Create card error:', err);
			return null;
		}
	},

	async updateCard(id: string, updates: UpdateCardInput) {
		error = null;
		try {
			const existing = await cardTable.get(id);
			if (!existing) return;

			const decrypted = await decryptRecord('cards', { ...existing });
			const current = toLogicalCard(decrypted as LocalCard);
			const nextType: CardType = updates.type ?? current.type;
			const nextFields: CardFields = updates.fields
				? updates.fields
				: updates.front !== undefined || updates.back !== undefined
					? nextType === 'cloze'
						? { ...current.fields, text: updates.front ?? current.fields.text ?? '' }
						: {
								...current.fields,
								front: updates.front ?? current.fields.front ?? '',
								back: updates.back ?? current.fields.back ?? '',
							}
					: current.fields;

			const legacy = legacyMirror(nextType, nextFields);
			const diff: Partial<LocalCard> = {
				type: nextType,
				fields: nextFields,
				...legacy,
			};
			if (updates.order !== undefined) diff.order = updates.order;
			if (updates.difficulty !== undefined) diff.difficulty = updates.difficulty;

			await encryptRecord('cards', diff);
			await cardTable.update(id, diff);

			const structuralChange =
				updates.type !== undefined ||
				updates.fields !== undefined ||
				(nextType === 'cloze' && updates.front !== undefined);
			if (structuralChange) {
				await reviewStore.ensureReviewsForCard({ id, type: nextType, fields: nextFields });
			}
		} catch (err: any) {
			error = err.message || 'Failed to update card';
			console.error('Update card error:', err);
		}
	},

	async deleteCard(id: string, deckId?: string) {
		error = null;
		try {
			const now = new Date().toISOString();
			await cardTable.update(id, { deletedAt: now });
			await reviewStore.softDeleteForCard(id);
			CardsEvents.cardDeleted();

			if (deckId) {
				const deck = await cardDeckTable.get(deckId);
				if (deck) {
					await cardDeckTable.update(deckId, {
						cardCount: Math.max(0, (deck.cardCount || 0) - 1),
					});
				}
			}
		} catch (err: any) {
			error = err.message || 'Failed to delete card';
			console.error('Delete card error:', err);
		}
	},

	async reorderCards(cardIds: string[]) {
		error = null;
		try {
			for (let i = 0; i < cardIds.length; i++) {
				await cardTable.update(cardIds[i], { order: i });
			}
		} catch (err: any) {
			error = err.message || 'Failed to reorder cards';
			console.error('Reorder cards error:', err);
		}
	},

	clearError() {
		error = null;
	},
};
