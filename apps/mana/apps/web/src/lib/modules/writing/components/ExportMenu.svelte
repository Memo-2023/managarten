<!--
  ExportMenu — drop-down next to the Generate/Checkpoint buttons in the
  DetailView. Three actions:
    - Markdown kopieren
    - .md herunterladen
    - Drucken / PDF (uses the browser's native print dialog)

  The heavy lifting lives in utils/export.ts + the stores; this
  component is just the menu surface + confirmation toasts.
-->
<script lang="ts">
	import { _ } from 'svelte-i18n';
	import {
		draftToMarkdown,
		draftToPlainText,
		downloadFile,
		fileStem,
		copyTextToClipboard,
	} from '../utils/export';
	import type { Draft, DraftVersion } from '../types';

	let {
		draft,
		currentVersion,
	}: {
		draft: Draft;
		currentVersion: DraftVersion | null;
	} = $props();

	let open = $state(false);
	let feedback = $state<string | null>(null);
	let feedbackTimer: ReturnType<typeof setTimeout> | null = null;

	function flash(msg: string) {
		feedback = msg;
		if (feedbackTimer) clearTimeout(feedbackTimer);
		feedbackTimer = setTimeout(() => (feedback = null), 2200);
	}

	async function copyMd() {
		const ok = await copyTextToClipboard(draftToMarkdown(draft, currentVersion));
		flash(
			ok ? $_('writing.export_menu.toast_md_copied') : $_('writing.export_menu.toast_copy_failed')
		);
		open = false;
	}

	async function copyPlain() {
		const ok = await copyTextToClipboard(draftToPlainText(draft, currentVersion));
		flash(
			ok ? $_('writing.export_menu.toast_text_copied') : $_('writing.export_menu.toast_copy_failed')
		);
		open = false;
	}

	function downloadMd() {
		downloadFile(
			`${fileStem(draft.title)}.md`,
			draftToMarkdown(draft, currentVersion),
			'text/markdown;charset=utf-8'
		);
		flash($_('writing.export_menu.toast_downloaded'));
		open = false;
	}

	function printDraft() {
		open = false;
		if (typeof window !== 'undefined') window.print();
	}
</script>

<div class="menu">
	<button
		type="button"
		class="trigger"
		class:active={open}
		onclick={() => (open = !open)}
		aria-expanded={open}
		title={$_('writing.export_menu.title')}
	>
		{$_('writing.export_menu.trigger')}
	</button>
	{#if open}
		<div class="dropdown" role="menu">
			<button type="button" role="menuitem" onclick={copyMd}>
				{$_('writing.export_menu.copy_md')}
			</button>
			<button type="button" role="menuitem" onclick={copyPlain}>
				{$_('writing.export_menu.copy_text')}
			</button>
			<button type="button" role="menuitem" onclick={downloadMd}>
				{$_('writing.export_menu.download_md')}
			</button>
			<button type="button" role="menuitem" onclick={printDraft}>
				{$_('writing.export_menu.print_pdf')}
			</button>
		</div>
	{/if}
	{#if feedback}
		<span class="toast" role="status" aria-live="polite">{feedback}</span>
	{/if}
</div>

<style>
	.menu {
		position: relative;
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
	}
	.trigger {
		padding: 0.4rem 0.8rem;
		border-radius: 0.5rem;
		border: 1px solid hsl(var(--color-border));
		background: transparent;
		color: inherit;
		cursor: pointer;
		font: inherit;
		font-size: 0.85rem;
	}
	.trigger:hover {
		border-color: hsl(var(--color-primary));
		color: hsl(var(--color-primary));
	}
	.trigger.active {
		background: hsl(var(--color-primary) / 0.1);
		border-color: hsl(var(--color-primary));
		color: hsl(var(--color-primary));
	}
	.dropdown {
		position: absolute;
		top: calc(100% + 0.3rem);
		right: 0;
		z-index: 20;
		display: flex;
		flex-direction: column;
		min-width: 14rem;
		padding: 0.3rem;
		border-radius: 0.55rem;
		border: 1px solid hsl(var(--color-border));
		background: hsl(var(--color-surface));
		box-shadow: 0 6px 20px rgba(0, 0, 0, 0.08);
	}
	.dropdown button {
		text-align: left;
		padding: 0.45rem 0.7rem;
		border-radius: 0.4rem;
		border: none;
		background: transparent;
		color: inherit;
		cursor: pointer;
		font: inherit;
		font-size: 0.85rem;
	}
	.dropdown button:hover:not(:disabled) {
		background: hsl(var(--color-primary) / 0.1);
		color: hsl(var(--color-primary));
	}
	.dropdown button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.toast {
		font-size: 0.8rem;
		color: hsl(var(--color-primary));
		white-space: nowrap;
	}
</style>
