<!--
  ReferencePicker — inline "Quellen" section inside the briefing form.
  Shows the currently-attached references as ReferenceChip pills (with
  live-resolved display labels) and a "+ Quelle" dropdown for adding
  new ones. Seven kinds:

    - article   → searchable list of saved articles
    - note      → searchable list of notes
    - library   → searchable list of library entries
    - url       → freeform URL input + optional context note
    - kontext   → space's standing-context Note (one-click add; the Note flagged isSpaceContext)
    - goal      → searchable list of goals
    - me-image  → searchable list of profile reference images

  The parent owns the references array and wires it to the draft via
  BriefingForm's save handler.
-->
<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { useAllArticles } from '$lib/modules/articles/queries';
	import { useAllNotes, useSpaceContextNote } from '$lib/modules/notes/queries';
	import { useAllEntries as useAllLibraryEntries } from '$lib/modules/library/queries';
	import { useAllMeImages } from '$lib/modules/profile/queries';
	import { useAllGoals } from '$lib/companion/goals/queries';
	import ReferenceChip from './ReferenceChip.svelte';
	import type { DraftReference, DraftReferenceKind } from '../types';

	const SUPPORTED_KINDS: DraftReferenceKind[] = [
		'article',
		'note',
		'library',
		'url',
		'kontext',
		'goal',
		'me-image',
	];
	const MAX_REFERENCES = 6;
	/** Sentinel targetId — the resolver finds the flagged note by scope-scan,
	 *  not by id, but a non-null id keeps the de-dupe + chip-key logic uniform. */
	const KONTEXT_SINGLETON_ID = 'kontext:singleton';

	let {
		references,
		onchange,
	}: {
		references: DraftReference[];
		onchange: (next: DraftReference[]) => void;
	} = $props();

	const articles$ = useAllArticles();
	const notes$ = useAllNotes();
	const library$ = useAllLibraryEntries();
	const kontext$ = useSpaceContextNote();
	const meImages$ = useAllMeImages();
	const goals$ = useAllGoals();

	// Lookup maps so chips can resolve their display label from targetId.
	const articlesById = $derived(new Map((articles$.value ?? []).map((a) => [a.id, a])));
	const notesById = $derived(new Map((notes$.value ?? []).map((n) => [n.id, n])));
	const libraryById = $derived(new Map((library$.value ?? []).map((e) => [e.id, e])));
	const meImagesById = $derived(new Map((meImages$.value ?? []).map((m) => [m.id, m])));
	const goalsById = $derived(new Map((goals$.value ?? []).map((g) => [g.id, g])));
	const kontextDoc = $derived(kontext$.value);

	function labelFor(ref: DraftReference): string {
		if (ref.kind === 'url') return ref.url ?? $_('writing.reference_picker.label_url_default');
		if (ref.kind === 'kontext') return $_('writing.reference_picker.label_kontext');
		if (!ref.targetId) return $_('writing.reference_picker.label_unknown');
		if (ref.kind === 'article') {
			const a = articlesById.get(ref.targetId);
			return a ? a.title : $_('writing.reference_picker.label_article_missing');
		}
		if (ref.kind === 'note') {
			const n = notesById.get(ref.targetId);
			return n
				? n.title || $_('writing.reference_picker.label_note_untitled')
				: $_('writing.reference_picker.label_note_missing');
		}
		if (ref.kind === 'library') {
			const e = libraryById.get(ref.targetId);
			return e ? e.title : $_('writing.reference_picker.label_library_missing');
		}
		if (ref.kind === 'goal') {
			const g = goalsById.get(ref.targetId);
			return g ? g.title : $_('writing.reference_picker.label_goal_missing');
		}
		if (ref.kind === 'me-image') {
			const m = meImagesById.get(ref.targetId);
			return m
				? (m.label ??
						$_('writing.reference_picker.label_image_kind_fallback', {
							values: { kind: m.kind },
						}))
				: $_('writing.reference_picker.label_image_missing');
		}
		return ref.targetId;
	}

	type PickerMode =
		| 'closed'
		| 'article'
		| 'note'
		| 'library'
		| 'url'
		| 'kontext'
		| 'goal'
		| 'me-image';
	let mode = $state<PickerMode>('closed');
	let searchQuery = $state('');
	let urlInput = $state('');
	let urlNote = $state('');

	const canAddMore = $derived(references.length < MAX_REFERENCES);

	function openMode(next: PickerMode) {
		mode = mode === next ? 'closed' : next;
		searchQuery = '';
		urlInput = '';
		urlNote = '';
	}

	function removeAt(idx: number) {
		const next = references.filter((_, i) => i !== idx);
		onchange(next);
	}

	function addRef(ref: DraftReference) {
		if (!canAddMore) return;
		// De-dupe: same kind + targetId/url → skip
		const duplicate = references.some(
			(r) => r.kind === ref.kind && (ref.targetId ? r.targetId === ref.targetId : r.url === ref.url)
		);
		if (duplicate) {
			mode = 'closed';
			return;
		}
		onchange([...references, ref]);
		mode = 'closed';
		searchQuery = '';
		urlInput = '';
		urlNote = '';
	}

	const filteredArticles = $derived.by(() => {
		const q = searchQuery.trim().toLowerCase();
		const all = articles$.value ?? [];
		if (!q) return all.slice(0, 20);
		return all
			.filter(
				(a) => a.title.toLowerCase().includes(q) || (a.siteName?.toLowerCase().includes(q) ?? false)
			)
			.slice(0, 20);
	});

	const filteredNotes = $derived.by(() => {
		const q = searchQuery.trim().toLowerCase();
		const all = notes$.value ?? [];
		if (!q) return all.slice(0, 20);
		return all
			.filter((n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q))
			.slice(0, 20);
	});

	const filteredLibrary = $derived.by(() => {
		const q = searchQuery.trim().toLowerCase();
		const all = library$.value ?? [];
		if (!q) return all.slice(0, 20);
		return all
			.filter(
				(e) =>
					e.title.toLowerCase().includes(q) || e.creators.some((c) => c.toLowerCase().includes(q))
			)
			.slice(0, 20);
	});

	const filteredGoals = $derived.by(() => {
		const q = searchQuery.trim().toLowerCase();
		const all = goals$.value ?? [];
		// Active goals are most relevant for writing context — sort them
		// to the top, then archived/done as a secondary group.
		const visible = all.filter((g) => !g.deletedAt);
		const sorted = [...visible].sort((a, b) => {
			const aRank = a.status === 'active' ? 0 : 1;
			const bRank = b.status === 'active' ? 0 : 1;
			return aRank - bRank;
		});
		if (!q) return sorted.slice(0, 20);
		return sorted
			.filter(
				(g) =>
					g.title.toLowerCase().includes(q) || (g.description?.toLowerCase().includes(q) ?? false)
			)
			.slice(0, 20);
	});

	const filteredMeImages = $derived.by(() => {
		const q = searchQuery.trim().toLowerCase();
		const all = meImages$.value ?? [];
		if (!q) return all.slice(0, 20);
		return all
			.filter(
				(m) =>
					(m.label?.toLowerCase().includes(q) ?? false) ||
					m.kind.toLowerCase().includes(q) ||
					m.tags.some((t) => t.toLowerCase().includes(q))
			)
			.slice(0, 20);
	});

	function addKontext() {
		if (!kontextDoc) return;
		addRef({ kind: 'kontext', targetId: KONTEXT_SINGLETON_ID, note: null });
	}

	function addUrl() {
		const url = urlInput.trim();
		if (!url) return;
		addRef({ kind: 'url', url, note: urlNote.trim() || null });
	}
</script>

<div class="picker">
	{#if references.length > 0}
		<div class="chips">
			{#each references as ref, idx (`${ref.kind}:${ref.targetId ?? ref.url ?? idx}`)}
				<ReferenceChip
					kind={ref.kind}
					label={labelFor(ref)}
					note={ref.note}
					onremove={() => removeAt(idx)}
				/>
			{/each}
		</div>
	{/if}

	{#if canAddMore}
		<div class="add-row">
			<span class="add-label">{$_('writing.reference_picker.add_label')}</span>
			{#each SUPPORTED_KINDS as k (k)}
				<button
					type="button"
					class="kind-btn"
					class:active={mode === k}
					onclick={() => openMode(k as PickerMode)}
				>
					{$_('writing.reference_picker.kind_' + k)}
				</button>
			{/each}
		</div>
	{:else}
		<p class="muted">
			{$_('writing.reference_picker.max_reached', { values: { max: MAX_REFERENCES } })}
		</p>
	{/if}

	{#if mode === 'article' || mode === 'note' || mode === 'library' || mode === 'goal' || mode === 'me-image'}
		<div class="search">
			<!-- svelte-ignore a11y_autofocus -->
			<input
				type="search"
				bind:value={searchQuery}
				placeholder={$_('writing.reference_picker.search_placeholder')}
				autofocus
			/>
			<div class="results">
				{#if mode === 'article'}
					{#if filteredArticles.length === 0}
						<p class="muted small">{$_('writing.reference_picker.no_results')}</p>
					{:else}
						{#each filteredArticles as a (a.id)}
							<button
								type="button"
								class="result"
								onclick={() => addRef({ kind: 'article', targetId: a.id, note: null })}
							>
								<strong>{a.title}</strong>
								{#if a.siteName}
									<span class="meta">{a.siteName}</span>
								{/if}
							</button>
						{/each}
					{/if}
				{:else if mode === 'note'}
					{#if filteredNotes.length === 0}
						<p class="muted small">{$_('writing.reference_picker.no_results')}</p>
					{:else}
						{#each filteredNotes as n (n.id)}
							<button
								type="button"
								class="result"
								onclick={() => addRef({ kind: 'note', targetId: n.id, note: null })}
							>
								<strong>{n.title || $_('writing.reference_picker.label_note_untitled')}</strong>
								{#if n.content}
									<span class="meta">
										{n.content.slice(0, 80).replace(/\s+/g, ' ')}
										{n.content.length > 80 ? '…' : ''}
									</span>
								{/if}
							</button>
						{/each}
					{/if}
				{:else if mode === 'library'}
					{#if filteredLibrary.length === 0}
						<p class="muted small">{$_('writing.reference_picker.no_results')}</p>
					{:else}
						{#each filteredLibrary as e (e.id)}
							<button
								type="button"
								class="result"
								onclick={() => addRef({ kind: 'library', targetId: e.id, note: null })}
							>
								<strong>{e.title}</strong>
								<span class="meta">
									{e.kind}
									{#if e.creators.length}· {e.creators[0]}{/if}
									{#if e.year}· {e.year}{/if}
								</span>
							</button>
						{/each}
					{/if}
				{:else if mode === 'goal'}
					{#if filteredGoals.length === 0}
						<p class="muted small">{$_('writing.reference_picker.no_goals')}</p>
					{:else}
						{#each filteredGoals as g (g.id)}
							<button
								type="button"
								class="result"
								onclick={() => addRef({ kind: 'goal', targetId: g.id, note: null })}
							>
								<strong>{g.title}</strong>
								<span class="meta">
									{g.status} · {g.currentValue}/{g.target.value}
									{g.target.period}
								</span>
							</button>
						{/each}
					{/if}
				{:else if mode === 'me-image'}
					{#if filteredMeImages.length === 0}
						<p class="muted small">{$_('writing.reference_picker.no_me_images')}</p>
					{:else}
						{#each filteredMeImages as m (m.id)}
							<button
								type="button"
								class="result me-image-result"
								onclick={() => addRef({ kind: 'me-image', targetId: m.id, note: null })}
							>
								{#if m.thumbnailUrl || m.publicUrl}
									<img src={m.thumbnailUrl ?? m.publicUrl} alt="" class="thumb" />
								{/if}
								<span class="me-image-text">
									<strong
										>{m.label ??
											$_('writing.reference_picker.label_image_kind_fallback', {
												values: { kind: m.kind },
											})}</strong
									>
									<span class="meta">
										{m.kind}{#if m.tags.length}
											· {m.tags.join(', ')}
										{/if}
									</span>
								</span>
							</button>
						{/each}
					{/if}
				{/if}
			</div>
		</div>
	{:else if mode === 'kontext'}
		<div class="search">
			{#if !kontextDoc}
				<p class="muted small">
					{$_('writing.reference_picker.kontext_empty_pre')}<a href="/notes">/notes</a>{$_(
						'writing.reference_picker.kontext_empty_post'
					)}
				</p>
			{:else}
				<button type="button" class="result" onclick={addKontext}>
					<strong>{$_('writing.reference_picker.kontext_link')}</strong>
					<span class="meta">
						{(kontextDoc.content ?? '').slice(0, 100).replace(/\s+/g, ' ')}
						{(kontextDoc.content ?? '').length > 100 ? '…' : ''}
					</span>
				</button>
			{/if}
		</div>
	{:else if mode === 'url'}
		<div class="url-row">
			<!-- svelte-ignore a11y_autofocus -->
			<input
				type="url"
				bind:value={urlInput}
				placeholder={$_('writing.reference_picker.url_placeholder')}
				autofocus
			/>
			<input
				type="text"
				bind:value={urlNote}
				placeholder={$_('writing.reference_picker.url_note_placeholder')}
				class="note-input"
			/>
			<button type="button" class="primary" disabled={!urlInput.trim()} onclick={addUrl}>
				{$_('writing.reference_picker.url_add')}
			</button>
		</div>
	{/if}
</div>

<style>
	.picker {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.3rem;
	}
	.add-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.3rem;
	}
	.add-label {
		font-size: 0.8rem;
		color: hsl(var(--color-muted-foreground));
		margin-right: 0.2rem;
	}
	.kind-btn {
		padding: 0.25rem 0.6rem;
		border-radius: 0.4rem;
		border: 1px solid hsl(var(--color-border));
		background: transparent;
		cursor: pointer;
		font: inherit;
		font-size: 0.8rem;
		color: inherit;
	}
	.kind-btn:hover:not(.active) {
		border-color: hsl(var(--color-primary));
		color: hsl(var(--color-primary));
	}
	.kind-btn.active {
		background: hsl(var(--color-primary) / 0.12);
		border-color: hsl(var(--color-primary));
		color: hsl(var(--color-primary));
	}
	.search {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		padding: 0.5rem;
		border-radius: 0.5rem;
		border: 1px solid hsl(var(--color-primary) / 0.25);
		background: hsl(var(--color-primary) / 0.03);
	}
	.search input[type='search'] {
		padding: 0.4rem 0.6rem;
		border-radius: 0.4rem;
		border: 1px solid hsl(var(--color-border));
		background: hsl(var(--color-surface));
		font: inherit;
		font-size: 0.85rem;
		color: inherit;
	}
	.search input[type='search']:focus {
		outline: 2px solid hsl(var(--color-primary));
		outline-offset: 1px;
		border-color: transparent;
	}
	.results {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		max-height: 240px;
		overflow-y: auto;
	}
	.result {
		display: flex;
		flex-direction: column;
		align-items: flex-start;
		gap: 0.15rem;
		padding: 0.4rem 0.6rem;
		border-radius: 0.35rem;
		border: 1px solid transparent;
		background: transparent;
		cursor: pointer;
		font: inherit;
		color: inherit;
		text-align: left;
	}
	.result:hover {
		background: hsl(var(--color-surface));
		border-color: hsl(var(--color-primary) / 0.4);
	}
	.result strong {
		font-size: 0.9rem;
		line-height: 1.25;
	}
	.result .meta {
		font-size: 0.75rem;
		color: hsl(var(--color-muted-foreground));
	}
	.me-image-result {
		flex-direction: row;
		gap: 0.55rem;
		align-items: center;
	}
	.me-image-result .thumb {
		width: 2.5rem;
		height: 2.5rem;
		border-radius: 0.4rem;
		object-fit: cover;
		flex-shrink: 0;
	}
	.me-image-text {
		display: flex;
		flex-direction: column;
		gap: 0.1rem;
		min-width: 0;
	}
	.url-row {
		display: flex;
		gap: 0.4rem;
		padding: 0.5rem;
		border-radius: 0.5rem;
		border: 1px solid hsl(var(--color-primary) / 0.25);
		background: hsl(var(--color-primary) / 0.03);
		flex-wrap: wrap;
	}
	.url-row input {
		flex: 1;
		min-width: 9rem;
		padding: 0.4rem 0.6rem;
		border-radius: 0.4rem;
		border: 1px solid hsl(var(--color-border));
		background: hsl(var(--color-surface));
		font: inherit;
		font-size: 0.85rem;
		color: inherit;
	}
	.url-row input:focus {
		outline: 2px solid hsl(var(--color-primary));
		outline-offset: 1px;
		border-color: transparent;
	}
	.url-row .note-input {
		flex: 2;
	}
	.url-row .primary {
		padding: 0.4rem 0.9rem;
		border-radius: 0.4rem;
		border: 1px solid hsl(var(--color-primary));
		background: hsl(var(--color-primary));
		color: white;
		cursor: pointer;
		font: inherit;
		font-size: 0.85rem;
		font-weight: 500;
	}
	.url-row .primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.muted {
		color: hsl(var(--color-muted-foreground));
		font-size: 0.8rem;
		margin: 0;
	}
	.muted.small {
		padding: 0.5rem;
		text-align: center;
	}
</style>
