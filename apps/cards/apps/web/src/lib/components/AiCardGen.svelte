<script lang="ts">
	import { generateCardsFromText, type GeneratedCard } from '$lib/ai/generate';
	import { extractTextFromPdf } from '$lib/ai/pdf';
	import { cardStore } from '$lib/stores/cards.svelte';

	interface Props {
		deckId: string;
		currentCardCount: number;
		onCreated?: () => void;
	}

	let { deckId, currentCardCount, onCreated }: Props = $props();

	let stage = $state<
		'idle' | 'reading-pdf' | 'generating' | 'preview' | 'creating' | 'done' | 'error'
	>('idle');
	let source = $state('');
	let pdfPicker = $state<HTMLInputElement | null>(null);
	let pdfStatus = $state<string | null>(null);
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
		pdfStatus = null;
	}

	async function handlePdfPick(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const file = input.files?.[0];
		input.value = '';
		if (!file) return;
		error = null;
		stage = 'reading-pdf';
		pdfStatus = `Lese ${file.name}…`;
		try {
			const result = await extractTextFromPdf(file);
			source = result.text;
			pdfStatus = `${file.name} · ${result.pageCount} Seiten · ${result.text.length} Zeichen`;
			stage = 'idle';
		} catch (e: any) {
			error = e?.message ?? 'PDF konnte nicht gelesen werden.';
			stage = 'error';
			pdfStatus = null;
		}
	}
</script>

<div class="rounded-xl border border-indigo-500/30 bg-card p-4">
	<div class="mb-2 flex items-center justify-between">
		<span class="text-sm font-medium">✨ Karten aus Text generieren</span>
		{#if stage !== 'idle'}
			<button
				class="text-xs text-muted-foreground/80 hover:text-foreground/80"
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
			class="min-h-[120px] w-full rounded-lg border border-border-strong bg-background px-3 py-2 text-sm outline-none focus:border-indigo-400"
		></textarea>
		{#if stage === 'error' && error}
			<p class="mt-2 text-sm text-error">{error}</p>
		{/if}
		<div class="mt-2 flex items-center justify-between gap-3 text-xs text-muted-foreground/80">
			<div class="flex items-center gap-3">
				<span>{source.length} Zeichen</span>
				{#if pdfStatus}<span class="text-app-accent">📄 {pdfStatus}</span>{/if}
			</div>
			<div class="flex items-center gap-2">
				<button
					class="rounded-lg border border-border-strong px-3 py-1.5 text-foreground/80 hover:bg-muted"
					onclick={() => pdfPicker?.click()}
				>
					📄 PDF laden
				</button>
				<button
					class="rounded-lg bg-app-accent px-4 py-1.5 text-sm text-white hover:bg-app-accent/90 disabled:opacity-50"
					onclick={handleGenerate}
					disabled={!source.trim()}
				>
					Generieren
				</button>
			</div>
		</div>
		<input
			bind:this={pdfPicker}
			type="file"
			accept="application/pdf,.pdf"
			class="hidden"
			onchange={handlePdfPick}
		/>
	{:else if stage === 'reading-pdf'}
		<div class="py-6 text-center text-sm text-muted-foreground">{pdfStatus ?? 'Lese PDF…'}</div>
	{:else if stage === 'generating'}
		<div class="py-6 text-center text-sm text-muted-foreground">Modell denkt nach…</div>
	{:else if stage === 'preview'}
		<div class="space-y-2 text-sm">
			<div class="text-foreground/80">
				{generated.length} Karten generiert. Wähle aus, was übernommen werden soll:
			</div>
			<ul class="max-h-72 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
				{#each generated as card, i (i)}
					<li class="flex items-start gap-2 rounded-md p-1 hover:bg-muted/50">
						<input
							type="checkbox"
							bind:checked={selected[i]}
							class="mt-1 shrink-0"
							id="ai-card-{i}"
						/>
						<label for="ai-card-{i}" class="min-w-0 flex-1 cursor-pointer">
							<div class="font-medium text-foreground">{card.front}</div>
							<div class="text-xs text-muted-foreground">{card.back}</div>
						</label>
					</li>
				{/each}
			</ul>
			<div class="flex justify-end gap-2 pt-1">
				<button
					class="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
					onclick={() => (selected = selected.map(() => true))}
				>
					Alle
				</button>
				<button
					class="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
					onclick={() => (selected = selected.map(() => false))}
				>
					Keine
				</button>
				<button
					class="rounded-lg bg-app-accent px-4 py-1.5 text-sm text-white hover:bg-app-accent/90 disabled:opacity-50"
					onclick={handleConfirm}
					disabled={!selected.some(Boolean)}
				>
					{selected.filter(Boolean).length} übernehmen
				</button>
			</div>
		</div>
	{:else if stage === 'creating'}
		<div class="py-6 text-center text-sm text-muted-foreground">Lege Karten an…</div>
	{:else if stage === 'done'}
		<div class="text-sm text-green-400">✓ {createdCount} Karten angelegt.</div>
		<button class="mt-2 text-xs text-muted-foreground/80 hover:text-foreground/80" onclick={reset}>
			Weiteren Text generieren
		</button>
	{/if}
</div>
