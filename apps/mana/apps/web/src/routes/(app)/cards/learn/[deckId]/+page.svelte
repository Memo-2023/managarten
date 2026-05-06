<script lang="ts">
	/**
	 * Learn session — the Phase-1 core gameloop.
	 *
	 * Shows the next due card from the deck, reveals on Space, takes a
	 * 1-4 grade via key or button, persists FSRS state + a study-block
	 * tick, and moves on. Session ends when the queue empties; the user
	 * can leave any time, the next visit picks up where we left off
	 * (state lives in cardReviews, not the page).
	 */

	import { onMount, onDestroy } from 'svelte';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { useDueReviews, useDeck } from '$lib/modules/cards/queries';
	import { reviewStore } from '$lib/modules/cards/stores/reviews.svelte';
	import { studyBlockStore } from '$lib/modules/cards/stores/study-blocks.svelte';
	import CardFace from '$lib/modules/cards/components/CardFace.svelte';
	import type { Card, CardReview, ReviewGrade } from '$lib/modules/cards/types';

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

	// Snapshot the queue once per visit so the user finishes what's in
	// front of them — otherwise a freshly-graded review getting its new
	// `due` tomorrow would vanish from the list mid-session and break
	// the "X of N" counter.
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
			currentIndex = queue.length; // sentinel — finished
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

<div class="mx-auto max-w-2xl space-y-6 px-4 py-8">
	<header class="flex items-center justify-between">
		<div>
			<button
				class="text-sm text-muted-foreground hover:underline"
				onclick={() => goto(`/cards/decks/${deckId}`)}
			>
				← {deckTitle}
			</button>
			<h1 class="mt-1 text-xl font-semibold">Lernen</h1>
		</div>
		{#if queue.length > 0 && !finished}
			<div class="text-sm text-muted-foreground">
				{Math.min(currentIndex + 1, queue.length)} / {queue.length}
			</div>
		{/if}
	</header>

	{#if empty}
		<div class="rounded-xl border border-border bg-card p-8 text-center">
			<div class="text-2xl">Alles gelernt</div>
			<p class="mt-2 text-sm text-muted-foreground">
				Komm später wieder — fällige Karten erscheinen automatisch.
			</p>
			<button
				class="mt-4 rounded-lg bg-primary px-4 py-2 text-sm text-white"
				onclick={() => goto(`/cards/decks/${deckId}`)}
			>
				Zurück zum Deck
			</button>
		</div>
	{:else if finished}
		<div class="rounded-xl border border-border bg-card p-8 text-center">
			<div class="text-2xl">Session abgeschlossen</div>
			<p class="mt-2 text-sm text-muted-foreground">
				{sessionCount} Karten in {Math.round((Date.now() - sessionStartedAt) / 1000)} s.
			</p>
			<button
				class="mt-4 rounded-lg bg-primary px-4 py-2 text-sm text-white"
				onclick={() => goto(`/cards/decks/${deckId}`)}
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

		{#if !showBack}
			<button class="w-full rounded-lg bg-primary py-3 text-base text-white" onclick={reveal}>
				Aufdecken <span class="ml-2 text-xs opacity-70">(Leertaste)</span>
			</button>
		{:else}
			<div class="grid grid-cols-4 gap-2">
				<button class="rounded-lg bg-red-500 py-3 text-sm text-white" onclick={() => grade(1)}>
					Nochmal
					<div class="text-xs opacity-70">1</div>
				</button>
				<button class="rounded-lg bg-orange-500 py-3 text-sm text-white" onclick={() => grade(2)}>
					Schwer
					<div class="text-xs opacity-70">2</div>
				</button>
				<button class="rounded-lg bg-green-500 py-3 text-sm text-white" onclick={() => grade(3)}>
					Gut
					<div class="text-xs opacity-70">3</div>
				</button>
				<button class="rounded-lg bg-blue-500 py-3 text-sm text-white" onclick={() => grade(4)}>
					Leicht
					<div class="text-xs opacity-70">4</div>
				</button>
			</div>
		{/if}
	{:else}
		<div class="text-center text-sm text-muted-foreground">Lade…</div>
	{/if}
</div>
