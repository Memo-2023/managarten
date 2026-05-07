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

import { cardsApi, CardsApiError } from '$lib/api/cards-api';
import type { ServerCard } from '$lib/api/cards-api';
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

export interface UpdatePreview {
	from: string;
	to: string;
	added: number;
	changed: number;
	removed: number;
	unchanged: number;
}

/**
 * Compute what would change if we pulled the latest version. Returns
 * `null` if already on latest. Used by the deck-detail banner so the
 * user sees "X neue, Y geänderte, Z entfernte" before committing.
 */
export async function previewUpdate(deckSlug: string): Promise<UpdatePreview | null> {
	const local = await cardDeckTable
		.where('subscribedFromSlug')
		.equals(deckSlug)
		.first()
		.catch(() => undefined);
	if (!local || local.deletedAt || !local.subscribedAtVersion) return null;
	const diff = await cardsApi.subscriptions.diff(deckSlug, local.subscribedAtVersion);
	if (diff.from === diff.to) return null;
	return {
		from: diff.from,
		to: diff.to,
		added: diff.added.length,
		changed: diff.changed.length,
		removed: diff.removed.length,
		unchanged: diff.unchanged.length,
	};
}

/**
 * Smart-merge the latest server version into the local Dexie copy
 * without losing FSRS state.
 *
 *   - **unchanged**: leave the local card alone — its FSRS reviews
 *     stay attached and the learning schedule continues unbroken.
 *   - **changed**: lookup local card by previous-hash, update fields/
 *     type/order/serverContentHash to the new values. FSRS reviews
 *     stay attached because we don't touch the card id. Re-runs
 *     ensureReviewsForCard so cloze-cluster fan-out matches the new
 *     content.
 *   - **added**: insert a new card with fresh FSRS reviews.
 *   - **removed**: soft-delete by content-hash + cascade reviews.
 *
 * Final step: bump local subscribedAtVersion + re-stamp server-side
 * (POST /subscribe is idempotent and re-anchors the user's row).
 */
export async function applyUpdate(deckSlug: string): Promise<UpdatePreview | null> {
	const local = await cardDeckTable
		.where('subscribedFromSlug')
		.equals(deckSlug)
		.first()
		.catch(() => undefined);
	if (!local || local.deletedAt || !local.subscribedAtVersion) return null;

	const diff = await cardsApi.subscriptions.diff(deckSlug, local.subscribedAtVersion);
	if (diff.from === diff.to) return null;

	const now = new Date().toISOString();

	for (const r of diff.removed) {
		const localCard = await cardTable
			.where('[deckId+serverContentHash]')
			.equals([local.id, r.contentHash])
			.first();
		if (localCard && !localCard.deletedAt) {
			await cardTable.update(localCard.id, { deletedAt: now });
			await reviewStore.softDeleteForCard(localCard.id);
		}
	}

	for (const c of diff.changed) {
		const localCard = await cardTable
			.where('[deckId+serverContentHash]')
			.equals([local.id, c.previous.contentHash])
			.first();
		if (!localCard) {
			// Heuristic mismatch — treat as added.
			await insertSubscribedCard(local.id, c.next, now);
			continue;
		}
		const nextType = asCardType(c.next.type);
		await cardTable.update(localCard.id, {
			type: nextType,
			fields: c.next.fields,
			order: c.next.ord,
			serverContentHash: c.next.contentHash,
			updatedAt: now,
		});
		await reviewStore.ensureReviewsForCard({
			id: localCard.id,
			type: nextType,
			fields: c.next.fields,
		});
	}

	for (const a of diff.added) {
		await insertSubscribedCard(local.id, a, now);
	}

	for (const u of diff.unchanged) {
		const localCard = await cardTable
			.where('[deckId+serverContentHash]')
			.equals([local.id, u.contentHash])
			.first();
		if (localCard && localCard.order !== u.ord) {
			await cardTable.update(localCard.id, { order: u.ord, updatedAt: now });
		}
	}

	const liveCards = await cardTable.where('deckId').equals(local.id).toArray();
	const liveCount = liveCards.filter((c) => !c.deletedAt).length;
	await cardDeckTable.update(local.id, {
		subscribedAtVersion: diff.to,
		cardCount: liveCount,
		updatedAt: now,
	});

	try {
		await cardsApi.subscriptions.subscribe(deckSlug);
	} catch {
		// Idempotent server-side; if this fails the local pointer
		// already advanced and the next sync will reconcile.
	}

	return {
		from: diff.from,
		to: diff.to,
		added: diff.added.length,
		changed: diff.changed.length,
		removed: diff.removed.length,
		unchanged: diff.unchanged.length,
	};
}

async function insertSubscribedCard(deckId: string, sc: ServerCard, now: string): Promise<void> {
	const card: LocalCard = {
		id: crypto.randomUUID(),
		deckId,
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

/**
 * One-shot poll of the user's subscriptions to see which decks have
 * a newer version waiting. Powers the dashboard "Updates"-banner.
 */
export async function listSubscriptionUpdates(): Promise<{ slug: string; title: string }[]> {
	let subs;
	try {
		subs = await cardsApi.subscriptions.list();
	} catch (e) {
		if (e instanceof CardsApiError && e.status === 401) return [];
		throw e;
	}
	return subs
		.filter((s) => s.updateAvailable)
		.map((s) => ({ slug: s.deckSlug, title: s.deckTitle }));
}
