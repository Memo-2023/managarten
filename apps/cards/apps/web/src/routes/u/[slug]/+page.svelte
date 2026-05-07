<script lang="ts">
	import { onMount } from 'svelte';
	import { page } from '$app/state';
	import { authStore } from '$lib/stores/auth.svelte';
	import { cardsApi, CardsApiError, type PublicAuthor, type DeckSummary } from '$lib/api/cards-api';
	import DeckGrid from '$lib/components/DeckGrid.svelte';

	const slug = $derived(page.params.slug as string);

	let stage = $state<'loading' | 'ok' | 'not-found' | 'error'>('loading');
	let author = $state<PublicAuthor | null>(null);
	let decks = $state<DeckSummary[]>([]);
	let following = $state(false);
	let error = $state<string | null>(null);
	let busy = $state(false);

	$effect(() => {
		if (!slug) return;
		load();
	});

	async function load() {
		stage = 'loading';
		try {
			const [a, d] = await Promise.all([
				cardsApi.authors.bySlug(slug),
				cardsApi.explore.browse({ author: slug, sort: 'recent', limit: 50 }),
			]);
			author = a;
			decks = d.items;
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

	async function toggleFollow() {
		if (busy) return;
		busy = true;
		try {
			if (following) {
				await cardsApi.follows.unfollow(slug);
				following = false;
			} else {
				await cardsApi.follows.follow(slug);
				following = true;
			}
		} catch (e) {
			error = (e as Error).message;
		} finally {
			busy = false;
		}
	}
</script>

<svelte:head>
	<title>{author?.displayName ?? '@' + slug} — Cards</title>
</svelte:head>

<main class="mx-auto max-w-3xl px-6 py-8">
	{#if stage === 'loading'}
		<p class="py-12 text-center text-sm text-neutral-400">Lade Profil…</p>
	{:else if stage === 'not-found'}
		<p class="rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center text-sm text-neutral-400">
			Profil <code class="rounded bg-neutral-800 px-1">@{slug}</code> existiert nicht.
		</p>
	{:else if stage === 'error'}
		<p class="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
			{error}
		</p>
	{:else if author}
		<header class="mb-6 flex items-start gap-4">
			{#if author.avatarUrl}
				<img
					src={author.avatarUrl}
					alt=""
					class="h-16 w-16 rounded-full border border-neutral-800 object-cover"
				/>
			{:else}
				<div
					class="flex h-16 w-16 items-center justify-center rounded-full border border-neutral-800 bg-neutral-900 text-xl font-semibold text-neutral-400"
				>
					{author.displayName.slice(0, 1).toUpperCase()}
				</div>
			{/if}
			<div class="flex-1">
				<div class="flex flex-wrap items-center gap-2">
					<h1 class="text-2xl font-semibold">{author.displayName}</h1>
					{#if author.verifiedMana}
						<span class="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs text-emerald-300">
							🛡️ Mana
						</span>
					{/if}
					{#if author.verifiedCommunity}
						<span class="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-amber-300">
							⭐ Community
						</span>
					{/if}
				</div>
				<p class="text-xs text-neutral-500">
					@{author.slug} · seit {new Date(author.joinedAt).toLocaleDateString('de-DE', {
						year: 'numeric',
						month: 'short',
					})}
				</p>
				{#if author.bio}
					<p class="mt-2 text-sm text-neutral-300">{author.bio}</p>
				{/if}
			</div>
			{#if authStore.isAuthenticated}
				<button
					class="rounded-lg border border-indigo-500/40 px-3 py-1.5 text-sm text-indigo-300 hover:bg-indigo-500/10 disabled:opacity-50"
					onclick={toggleFollow}
					disabled={busy}
				>
					{following ? 'Entfolgen' : 'Folgen'}
				</button>
			{/if}
		</header>

		<h2 class="mb-3 text-sm font-medium text-neutral-300">
			{decks.length} {decks.length === 1 ? 'Deck' : 'Decks'}
		</h2>
		<DeckGrid {decks} emptyText="Dieser Author hat noch keine Decks veröffentlicht." />
	{/if}

	<p class="mt-12 text-center text-xs text-neutral-600">
		<a href="/explore" class="hover:text-neutral-300">← Marktplatz</a>
	</p>
</main>
