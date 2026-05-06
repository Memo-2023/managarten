<!--
  Cards — Workbench ListView
  Deck list with card counts and due-now indicator.
-->
<script lang="ts">
	import { useLiveQueryWithDefault } from '@mana/local-store/svelte';
	import { db } from '$lib/data/database';
	import { BaseListView } from '@mana/shared-ui';
	import type { LocalDeck, LocalCard, LocalCardReview } from './types';
	import type { ViewProps } from '$lib/app-registry';

	let { navigate }: ViewProps = $props();

	const decksQuery = useLiveQueryWithDefault(async () => {
		const all = await db.table<LocalDeck>('cardDecks').toArray();
		return all.filter((d) => !d.deletedAt);
	}, [] as LocalDeck[]);

	const cardsQuery = useLiveQueryWithDefault(async () => {
		const all = await db.table<LocalCard>('cards').toArray();
		return all.filter((c) => !c.deletedAt);
	}, [] as LocalCard[]);

	const reviewsQuery = useLiveQueryWithDefault(async () => {
		const nowIso = new Date().toISOString();
		const due = await db
			.table<LocalCardReview>('cardReviews')
			.where('due')
			.belowOrEqual(nowIso)
			.toArray();
		return due.filter((r) => !r.deletedAt);
	}, [] as LocalCardReview[]);

	const decks = $derived(decksQuery.value);
	const cards = $derived(cardsQuery.value);
	const dueReviews = $derived(reviewsQuery.value);

	const cardIdToDeckId = $derived(new Map(cards.map((c) => [c.id, c.deckId])));

	const dueByDeck = $derived.by(() => {
		const counts = new Map<string, number>();
		for (const r of dueReviews) {
			const deckId = cardIdToDeckId.get(r.cardId);
			if (!deckId) continue;
			counts.set(deckId, (counts.get(deckId) ?? 0) + 1);
		}
		return counts;
	});

	const totalDue = $derived(dueReviews.length);

	function cardsInDeck(deckId: string): number {
		return cards.filter((c) => c.deckId === deckId).length;
	}
</script>

<BaseListView items={decks} getKey={(d) => d.id} emptyTitle="Keine Decks">
	{#snippet header()}
		<span class="flex-1">{decks.length} Decks</span>
		<span class="text-warning/80">{totalDue} fällig</span>
	{/snippet}

	{#snippet item(deck)}
		{@const due = dueByDeck.get(deck.id) ?? 0}
		<button
			onclick={() =>
				navigate('detail', {
					deckId: deck.id,
					_siblingIds: decks.map((d) => d.id),
					_siblingKey: 'deckId',
				})}
			class="mb-2 w-full rounded-md border border-border px-3 py-2.5 text-left transition-colors hover:bg-muted/50 min-h-[44px]"
		>
			<div class="flex items-center gap-2">
				<div class="h-3 w-3 rounded" style="background: {deck.color}"></div>
				<p class="flex-1 truncate text-sm font-medium text-foreground">{deck.name}</p>
				{#if due > 0}
					<span class="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-600">
						{due} fällig
					</span>
				{/if}
				<span class="text-xs text-muted-foreground">{cardsInDeck(deck.id)}</span>
			</div>
			{#if deck.description}
				<p class="mt-1 truncate text-xs text-muted-foreground">{deck.description}</p>
			{/if}
		</button>
	{/snippet}
</BaseListView>
