<script lang="ts">
	import { onMount } from 'svelte';
	import {
		cardsApi,
		CardsApiError,
		type DeckReportItem,
		type ResolveAction,
	} from '$lib/api/cards-api';
	import { authStore } from '$lib/stores/auth.svelte';

	let stage = $state<'loading' | 'forbidden' | 'ok' | 'error'>('loading');
	let reports = $state<DeckReportItem[]>([]);
	let error = $state<string | null>(null);
	let busy = $state<string | null>(null);

	const isAdmin = $derived((authStore.user as { role?: string } | undefined)?.role === 'admin');

	onMount(load);

	async function load() {
		stage = 'loading';
		try {
			reports = await cardsApi.admin.listReports();
			stage = 'ok';
		} catch (e) {
			if (e instanceof CardsApiError && e.status === 403) {
				stage = 'forbidden';
				return;
			}
			error = e instanceof CardsApiError ? e.message : (e as Error).message;
			stage = 'error';
		}
	}

	async function resolve(report: DeckReportItem, action: ResolveAction) {
		const messages: Record<ResolveAction, string> = {
			dismiss: 'Diesen Bericht als unbegründet abweisen?',
			takedown: `Deck „${report.deckTitle}" entfernen?`,
			'ban-author': `Author dieses Decks bannen? (Alle ihre Decks werden entfernt.)`,
		};
		if (!confirm(messages[action])) return;

		const notes =
			action === 'dismiss'
				? undefined
				: (prompt('Notiz für interne Doku (optional):') ?? undefined);
		busy = report.id;
		try {
			await cardsApi.admin.resolveReport(report.id, { action, notes });
			reports = reports.filter((r) => r.id !== report.id);
		} catch (e) {
			error = e instanceof CardsApiError ? e.message : (e as Error).message;
		} finally {
			busy = null;
		}
	}

	function badgeClass(c: DeckReportItem['category']) {
		const map: Record<DeckReportItem['category'], string> = {
			spam: 'bg-amber-500/15 text-amber-300',
			copyright: 'bg-blue-500/15 text-blue-300',
			nsfw: 'bg-pink-500/15 text-pink-300',
			misinformation: 'bg-violet-500/15 text-violet-300',
			hate: 'bg-red-500/15 text-red-300',
			other: 'bg-neutral-800 text-neutral-300',
		};
		return map[c];
	}
</script>

<svelte:head>
	<title>Moderation — Cards</title>
</svelte:head>

<main class="mx-auto max-w-3xl px-6 py-8">
	<header class="mb-6 flex items-center justify-between">
		<h1 class="text-2xl font-semibold tracking-tight">Moderation-Inbox</h1>
		{#if stage === 'ok'}
			<button class="text-xs text-neutral-500 hover:text-neutral-200" onclick={load}>
				Aktualisieren
			</button>
		{/if}
	</header>

	{#if stage === 'loading'}
		<p class="py-12 text-center text-sm text-neutral-400">Lädt…</p>
	{:else if stage === 'forbidden' || !isAdmin}
		<p
			class="rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center text-sm text-neutral-400"
		>
			Nur Admins haben Zugang zur Moderation-Inbox.
		</p>
	{:else if stage === 'error'}
		<p class="rounded-lg border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400">
			{error}
		</p>
	{:else if reports.length === 0}
		<p
			class="rounded-xl border border-neutral-800 bg-neutral-900 p-8 text-center text-sm text-neutral-500"
		>
			Keine offenen Reports.
		</p>
	{:else}
		<ul class="space-y-3">
			{#each reports as r (r.id)}
				<li class="rounded-xl border border-neutral-800 bg-neutral-900 p-4">
					<header class="mb-2 flex items-start justify-between gap-2">
						<div class="min-w-0">
							<div class="flex items-center gap-2">
								<span class="rounded-full px-2 py-0.5 text-xs {badgeClass(r.category)}">
									{r.category}
								</span>
								<a
									href="/d/{r.deckSlug}"
									class="truncate text-sm font-medium hover:text-indigo-300"
								>
									{r.deckTitle}
								</a>
								{#if r.cardContentHash}
									<span class="text-xs text-neutral-500"
										>· Karte {r.cardContentHash.slice(0, 8)}…</span
									>
								{/if}
							</div>
							<p class="mt-1 text-xs text-neutral-500">
								{new Date(r.createdAt).toLocaleString('de-DE')}
							</p>
						</div>
					</header>

					{#if r.body}
						<p
							class="mb-3 whitespace-pre-line rounded-lg bg-neutral-950 p-2 text-sm text-neutral-300"
						>
							{r.body}
						</p>
					{/if}

					{#if error}
						<p class="mb-2 text-xs text-red-400">{error}</p>
					{/if}

					<div class="flex flex-wrap gap-2">
						<button
							class="rounded-lg border border-neutral-700 px-3 py-1.5 text-xs hover:bg-neutral-800 disabled:opacity-50"
							onclick={() => resolve(r, 'dismiss')}
							disabled={busy === r.id}
						>
							Abweisen
						</button>
						<button
							class="rounded-lg bg-amber-500 px-3 py-1.5 text-xs text-amber-950 hover:bg-amber-400 disabled:opacity-50"
							onclick={() => resolve(r, 'takedown')}
							disabled={busy === r.id}
						>
							Deck entfernen
						</button>
						<button
							class="rounded-lg bg-red-500 px-3 py-1.5 text-xs text-white hover:bg-red-400 disabled:opacity-50"
							onclick={() => resolve(r, 'ban-author')}
							disabled={busy === r.id}
						>
							Author bannen
						</button>
					</div>
				</li>
			{/each}
		</ul>
	{/if}
</main>
