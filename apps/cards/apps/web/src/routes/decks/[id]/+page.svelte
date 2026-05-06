<script lang="ts">
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { useDeck, useCardsByDeck, useDueReviews } from '$lib/queries';
	import { deckStore } from '$lib/stores/decks.svelte';
	import { cardStore } from '$lib/stores/cards.svelte';
	import { renderMarkdown, type Card, type CardType, type Deck } from '@mana/cards-core';

	const deckId = $derived(page.params.id as string);

	const deckQuery = $derived(useDeck(deckId));
	const cardsQuery = $derived(useCardsByDeck(deckId));
	const dueQuery = $derived(useDueReviews(deckId));

	const deck = $derived(($deckQuery as Deck | null | undefined) ?? null);
	const cards = $derived(($cardsQuery as Card[] | undefined) ?? []);
	const dueCount = $derived(($dueQuery as { card: Card }[] | undefined)?.length ?? 0);

	let showNew = $state(false);
	let newType = $state<CardType>('basic');
	let newFront = $state('');
	let newBack = $state('');
	let newCloze = $state('');
	let confirmDelete = $state(false);

	const cardTypeOptions: { value: CardType; label: string; hint: string }[] = [
		{ value: 'basic', label: 'Standard', hint: 'Vorderseite → Rückseite' },
		{ value: 'basic-reverse', label: 'Beidseitig', hint: 'Lernt in beide Richtungen' },
		{ value: 'cloze', label: 'Lückentext', hint: 'Markiere mit {{c1::Wort}}' },
		{ value: 'type-in', label: 'Eintippen', hint: 'Antwort wird verglichen' },
	];

	function canSubmit(): boolean {
		if (newType === 'cloze') return newCloze.trim().length > 0;
		return newFront.trim().length > 0 && newBack.trim().length > 0;
	}

	async function handleCreateCard() {
		if (!canSubmit()) return;
		if (newType === 'cloze') {
			await cardStore.createCard(
				{ deckId, type: 'cloze', fields: { text: newCloze.trim() } },
				cards.length
			);
		} else {
			await cardStore.createCard(
				{ deckId, type: newType, front: newFront.trim(), back: newBack.trim() },
				cards.length
			);
		}
		newFront = '';
		newBack = '';
		newCloze = '';
		showNew = false;
	}

	async function handleDeleteCard(cardId: string) {
		if (!confirm('Karte wirklich löschen?')) return;
		await cardStore.deleteCard(cardId, deckId);
	}

	async function handleDeleteDeck() {
		await deckStore.deleteDeck(deckId);
		goto('/');
	}

	function typeBadge(type: CardType): string {
		switch (type) {
			case 'basic':
				return 'Standard';
			case 'basic-reverse':
				return 'Beidseitig';
			case 'cloze':
				return 'Lückentext';
			case 'type-in':
				return 'Eintippen';
			default:
				return type;
		}
	}

	function preview(card: Card): { primary: string; secondary: string } {
		if (card.type === 'cloze') {
			return { primary: (card.fields.text ?? '').slice(0, 140), secondary: '' };
		}
		return {
			primary: card.fields.front ?? card.front ?? '',
			secondary: card.fields.back ?? card.back ?? '',
		};
	}
</script>

<svelte:head>
	<title>{deck?.title ?? 'Deck'} — Cards</title>
</svelte:head>

<main class="mx-auto max-w-3xl px-6 py-10">
	<a href="/" class="mb-6 inline-block text-sm text-neutral-400 hover:text-neutral-100">← Decks</a>

	{#if deck}
		<header class="mb-6 flex items-start justify-between gap-4">
			<div class="flex-1">
				<div class="mb-2 flex items-center gap-3">
					<span class="h-3 w-3 rounded-full" style="background: {deck.color}"></span>
					<h1 class="text-2xl font-semibold">{deck.title}</h1>
				</div>
				{#if deck.description}
					<p class="text-sm text-neutral-400">{deck.description}</p>
				{/if}
			</div>
			<button
				class="rounded-lg border border-red-500/30 px-3 py-1.5 text-sm text-red-400 hover:bg-red-500/10"
				onclick={() => (confirmDelete = true)}
			>
				Löschen
			</button>
		</header>

		<div class="mb-6 flex flex-wrap items-center gap-3">
			<button
				class="rounded-lg bg-indigo-500 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-400 disabled:opacity-50"
				onclick={() => goto(`/learn/${deckId}`)}
				disabled={dueCount === 0}
			>
				Lernen
				{#if dueCount > 0}
					<span class="ml-2 rounded-full bg-white/20 px-2 py-0.5 text-xs">{dueCount} fällig</span>
				{/if}
			</button>
			{#if dueCount === 0 && cards.length > 0}
				<span class="text-sm text-neutral-400">Heute alles gelernt — schau später wieder rein.</span
				>
			{/if}
		</div>

		<div class="mb-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
			<div class="rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-center">
				<div class="text-2xl font-semibold">{cards.length}</div>
				<div class="text-xs text-neutral-400">Karten</div>
			</div>
			<div class="rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-center">
				<div class="text-2xl font-semibold text-amber-400">{dueCount}</div>
				<div class="text-xs text-neutral-400">Fällig</div>
			</div>
		</div>

		<div class="mb-6">
			<button
				class="rounded-lg bg-indigo-500 px-4 py-2 text-sm text-white hover:bg-indigo-400"
				onclick={() => (showNew = true)}
			>
				Neue Karte
			</button>
		</div>

		{#if showNew}
			<div class="mb-6 rounded-xl border border-indigo-500/30 bg-neutral-900 p-4">
				<h3 class="mb-3 font-medium">Neue Karte</h3>

				<div class="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
					{#each cardTypeOptions as opt (opt.value)}
						<button
							type="button"
							onclick={() => (newType = opt.value)}
							class="rounded-lg border p-2 text-left text-sm transition-colors {newType ===
							opt.value
								? 'border-indigo-400 bg-indigo-500/10 text-indigo-300'
								: 'border-neutral-700 hover:bg-neutral-800'}"
						>
							<div class="font-medium">{opt.label}</div>
							<div class="text-xs text-neutral-400">{opt.hint}</div>
						</button>
					{/each}
				</div>

				<div class="space-y-3">
					{#if newType === 'cloze'}
						<div>
							<label for="card-cloze" class="mb-1 block text-sm text-neutral-400">
								Text mit Lücken
							</label>
							<!-- svelte-ignore a11y_autofocus -->
							<textarea
								id="card-cloze"
								bind:value={newCloze}
								placeholder="Berlin ist die Hauptstadt von &#123;&#123;c1::Deutschland&#125;&#125;."
								class="min-h-[100px] w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-indigo-400"
								autofocus
							></textarea>
							<p class="mt-1 text-xs text-neutral-500">
								Markiere mit
								<code class="rounded bg-neutral-800 px-1">&#123;&#123;c1::Wort&#125;&#125;</code>
								— optional Hinweis: <code class="rounded bg-neutral-800 px-1">::Hinweis</code>.
							</p>
						</div>
					{:else}
						<div>
							<label for="card-front" class="mb-1 block text-sm text-neutral-400">Vorderseite</label
							>
							<!-- svelte-ignore a11y_autofocus -->
							<input
								id="card-front"
								type="text"
								bind:value={newFront}
								placeholder="Frage oder Begriff…"
								class="w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-indigo-400"
								autofocus
							/>
						</div>
						<div>
							<label for="card-back" class="mb-1 block text-sm text-neutral-400">Rückseite</label>
							<textarea
								id="card-back"
								bind:value={newBack}
								placeholder="Antwort oder Erklärung…"
								class="min-h-[80px] w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-indigo-400"
							></textarea>
						</div>
					{/if}
					<div class="flex justify-end gap-2">
						<button
							class="rounded-lg px-3 py-1.5 text-sm text-neutral-400 hover:text-neutral-100"
							onclick={() => {
								showNew = false;
								newFront = '';
								newBack = '';
								newCloze = '';
							}}
						>
							Abbrechen
						</button>
						<button
							class="rounded-lg bg-indigo-500 px-4 py-1.5 text-sm text-white hover:bg-indigo-400 disabled:opacity-50"
							onclick={handleCreateCard}
							disabled={!canSubmit()}
						>
							Karte erstellen
						</button>
					</div>
				</div>
			</div>
		{/if}

		<div class="rounded-xl border border-neutral-800 bg-neutral-900">
			<h2 class="border-b border-neutral-800 p-4 text-lg font-semibold">
				Karten ({cards.length})
			</h2>
			{#if cards.length === 0}
				<div class="p-10 text-center text-neutral-400">
					Noch keine Karten. Erstelle deine erste!
				</div>
			{:else}
				<ul class="divide-y divide-neutral-800">
					{#each cards as card, i (card.id)}
						{@const p = preview(card)}
						<li class="flex items-start gap-4 p-4">
							<span class="mt-1 text-xs text-neutral-500">{i + 1}.</span>
							<div class="min-w-0 flex-1 space-y-1">
								<div class="card-content">
									{@html renderMarkdown(p.primary)}
								</div>
								{#if p.secondary}
									<div class="card-content text-sm text-neutral-400">
										{@html renderMarkdown(p.secondary)}
									</div>
								{/if}
							</div>
							<div class="flex items-center gap-2">
								<span class="rounded-full bg-neutral-800 px-2 py-0.5 text-xs text-neutral-400">
									{typeBadge(card.type)}
								</span>
								<button
									class="rounded p-1 text-neutral-500 hover:text-red-400"
									onclick={() => handleDeleteCard(card.id)}
									aria-label="Karte löschen"
								>
									✕
								</button>
							</div>
						</li>
					{/each}
				</ul>
			{/if}
		</div>

		{#if confirmDelete}
			<div
				class="fixed inset-0 z-50 flex items-center justify-center bg-black/70"
				onclick={() => (confirmDelete = false)}
				onkeydown={(e) => e.key === 'Escape' && (confirmDelete = false)}
				role="presentation"
			>
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<div
					class="mx-4 w-full max-w-md rounded-xl border border-neutral-800 bg-neutral-900 p-6"
					onclick={(e) => e.stopPropagation()}
				>
					<h3 class="mb-2 text-xl font-semibold">Deck löschen?</h3>
					<p class="mb-6 text-neutral-400">
						"{deck.title}" wird mit allen Karten gelöscht.
					</p>
					<div class="flex justify-end gap-3">
						<button
							class="rounded-lg px-4 py-2 text-sm text-neutral-400 hover:text-neutral-100"
							onclick={() => (confirmDelete = false)}
						>
							Abbrechen
						</button>
						<button
							class="rounded-lg bg-red-500 px-4 py-2 text-sm text-white hover:bg-red-400"
							onclick={handleDeleteDeck}
						>
							Löschen
						</button>
					</div>
				</div>
			</div>
		{/if}
	{:else}
		<div class="py-16 text-center text-neutral-400">
			Deck nicht gefunden.
			<a href="/" class="ml-2 text-indigo-400 hover:underline">zurück</a>
		</div>
	{/if}
</main>
