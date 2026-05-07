<script lang="ts">
	import { parseApkg, type ParsedAnki } from '$lib/anki/parse';
	import { importParsedAnki, type ImportResult } from '$lib/anki/import';

	let fileInput = $state<HTMLInputElement | null>(null);
	let stage = $state<
		'idle' | 'parsing' | 'preview' | 'uploading-media' | 'importing' | 'done' | 'error'
	>('idle');
	let parsed = $state<ParsedAnki | null>(null);
	let result = $state<ImportResult | null>(null);
	let error = $state<string | null>(null);
	let fileName = $state<string>('');
	let mediaProgress = $state<{ uploaded: number; total: number }>({ uploaded: 0, total: 0 });

	const mediaCount = $derived(parsed?.mediaByFilename.size ?? 0);

	async function handleFile(file: File) {
		error = null;
		fileName = file.name;
		stage = 'parsing';
		try {
			parsed = await parseApkg(file);
			stage = 'preview';
		} catch (e: any) {
			error = e?.message ?? 'Datei konnte nicht gelesen werden.';
			stage = 'error';
		}
	}

	function onPick(e: Event) {
		const input = e.currentTarget as HTMLInputElement;
		const f = input.files?.[0];
		if (f) handleFile(f);
		input.value = '';
	}

	function onDrop(e: DragEvent) {
		e.preventDefault();
		const f = e.dataTransfer?.files?.[0];
		if (f) handleFile(f);
	}

	async function confirmImport() {
		if (!parsed) return;
		mediaProgress = { uploaded: 0, total: mediaCount };
		stage = mediaCount > 0 ? 'uploading-media' : 'importing';
		try {
			result = await importParsedAnki(parsed, {
				onMediaProgress: (p) => {
					mediaProgress = p;
					if (p.uploaded >= p.total && stage === 'uploading-media') {
						stage = 'importing';
					}
				},
			});
			stage = 'done';
		} catch (e: any) {
			error = e?.message ?? 'Import fehlgeschlagen.';
			stage = 'error';
		}
	}

	function reset() {
		stage = 'idle';
		parsed = null;
		result = null;
		error = null;
		fileName = '';
	}
</script>

<div class="rounded-xl border border-border bg-card p-4">
	<div class="mb-2 text-sm font-medium">Aus Anki importieren</div>

	{#if stage === 'idle'}
		<!-- svelte-ignore a11y_no_static_element_interactions -->
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			class="rounded-lg border-2 border-dashed border-border-strong px-4 py-6 text-center text-sm text-muted-foreground transition-colors hover:border-indigo-400 hover:text-foreground/90"
			ondragover={(e) => e.preventDefault()}
			ondrop={onDrop}
			onclick={() => fileInput?.click()}
		>
			<div class="mb-1">📦 .apkg-Datei hier ablegen oder klicken</div>
			<div class="text-xs text-muted-foreground/80">
				Basic, Basic + Reverse, Cloze · Bilder + Audio werden mit übernommen.
			</div>
		</div>
		<input
			bind:this={fileInput}
			type="file"
			accept=".apkg,.colpkg"
			class="hidden"
			onchange={onPick}
		/>
	{:else if stage === 'parsing'}
		<div class="py-6 text-center text-sm text-muted-foreground">Lese {fileName}…</div>
	{:else if stage === 'preview' && parsed}
		<div class="space-y-2 text-sm">
			<div>
				<span class="text-muted-foreground">Gefunden in</span>
				<code class="rounded bg-muted px-1 text-xs">{fileName}</code>:
			</div>
			<ul class="ml-4 list-disc text-foreground/80">
				<li>{parsed.decks.length} {parsed.decks.length === 1 ? 'Deck' : 'Decks'}</li>
				<li>{parsed.cards.length} {parsed.cards.length === 1 ? 'Karte' : 'Karten'}</li>
				{#if mediaCount > 0}
					<li>{mediaCount} Medien (Bilder/Audio)</li>
				{/if}
				{#if parsed.skipped > 0}
					<li class="text-warning">{parsed.skipped} übersprungen (unbekannter Typ)</li>
				{/if}
			</ul>
			{#if parsed.warnings.length > 0}
				<details class="text-xs text-muted-foreground/80">
					<summary class="cursor-pointer">Hinweise ({parsed.warnings.length})</summary>
					<ul class="mt-1 list-disc pl-4">
						{#each parsed.warnings.slice(0, 10) as w (w)}<li>{w}</li>{/each}
					</ul>
				</details>
			{/if}
			<div class="flex justify-end gap-2 pt-2">
				<button
					class="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
					onclick={reset}
				>
					Abbrechen
				</button>
				<button
					class="rounded-lg bg-app-accent px-4 py-1.5 text-sm text-white hover:bg-app-accent/90"
					onclick={confirmImport}
				>
					Importieren
				</button>
			</div>
		</div>
	{:else if stage === 'uploading-media'}
		<div class="py-6 text-center text-sm text-muted-foreground">
			<div>Lade Medien hoch · {mediaProgress.uploaded} / {mediaProgress.total}</div>
			<div class="mx-auto mt-3 h-1 w-48 overflow-hidden rounded-full bg-muted">
				<div
					class="h-full bg-app-accent transition-all"
					style="width: {mediaProgress.total === 0
						? 0
						: (mediaProgress.uploaded / mediaProgress.total) * 100}%"
				></div>
			</div>
		</div>
	{:else if stage === 'importing'}
		<div class="py-6 text-center text-sm text-muted-foreground">
			Importiere {parsed?.cards.length ?? 0} Karten…
		</div>
	{:else if stage === 'done' && result}
		<div class="space-y-2 text-sm">
			<div class="text-green-400">
				✓ {result.cardsCreated} Karten in {result.decksCreated}
				{result.decksCreated === 1 ? 'Deck' : 'Decks'} angelegt.
			</div>
			{#if result.mediaUploaded > 0 || result.mediaFailed > 0}
				<div class="text-muted-foreground">
					{result.mediaUploaded} Medien übernommen{#if result.mediaFailed > 0}
						<span class="text-warning">· {result.mediaFailed} fehlgeschlagen</span>
					{/if}
				</div>
			{/if}
			{#if result.failed > 0}
				<div class="text-warning">{result.failed} Karten konnten nicht angelegt werden.</div>
			{/if}
			<button
				class="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
				onclick={reset}
			>
				Weitere Datei
			</button>
		</div>
	{:else if stage === 'error'}
		<div class="space-y-2 text-sm">
			<div class="text-error">Fehler: {error}</div>
			<button
				class="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
				onclick={reset}
			>
				Erneut versuchen
			</button>
		</div>
	{/if}
</div>
