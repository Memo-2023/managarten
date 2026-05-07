/**
 * Subscribe to a marketplace deck and pull its latest version into
 * the local Dexie. Phase δ.2 — initial pull only; smart-merge of
 * subsequent updates lands in δ.3 via `applySubscriptionUpdate`
 * (placeholder export below).
 *
 * The subscribed deck shows up alongside own decks but is marked
 * `subscribedFromSlug` + `subscribedAtVersion` so the UI can hide
 * mutate controls and show an "Update available" indicator when
 * cards-server reports a newer version.
 */

import { cardsApi, CardsApiError, type ServerCard } from '$lib/api/cards-api';
import { cardDeckTable, cardTable } from '$lib/data/database';
import { reviewStore } from '$lib/stores/reviews.svelte';
import type { CardType, LocalCard, LocalDeck } from '@mana/cards-core';

const ALLOWED_TYPES: CardType[] = [
	'basic',
	'basic-reverse',
	'cloze',
	'type-in',
	'image-occlusion',
	'audio',
	'multiple-choice',
];

function asCardType(t: string): CardType {
	return (ALLOWED_TYPES as string[]).includes(t) ? (t as CardType) : 'basic';
}

export interface SubscribeResult {
	deckId: string;
	cardCount: number;
}

export async function subscribeAndPull(deckSlug: string): Promise<SubscribeResult> {
	// 1. Tell the server we're subscribed (idempotent, returns the
	//    version we should pull).
	const sub = await cardsApi.subscriptions.subscribe(deckSlug);

	// 2. Fetch the deck metadata so we know title/description/etc.
	const { deck, latestVersion } = await cardsApi.decks.bySlug(deckSlug);
	if (!latestVersion) {
		throw new Error('Subscribed but the deck has no published version yet');
	}

	// 3. Fetch the version's cards (full payload).
	const version = await cardsApi.subscriptions.version(deckSlug, latestVersion.semver);

	// 4. Already subscribed locally? Don't duplicate — refresh in
	//    place. Phase δ.3 will swap this for a real diff-apply.
	const existingDeck = await cardDeckTable
		.where('subscribedFromSlug')
		.equals(deckSlug)
		.first()
		.catch(() => undefined);

	const now = new Date().toISOString();
	const localDeck: LocalDeck = existingDeck ?? {
		id: crypto.randomUUID(),
		name: deck.title,
		description: deck.description,
		color: '#6366f1',
		cardCount: version.cards.length,
		visibility: 'private',
		createdAt: now,
		updatedAt: now,
		subscribedFromSlug: deckSlug,
		subscribedAtVersion: latestVersion.semver,
	};

	if (existingDeck) {
		await cardDeckTable.update(existingDeck.id, {
			name: deck.title,
			description: deck.description,
			cardCount: version.cards.length,
			subscribedAtVersion: latestVersion.semver,
			updatedAt: now,
		});
	} else {
		await cardDeckTable.add(localDeck);
	}

	// 5. Replace cards (initial-pull strategy; δ.3 keeps FSRS state).
	if (existingDeck) {
		const oldCards = await cardTable.where('deckId').equals(existingDeck.id).toArray();
		for (const c of oldCards) {
			if (!c.deletedAt) await cardTable.update(c.id, { deletedAt: now });
		}
	}

	for (const sc of version.cards) {
		const card: LocalCard = {
			id: crypto.randomUUID(),
			deckId: localDeck.id,
			type: asCardType(sc.type),
			fields: sc.fields,
			order: sc.ord,
			serverContentHash: sc.contentHash,
			createdAt: now,
			updatedAt: now,
		};
		await cardTable.add(card);
		await reviewStore.ensureReviewsForCard({
			id: card.id,
			type: card.type as CardType,
			fields: card.fields ?? {},
		});
	}

	return { deckId: localDeck.id, cardCount: version.cards.length };
}

export async function unsubscribe(deckSlug: string): Promise<void> {
	await cardsApi.subscriptions.unsubscribe(deckSlug);
	const local = await cardDeckTable
		.where('subscribedFromSlug')
		.equals(deckSlug)
		.first()
		.catch(() => undefined);
	if (!local) return;
	const now = new Date().toISOString();
	const cards = await cardTable.where('deckId').equals(local.id).toArray();
	for (const c of cards) {
		if (!c.deletedAt) await cardTable.update(c.id, { deletedAt: now });
	}
	await cardDeckTable.update(local.id, { deletedAt: now });
}

/** Helper: am I already subscribed locally to this slug? */
export async function isSubscribedLocally(slug: string): Promise<boolean> {
	try {
		const row = await cardDeckTable.where('subscribedFromSlug').equals(slug).first();
		return Boolean(row && !row.deletedAt);
	} catch {
		return false;
	}
}

export async function ensureSubscriptionFresh(_deckSlug: string): Promise<void> {
	// Placeholder for Phase δ.3 — when an update is available, fetch
	// the diff and apply it card-by-card without touching FSRS state.
	// Today we just re-pull (existingDeck branch above does that).
}
