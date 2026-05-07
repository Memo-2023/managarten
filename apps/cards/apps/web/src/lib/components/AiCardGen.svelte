<script lang="ts">
	import { generateCardsFromText, type GeneratedCard } from '$lib/ai/generate';
	import { cardStore } from '$lib/stores/cards.svelte';

	interface Props {
		deckId: string;
		currentCardCount: number;
		onCreated?: () => void;
	}

	let { deckId, currentCardCount, onCreated }: Props = $props();

	let stage = $state<'idle' | 'generating' | 'preview' | 'creating' | 'done' | 'error'>('idle');
	let source = $state('');
	let generated = $state<GeneratedCard[]>([]);
	let selected = $state<boolean[]>([]);
	let error = $state<string | null>(null);
	let createdCount = $state(0);
	let abortController: AbortController | null = null;

	async function handleGenerate() {
		if (!source.trim()) return;
		error = null;
		stage = 'generating';
		abortController = new AbortController();
		try {
			const cards = await generateCardsFromText(source, { signal: abortController.signal });
			generated = cards;
			selected = cards.map(() => true);
			stage = 'preview';
		} catch (e: any) {
			if (e?.name === 'AbortError') {
				stage = 'idle';
				return;
			}
			error = e?.message ?? 'Generierung fehlgeschlagen.';
			stage = 'error';
		} finally {
			abortController = null;
		}
	}

	function cancelGenerate() {
		abortController?.abort();
	}

	async function handleConfirm() {
		stage = 'creating';
		let order = currentCardCount;
		let count = 0;
		for (let i = 0; i < generated.length; i++) {
			if (!selected[i]) continue;
			const c = generated[i];
			const created = await cardStore.createCard(
				{ deckId, type: 'basic', front: c.front, back: c.back },
				order
			);
			if (created) {
				count++;
				order++;
			}
		}
		createdCount = count;
		stage = 'done';
		onCreated?.();
	}

	function reset() {
		stage = 'idle';
		generated = [];
		selected = [];
		source = '';
		error = null;
		createdCount = 0;
	}
</script>

<div class="rounded-xl border border-indigo-500/30 bg-neutral-900 p-4">
	<div class="mb-2 flex items-center justify-between">
		<span class="text-sm font-medium">✨ Karten aus Text generieren</span>
		{#if stage !== 'idle'}
			<button
				class="text-xs text-neutral-500 hover:text-neutral-300"
				onclick={stage === 'generating' ? cancelGenerate : reset}
			>
				{stage === 'generating' ? 'Abbrechen' : 'Zurücksetzen'}
			</button>
		{/if}
	</div>

	{#if stage === 'idle' || stage === 'error'}
		<textarea
			bind:value={source}
			placeholder="Text einfügen — Notizen, Lehrbuch-Absatz, Definition…"
			class="min-h-[120px] w-full rounded-lg border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm outline-none focus:border-indigo-400"
		></textarea>
		{#if stage === 'error' && error}
			<p class="mt-2 text-sm text-red-400">{error}</p>
		{/if}
		<div class="mt-2 flex items-center justify-between text-xs text-neutral-500">
			<span>{source.length} Zeichen</span>
			<button
				class="rounded-lg bg-indigo-500 px-4 py-1.5 text-sm text-white hover:bg-indigo-400 disabled:opacity-50"
				onclick={handleGenerate}
				disabled={!source.trim()}
			>
				Generieren
			</button>
		</div>
	{:else if stage === 'generating'}
		<div class="py-6 text-center text-sm text-neutral-400">Modell denkt nach…</div>
	{:else if stage === 'preview'}
		<div class="space-y-2 text-sm">
			<div class="text-neutral-300">
				{generated.length} Karten generiert. Wähle aus, was übernommen werden soll:
			</div>
			<ul class="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-neutral-800 p-2">
				{#each generated as card, i (i)}
					<li class="flex items-start gap-2 rounded-md p-1 hover:bg-neutral-800/50">
						<input
							type="checkbox"
							bind:checked={selected[i]}
							class="mt-1 shrink-0"
							id="ai-card-{i}"
						/>
						<label for="ai-card-{i}" class="min-w-0 flex-1 cursor-pointer">
							<div class="font-medium text-neutral-100">{card.front}</div>
							<div class="text-xs text-neutral-400">{card.back}</div>
						</label>
					</li>
				{/each}
			</ul>
			<div class="flex justify-end gap-2 pt-1">
				<button
					class="rounded-lg px-3 py-1.5 text-sm text-neutral-400 hover:text-neutral-100"
					onclick={() => (selected = selected.map(() => true))}
				>
					Alle
				</button>
				<button
					class="rounded-lg px-3 py-1.5 text-sm text-neutral-400 hover:text-neutral-100"
					onclick={() => (selected = selected.map(() => false))}
				>
					Keine
				</button>
				<button
					class="rounded-lg bg-indigo-500 px-4 py-1.5 text-sm text-white hover:bg-indigo-400 disabled:opacity-50"
					onclick={handleConfirm}
					disabled={!selected.some(Boolean)}
				>
					{selected.filter(Boolean).length} übernehmen
				</button>
			</div>
		</div>
	{:else if stage === 'creating'}
		<div class="py-6 text-center text-sm text-neutral-400">Lege Karten an…</div>
	{:else if stage === 'done'}
		<div class="text-sm text-green-400">✓ {createdCount} Karten angelegt.</div>
		<button
			class="mt-2 text-xs text-neutral-500 hover:text-neutral-300"
			onclick={reset}
		>
			Weiteren Text generieren
		</button>
	{/if}
</div>
