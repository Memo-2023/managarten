/**
 * Card Store — standalone.
 *
 * Writes the {type, fields} shape directly. Legacy mirror (front/back
 * columns) kept on for cross-compat with the mana-modul data model
 * once sync flips on. No encryption, no domain events — that's the
 * deliberate Phase-1 simplification.
 */

import { cardTable, cardDeckTable } from '../data/database';
import { encryptRecord, decryptRecord } from '../data/crypto';
import { reviewStore } from './reviews.svelte';
import {
	type CardFields,
	type CardType,
	type LocalCard,
	type CreateCardInput,
	type UpdateCardInput,
} from '@mana/cards-core';

let error = $state<string | null>(null);

function resolveTypeAndFields(input: CreateCardInput): {
	type: CardType;
	fields: CardFields;
} {
	const type = input.type ?? 'basic';
	if (input.fields) return { type, fields: input.fields };
	if (type === 'cloze') return { type, fields: { text: input.front ?? '' } };
	return { type, fields: { front: input.front ?? '', back: input.back ?? '' } };
}

function legacyMirror(type: CardType, fields: CardFields): { front?: string; back?: string } {
	if (type === 'basic' || type === 'basic-reverse' || type === 'type-in') {
		return { front: fields.front ?? '', back: fields.back ?? '' };
	}
	if (type === 'cloze') {
		return { front: fields.text ?? '', back: '' };
	}
	return {};
}

export const cardStore = {
	get error() {
		return error;
	},

	async createCard(
		input: CreateCardInput,
		currentCardCount: number = 0
	): Promise<LocalCard | null> {
		error = null;
		try {
			const { type, fields } = resolveTypeAndFields(input);
			const legacy = legacyMirror(type, fields);
			const now = new Date().toISOString();

			const newLocal: LocalCard = {
				id: crypto.randomUUID(),
				deckId: input.deckId,
				type,
				fields,
				order: currentCardCount,
				createdAt: now,
				updatedAt: now,
				...legacy,
			};

			await encryptRecord('cards', newLocal);
			await cardTable.add(newLocal);

			const deck = await cardDeckTable.get(input.deckId);
			if (deck) {
				await cardDeckTable.update(input.deckId, {
					cardCount: (deck.cardCount || 0) + 1,
					updatedAt: now,
				});
			}

			await reviewStore.ensureReviewsForCard({ id: newLocal.id, type, fields });
			return newLocal;
		} catch (err: any) {
			error = err.message || 'Failed to create card';
			console.error('Create card error:', err);
			return null;
		}
	},

	async updateCard(id: string, updates: UpdateCardInput) {
		error = null;
		try {
			const existingRaw = await cardTable.get(id);
			if (!existingRaw) return;
			const existing = await decryptRecord('cards', { ...existingRaw });

			const currentType: CardType = existing.type ?? 'basic';
			const currentFields: CardFields = existing.fields ?? {
				front: existing.front ?? '',
				back: existing.back ?? '',
			};

			const nextType: CardType = updates.type ?? currentType;
			const nextFields: CardFields = updates.fields
				? updates.fields
				: updates.front !== undefined || updates.back !== undefined
					? nextType === 'cloze'
						? { ...currentFields, text: updates.front ?? currentFields.text ?? '' }
						: {
								...currentFields,
								front: updates.front ?? currentFields.front ?? '',
								back: updates.back ?? currentFields.back ?? '',
							}
					: currentFields;

			const legacy = legacyMirror(nextType, nextFields);
			const diff: Partial<LocalCard> = {
				type: nextType,
				fields: nextFields,
				updatedAt: new Date().toISOString(),
				...legacy,
			};
			if (updates.order !== undefined) diff.order = updates.order;

			await encryptRecord('cards', diff as Record<string, unknown>);
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

			if (deckId) {
				const deck = await cardDeckTable.get(deckId);
				if (deck) {
					await cardDeckTable.update(deckId, {
						cardCount: Math.max(0, (deck.cardCount || 0) - 1),
						updatedAt: now,
					});
				}
			}
		} catch (err: any) {
			error = err.message || 'Failed to delete card';
			console.error('Delete card error:', err);
		}
	},

	clearError() {
		error = null;
	},
};
