<!--
  Notes — Workbench ListView
  Single-line quick-create, click any note to edit inline.
-->
<script lang="ts">
	import { useAllNotes, searchNotes, getPreview, formatRelativeTime } from './queries';
	import { notesStore } from './stores/notes.svelte';
	import { notesSelectionStore } from './stores/selection.svelte';
	import type { Note } from './types';
	import type { ViewProps } from '$lib/app-registry';
	import { ContextMenu, type ContextMenuItem } from '@mana/shared-ui';
	import { useItemContextMenu } from '$lib/data/item-context-menu.svelte';
	import { PencilSimple, Trash, PushPin, LinkSimple, Scroll } from '@mana/shared-icons';
	import FloatingInputBar from '$lib/components/FloatingInputBar.svelte';
	import AgentDot from '$lib/components/ai/AgentDot.svelte';
	import ScopeEmptyState from '$lib/components/workbench/ScopeEmptyState.svelte';
	import { hasActiveSceneScope } from '$lib/stores/scene-scope.svelte';
	import { crawlUrl, type CrawlMode } from './api';
	import { requireAuth } from '$lib/auth/require-auth.svelte';

	let { navigate, goBack, params }: ViewProps = $props();

	let notes$ = useAllNotes();
	let notes = $derived(notes$.value);

	let searchQuery = $state('');
	let editingId = $state<string | null>(null);
	let editTitle = $state('');
	let editContent = $state('');
	let newTitle = $state('');

	let filtered = $derived(searchNotes(notes, searchQuery));

	async function handleQuickCreate() {
		if (!newTitle.trim()) return;
		const note = await notesStore.createNote({ title: newTitle.trim() });
		newTitle = '';
		startEdit(note);
	}

	async function handleVoiceComplete(blob: Blob, durationMs: number) {
		const note = await notesStore.createFromVoice(blob, durationMs, 'de');
		startEdit(note);
	}

	function startEdit(note: Note) {
		if (editingId && editingId !== note.id) saveEdit();
		editingId = note.id;
		editTitle = note.title;
		editContent = note.content;
	}

	// When a voice note's transcript arrives asynchronously while the
	// inline editor is open, the underlying Dexie row updates but the
	// editor's local copy stays on the "…" placeholder. Sync it back in
	// — but ONLY while the editor still shows the placeholder, so we
	// never overwrite content the user has already typed.
	$effect(() => {
		if (!editingId) return;
		const live = notes.find((n) => n.id === editingId);
		if (!live) return;
		if (editContent === '…' && live.content !== '…') {
			editTitle = live.title;
			editContent = live.content;
		}
	});

	// Cross-module focus signal (e.g. Kontext → "Als Notiz speichern").
	// The caller populates selectionStore.focusedNoteId; we wait until
	// the underlying Dexie row is visible via liveQuery (the just-created
	// note may not be in `notes` on the first effect run because liveQuery
	// is async), then open it in the editor and scroll it into view.
	$effect(() => {
		const id = notesSelectionStore.focusedNoteId;
		if (!id) return;
		const target = notes.find((n) => n.id === id);
		if (!target) return;
		startEdit(target);
		notesSelectionStore.clearFocus();
		queueMicrotask(() => {
			const el = document.querySelector(`[data-note-id="${id}"]`);
			el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
		});
	});

	async function saveEdit() {
		if (!editingId) return;
		await notesStore.updateNote(editingId, {
			title: editTitle.trim() || 'Unbenannt',
			content: editContent,
		});
		editingId = null;
	}

	async function handleDelete(id: string) {
		await notesStore.deleteNote(id);
		if (editingId === id) editingId = null;
	}

	async function handleTogglePin(e: Event, id: string) {
		e.stopPropagation();
		await notesStore.togglePin(id);
	}

	// ─── URL Import ──────────────────────────────────────────
	let urlImportOpen = $state(false);
	let importUrl = $state('');
	let importMode = $state<CrawlMode>('single');
	let importSummarize = $state(false);
	let importing = $state(false);
	let importError = $state<string | null>(null);

	function resetImport() {
		importUrl = '';
		importMode = 'single';
		importSummarize = false;
		importError = null;
	}

	async function handleImport(e: Event) {
		e.preventDefault();
		const trimmed = importUrl.trim();
		if (!trimmed) return;
		const ok = await requireAuth({
			feature: 'notes-url-import',
			reason:
				'Das Crawlen einer Web-Seite läuft serverseitig (robots.txt, Rate-Limits, optionale KI-Zusammenfassung) und erfordert ein Mana-Konto.',
		});
		if (!ok) return;
		importing = true;
		importError = null;
		try {
			const result = await crawlUrl({
				url: trimmed,
				mode: importMode,
				summarize: importSummarize,
			});
			const header = `_Quelle: ${result.sourceUrl}_\n\n`;
			const note = await notesStore.createNote({
				title: result.title,
				content: header + result.content,
			});
			urlImportOpen = false;
			resetImport();
			startEdit(note);
		} catch (err) {
			importError = err instanceof Error ? err.message : 'Import fehlgeschlagen';
		} finally {
			importing = false;
		}
	}

	// ─── Space-Kontext Mutex ─────────────────────────────────
	async function handleToggleSpaceContext(note: Note) {
		// Mutex enforced inside the store; flagged → unset, unflagged → set.
		await notesStore.markAsSpaceContext(note.isSpaceContext ? null : note.id);
	}

	const ctxMenu = useItemContextMenu<Note>();

	let ctxMenuItems = $derived<ContextMenuItem[]>(
		ctxMenu.state.target
			? [
					{
						id: 'edit',
						label: 'Bearbeiten',
						icon: PencilSimple,
						action: () => {
							const target = ctxMenu.state.target;
							if (target) startEdit(target);
						},
					},
					{
						id: 'pin',
						label: ctxMenu.state.target.isPinned ? 'Lösen' : 'Pinnen',
						icon: PushPin,
						action: () => {
							const target = ctxMenu.state.target;
							if (target) notesStore.togglePin(target.id);
						},
					},
					{
						id: 'space-context',
						label: ctxMenu.state.target.isSpaceContext
							? 'Space-Kontext lösen'
							: 'Als Space-Kontext markieren',
						icon: Scroll,
						action: () => {
							const target = ctxMenu.state.target;
							if (target) handleToggleSpaceContext(target);
						},
					},
					{ id: 'div', label: '', type: 'divider' as const },
					{
						id: 'delete',
						label: 'Löschen',
						icon: Trash,
						variant: 'danger' as const,
						action: () => {
							const target = ctxMenu.state.target;
							if (target) handleDelete(target.id);
						},
					},
				]
			: []
	);
</script>

<div class="app-view">
	<!-- URL import: collapsed pill, expands to inline form on click -->
	<div class="url-import">
		{#if !urlImportOpen}
			<button
				type="button"
				class="url-import-toggle"
				onclick={() => (urlImportOpen = true)}
				aria-label="Notiz aus URL erstellen"
			>
				<LinkSimple size={14} />
				<span>Aus URL importieren</span>
			</button>
		{:else}
			<form class="url-import-form" onsubmit={handleImport}>
				<div class="url-import-row">
					<input
						type="url"
						bind:value={importUrl}
						required
						placeholder="https://example.com/article"
						disabled={importing}
						class="url-import-input"
					/>
					<button type="submit" class="url-import-submit" disabled={importing || !importUrl.trim()}>
						{importing ? 'Lade…' : 'Importieren'}
					</button>
					<button
						type="button"
						class="url-import-cancel"
						onclick={() => {
							urlImportOpen = false;
							resetImport();
						}}
						disabled={importing}
						aria-label="Abbrechen"
					>
						×
					</button>
				</div>
				<div class="url-import-opts">
					<label class:disabled={importing}>
						<input type="radio" bind:group={importMode} value="single" disabled={importing} />
						Nur diese Seite
					</label>
					<label class:disabled={importing}>
						<input type="radio" bind:group={importMode} value="deep" disabled={importing} />
						Ganze Website (max. 20)
					</label>
					<span class="sep">·</span>
					<label class:disabled={importing}>
						<input type="checkbox" bind:checked={importSummarize} disabled={importing} />
						KI-Zusammenfassung
					</label>
				</div>
				{#if importError}
					<p class="url-import-error">{importError}</p>
				{/if}
			</form>
		{/if}
	</div>

	<!-- Search -->
	{#if notes.length > 5}
		<input class="search-input" type="text" placeholder="Suchen..." bind:value={searchQuery} />
	{/if}

	<!-- Note list -->
	<div class="note-list">
		{#each filtered as note (note.id)}
			{#if editingId === note.id}
				<!-- Inline editor -->
				<!-- svelte-ignore a11y_no_noninteractive_element_interactions -->
				<div
					class="note-item editing"
					data-note-id={note.id}
					onkeydown={(e) => {
						if (e.key === 'Escape') saveEdit();
					}}
					role="form"
				>
					<!-- svelte-ignore a11y_autofocus -->
					<input
						class="ed-title"
						type="text"
						bind:value={editTitle}
						placeholder="Titel..."
						autofocus
					/>
					<textarea class="ed-content" bind:value={editContent} placeholder="Inhalt..." rows="4"
					></textarea>
					<div class="ed-actions">
						<button class="ed-btn danger" onclick={() => handleDelete(note.id)}>Löschen</button>
						<button class="ed-btn" onclick={() => handleTogglePin(new Event('click'), note.id)}>
							{note.isPinned ? 'Lösen' : 'Pinnen'}
						</button>
						<button class="ed-btn primary" onclick={saveEdit}>Fertig</button>
					</div>
				</div>
			{:else}
				<!-- Note row -->
				<button
					class="note-item"
					data-note-id={note.id}
					onclick={() => startEdit(note)}
					oncontextmenu={(e) => ctxMenu.open(e, note)}
				>
					{#if note.color}
						<span class="color-dot" style="background: {note.color}"></span>
					{/if}
					<div class="note-content">
						<div class="note-top">
							<span class="note-title">{note.title || 'Unbenannt'}</span>
							<AgentDot record={note} />
							{#if note.isSpaceContext}
								<span
									class="space-context-badge"
									title="Space-Kontext — Quelle für AI-Referenzen in diesem Space"
								>
									<Scroll size={12} />
								</span>
							{/if}
							{#if note.isPinned}<span class="pin">&#x1f4cc;</span>{/if}
						</div>
						{#if note.content}
							<p class="note-preview">{getPreview(note.content, 60)}</p>
						{/if}
						<span class="note-meta">
							{formatRelativeTime(note.updatedAt)}
							{#if note.transcriptModel}
								<span class="stt-chip" title="STT-Pipeline">&#x1f3a4; {note.transcriptModel}</span>
							{/if}
						</span>
					</div>
				</button>
			{/if}
		{/each}

		{#if filtered.length === 0 && notes.length > 0}
			<p class="empty">Keine Treffer</p>
		{/if}
	</div>

	{#if notes.length === 0}
		{#if hasActiveSceneScope()}
			<ScopeEmptyState label="Notizen" />
		{:else}
			<p class="empty">Erstelle deine erste Notiz.</p>
		{/if}
	{/if}

	<FloatingInputBar
		bind:value={newTitle}
		placeholder="Neue Notiz..."
		onSubmit={handleQuickCreate}
		voice
		voiceFeature="notes-voice-capture"
		voiceReason="Notizen werden verschlüsselt gespeichert. Dafür brauchst du ein Mana-Konto."
		onVoiceComplete={handleVoiceComplete}
	/>

	<ContextMenu
		visible={ctxMenu.state.visible}
		x={ctxMenu.state.x}
		y={ctxMenu.state.y}
		items={ctxMenuItems}
		onClose={ctxMenu.close}
	/>
</div>

<style>
	.app-view {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		padding: 1rem;
		height: 100%;
		position: relative;
	}

	.url-import {
		display: flex;
		flex-direction: column;
	}
	.url-import-toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		align-self: flex-start;
		padding: 0.3rem 0.5rem;
		border: 1px dashed hsl(var(--color-border));
		border-radius: 0.375rem;
		background: transparent;
		color: hsl(var(--color-muted-foreground));
		font-size: 0.75rem;
		cursor: pointer;
		transition:
			color 0.15s,
			border-color 0.15s;
	}
	.url-import-toggle:hover {
		color: hsl(var(--color-foreground));
		border-color: hsl(var(--color-ring));
	}
	.url-import-form {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding: 0.5rem;
		border: 1px solid hsl(var(--color-border));
		border-radius: 0.5rem;
		background: hsl(var(--color-card));
	}
	.url-import-row {
		display: flex;
		align-items: stretch;
		gap: 0.25rem;
	}
	.url-import-input {
		flex: 1;
		min-width: 0;
		padding: 0.3rem 0.5rem;
		border: 1px solid hsl(var(--color-border));
		border-radius: 0.375rem;
		background: transparent;
		color: hsl(var(--color-foreground));
		font-size: 0.8125rem;
		outline: none;
	}
	.url-import-input:focus {
		border-color: hsl(var(--color-ring));
	}
	.url-import-submit {
		padding: 0.3rem 0.75rem;
		border: none;
		border-radius: 0.375rem;
		background: hsl(var(--color-primary));
		color: hsl(var(--color-primary-foreground));
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
	}
	.url-import-submit:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.url-import-cancel {
		padding: 0.3rem 0.5rem;
		border: 1px solid hsl(var(--color-border));
		border-radius: 0.375rem;
		background: transparent;
		color: hsl(var(--color-muted-foreground));
		font-size: 1rem;
		line-height: 1;
		cursor: pointer;
	}
	.url-import-opts {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.75rem;
		color: hsl(var(--color-muted-foreground));
	}
	.url-import-opts label {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		cursor: pointer;
	}
	.url-import-opts label.disabled {
		opacity: 0.5;
	}
	.url-import-opts .sep {
		opacity: 0.4;
	}
	.url-import-error {
		margin: 0;
		font-size: 0.75rem;
		color: hsl(var(--color-destructive, 0 84% 60%));
	}

	.space-context-badge {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		color: hsl(var(--color-primary));
		opacity: 0.8;
	}

	.search-input {
		padding: 0.3rem 0.5rem;
		border-radius: 0.375rem;
		border: 1px solid hsl(var(--color-border));
		background: transparent;
		font-size: 0.75rem;
		color: hsl(var(--color-foreground));
		outline: none;
	}
	.search-input:focus {
		border-color: hsl(var(--color-ring));
	}
	.search-input::placeholder {
		color: hsl(var(--color-muted-foreground));
	}
	.note-list {
		flex: 1;
		overflow-y: auto;
		padding-bottom: 4rem;
	}
	.note-item {
		display: flex;
		align-items: flex-start;
		gap: 0.5rem;
		width: 100%;
		padding: 0.375rem 0.25rem;
		border: none;
		background: transparent;
		text-align: left;
		border-radius: 0.25rem;
		cursor: pointer;
		transition: background 0.15s;
		user-select: none;
		-webkit-user-select: none;
		-webkit-touch-callout: none;
	}
	.note-item:hover {
		background: hsl(var(--color-surface-hover));
	}
	.color-dot {
		width: 6px;
		height: 6px;
		border-radius: 9999px;
		flex-shrink: 0;
		margin-top: 0.375rem;
	}
	.note-content {
		min-width: 0;
		flex: 1;
	}
	.note-top {
		display: flex;
		align-items: center;
		gap: 0.25rem;
	}
	.note-title {
		font-size: 0.8125rem;
		font-weight: 500;
		color: hsl(var(--color-foreground));
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		flex: 1;
	}
	.pin {
		font-size: 0.5625rem;
		flex-shrink: 0;
	}
	.note-preview {
		font-size: 0.6875rem;
		color: hsl(var(--color-muted-foreground));
		margin: 0;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.note-meta {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.625rem;
		color: hsl(var(--color-muted-foreground));
	}
	.stt-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.125rem;
		padding: 0 0.375rem;
		border-radius: 9999px;
		background: hsl(var(--color-muted) / 0.6);
		font-size: 0.5625rem;
	}

	/* ── Inline Editor ──────────────────────────── */
	.note-item.editing {
		cursor: default;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.5rem;
		border: 1px solid hsl(var(--color-primary) / 0.3);
		border-radius: 0.375rem;
		background: hsl(var(--color-primary) / 0.04);
		user-select: text;
		-webkit-user-select: text;
		-webkit-touch-callout: default;
	}
	.note-item.editing:hover {
		background: hsl(var(--color-primary) / 0.04);
	}
	.ed-title {
		width: 100%;
		background: transparent;
		border: none;
		color: hsl(var(--color-foreground));
		font-size: 0.8125rem;
		font-weight: 600;
		padding: 0;
		outline: none;
	}
	.ed-title::placeholder {
		color: hsl(var(--color-muted-foreground));
	}
	.ed-content {
		width: 100%;
		background: transparent;
		border: none;
		color: hsl(var(--color-foreground));
		font-size: 0.75rem;
		padding: 0;
		outline: none;
		resize: vertical;
		min-height: 2.5rem;
		font-family: inherit;
		line-height: 1.5;
	}
	.ed-content::placeholder {
		color: hsl(var(--color-muted-foreground));
	}
	.ed-actions {
		display: flex;
		gap: 0.25rem;
		justify-content: flex-end;
		padding-top: 0.125rem;
	}
	.ed-btn {
		padding: 0.25rem 0.5rem;
		border-radius: 0.25rem;
		font-size: 0.6875rem;
		font-weight: 500;
		cursor: pointer;
		border: none;
		background: transparent;
		color: hsl(var(--color-muted-foreground));
		transition: all 0.15s;
	}
	.ed-btn:hover {
		background: hsl(var(--color-surface-hover));
		color: hsl(var(--color-foreground));
	}
	.ed-btn.primary {
		background: hsl(var(--color-primary));
		color: hsl(var(--color-primary-foreground));
	}
	.ed-btn.primary:hover {
		filter: brightness(0.9);
	}
	.ed-btn.danger:hover {
		color: hsl(var(--color-error));
		background: hsl(var(--color-error) / 0.08);
	}
	.empty {
		padding: 2rem 0;
		text-align: center;
		font-size: 0.8125rem;
		color: hsl(var(--color-muted-foreground));
	}

	@media (max-width: 640px) {
		.app-view {
			padding: 0.75rem;
		}
		.note-item {
			padding: 0.625rem 0.375rem;
			min-height: 44px;
		}
	}
</style>
