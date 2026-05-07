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
		<p class="py-12 text-center text-sm text-muted-foreground">Lade Profil…</p>
	{:else if stage === 'not-found'}
		<p
			class="rounded-xl border border-border bg-card p-8 text-center text-sm text-muted-foreground"
		>
			Profil <code class="rounded bg-muted px-1">@{slug}</code> existiert nicht.
		</p>
	{:else if stage === 'error'}
		<p class="rounded-lg border border-error/30 bg-error/10 p-4 text-sm text-error">
			{error}
		</p>
	{:else if author}
		<header class="mb-6 flex items-start gap-4">
			{#if author.avatarUrl}
				<img
					src={author.avatarUrl}
					alt=""
					class="h-16 w-16 rounded-full border border-border object-cover"
				/>
			{:else}
				<div
					class="flex h-16 w-16 items-center justify-center rounded-full border border-border bg-card text-xl font-semibold text-muted-foreground"
				>
					{author.displayName.slice(0, 1).toUpperCase()}
				</div>
			{/if}
			<div class="flex-1">
				<div class="flex flex-wrap items-center gap-2">
					<h1 class="text-2xl font-semibold">{author.displayName}</h1>
					{#if author.verifiedMana}
						<span class="rounded-full bg-success/15 px-2 py-0.5 text-xs text-success">
							🛡️ Mana
						</span>
					{/if}
					{#if author.verifiedCommunity}
						<span class="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-warning">
							⭐ Community
						</span>
					{/if}
				</div>
				<p class="text-xs text-muted-foreground/80">
					@{author.slug} · seit {new Date(author.joinedAt).toLocaleDateString('de-DE', {
						year: 'numeric',
						month: 'short',
					})}
				</p>
				{#if author.bio}
					<p class="mt-2 text-sm text-foreground/80">{author.bio}</p>
				{/if}
			</div>
			{#if authStore.isAuthenticated}
				<button
					class="rounded-lg border border-app-accent/40 px-3 py-1.5 text-sm text-app-accent hover:bg-app-accent/10 disabled:opacity-50"
					onclick={toggleFollow}
					disabled={busy}
				>
					{following ? 'Entfolgen' : 'Folgen'}
				</button>
			{/if}
		</header>

		<h2 class="mb-3 text-sm font-medium text-foreground/80">
			{decks.length}
			{decks.length === 1 ? 'Deck' : 'Decks'}
		</h2>
		<DeckGrid {decks} emptyText="Dieser Author hat noch keine Decks veröffentlicht." />
	{/if}

	<p class="mt-12 text-center text-xs text-muted-foreground/60">
		<a href="/explore" class="hover:text-foreground/80">← Marktplatz</a>
	</p>
</main>
