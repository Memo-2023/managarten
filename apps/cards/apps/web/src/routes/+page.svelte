<script lang="ts">
	import { goto } from '$app/navigation';
	import { useAllDecks, useDueCountByDeck } from '$lib/queries';
	import { deckStore } from '$lib/stores/decks.svelte';
	import AnkiImport from '$lib/components/AnkiImport.svelte';
	import StudyHeatmap from '$lib/components/StudyHeatmap.svelte';
	import type { Deck } from '@mana/cards-core';

	const decksQuery = $derived(useAllDecks());
	const decks = $derived(($decksQuery as Deck[] | undefined) ?? []);

	const dueByDeckQuery = $derived(useDueCountByDeck());
	const dueByDeck = $derived(($dueByDeckQuery as Map<string, number> | undefined) ?? new Map());
	const totalDue = $derived(
		[...(dueByDeck as Map<string, number>).values()].reduce((a, b) => a + b, 0)
	);

	let showNew = $state(false);
	let newTitle = $state('');
	let newDesc = $state('');
	let creating = $state(false);

	async function handleCreate() {
		if (!newTitle.trim() || creating) return;
		creating = true;
		const deck = await deckStore.createDeck({
			title: newTitle.trim(),
			description: newDesc.trim() || undefined,
		});
		creating = false;
		newTitle = '';
		newDesc = '';
		showNew = false;
		if (deck) goto(`/decks/${deck.id}`);
	}
</script>

<svelte:head>
	<title>Cards</title>
</svelte:head>

<main class="mx-auto max-w-3xl px-6 py-10">
	<header class="mb-8 flex items-center justify-between">
		<div>
			<h1 class="text-3xl font-semibold tracking-tight">Cards</h1>
			<p class="text-sm text-muted-foreground">
				{decks.length}
				{decks.length === 1 ? 'Deck' : 'Decks'}{#if totalDue > 0}
					· <span class="text-warning">{totalDue} fällig</span>
				{/if}
			</p>
		</div>
		<button
			class="rounded-lg bg-app-accent px-4 py-2 text-sm font-medium text-white hover:bg-app-accent/90"
			onclick={() => (showNew = true)}
		>
			Neues Deck
		</button>
	</header>

	{#if showNew}
		<form
			class="mb-6 space-y-3 rounded-xl border border-border bg-card p-4"
			onsubmit={(e) => {
				e.preventDefault();
				handleCreate();
			}}
		>
			<!-- svelte-ignore a11y_autofocus -->
			<input
				type="text"
				bind:value={newTitle}
				placeholder="Titel (z.B. Spanisch Vokabeln)"
				class="w-full rounded-lg border border-border-strong bg-background px-3 py-2 text-sm outline-none focus:border-indigo-400"
				autofocus
				required
			/>
			<textarea
				bind:value={newDesc}
				placeholder="Beschreibung (optional)"
				class="min-h-[60px] w-full rounded-lg border border-border-strong bg-background px-3 py-2 text-sm outline-none focus:border-indigo-400"
			></textarea>
			<div class="flex justify-end gap-2">
				<button
					type="button"
					class="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
					onclick={() => {
						showNew = false;
						newTitle = '';
						newDesc = '';
					}}
				>
					Abbrechen
				</button>
				<button
					type="submit"
					class="rounded-lg bg-app-accent px-4 py-1.5 text-sm text-white hover:bg-app-accent/90 disabled:opacity-50"
					disabled={!newTitle.trim() || creating}
				>
					{creating ? 'Lege an…' : 'Anlegen'}
				</button>
			</div>
		</form>
	{/if}

	{#if decks.length === 0 && !showNew}
		<div class="rounded-xl border border-border bg-card p-10 text-center">
			<div class="mb-3 text-4xl">🃏</div>
			<p class="text-muted-foreground">Noch keine Decks. Leg dein erstes an.</p>
			<button
				class="mt-4 rounded-lg bg-app-accent px-4 py-2 text-sm text-white hover:bg-app-accent/90"
				onclick={() => (showNew = true)}
			>
				Erstes Deck anlegen
			</button>
		</div>
	{:else}
		<ul class="space-y-2">
			{#each decks as deck (deck.id)}
				{@const due = (dueByDeck as Map<string, number>).get(deck.id) ?? 0}
				<li>
					<a
						href={`/decks/${deck.id}`}
						class="flex items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 transition-colors hover:border-border-strong hover:bg-muted"
					>
						<span class="h-3 w-3 shrink-0 rounded-full" style="background: {deck.color}"></span>
						<span class="flex-1 truncate">
							<span class="block font-medium">{deck.title}</span>
							{#if deck.description}
								<span class="block truncate text-xs text-muted-foreground">{deck.description}</span>
							{/if}
						</span>
						{#if due > 0}
							<span class="rounded-full bg-amber-500/15 px-2 py-0.5 text-xs text-warning">
								{due} fällig
							</span>
						{/if}
						<span class="text-xs text-muted-foreground/80">{deck.cardCount}</span>
					</a>
				</li>
			{/each}
		</ul>
	{/if}

	<div class="mt-10">
		<StudyHeatmap />
	</div>

	<div class="mt-6">
		<AnkiImport />
	</div>

	<p class="mt-12 text-center text-xs text-muted-foreground/60">
		Phase 1 · synct mit mana.how/cards
	</p>
</main>
