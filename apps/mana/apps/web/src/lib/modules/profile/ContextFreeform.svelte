<!--
  Context Freeform — Markdown editor for userContext.freeform.
-->
<script lang="ts">
	import { onMount } from 'svelte';
	import { marked } from 'marked';
	import { useUserContext } from './queries';
	import { userContextStore } from './stores/user-context.svelte';
	import { PencilSimple, Eye, LinkSimple, X } from '@mana/shared-icons';
	import { crawlUrl, type CrawlMode } from '$lib/modules/notes/api';
	import { requireAuth } from '$lib/auth/require-auth.svelte';
	import { _ } from 'svelte-i18n';

	const SAVE_DEBOUNCE_MS = 500;

	let urlPanelOpen = $state(false);
	let importUrl = $state('');
	let importMode = $state<CrawlMode>('single');
	let importSummarize = $state(false);
	let importing = $state(false);
	let importPhase = $state<'idle' | 'crawling' | 'summarizing' | 'appending'>('idle');
	let importElapsed = $state(0);
	let importError = $state<string | null>(null);

	let ctx$ = useUserContext();
	let ctx = $derived(ctx$.value);

	let mode = $state<'view' | 'edit'>('view');
	let draft = $state('');
	let saveState = $state<'idle' | 'pending' | 'saved'>('idle');
	let initialized = $state(false);
	let saveTimer: ReturnType<typeof setTimeout> | null = null;
	let savedTimer: ReturnType<typeof setTimeout> | null = null;

	onMount(() => {});

	$effect(() => {
		if (!ctx) return;
		if (!initialized) {
			draft = ctx.freeform;
			initialized = true;
			if (!ctx.freeform) mode = 'edit';
		}
	});

	function scheduleSave() {
		saveState = 'pending';
		if (saveTimer) clearTimeout(saveTimer);
		saveTimer = setTimeout(flush, SAVE_DEBOUNCE_MS);
	}
	async function flush() {
		if (saveTimer) {
			clearTimeout(saveTimer);
			saveTimer = null;
		}
		if (ctx && draft === ctx.freeform) {
			saveState = 'idle';
			return;
		}
		await userContextStore.setFreeform(draft);
		saveState = 'saved';
		if (savedTimer) clearTimeout(savedTimer);
		savedTimer = setTimeout(() => {
			if (saveState === 'saved') saveState = 'idle';
		}, 1500);
	}
	async function toggleMode() {
		if (mode === 'edit') {
			await flush();
			mode = 'view';
		} else {
			if (ctx) draft = ctx.freeform;
			mode = 'edit';
		}
	}
	function handleKeydown(e: KeyboardEvent) {
		if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'e') {
			e.preventDefault();
			void toggleMode();
		}
	}
	function closeUrlPanel() {
		if (importing) return;
		urlPanelOpen = false;
		importUrl = '';
		importMode = 'single';
		importSummarize = false;
		importPhase = 'idle';
		importElapsed = 0;
		importError = null;
	}
	async function handleImport(e: Event) {
		e.preventDefault();
		const trimmed = importUrl.trim();
		if (!trimmed) return;
		const ok = await requireAuth({
			feature: 'context-url-import',
			reason: $_('profile.freeform.auth_reason_crawl'),
		});
		if (!ok) return;
		importing = true;
		importError = null;
		importPhase = 'crawling';
		importElapsed = 0;
		const started = performance.now();
		const tick = setInterval(() => {
			importElapsed = Math.floor((performance.now() - started) / 1000);
		}, 250);
		let phaseTimer: ReturnType<typeof setTimeout> | null = null;
		if (importSummarize) {
			phaseTimer = setTimeout(
				() => {
					if (importing) importPhase = 'summarizing';
				},
				importMode === 'deep' ? 25_000 : 4_000
			);
		}
		try {
			const result = await crawlUrl({
				url: trimmed,
				mode: importMode,
				summarize: importSummarize,
			});
			if (phaseTimer) clearTimeout(phaseTimer);
			importPhase = 'appending';
			const sourceLabel = $_('profile.freeform.crawl_source_label');
			const header = `## ${result.title}\n\n_${sourceLabel}: ${result.sourceUrl}_\n\n`;
			await userContextStore.appendFreeform(header + result.content);
			if (mode === 'edit' && ctx) draft = ctx.freeform;
			closeUrlPanel();
		} catch (err) {
			importError = err instanceof Error ? err.message : $_('profile.freeform.error_import_failed');
		} finally {
			if (phaseTimer) clearTimeout(phaseTimer);
			clearInterval(tick);
			importing = false;
		}
	}

	let renderedHtml = $derived.by(() => {
		const source = ctx?.freeform ?? '';
		if (!source.trim()) return '';
		try {
			return marked.parse(source, { async: false }) as string;
		} catch {
			return '';
		}
	});
</script>

<svelte:window onkeydown={handleKeydown} />

<div class="freeform">
	<header class="bar">
		<div class="status">
			{#if saveState === 'pending'}<span class="status-text">{$_('profile.freeform.saving')}</span>
			{:else if saveState === 'saved'}<span class="status-text saved"
					>{$_('profile.freeform.saved')}</span
				>{/if}
		</div>
		<div class="actions">
			<button
				class="mode-btn"
				class:active={urlPanelOpen}
				onclick={() => (urlPanelOpen ? closeUrlPanel() : (urlPanelOpen = true))}
				title={$_('profile.freeform.toggle_url_title')}
			>
				<LinkSimple size={14} /><span>{$_('profile.freeform.action_from_url')}</span>
			</button>
			<button
				class="mode-btn"
				onclick={toggleMode}
				title={$_('profile.freeform.toggle_mode_title')}
			>
				{#if mode === 'view'}<PencilSimple size={14} /><span
						>{$_('profile.freeform.action_edit')}</span
					>
				{:else}<Eye size={14} /><span>{$_('profile.freeform.action_view')}</span>{/if}
			</button>
		</div>
	</header>

	{#if urlPanelOpen}
		<form class="url-panel" onsubmit={handleImport}>
			<div class="url-row">
				<input
					type="url"
					bind:value={importUrl}
					required
					placeholder={$_('profile.freeform.url_placeholder')}
					disabled={importing}
					class="url-input"
				/>
				<button type="submit" disabled={importing || !importUrl.trim()} class="url-submit">
					{#if importing}{importPhase === 'crawling'
							? $_('profile.freeform.phase_crawling')
							: importPhase === 'summarizing'
								? $_('profile.freeform.phase_summarizing')
								: $_('profile.freeform.phase_appending')}{:else}{$_(
							'profile.freeform.action_insert'
						)}{/if}
				</button>
				<button
					type="button"
					onclick={closeUrlPanel}
					disabled={importing}
					class="url-close"
					title={$_('profile.freeform.action_close_title')}><X size={14} /></button
				>
			</div>
			<div class="url-opts">
				<label class:disabled={importing}
					><input type="radio" bind:group={importMode} value="single" disabled={importing} />
					{$_('profile.freeform.option_single')}</label
				>
				<label class:disabled={importing}
					><input type="radio" bind:group={importMode} value="deep" disabled={importing} />
					{$_('profile.freeform.option_deep')}</label
				>
				<span class="url-sep">·</span>
				<label class:disabled={importing}
					><input type="checkbox" bind:checked={importSummarize} disabled={importing} />
					{$_('profile.freeform.option_summarize')}</label
				>
			</div>
			{#if importError}<p class="url-error">{importError}</p>{/if}
		</form>
	{/if}

	{#if mode === 'edit'}
		<textarea
			class="editor"
			bind:value={draft}
			oninput={scheduleSave}
			onblur={flush}
			placeholder={$_('profile.freeform.placeholder')}
		></textarea>
	{:else if renderedHtml}
		<!-- eslint-disable-next-line svelte/no-at-html-tags -->
		<article class="prose">{@html renderedHtml}</article>
	{:else}
		<button class="empty" onclick={() => (mode = 'edit')}
			><span>{$_('profile.freeform.placeholder')}</span><span class="hint"
				>{$_('profile.freeform.empty_hint')}</span
			></button
		>
	{/if}
</div>

<style>
	.freeform {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		height: 100%;
		min-height: 0;
	}
	.bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.status {
		min-height: 1rem;
	}
	.actions {
		display: flex;
		gap: 0.375rem;
	}
	.status-text {
		font-size: 0.6875rem;
		color: hsl(var(--color-muted-foreground));
	}
	.status-text.saved {
		color: hsl(var(--color-success, var(--color-primary)));
	}
	.mode-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.25rem 0.5rem;
		border: 1px solid hsl(var(--color-border));
		border-radius: 0.375rem;
		background: transparent;
		color: hsl(var(--color-foreground));
		font-size: 0.75rem;
		cursor: pointer;
		transition:
			background 0.15s,
			border-color 0.15s;
	}
	.mode-btn:hover {
		background: hsl(var(--color-surface-hover));
		border-color: hsl(var(--color-ring));
	}
	.mode-btn.active {
		background: hsl(var(--color-primary) / 0.12);
		border-color: hsl(var(--color-primary));
		color: hsl(var(--color-primary));
	}
	.url-panel {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.625rem 0.75rem;
		border: 1px solid hsl(var(--color-border));
		border-radius: 0.5rem;
		background: hsl(var(--color-muted) / 0.35);
	}
	.url-row {
		display: flex;
		align-items: stretch;
		gap: 0.375rem;
	}
	.url-input {
		flex: 1;
		min-width: 0;
		padding: 0.375rem 0.625rem;
		border: 1px solid hsl(var(--color-border));
		border-radius: 0.375rem;
		background: transparent;
		color: hsl(var(--color-foreground));
		font-size: 0.8125rem;
		outline: none;
	}
	.url-input:focus {
		border-color: hsl(var(--color-ring));
	}
	.url-submit {
		padding: 0.375rem 0.75rem;
		border: none;
		border-radius: 0.375rem;
		background: hsl(var(--color-primary));
		color: hsl(var(--color-primary-foreground));
		font-size: 0.75rem;
		font-weight: 500;
		cursor: pointer;
	}
	.url-submit:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.url-close {
		display: inline-flex;
		align-items: center;
		justify-content: center;
		width: 1.75rem;
		border: 1px solid hsl(var(--color-border));
		border-radius: 0.375rem;
		background: transparent;
		color: hsl(var(--color-muted-foreground));
		cursor: pointer;
	}
	.url-close:hover:not(:disabled) {
		color: hsl(var(--color-foreground));
		border-color: hsl(var(--color-ring));
	}
	.url-opts {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
		font-size: 0.75rem;
		color: hsl(var(--color-muted-foreground));
	}
	.url-opts label {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		cursor: pointer;
	}
	.url-opts label.disabled {
		opacity: 0.5;
	}
	.url-sep {
		opacity: 0.4;
	}
	.url-error {
		margin: 0;
		font-size: 0.6875rem;
		color: hsl(var(--color-destructive, 0 84% 60%));
	}
	.editor {
		flex: 1;
		min-height: 0;
		width: 100%;
		background: transparent;
		border: 1px solid hsl(var(--color-border));
		border-radius: 0.5rem;
		padding: 0.75rem 0.875rem;
		font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
		font-size: 0.8125rem;
		line-height: 1.55;
		color: hsl(var(--color-foreground));
		resize: none;
		outline: none;
	}
	.editor:focus {
		border-color: hsl(var(--color-ring));
	}
	.editor::placeholder {
		color: hsl(var(--color-muted-foreground));
	}
	.empty {
		flex: 1;
		display: flex;
		flex-direction: column;
		align-items: center;
		justify-content: center;
		gap: 0.375rem;
		background: transparent;
		border: 1px dashed hsl(var(--color-border));
		border-radius: 0.5rem;
		color: hsl(var(--color-muted-foreground));
		font-size: 0.875rem;
		cursor: text;
	}
	.empty:hover {
		border-color: hsl(var(--color-ring));
		color: hsl(var(--color-foreground));
	}
	.empty .hint {
		font-size: 0.6875rem;
		opacity: 0.75;
	}
	.prose {
		flex: 1;
		overflow-y: auto;
		color: hsl(var(--color-foreground));
		font-size: 0.875rem;
		line-height: 1.6;
	}
	.prose :global(h1),
	.prose :global(h2),
	.prose :global(h3) {
		margin: 1.25em 0 0.5em;
		font-weight: 600;
		line-height: 1.3;
	}
	.prose :global(h1) {
		font-size: 1.375rem;
	}
	.prose :global(h2) {
		font-size: 1.15rem;
	}
	.prose :global(p) {
		margin: 0.5em 0;
	}
	.prose :global(ul),
	.prose :global(ol) {
		margin: 0.5em 0;
		padding-left: 1.25rem;
	}
	.prose :global(code) {
		font-family: ui-monospace, monospace;
		font-size: 0.8125em;
		padding: 0.1em 0.35em;
		border-radius: 0.25rem;
		background: hsl(var(--color-muted) / 0.5);
	}
	.prose :global(pre) {
		padding: 0.75rem 0.875rem;
		border-radius: 0.5rem;
		background: hsl(var(--color-muted) / 0.5);
		overflow-x: auto;
	}
	.prose :global(blockquote) {
		margin: 0.75em 0;
		padding: 0.25em 0.75em;
		border-left: 3px solid hsl(var(--color-border));
		color: hsl(var(--color-muted-foreground));
	}
	.prose :global(a) {
		color: hsl(var(--color-primary));
		text-decoration: underline;
	}
	.prose :global(hr) {
		border: none;
		border-top: 1px solid hsl(var(--color-border));
		margin: 1.25em 0;
	}
</style>
