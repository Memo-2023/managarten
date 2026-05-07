<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { authStore } from '$lib/stores/auth.svelte';
	import {
		cardsApi,
		CardsApiError,
		type PublicAuthor,
		type PublicDeck,
		type PublicDeckVersion,
	} from '$lib/api/cards-api';

	const slug = $derived(page.params.slug as string);

	let stage = $state<'loading' | 'ok' | 'not-found' | 'error'>('loading');
	let deck = $state<PublicDeck | null>(null);
	let version = $state<PublicDeckVersion | null>(null);
	let author = $state<PublicAuthor | null>(null);
	let starred = $state(false);
	let error = $state<string | null>(null);
	let busy = $state(false);

	$effect(() => {
		if (!slug) return;
		load();
	});

	async function load() {
		stage = 'loading';
		try {
			const r = await cardsApi.decks.bySlug(slug);
			deck = r.deck;
			version = r.latestVersion;
			// Author profile is a separate lookup by ownerUserId — we don't
			// have a slug from the deck endpoint yet, but the explore browse
			// gives us the author info inline. For Phase γ.2 we keep this
			// page simple and just show the deck; clicking the deck card on
			// /explore already routed via /u/<slug>.
			stage = 'ok';
		} catch (e) {
			if (e instanceof CardsApiError && e.status === 404) {
				stage = 'not-found';
				return;
			}
			error = (e as Error).message;
			stage = 'error';
		}
	}

	async function toggleStar() {
		if (!deck || busy) return;
		busy = true;
		try {
			if (starred) {
				await cardsApi.decks.unstar(deck.slug);
				starred = false;
			} else {
				await cardsApi.decks.star(deck.slug);
				starred = true;
			}
		} catch (e) {
			error = (e as Error).message;
		} finally {
			busy = false;
		}
	}

	// `author` is a placeholder for Phase γ.3 (full author surface on
	// the deck page). Reading it once silences the unused-state lint
	// without changing reactivity semantics.
	// svelte-ignore state_referenced_locally
	void author;
</script>

<svelte:head>
	<title>{deck?.title ?? slug} — Cards</title>
</svelte:head>

<main class="mx-auto max-w-3xl px-6 py-8">
	{#if stage === 'loading'}
		<p class="py-12 text-center text-sm text-neutral-400">Lade Deck…</p>
	{:else if stage === 'not-found'}
		<p class="rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center text-sm text-neutral-400">
			Deck <code class="rounded bg-neutral-800 px-1">{slug}</code> existiert nicht.
		</p>
	{:else if stage === 'error'}
		<p class="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
			{error}
		</p>
	{:else if deck}
		<article>
			<header class="mb-6">
				<h1 class="text-3xl font-semibold tracking-tight">{deck.title}</h1>
				{#if deck.description}
					<p class="mt-2 text-sm text-neutral-400">{deck.description}</p>
				{/if}
			</header>

			<div class="mb-6 flex flex-wrap items-center gap-3 text-sm">
				{#if version}
					<span class="rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-300">
						v{version.semver}
					</span>
					<span class="text-neutral-400">{version.cardCount} Karten</span>
				{/if}
				<span class="text-neutral-400">{deck.license}</span>
				{#if deck.language}
					<span class="text-neutral-400">{deck.language.toUpperCase()}</span>
				{/if}
				{#if deck.priceCredits > 0}
					<span class="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-300">
						{deck.priceCredits} 💎
					</span>
				{/if}
			</div>

			{#if version?.changelog}
				<section class="mb-6 rounded-xl border border-neutral-800 bg-neutral-900 p-4">
					<h2 class="mb-1 text-xs font-medium uppercase tracking-wide text-neutral-500">
						Changelog v{version.semver}
					</h2>
					<p class="whitespace-pre-line text-sm text-neutral-300">{version.changelog}</p>
				</section>
			{/if}

			<div class="flex flex-wrap items-center gap-2">
				{#if authStore.isAuthenticated}
					<button
						class="rounded-lg border border-indigo-500/40 px-4 py-2 text-sm text-indigo-300 hover:bg-indigo-500/10 disabled:opacity-50"
						onclick={toggleStar}
						disabled={busy}
					>
						{starred ? '★ Markiert' : '☆ Merken'}
					</button>
					<button
						class="rounded-lg bg-indigo-500 px-4 py-2 text-sm text-white hover:bg-indigo-400 disabled:opacity-50"
						disabled
						title="Subscribe + Smart-Merge folgt in Phase δ"
					>
						Abonnieren · Phase δ
					</button>
				{:else}
					<a
						href="/login"
						class="rounded-lg bg-indigo-500 px-4 py-2 text-sm text-white hover:bg-indigo-400"
					>
						Anmelden um zu merken
					</a>
				{/if}
			</div>

			<p class="mt-10 text-xs text-neutral-500">
				Veröffentlicht: {new Date(deck.createdAt).toLocaleDateString('de-DE')}
			</p>
		</article>
	{/if}

	<p class="mt-12 text-center text-xs text-neutral-600">
		<a href="/explore" class="hover:text-neutral-300">← Marktplatz</a>
	</p>
</main>
