<script lang="ts">
	import { onMount } from 'svelte';
	import { cardsApi, CardsApiError, type ServerCard } from '$lib/api/cards-api';
	import CardDiscussions from './CardDiscussions.svelte';

	interface Props {
		deckSlug: string;
		semver: string;
	}

	let { deckSlug, semver }: Props = $props();

	let cards = $state<ServerCard[]>([]);
	let counts = $state<Record<string, number>>({});
	let loading = $state(true);
	let error = $state<string | null>(null);
	let openHash = $state<string | null>(null);

	onMount(load);

	async function load() {
		loading = true;
		error = null;
		try {
			const [version, c] = await Promise.all([
				cardsApi.subscriptions.version(deckSlug, semver),
				cardsApi.discussions.countsForDeck(deckSlug),
			]);
			cards = version.cards;
			counts = c;
		} catch (e) {
			error = e instanceof CardsApiError ? e.message : (e as Error).message;
		} finally {
			loading = false;
		}
	}

	function preview(card: ServerCard): string {
		// Best-effort one-liner: prefer "front" field, then any first non-empty.
		const front = card.fields.front ?? card.fields.text ?? '';
		if (front) return stripTags(front).slice(0, 140);
		const first = Object.values(card.fields).find((v) => v && v.trim());
		return first ? stripTags(first).slice(0, 140) : `(${card.type})`;
	}

	function stripTags(s: string): string {
		return s
			.replace(/<[^>]+>/g, ' ')
			.replace(/\s+/g, ' ')
			.trim();
	}
</script>

<section class="mt-10">
	<header class="mb-3 flex items-center justify-between">
		<h2 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
			Karten {cards.length > 0 ? `(${cards.length})` : ''}
		</h2>
		{#if loading}
			<span class="text-xs text-muted-foreground/60">Lädt…</span>
		{/if}
	</header>

	{#if error}
		<p class="mb-3 rounded-lg border border-error/30 bg-error/10 p-3 text-sm text-error">
			{error}
		</p>
	{:else if cards.length === 0 && !loading}
		<p class="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground/80">
			Diese Version enthält keine Karten.
		</p>
	{:else}
		<ul class="space-y-2">
			{#each cards as c (c.contentHash)}
				{@const n = counts[c.contentHash] ?? 0}
				{@const isOpen = openHash === c.contentHash}
				<li class="rounded-xl border border-border bg-card p-3">
					<button
						class="flex w-full items-center justify-between gap-3 text-left"
						onclick={() => (openHash = isOpen ? null : c.contentHash)}
					>
						<div class="min-w-0 flex-1">
							<div class="text-xs uppercase tracking-wide text-muted-foreground/80">
								#{c.ord + 1} · {c.type}
							</div>
							<div class="mt-1 truncate text-sm text-foreground/90">{preview(c)}</div>
						</div>
						<div class="shrink-0 text-xs text-muted-foreground/80">
							{#if n > 0}
								💬 {n}
							{:else}
								💬
							{/if}
						</div>
					</button>

					{#if isOpen}
						<CardDiscussions contentHash={c.contentHash} {deckSlug} />
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>
