<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { authStore } from '$lib/stores/auth.svelte';
	import {
		cardsApi,
		CardsApiError,
		type PublicDeck,
		type PublicDeckVersion,
	} from '$lib/api/cards-api';
	import { isSubscribedLocally, subscribeAndPull, unsubscribe } from '$lib/services/subscribe';
	import { cardDeckTable } from '$lib/data/database';
	import PullRequestsSection from '$lib/components/PullRequestsSection.svelte';
	import DeckCardList from '$lib/components/DeckCardList.svelte';
	import ReportButton from '$lib/components/ReportButton.svelte';

	const slug = $derived(page.params.slug as string);

	let stage = $state<'loading' | 'ok' | 'not-found' | 'error'>('loading');
	let deck = $state<PublicDeck | null>(null);
	let version = $state<PublicDeckVersion | null>(null);
	let starred = $state(false);
	let starBusy = $state(false);
	let subscribed = $state(false);
	let subscribeBusy = $state(false);
	let subscribedDeckId = $state<string | null>(null);
	let hasPurchased = $state<boolean | null>(null);
	let purchaseBusy = $state(false);
	let error = $state<string | null>(null);

	const isPaid = $derived(!!deck && deck.priceCredits > 0);
	const canSubscribeNow = $derived(!isPaid || hasPurchased === true);
	const isOwner = $derived(!!deck && authStore.user?.id === deck.ownerUserId);

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
			hasPurchased = r.hasPurchased;
			subscribed = await isSubscribedLocally(slug);
			if (subscribed) {
				const local = await cardDeckTable
					.where('subscribedFromSlug')
					.equals(slug)
					.first()
					.catch(() => undefined);
				subscribedDeckId = local?.id ?? null;
			}
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
		if (!deck || starBusy) return;
		starBusy = true;
		error = null;
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
			starBusy = false;
		}
	}

	async function buy() {
		if (!deck || purchaseBusy) return;
		if (!confirm(`Deck „${deck.title}" für ${deck.priceCredits} Credits kaufen?`)) return;
		purchaseBusy = true;
		error = null;
		try {
			await cardsApi.purchases.buy(deck.slug);
			hasPurchased = true;
		} catch (e) {
			error = e instanceof CardsApiError ? e.message : (e as Error).message;
		} finally {
			purchaseBusy = false;
		}
	}

	async function toggleSubscribe() {
		if (!deck || subscribeBusy) return;
		subscribeBusy = true;
		error = null;
		try {
			if (subscribed) {
				await unsubscribe(deck.slug);
				subscribed = false;
				subscribedDeckId = null;
			} else {
				const result = await subscribeAndPull(deck.slug);
				subscribed = true;
				subscribedDeckId = result.deckId;
			}
		} catch (e) {
			error = (e as Error).message;
		} finally {
			subscribeBusy = false;
		}
	}
</script>

<svelte:head>
	<title>{deck?.title ?? slug} — Cards</title>
</svelte:head>

<main class="mx-auto max-w-3xl px-6 py-8">
	{#if stage === 'loading'}
		<p class="py-12 text-center text-sm text-neutral-400">Lade Deck…</p>
	{:else if stage === 'not-found'}
		<p
			class="rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center text-sm text-neutral-400"
		>
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
						disabled={starBusy}
					>
						{starred ? '★ Markiert' : '☆ Merken'}
					</button>

					{#if subscribed}
						<button
							class="rounded-lg border border-emerald-500/40 px-4 py-2 text-sm text-emerald-300 hover:bg-emerald-500/10 disabled:opacity-50"
							onclick={toggleSubscribe}
							disabled={subscribeBusy}
							title="Abo entfernen"
						>
							{subscribeBusy ? 'Lädt…' : '✓ Abonniert'}
						</button>
						{#if subscribedDeckId}
							<button
								class="rounded-lg bg-indigo-500 px-4 py-2 text-sm text-white hover:bg-indigo-400"
								onclick={() => goto(`/learn/${subscribedDeckId}`)}
							>
								Lernen
							</button>
						{/if}
					{:else if isPaid && !canSubscribeNow && !isOwner}
						<button
							class="rounded-lg bg-amber-500 px-4 py-2 text-sm font-medium text-amber-950 hover:bg-amber-400 disabled:opacity-50"
							onclick={buy}
							disabled={purchaseBusy || !version}
						>
							{purchaseBusy ? 'Verarbeite…' : `Kaufen für ${deck.priceCredits} 💎`}
						</button>
					{:else}
						<button
							class="rounded-lg bg-indigo-500 px-4 py-2 text-sm text-white hover:bg-indigo-400 disabled:opacity-50"
							onclick={toggleSubscribe}
							disabled={subscribeBusy || !version}
							title={version ? 'In meine Decks ziehen' : 'Deck hat noch keine Version'}
						>
							{subscribeBusy ? 'Abonniere…' : 'Abonnieren'}
						</button>
						{#if isPaid && hasPurchased}
							<span
								class="rounded-full bg-emerald-500/15 px-2 py-1 text-xs text-emerald-300"
								title="Du besitzt dieses Deck"
							>
								✓ Gekauft
							</span>
						{/if}
					{/if}
				{:else}
					<a
						href="/login"
						class="rounded-lg bg-indigo-500 px-4 py-2 text-sm text-white hover:bg-indigo-400"
					>
						Anmelden um zu abonnieren
					</a>
				{/if}
			</div>

			{#if error}
				<p class="mt-3 text-sm text-red-400">{error}</p>
			{/if}

			<div class="mt-10 flex items-center justify-between text-xs text-neutral-500">
				<span>Veröffentlicht: {new Date(deck.createdAt).toLocaleDateString('de-DE')}</span>
				{#if !isOwner}
					<ReportButton deckSlug={deck.slug} />
				{/if}
			</div>

			{#if deck.isTakedown}
				<p class="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-300">
					Dieses Deck wurde von der Moderation entfernt.
				</p>
			{/if}

			{#if version}
				<DeckCardList deckSlug={deck.slug} semver={version.semver} />
			{/if}

			<PullRequestsSection deckSlug={deck.slug} ownerUserId={deck.ownerUserId} onMerged={load} />
		</article>
	{/if}

	<p class="mt-12 text-center text-xs text-neutral-600">
		<a href="/explore" class="hover:text-neutral-300">← Marktplatz</a>
	</p>
</main>
