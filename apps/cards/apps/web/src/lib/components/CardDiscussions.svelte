<script lang="ts">
	import { cardsApi, CardsApiError, type CardDiscussion } from '$lib/api/cards-api';
	import { authStore } from '$lib/stores/auth.svelte';
	import ReportButton from './ReportButton.svelte';

	interface Props {
		contentHash: string;
		deckSlug: string;
	}

	let { contentHash, deckSlug }: Props = $props();

	let comments = $state<CardDiscussion[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let draft = $state('');
	let posting = $state(false);

	$effect(() => {
		// Re-load whenever the card under review changes.
		void contentHash;
		comments = [];
		load();
	});

	async function load() {
		loading = true;
		error = null;
		try {
			comments = await cardsApi.discussions.listForCard(contentHash);
		} catch (e) {
			error = e instanceof CardsApiError ? e.message : (e as Error).message;
		} finally {
			loading = false;
		}
	}

	async function post() {
		const body = draft.trim();
		if (!body) return;
		posting = true;
		error = null;
		try {
			const row = await cardsApi.discussions.post(contentHash, { deckSlug, body });
			comments = [...comments, row];
			draft = '';
		} catch (e) {
			error = e instanceof CardsApiError ? e.message : (e as Error).message;
		} finally {
			posting = false;
		}
	}

	async function hide(c: CardDiscussion) {
		if (!confirm('Kommentar ausblenden?')) return;
		try {
			await cardsApi.discussions.hide(c.id);
			comments = comments.filter((x) => x.id !== c.id);
		} catch (e) {
			error = e instanceof CardsApiError ? e.message : (e as Error).message;
		}
	}
</script>

<aside class="mt-4 rounded-xl border border-border bg-background p-4">
	<header class="mb-2 flex items-center justify-between">
		<h3 class="text-xs font-semibold uppercase tracking-wide text-muted-foreground/80">
			Diskussion {comments.length > 0 ? `(${comments.length})` : ''}
		</h3>
		{#if loading}
			<span class="text-xs text-muted-foreground/60">Lädt…</span>
		{/if}
	</header>

	{#if error}
		<p class="mb-2 text-xs text-error">{error}</p>
	{/if}

	{#if comments.length === 0 && !loading}
		<p class="text-xs text-muted-foreground/60">Noch keine Kommentare zu dieser Karte.</p>
	{:else}
		<ul class="space-y-2">
			{#each comments as c (c.id)}
				<li class="rounded-lg border border-border bg-card p-2 text-sm">
					<div class="flex items-start justify-between gap-2">
						<p class="whitespace-pre-line text-foreground/90">{c.body}</p>
						<div class="flex shrink-0 items-center gap-2">
							{#if authStore.user?.id !== c.authorUserId}
								<ReportButton {deckSlug} cardContentHash={c.cardContentHash} variant="icon" />
							{/if}
							{#if authStore.user?.id === c.authorUserId}
								<button
									class="text-xs text-muted-foreground/60 hover:text-error"
									onclick={() => hide(c)}
									title="Ausblenden"
									aria-label="Ausblenden"
								>
									✕
								</button>
							{/if}
						</div>
					</div>
					<p class="mt-1 text-xs text-muted-foreground/60">
						{new Date(c.createdAt).toLocaleString('de-DE')}
					</p>
				</li>
			{/each}
		</ul>
	{/if}

	{#if authStore.isAuthenticated}
		<form
			class="mt-3 flex gap-2"
			onsubmit={(e) => {
				e.preventDefault();
				post();
			}}
		>
			<input
				class="flex-1 rounded-lg border border-border bg-card px-3 py-1.5 text-sm"
				placeholder="Kommentar zur Karte…"
				bind:value={draft}
				disabled={posting}
			/>
			<button
				class="rounded-lg bg-app-accent px-3 py-1.5 text-xs text-white hover:bg-app-accent/90 disabled:opacity-50"
				type="submit"
				disabled={posting || !draft.trim()}
			>
				{posting ? 'Sende…' : 'Senden'}
			</button>
		</form>
	{/if}
</aside>
