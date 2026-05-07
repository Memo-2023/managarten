<script lang="ts">
	import { cardsApi, CardsApiError, type ReportCategory } from '$lib/api/cards-api';
	import { authStore } from '$lib/stores/auth.svelte';

	interface Props {
		deckSlug: string;
		cardContentHash?: string;
		variant?: 'inline' | 'icon';
	}

	let { deckSlug, cardContentHash, variant = 'inline' }: Props = $props();

	let open = $state(false);
	let category = $state<ReportCategory>('spam');
	let body = $state('');
	let busy = $state(false);
	let error = $state<string | null>(null);
	let done = $state(false);

	const CATEGORIES: { value: ReportCategory; label: string }[] = [
		{ value: 'spam', label: 'Spam' },
		{ value: 'copyright', label: 'Urheberrecht' },
		{ value: 'nsfw', label: 'NSFW' },
		{ value: 'misinformation', label: 'Falschinformation' },
		{ value: 'hate', label: 'Hass' },
		{ value: 'other', label: 'Sonstiges' },
	];

	function close() {
		open = false;
		error = null;
		body = '';
		done = false;
	}

	async function submit() {
		busy = true;
		error = null;
		try {
			await cardsApi.moderation.report({
				deckSlug,
				cardContentHash,
				category,
				body: body.trim() || undefined,
			});
			done = true;
			setTimeout(close, 1500);
		} catch (e) {
			error = e instanceof CardsApiError ? e.message : (e as Error).message;
		} finally {
			busy = false;
		}
	}
</script>

{#if authStore.isAuthenticated}
	{#if variant === 'icon'}
		<button
			class="text-xs text-muted-foreground/60 hover:text-warning"
			onclick={() => (open = true)}
			title="Melden"
			aria-label="Melden"
		>
			🚩
		</button>
	{:else}
		<button
			class="text-xs text-muted-foreground/80 hover:text-warning"
			onclick={() => (open = true)}
		>
			🚩 Melden
		</button>
	{/if}
{/if}

{#if open}
	<div
		class="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4"
		role="dialog"
		aria-modal="true"
	>
		<div class="w-full max-w-md rounded-xl border border-border bg-background p-5">
			<header class="mb-4 flex items-center justify-between">
				<h2 class="text-base font-semibold">
					{cardContentHash ? 'Karte melden' : 'Deck melden'}
				</h2>
				<button
					class="text-muted-foreground hover:text-foreground"
					onclick={close}
					aria-label="Schließen">✕</button
				>
			</header>

			{#if done}
				<p class="rounded-lg border border-success/30 bg-success/10 p-3 text-sm text-success">
					Danke — die Moderation prüft den Bericht.
				</p>
			{:else}
				<label class="mb-3 block">
					<span class="mb-1 block text-xs text-muted-foreground">Kategorie</span>
					<select
						class="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
						bind:value={category}
					>
						{#each CATEGORIES as c (c.value)}
							<option value={c.value}>{c.label}</option>
						{/each}
					</select>
				</label>

				<label class="mb-4 block">
					<span class="mb-1 block text-xs text-muted-foreground">Begründung (optional)</span>
					<textarea
						class="w-full rounded-lg border border-border bg-card px-3 py-2 text-sm"
						rows="3"
						bind:value={body}
						placeholder="Was stimmt nicht?"
					></textarea>
				</label>

				{#if error}
					<p class="mb-3 text-sm text-error">{error}</p>
				{/if}

				<div class="flex justify-end gap-2">
					<button
						class="rounded-lg border border-border px-4 py-2 text-sm hover:border-border-strong"
						onclick={close}
						disabled={busy}>Abbrechen</button
					>
					<button
						class="rounded-lg bg-amber-500 px-4 py-2 text-sm text-amber-950 hover:bg-amber-400 disabled:opacity-50"
						onclick={submit}
						disabled={busy}
					>
						{busy ? 'Sende…' : 'Melden'}
					</button>
				</div>
			{/if}
		</div>
	</div>
{/if}
