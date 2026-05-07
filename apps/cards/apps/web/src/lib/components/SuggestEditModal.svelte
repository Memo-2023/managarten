<script lang="ts">
	import { cardsApi, CardsApiError } from '$lib/api/cards-api';
	import type { Card } from '@mana/cards-core';

	type Mode = 'modify' | 'remove';

	interface Props {
		card: Card;
		deckSlug: string;
		open: boolean;
		onClose: () => void;
		onSubmitted?: () => void;
	}

	let { card, deckSlug, open, onClose, onSubmitted }: Props = $props();

	let mode = $state<Mode>('modify');
	let title = $state('');
	let body = $state('');
	let editedFields = $state<Record<string, string>>({});
	let busy = $state(false);
	let error = $state<string | null>(null);
	let success = $state(false);

	$effect(() => {
		if (open) {
			editedFields = { ...card.fields };
			title = `Verbesserung: Karte ${card.order + 1}`;
			body = '';
			mode = 'modify';
			error = null;
			success = false;
		}
	});

	const fieldKeys = $derived(Object.keys(editedFields));

	const hasChanges = $derived.by(() => {
		if (mode === 'remove') return true;
		return fieldKeys.some((k) => editedFields[k] !== card.fields[k]);
	});

	async function submit() {
		if (!card.serverContentHash) {
			error = 'Diese Karte stammt nicht aus einem abonnierten Deck.';
			return;
		}
		if (!hasChanges) {
			error = 'Keine Änderungen zu vorschlagen.';
			return;
		}
		if (!title.trim()) {
			error = 'Titel fehlt.';
			return;
		}
		busy = true;
		error = null;
		try {
			const diff =
				mode === 'remove'
					? {
							add: [],
							modify: [],
							remove: [{ contentHash: card.serverContentHash }],
						}
					: {
							add: [],
							modify: [
								{
									previousContentHash: card.serverContentHash,
									type: card.type,
									fields: editedFields,
								},
							],
							remove: [],
						};
			await cardsApi.pullRequests.create(deckSlug, {
				title: title.trim(),
				body: body.trim() || undefined,
				diff,
			});
			success = true;
			onSubmitted?.();
			setTimeout(() => onClose(), 1200);
		} catch (e) {
			error = e instanceof CardsApiError ? e.message : (e as Error).message;
		} finally {
			busy = false;
		}
	}
</script>

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
		role="dialog"
		aria-modal="true"
	>
		<div class="w-full max-w-xl rounded-xl border border-neutral-800 bg-neutral-950 p-6">
			<header class="mb-4 flex items-center justify-between">
				<h2 class="text-lg font-semibold">Verbesserung vorschlagen</h2>
				<button
					class="text-neutral-400 hover:text-neutral-100"
					onclick={onClose}
					aria-label="Schließen">✕</button
				>
			</header>

			{#if success}
				<p
					class="rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-3 text-sm text-emerald-300"
				>
					Pull Request gesendet — der Author wird benachrichtigt.
				</p>
			{:else}
				<div class="mb-4 inline-flex rounded-lg border border-neutral-800 p-1">
					<button
						class="rounded px-3 py-1 text-xs"
						class:bg-neutral-800={mode === 'modify'}
						onclick={() => (mode = 'modify')}>Inhalt ändern</button
					>
					<button
						class="rounded px-3 py-1 text-xs"
						class:bg-neutral-800={mode === 'remove'}
						onclick={() => (mode = 'remove')}>Karte entfernen</button
					>
				</div>

				<label class="mb-3 block">
					<span class="mb-1 block text-xs text-neutral-400">Titel</span>
					<input
						class="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm"
						bind:value={title}
						placeholder="Kurzbeschreibung der Verbesserung"
					/>
				</label>

				{#if mode === 'modify'}
					<div class="mb-3 space-y-2">
						{#each fieldKeys as key (key)}
							<label class="block">
								<span class="mb-1 block text-xs text-neutral-400">{key}</span>
								<textarea
									class="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm"
									rows="2"
									bind:value={editedFields[key]}
								></textarea>
							</label>
						{/each}
					</div>
				{:else}
					<p
						class="mb-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-200"
					>
						Diese Karte wird beim Merge aus dem Deck entfernt.
					</p>
				{/if}

				<label class="mb-4 block">
					<span class="mb-1 block text-xs text-neutral-400">Begründung (optional)</span>
					<textarea
						class="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-sm"
						rows="3"
						bind:value={body}
						placeholder="Warum ist diese Änderung sinnvoll?"
					></textarea>
				</label>

				{#if error}
					<p class="mb-3 text-sm text-red-400">{error}</p>
				{/if}

				<div class="flex items-center justify-end gap-2">
					<button
						class="rounded-lg border border-neutral-800 px-4 py-2 text-sm hover:border-neutral-700"
						onclick={onClose}
						disabled={busy}>Abbrechen</button
					>
					<button
						class="rounded-lg bg-indigo-500 px-4 py-2 text-sm text-white hover:bg-indigo-400 disabled:opacity-50"
						onclick={submit}
						disabled={busy || !hasChanges}
					>
						{busy ? 'Sende…' : 'PR senden'}
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}
