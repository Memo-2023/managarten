<script lang="ts">
	/**
	 * Publish-flow modal — three-stage:
	 *
	 *   1. become-author   — only if the user has no author row yet.
	 *                        Asks for slug + displayName + pseudonym.
	 *   2. deck-meta       — title (prefilled), description, language,
	 *                        license, optional price.
	 *   3. publishing      — posts to cards-api, shows result + link.
	 *
	 * Bestehende Karten aus der lokalen Dexie werden direkt gelesen —
	 * der Server bekommt eine flache Karte-Liste mit type + fields.
	 */

	import type { Card, Deck } from '@mana/cards-core';
	import { authorStore } from '$lib/stores/author.svelte';
	import { CardsApiError, type PublishResult } from '$lib/api/cards-api';
	import { cardsApi } from '$lib/api/cards-api';
	import { slugify } from '$lib/util/slug';

	interface Props {
		deck: Deck;
		cards: Card[];
		onClose: () => void;
		onPublished?: (result: PublishResult) => void;
	}
	let { deck, cards, onClose, onPublished }: Props = $props();

	let stage = $state<'loading' | 'become-author' | 'meta' | 'publishing' | 'done' | 'error'>(
		'loading'
	);
	let error = $state<string | null>(null);
	let result = $state<PublishResult | null>(null);

	// Author form
	let authorSlug = $state('');
	let authorName = $state('');
	let authorPseudonym = $state(false);

	// Deck meta form — initial values come from the deck prop. Wrapped
	// in a $derived initializer so svelte-check stops complaining
	// about state-from-props initialisation; user edits then live in
	// the locally-bound $state.
	// svelte-ignore state_referenced_locally
	let deckSlug = $state(slugify(deck.title));
	// svelte-ignore state_referenced_locally
	let deckTitle = $state(deck.title);
	// svelte-ignore state_referenced_locally
	let deckDescription = $state(deck.description ?? '');
	let deckLanguage = $state('de');
	let deckLicense = $state<'CC0-1.0' | 'CC-BY-4.0' | 'CC-BY-SA-4.0' | 'Cardecky-Personal-Use-1.0'>(
		'CC-BY-4.0'
	);
	let deckSemver = $state('1.0.0');
	let deckChangelog = $state('');

	$effect(() => {
		if (stage !== 'loading') return;
		(async () => {
			await authorStore.load();
			if (authorStore.isAuthor) {
				stage = 'meta';
			} else {
				stage = 'become-author';
				authorName = ''; // user fills in
			}
		})();
	});

	async function submitAuthor() {
		if (!authorSlug.trim() || !authorName.trim()) return;
		const created = await authorStore.upsert({
			slug: authorSlug.trim(),
			displayName: authorName.trim(),
			pseudonym: authorPseudonym,
		});
		if (created) stage = 'meta';
		else error = authorStore.error;
	}

	function buildPublishCards() {
		// Map our local CardType + fields straight to the server shape.
		// Cloze fields ship as { text, extra? }; basic + basic-reverse +
		// type-in ship as { front, back }.
		return cards
			.filter((c) => Object.keys(c.fields ?? {}).length > 0)
			.map((c) => ({ type: c.type, fields: c.fields }));
	}

	async function submitPublish() {
		if (!deckSlug.trim() || !deckTitle.trim()) return;
		stage = 'publishing';
		error = null;
		try {
			// 1. Init the deck (idempotent on slug — re-init throws 409,
			//    in which case we just continue to publish).
			try {
				await cardsApi.decks.init({
					slug: deckSlug.trim(),
					title: deckTitle.trim(),
					description: deckDescription.trim() || undefined,
					language: deckLanguage,
					license: deckLicense,
					priceCredits: 0,
				});
			} catch (e) {
				if (!(e instanceof CardsApiError && e.status === 409)) throw e;
			}

			// 2. Publish a version with the local cards.
			const publishCards = buildPublishCards();
			if (publishCards.length === 0) {
				throw new Error('Das Deck enthält keine Karten zum Veröffentlichen.');
			}
			result = await cardsApi.decks.publish(deckSlug.trim(), {
				semver: deckSemver.trim(),
				changelog: deckChangelog.trim() || undefined,
				cards: publishCards,
			});
			stage = 'done';
			onPublished?.(result);
		} catch (e) {
			error = e instanceof Error ? e.message : 'Veröffentlichung fehlgeschlagen';
			stage = 'error';
		}
	}
</script>

<div
	class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
	onclick={onClose}
	onkeydown={(e) => e.key === 'Escape' && onClose()}
	role="presentation"
>
	<!-- svelte-ignore a11y_no_static_element_interactions -->
	<!-- svelte-ignore a11y_click_events_have_key_events -->
	<div
		class="w-full max-w-lg rounded-xl border border-border bg-card p-6"
		onclick={(e) => e.stopPropagation()}
	>
		<div class="mb-4 flex items-start justify-between">
			<h2 class="text-xl font-semibold">Deck veröffentlichen</h2>
			<button
				onclick={onClose}
				class="text-muted-foreground/80 hover:text-foreground/90"
				aria-label="Schließen">✕</button
			>
		</div>

		{#if stage === 'loading'}
			<div class="py-8 text-center text-sm text-muted-foreground">Lade Author-Profil…</div>
		{:else if stage === 'become-author'}
			<div class="space-y-4 text-sm">
				<p class="text-foreground/80">
					Erstelle ein Author-Profil — andere User finden deine Decks unter
					<code class="rounded bg-muted px-1 text-xs">cardecky.mana.how/u/dein-slug</code>.
				</p>
				<div>
					<label for="author-slug" class="mb-1 block text-xs text-muted-foreground">
						Slug (3–60 Zeichen, a–z, 0–9, -)
					</label>
					<input
						id="author-slug"
						type="text"
						bind:value={authorSlug}
						placeholder="anna-lang"
						class="w-full rounded-lg border border-border-strong bg-background px-3 py-2 text-sm outline-none focus:border-indigo-400"
					/>
				</div>
				<div>
					<label for="author-name" class="mb-1 block text-xs text-muted-foreground"
						>Anzeigename</label
					>
					<input
						id="author-name"
						type="text"
						bind:value={authorName}
						placeholder="Anna Lang"
						class="w-full rounded-lg border border-border-strong bg-background px-3 py-2 text-sm outline-none focus:border-indigo-400"
					/>
				</div>
				<label class="flex items-start gap-2 text-xs text-muted-foreground">
					<input type="checkbox" bind:checked={authorPseudonym} class="mt-0.5" />
					<span>Pseudonym — Anzeigename ist nicht mein Klarname</span>
				</label>
				{#if authorStore.error}
					<p class="text-error">{authorStore.error}</p>
				{/if}
				<div class="flex justify-end gap-2 pt-2">
					<button
						class="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
						onclick={onClose}
					>
						Abbrechen
					</button>
					<button
						class="rounded-lg bg-app-accent px-4 py-1.5 text-sm text-white hover:bg-app-accent/90 disabled:opacity-50"
						onclick={submitAuthor}
						disabled={!authorSlug.trim() || !authorName.trim() || authorStore.loading}
					>
						{authorStore.loading ? 'Speichere…' : 'Author werden'}
					</button>
				</div>
			</div>
		{:else if stage === 'meta'}
			<div class="space-y-4 text-sm">
				<p class="text-muted-foreground">
					Veröffentlicht als <code class="rounded bg-muted px-1 text-xs"
						>cardecky.mana.how/d/{deckSlug || '...'}</code
					>
				</p>
				<div>
					<label for="d-slug" class="mb-1 block text-xs text-muted-foreground">Slug</label>
					<input
						id="d-slug"
						type="text"
						bind:value={deckSlug}
						class="w-full rounded-lg border border-border-strong bg-background px-3 py-2 text-sm outline-none focus:border-indigo-400"
					/>
				</div>
				<div>
					<label for="d-title" class="mb-1 block text-xs text-muted-foreground">Titel</label>
					<input
						id="d-title"
						type="text"
						bind:value={deckTitle}
						class="w-full rounded-lg border border-border-strong bg-background px-3 py-2 text-sm outline-none focus:border-indigo-400"
					/>
				</div>
				<div>
					<label for="d-desc" class="mb-1 block text-xs text-muted-foreground">Beschreibung</label>
					<textarea
						id="d-desc"
						bind:value={deckDescription}
						placeholder="Worum geht es in diesem Deck?"
						class="min-h-[80px] w-full rounded-lg border border-border-strong bg-background px-3 py-2 text-sm outline-none focus:border-indigo-400"
					></textarea>
				</div>
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label for="d-lang" class="mb-1 block text-xs text-muted-foreground">Sprache</label>
						<select
							id="d-lang"
							bind:value={deckLanguage}
							class="w-full rounded-lg border border-border-strong bg-background px-3 py-2 text-sm outline-none focus:border-indigo-400"
						>
							<option value="de">Deutsch</option>
							<option value="en">English</option>
							<option value="es">Español</option>
							<option value="fr">Français</option>
							<option value="it">Italiano</option>
							<option value="pt">Português</option>
							<option value="ja">日本語</option>
						</select>
					</div>
					<div>
						<label for="d-license" class="mb-1 block text-xs text-muted-foreground">Lizenz</label>
						<select
							id="d-license"
							bind:value={deckLicense}
							class="w-full rounded-lg border border-border-strong bg-background px-3 py-2 text-sm outline-none focus:border-indigo-400"
						>
							<option value="CC-BY-4.0">CC-BY 4.0 — frei mit Namensnennung</option>
							<option value="CC-BY-SA-4.0">CC-BY-SA 4.0 — share-alike</option>
							<option value="CC0-1.0">CC0 — gemeinfrei</option>
							<option value="Cardecky-Personal-Use-1.0">Personal Use — nur lernen</option>
						</select>
					</div>
				</div>
				<div class="grid grid-cols-2 gap-3">
					<div>
						<label for="d-semver" class="mb-1 block text-xs text-muted-foreground">Version</label>
						<input
							id="d-semver"
							type="text"
							bind:value={deckSemver}
							placeholder="1.0.0"
							class="w-full rounded-lg border border-border-strong bg-background px-3 py-2 text-sm outline-none focus:border-indigo-400"
						/>
					</div>
					<div>
						<label for="d-changelog" class="mb-1 block text-xs text-muted-foreground">
							Changelog (optional)
						</label>
						<input
							id="d-changelog"
							type="text"
							bind:value={deckChangelog}
							placeholder="Erste Version"
							class="w-full rounded-lg border border-border-strong bg-background px-3 py-2 text-sm outline-none focus:border-indigo-400"
						/>
					</div>
				</div>
				<p class="text-xs text-muted-foreground/80">
					{cards.length}
					{cards.length === 1 ? 'Karte' : 'Karten'} werden veröffentlicht. Das Deck durchläuft eine KI-Inhaltsprüfung
					— offensichtlich harmloses Material geht direkt durch.
				</p>
				<div class="flex justify-end gap-2 pt-2">
					<button
						class="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
						onclick={onClose}
					>
						Abbrechen
					</button>
					<button
						class="rounded-lg bg-app-accent px-4 py-1.5 text-sm text-white hover:bg-app-accent/90 disabled:opacity-50"
						onclick={submitPublish}
						disabled={!deckSlug.trim() || !deckTitle.trim() || cards.length === 0}
					>
						Veröffentlichen
					</button>
				</div>
			</div>
		{:else if stage === 'publishing'}
			<div class="py-8 text-center text-sm text-muted-foreground">
				Lade {cards.length} Karten hoch und prüfe Inhalt…
			</div>
		{:else if stage === 'done' && result}
			<div class="space-y-3 text-sm">
				<div class="text-green-400">
					✓ Veröffentlicht als Version {result.version.semver}
				</div>
				<div class="text-foreground/80">
					{result.version.cardCount} Karten · Lizenz: {result.deck.license}
				</div>
				{#if result.moderation.verdict === 'flag'}
					<div class="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-warning">
						Inhalt wurde zur Moderations-Prüfung markiert ({result.moderation.categories.join(
							', '
						)}). Das Deck ist veröffentlicht; ein Mensch schaut bei Gelegenheit drüber.
					</div>
				{/if}
				<button
					class="rounded-lg bg-app-accent px-4 py-1.5 text-sm text-white hover:bg-app-accent/90"
					onclick={onClose}
				>
					Fertig
				</button>
			</div>
		{:else if stage === 'error'}
			<div class="space-y-3 text-sm">
				<div class="text-error">Fehler: {error}</div>
				<button
					class="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
					onclick={() => (stage = 'meta')}
				>
					Erneut versuchen
				</button>
			</div>
		{/if}
	</div>
</div>
