<script lang="ts">
	import { page } from '$app/stores';
	import { goto } from '$app/navigation';
	import { deckStore } from '$lib/modules/cards/stores/decks.svelte';
	import { cardStore } from '$lib/modules/cards/stores/cards.svelte';
	import { useDeck, useCardsByDeck, useDueReviews } from '$lib/modules/cards/queries';
	import type { Deck, Card, CardType } from '$lib/modules/cards/types';
	import { renderMarkdown } from '$lib/modules/cards/render';
	import { ArrowLeft, Trash, Plus, ShareNetwork } from '@mana/shared-icons';
	import { ShareModal } from '@mana/shared-uload';
	import { RoutePage } from '$lib/components/shell';

	let deckId = $derived($page.params.id ?? '');
	let showDeleteConfirm = $state(false);
	let deleting = $state(false);
	let showShare = $state(false);
	let shareUrl = $derived(
		`${typeof window !== 'undefined' ? window.location.origin : ''}/cards/decks/${deckId}`
	);

	// New card form
	let showNewCardForm = $state(false);
	let newCardType = $state<CardType>('basic');
	let newCardFront = $state('');
	let newCardBack = $state('');
	let newCardCloze = $state('');

	// svelte-ignore state_referenced_locally
	const currentDeck = useDeck(deckId);
	// svelte-ignore state_referenced_locally
	const deckCards = useCardsByDeck(deckId);
	// svelte-ignore state_referenced_locally
	const dueReviews = useDueReviews(deckId);

	let deck = $derived(($currentDeck as Deck | null | undefined) ?? null);
	let cards = $derived(($deckCards as Card[] | undefined) ?? []);
	let dueCount = $derived(
		($dueReviews as { review: unknown; card: unknown }[] | undefined)?.length ?? 0
	);

	const cardTypeOptions: { value: CardType; label: string; hint: string }[] = [
		{ value: 'basic', label: 'Standard', hint: 'Vorderseite → Rückseite' },
		{ value: 'basic-reverse', label: 'Beidseitig', hint: 'Lernt in beide Richtungen' },
		{ value: 'cloze', label: 'Lückentext', hint: 'Markiere mit {{c1::Wort}}' },
		{ value: 'type-in', label: 'Eintippen', hint: 'Antwort wird verglichen' },
	];

	function canSubmit(): boolean {
		if (newCardType === 'cloze') return newCardCloze.trim().length > 0;
		return newCardFront.trim().length > 0 && newCardBack.trim().length > 0;
	}

	async function handleDelete() {
		if (!deckId) return;
		deleting = true;
		await deckStore.deleteDeck(deckId);
		deleting = false;
		goto('/cards/decks');
	}

	async function handleCreateCard() {
		if (!canSubmit()) return;
		if (newCardType === 'cloze') {
			await cardStore.createCard(
				{ deckId, type: 'cloze', fields: { text: newCardCloze.trim() } },
				cards.length
			);
		} else {
			await cardStore.createCard(
				{
					deckId,
					type: newCardType,
					front: newCardFront.trim(),
					back: newCardBack.trim(),
				},
				cards.length
			);
		}
		newCardFront = '';
		newCardBack = '';
		newCardCloze = '';
		showNewCardForm = false;
	}

	async function handleDeleteCard(cardId: string) {
		if (!confirm('Karte wirklich löschen?')) return;
		await cardStore.deleteCard(cardId, deckId);
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

	function previewSummary(card: Card): { primary: string; secondary: string } {
		if (card.type === 'cloze') {
			const text = card.fields.text ?? '';
			return { primary: text.slice(0, 140), secondary: '' };
		}
		return {
			primary: card.fields.front ?? card.front ?? '',
			secondary: card.fields.back ?? card.back ?? '',
		};
	}
</script>

<svelte:head>
	<title>{deck?.title || 'Deck'} — Cards — Mana</title>
</svelte:head>

<RoutePage appId="cards" backHref="/cards/decks" title="Deck">
	{#if deck}
		<div class="mx-auto max-w-5xl space-y-6">
			<button
				onclick={() => goto('/cards/decks')}
				class="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground"
			>
				<ArrowLeft size={16} />
				Zurück zu Decks
			</button>

			<!-- Deck Header -->
			<div class="flex items-start justify-between">
				<div class="flex-1">
					<div class="mb-2 flex items-center gap-3">
						<div class="h-3 w-3 rounded-full" style="background: {deck.color}"></div>
						<h1 class="text-2xl font-bold text-foreground">{deck.title}</h1>
					</div>
					{#if deck.description}
						<p class="text-muted-foreground">{deck.description}</p>
					{/if}
				</div>

				<div class="flex items-center gap-2">
					{#if deck.visibility === 'public'}
						<span class="rounded-full bg-primary/10 px-3 py-1 text-xs text-primary">Öffentlich</span
						>
					{/if}
					<button
						onclick={() => (showShare = true)}
						class="rounded-lg border border-border p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
						title="Kurzlink teilen"
					>
						<ShareNetwork size={16} />
					</button>
					<button
						class="rounded-lg border border-destructive/30 p-2 text-destructive transition-colors hover:bg-destructive/10"
						onclick={() => (showDeleteConfirm = true)}
						aria-label="Deck löschen"
					>
						<Trash size={16} />
					</button>
				</div>
			</div>

			<!-- Action row: Lernen + Stats -->
			<div class="flex flex-wrap items-center gap-3">
				<button
					class="flex items-center gap-2 rounded-lg bg-primary px-5 py-2.5 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
					onclick={() => goto(`/cards/learn/${deckId}`)}
					disabled={dueCount === 0}
				>
					Lernen
					{#if dueCount > 0}
						<span class="rounded-full bg-background/20 px-2 py-0.5 text-xs">{dueCount} fällig</span>
					{/if}
				</button>
				{#if dueCount === 0 && cards.length > 0}
					<span class="text-sm text-muted-foreground">
						Heute alles gelernt — schau später wieder rein.
					</span>
				{/if}
			</div>

			<!-- Stats -->
			<div class="grid grid-cols-2 gap-4 md:grid-cols-3">
				<div class="rounded-xl border border-border bg-card p-4 text-center">
					<div class="text-3xl font-bold text-foreground">{cards.length}</div>
					<div class="text-sm text-muted-foreground">Karten gesamt</div>
				</div>
				<div class="rounded-xl border border-border bg-card p-4 text-center">
					<div class="text-3xl font-bold text-amber-500">{dueCount}</div>
					<div class="text-sm text-muted-foreground">Fällig</div>
				</div>
			</div>

			<!-- Add Card Button -->
			<div class="flex items-center gap-3">
				<button
					class="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm text-white"
					onclick={() => (showNewCardForm = true)}
				>
					<Plus size={16} />
					Neue Karte
				</button>
			</div>

			<!-- New Card Form -->
			{#if showNewCardForm}
				<div class="rounded-xl border border-primary bg-card p-4">
					<h3 class="mb-3 font-medium text-foreground">Neue Karte</h3>

					<!-- Type picker -->
					<div class="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
						{#each cardTypeOptions as opt}
							<button
								type="button"
								onclick={() => (newCardType = opt.value)}
								class="rounded-lg border p-2 text-left text-sm transition-colors {newCardType ===
								opt.value
									? 'border-primary bg-primary/10 text-primary'
									: 'border-border hover:bg-muted/50'}"
							>
								<div class="font-medium">{opt.label}</div>
								<div class="text-xs text-muted-foreground">{opt.hint}</div>
							</button>
						{/each}
					</div>

					<div class="space-y-3">
						{#if newCardType === 'cloze'}
							<div>
								<label for="card-cloze" class="mb-1 block text-sm text-muted-foreground">
									Text mit Lücken
								</label>
								<!-- svelte-ignore a11y_autofocus -->
								<textarea
									id="card-cloze"
									bind:value={newCardCloze}
									placeholder="Berlin ist die Hauptstadt von &#123;&#123;c1::Deutschland&#125;&#125;."
									class="min-h-[100px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
									autofocus
								></textarea>
								<p class="mt-1 text-xs text-muted-foreground">
									Markiere mit
									<code class="rounded bg-muted px-1">&#123;&#123;c1::Wort&#125;&#125;</code>
									— optional Hinweis: <code class="rounded bg-muted px-1">::Hinweis</code>.
								</p>
							</div>
						{:else}
							<div>
								<label for="card-front" class="mb-1 block text-sm text-muted-foreground">
									Vorderseite
								</label>
								<!-- svelte-ignore a11y_autofocus -->
								<input
									id="card-front"
									type="text"
									bind:value={newCardFront}
									placeholder="Frage oder Begriff…"
									class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
									autofocus
								/>
							</div>
							<div>
								<label for="card-back" class="mb-1 block text-sm text-muted-foreground">
									Rückseite
								</label>
								<textarea
									id="card-back"
									bind:value={newCardBack}
									placeholder="Antwort oder Erklärung…"
									class="min-h-[80px] w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none focus:border-primary"
								></textarea>
							</div>
						{/if}
						<div class="flex justify-end gap-2">
							<button
								class="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
								onclick={() => {
									showNewCardForm = false;
									newCardFront = '';
									newCardBack = '';
									newCardCloze = '';
								}}
							>
								Abbrechen
							</button>
							<button
								class="rounded-lg bg-primary px-4 py-1.5 text-sm text-white disabled:opacity-50"
								onclick={handleCreateCard}
								disabled={!canSubmit()}
							>
								Karte erstellen
							</button>
						</div>
					</div>
				</div>
			{/if}

			<!-- Cards List -->
			<div class="rounded-xl border border-border bg-card">
				<h2 class="border-b border-border p-4 text-lg font-semibold text-foreground">
					Karten ({cards.length})
				</h2>
				{#if cards.length === 0}
					<div class="py-12 text-center">
						<div class="mb-4 text-4xl">📝</div>
						<p class="text-muted-foreground">Noch keine Karten. Erstelle deine erste Karte!</p>
						<button
							class="mt-4 rounded-lg bg-primary px-4 py-2 text-sm text-white"
							onclick={() => (showNewCardForm = true)}
						>
							Karte hinzufügen
						</button>
					</div>
				{:else}
					<div class="divide-y divide-border">
						{#each cards as card, i (card.id)}
							{@const preview = previewSummary(card)}
							<div class="flex items-start gap-4 p-4">
								<span class="mt-1 text-xs text-muted-foreground">{i + 1}.</span>
								<div class="min-w-0 flex-1 space-y-1">
									<div class="prose prose-sm max-w-none text-foreground dark:prose-invert">
										{@html renderMarkdown(preview.primary)}
									</div>
									{#if preview.secondary}
										<div class="prose prose-sm max-w-none text-muted-foreground dark:prose-invert">
											{@html renderMarkdown(preview.secondary)}
										</div>
									{/if}
								</div>
								<div class="flex items-center gap-2">
									<span class="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
										{typeBadge(card.type)}
									</span>
									<button
										class="rounded p-1 text-muted-foreground hover:text-destructive"
										onclick={() => handleDeleteCard(card.id)}
										aria-label="Karte löschen"
									>
										<Trash size={14} />
									</button>
								</div>
							</div>
						{/each}
					</div>
				{/if}
			</div>

			<!-- Delete Confirmation Modal -->
			{#if showDeleteConfirm}
				<div
					class="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
					onclick={() => (showDeleteConfirm = false)}
					onkeydown={(e) => e.key === 'Escape' && (showDeleteConfirm = false)}
					tabindex="-1"
					role="presentation"
				>
					<!-- svelte-ignore a11y_no_static_element_interactions -->
					<!-- svelte-ignore a11y_click_events_have_key_events -->
					<div
						class="mx-4 w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-xl"
						onclick={(e) => e.stopPropagation()}
					>
						<h3 class="mb-2 text-xl font-semibold text-foreground">Deck löschen?</h3>
						<p class="mb-6 text-muted-foreground">
							Möchtest du "{deck.title}" wirklich löschen? Diese Aktion kann nicht rückgängig
							gemacht werden und löscht auch alle Karten in diesem Deck.
						</p>
						<div class="flex justify-end gap-3">
							<button
								class="rounded-lg px-4 py-2 text-sm text-muted-foreground hover:text-foreground"
								onclick={() => (showDeleteConfirm = false)}
							>
								Abbrechen
							</button>
							<button
								class="rounded-lg bg-destructive px-4 py-2 text-sm text-white disabled:opacity-50"
								disabled={deleting}
								onclick={handleDelete}
							>
								{deleting ? 'Lösche…' : 'Deck löschen'}
							</button>
						</div>
					</div>
				</div>
			{/if}
		</div>
	{:else}
		<div class="py-16 text-center">
			<p class="text-muted-foreground">Deck nicht gefunden</p>
			<button
				class="mt-4 rounded-lg bg-primary px-4 py-2 text-sm text-white"
				onclick={() => goto('/cards/decks')}
			>
				Zurück zu Decks
			</button>
		</div>
	{/if}

	<ShareModal
		visible={showShare}
		onClose={() => (showShare = false)}
		url={shareUrl}
		title={deck?.title ?? ''}
		source="cards"
		description={deck?.description ?? ''}
	/>
</RoutePage>
