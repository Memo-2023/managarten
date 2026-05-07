<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { cardsApi, type DeckSummary } from '$lib/api/cards-api';
	import DeckGrid from '$lib/components/DeckGrid.svelte';

	let stage = $state<'loading' | 'landing' | 'search' | 'error'>('loading');
	let featured = $state<DeckSummary[]>([]);
	let trending = $state<DeckSummary[]>([]);
	let searchQuery = $state('');
	let searchResults = $state<DeckSummary[]>([]);
	let searchTotal = $state(0);
	let searchBusy = $state(false);
	let error = $state<string | null>(null);

	onMount(loadLanding);

	async function loadLanding() {
		stage = 'loading';
		try {
			const r = await cardsApi.explore.landing();
			featured = r.featured;
			trending = r.trending;
			stage = 'landing';
		} catch (e) {
			error = (e as Error).message;
			stage = 'error';
		}
	}

	async function runSearch() {
		const q = searchQuery.trim();
		if (!q) {
			loadLanding();
			return;
		}
		searchBusy = true;
		try {
			const r = await cardsApi.explore.browse({ q, sort: 'popular', limit: 30 });
			searchResults = r.items;
			searchTotal = r.total;
			stage = 'search';
		} catch (e) {
			error = (e as Error).message;
			stage = 'error';
		} finally {
			searchBusy = false;
		}
	}
</script>

<svelte:head>
	<title>Entdecken — Cards</title>
</svelte:head>

<main class="mx-auto max-w-3xl px-6 py-8">
	<header class="mb-6">
		<h1 class="text-3xl font-semibold tracking-tight">Entdecken</h1>
		<p class="text-sm text-neutral-400">
			Decks aus dem Cards-Marktplatz — kostenlos lernen oder eigene veröffentlichen.
		</p>
	</header>

	<form
		class="mb-6 flex gap-2"
		onsubmit={(e) => {
			e.preventDefault();
			runSearch();
		}}
	>
		<input
			type="search"
			bind:value={searchQuery}
			placeholder="Suche nach Titel oder Beschreibung…"
			class="flex-1 rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-indigo-400"
		/>
		<button
			type="submit"
			class="rounded-lg bg-indigo-500 px-4 py-2 text-sm text-white hover:bg-indigo-400 disabled:opacity-50"
			disabled={searchBusy}
		>
			{searchBusy ? 'Suche…' : 'Suchen'}
		</button>
	</form>

	{#if stage === 'loading'}
		<p class="py-12 text-center text-sm text-neutral-400">Lade Marktplatz…</p>
	{:else if stage === 'error'}
		<p class="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
			{error}
			<button class="ml-2 underline" onclick={loadLanding}>Erneut versuchen</button>
		</p>
	{:else if stage === 'search'}
		<section>
			<div class="mb-3 flex items-center justify-between">
				<h2 class="text-sm font-medium text-neutral-300">
					{searchTotal} Treffer für „{searchQuery}"
				</h2>
				<button class="text-xs text-neutral-500 hover:text-neutral-200" onclick={loadLanding}>
					Zurück
				</button>
			</div>
			<DeckGrid decks={searchResults} emptyText="Keine Decks gefunden." />
		</section>
	{:else if stage === 'landing'}
		{#if featured.length > 0}
			<section class="mb-8">
				<h2 class="mb-3 text-sm font-medium text-neutral-300">
					🛡️ Featured · vom Mana-Verein empfohlen
				</h2>
				<DeckGrid decks={featured} />
			</section>
		{/if}

		<section>
			<h2 class="mb-3 text-sm font-medium text-neutral-300">📈 Trending · letzte 7 Tage</h2>
			<DeckGrid decks={trending} emptyText="Noch keine Trends — sei der/die Erste mit einem Public-Deck." />
		</section>
	{/if}

	<p class="mt-12 text-center text-xs text-neutral-600">
		<a href="/" class="hover:text-neutral-300">← Eigene Decks</a>
	</p>
</main>
