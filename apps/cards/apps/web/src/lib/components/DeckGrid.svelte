<script lang="ts">
	import type { DeckSummary } from '$lib/api/cards-api';

	interface Props {
		decks: DeckSummary[];
		emptyText?: string;
	}
	let { decks, emptyText = 'Noch keine Decks.' }: Props = $props();

	function badgeClass(d: DeckSummary): string {
		if (d.owner.verifiedMana) return 'bg-emerald-500/15 text-emerald-300';
		if (d.owner.verifiedCommunity) return 'bg-amber-500/15 text-amber-300';
		return '';
	}

	function badgeText(d: DeckSummary): string {
		if (d.owner.verifiedMana) return '🛡️';
		if (d.owner.verifiedCommunity) return '⭐';
		return '';
	}
</script>

{#if decks.length === 0}
	<p class="rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center text-sm text-neutral-400">
		{emptyText}
	</p>
{:else}
	<ul class="grid gap-3 sm:grid-cols-2">
		{#each decks as deck (deck.slug)}
			<li>
				<a
					href={`/d/${deck.slug}`}
					class="block rounded-xl border border-neutral-800 bg-neutral-900 p-4 transition-colors hover:border-neutral-700 hover:bg-neutral-800"
				>
					<div class="mb-1 flex items-start justify-between gap-3">
						<h3 class="font-semibold leading-tight">{deck.title}</h3>
						{#if deck.priceCredits > 0}
							<span class="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-300">
								{deck.priceCredits} 💎
							</span>
						{/if}
					</div>
					{#if deck.description}
						<p class="mb-2 line-clamp-2 text-xs text-neutral-400">{deck.description}</p>
					{/if}
					<div class="flex flex-wrap items-center gap-2 text-xs text-neutral-500">
						<!-- Author shows as text inside the deck-link; the deck card
						     navigates to the deck page, the author profile is one
						     hop further from there. Keeps HTML valid (no nested <a>). -->
						<span class="text-neutral-300">{deck.owner.displayName}</span>
						{#if badgeText(deck)}
							<span class="rounded-full px-1.5 py-0.5 {badgeClass(deck)}">{badgeText(deck)}</span>
						{/if}
						<span>· {deck.cardCount} Karten</span>
						<span>· ⭐ {deck.starCount}</span>
						{#if deck.language}<span>· {deck.language.toUpperCase()}</span>{/if}
					</div>
				</a>
			</li>
		{/each}
	</ul>
{/if}
