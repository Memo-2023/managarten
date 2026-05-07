<script lang="ts">
	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { useDueReviews, useDeck } from '$lib/queries';
	import { reviewStore } from '$lib/stores/reviews.svelte';
	import { studyBlockStore } from '$lib/stores/study-blocks.svelte';
	import CardFace from '$lib/components/CardFace.svelte';
	import SuggestEditModal from '$lib/components/SuggestEditModal.svelte';
	import CardDiscussions from '$lib/components/CardDiscussions.svelte';
	import type { Card, CardReview, ReviewGrade } from '@mana/cards-core';

	const deckId = $derived(page.params.deckId as string);
	const dueQuery = $derived(useDueReviews(deckId));
	const deckQuery = $derived(useDeck(deckId));

	let queue = $state<{ review: CardReview; card: Card }[]>([]);
	let currentIndex = $state(0);
	let showBack = $state(false);
	let typedAnswer = $state('');
	let sessionCount = $state(0);
	let sessionStartedAt = $state(Date.now());
	let cardShownAt = $state(Date.now());

	const current = $derived(queue[currentIndex]);
	const deckTitle = $derived($deckQuery?.title ?? 'Deck');
	const subscribedSlug = $derived($deckQuery?.subscribedFromSlug);
	const canSuggest = $derived(!!subscribedSlug && !!current?.card.serverContentHash);
	let suggestOpen = $state(false);
	let discussionsOpen = $state(false);

	$effect(() => {
		// Collapse the discussion panel whenever the card changes so the
		// learner isn't visually overloaded between cards.
		void current?.card.id;
		discussionsOpen = false;
	});

	$effect(() => {
		const snap = $dueQuery;
		if (snap && queue.length === 0 && snap.length > 0) {
			queue = snap;
		}
	});

	function reveal() {
		if (!showBack && current) showBack = true;
	}

	async function grade(g: ReviewGrade) {
		if (!current || !showBack) return;
		const elapsedMs = Date.now() - cardShownAt;
		await reviewStore.grade(current.review.id, g);
		await studyBlockStore.recordReview(elapsedMs);
		sessionCount++;
		nextCard();
	}

	function nextCard() {
		showBack = false;
		typedAnswer = '';
		cardShownAt = Date.now();
		if (currentIndex < queue.length - 1) {
			currentIndex++;
		} else {
			currentIndex = queue.length;
		}
	}

	function handleKey(e: KeyboardEvent) {
		if (e.target && (e.target as HTMLElement).tagName === 'INPUT') return;
		if (e.key === ' ' || e.key === 'Enter') {
			e.preventDefault();
			if (!showBack) reveal();
			return;
		}
		if (showBack && (e.key === '1' || e.key === '2' || e.key === '3' || e.key === '4')) {
			e.preventDefault();
			grade(Number(e.key) as ReviewGrade);
		}
	}

	onMount(() => {
		window.addEventListener('keydown', handleKey);
		sessionStartedAt = Date.now();
		cardShownAt = Date.now();
	});
	onDestroy(() => window.removeEventListener('keydown', handleKey));

	const finished = $derived(queue.length > 0 && currentIndex >= queue.length);
	const empty = $derived(queue.length === 0 && $dueQuery?.length === 0);
</script>

<svelte:head>
	<title>Lernen — {deckTitle} — Cards</title>
</svelte:head>

<div class="mx-auto max-w-2xl px-6 py-10">
	<header class="mb-6 flex items-center justify-between">
		<div>
			<button
				class="text-sm text-neutral-400 hover:text-neutral-100"
				onclick={() => goto(`/decks/${deckId}`)}
			>
				← {deckTitle}
			</button>
			<h1 class="mt-1 text-xl font-semibold">Lernen</h1>
		</div>
		{#if queue.length > 0 && !finished}
			<div class="text-sm text-neutral-400">
				{Math.min(currentIndex + 1, queue.length)} / {queue.length}
			</div>
		{/if}
	</header>

	{#if empty}
		<div class="rounded-xl border border-neutral-800 bg-neutral-900 p-10 text-center">
			<div class="text-2xl">Alles gelernt</div>
			<p class="mt-2 text-sm text-neutral-400">
				Komm später wieder — fällige Karten erscheinen automatisch.
			</p>
			<button
				class="mt-4 rounded-lg bg-indigo-500 px-4 py-2 text-sm text-white hover:bg-indigo-400"
				onclick={() => goto(`/decks/${deckId}`)}
			>
				Zurück zum Deck
			</button>
		</div>
	{:else if finished}
		<div class="rounded-xl border border-neutral-800 bg-neutral-900 p-10 text-center">
			<div class="text-2xl">Session abgeschlossen</div>
			<p class="mt-2 text-sm text-neutral-400">
				{sessionCount} Karten in {Math.round((Date.now() - sessionStartedAt) / 1000)} s.
			</p>
			<button
				class="mt-4 rounded-lg bg-indigo-500 px-4 py-2 text-sm text-white hover:bg-indigo-400"
				onclick={() => goto(`/decks/${deckId}`)}
			>
				Fertig
			</button>
		</div>
	{:else if current}
		<CardFace
			card={current.card}
			subIndex={current.review.subIndex}
			{showBack}
			{typedAnswer}
			onTypedAnswer={(v) => (typedAnswer = v)}
		/>

		{#if canSuggest}
			<div class="mt-3 flex justify-end gap-3">
				<button
					class="text-xs text-neutral-500 hover:text-neutral-200"
					onclick={() => (discussionsOpen = !discussionsOpen)}
					title="Kommentare zur Karte"
				>
					💬 {discussionsOpen ? 'Diskussion ausblenden' : 'Diskussion'}
				</button>
				<button
					class="text-xs text-neutral-500 hover:text-indigo-300"
					onclick={() => (suggestOpen = true)}
					title="Verbesserung dieser Karte vorschlagen"
				>
					✏️ Verbessern
				</button>
			</div>

			{#if discussionsOpen && subscribedSlug && current?.card.serverContentHash}
				<CardDiscussions contentHash={current.card.serverContentHash} deckSlug={subscribedSlug} />
			{/if}
		{/if}

		{#if !showBack}
			<button
				class="mt-6 w-full rounded-lg bg-indigo-500 py-3 text-base text-white hover:bg-indigo-400"
				onclick={reveal}
			>
				Aufdecken <span class="ml-2 text-xs opacity-70">(Leertaste)</span>
			</button>
		{:else}
			<div class="mt-6 grid grid-cols-4 gap-2">
				<button
					class="rounded-lg bg-red-500 py-3 text-sm text-white hover:bg-red-400"
					onclick={() => grade(1)}
				>
					Nochmal
					<div class="text-xs opacity-70">1</div>
				</button>
				<button
					class="rounded-lg bg-orange-500 py-3 text-sm text-white hover:bg-orange-400"
					onclick={() => grade(2)}
				>
					Schwer
					<div class="text-xs opacity-70">2</div>
				</button>
				<button
					class="rounded-lg bg-green-500 py-3 text-sm text-white hover:bg-green-400"
					onclick={() => grade(3)}
				>
					Gut
					<div class="text-xs opacity-70">3</div>
				</button>
				<button
					class="rounded-lg bg-blue-500 py-3 text-sm text-white hover:bg-blue-400"
					onclick={() => grade(4)}
				>
					Leicht
					<div class="text-xs opacity-70">4</div>
				</button>
			</div>
		{/if}
	{:else}
		<div class="text-center text-sm text-neutral-400">Lade…</div>
	{/if}
</div>

{#if subscribedSlug && current}
	<SuggestEditModal
		card={current.card}
		deckSlug={subscribedSlug}
		open={suggestOpen}
		onClose={() => (suggestOpen = false)}
	/>
{/if}
