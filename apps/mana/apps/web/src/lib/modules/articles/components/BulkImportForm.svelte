<!--
  BulkImportForm — paste a list of URLs (one per line / whitespace /
  comma separated), live-validates with `parseUrls`, kicks off an
  import job + navigates to its detail view.

  Plan: docs/plans/articles-bulk-import.md.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { _ } from 'svelte-i18n';
	import { articleImportsStore, MAX_URLS_PER_JOB, parseUrls } from '../stores/imports.svelte';

	let raw = $state('');
	let busy = $state(false);
	let error = $state<string | null>(null);

	const parsed = $derived(parseUrls(raw));
	const overLimit = $derived(parsed.valid.length > MAX_URLS_PER_JOB);

	async function handleSubmit() {
		if (busy) return;
		if (parsed.valid.length === 0) {
			error = $_('articles.import.error_no_urls');
			return;
		}
		if (overLimit) {
			error = $_('articles.import.error_overlimit', {
				values: { n: parsed.valid.length, max: MAX_URLS_PER_JOB },
			});
			return;
		}
		busy = true;
		error = null;
		try {
			const jobId = await articleImportsStore.createJob(parsed.valid);
			goto(`/articles/import/${jobId}`);
		} catch (e) {
			error = e instanceof Error ? e.message : $_('articles.import.error_failed');
			busy = false;
		}
	}
</script>

<div class="bulk-shell">
	<header class="header">
		<h1>{$_('articles.import.form_title')}</h1>
		<p class="subtitle">{$_('articles.import.form_subtitle')}</p>
	</header>

	<textarea
		class="url-area"
		bind:value={raw}
		placeholder={$_('articles.import.form_placeholder')}
		rows="10"
		disabled={busy}
	></textarea>

	<div class="counter-row" aria-live="polite">
		<span class="counter counter-valid" class:counter-overlimit={overLimit}>
			{$_('articles.import.count_valid', { values: { n: parsed.valid.length } })}{overLimit
				? $_('articles.import.count_overlimit_suffix', { values: { max: MAX_URLS_PER_JOB } })
				: ''}
		</span>
		{#if parsed.duplicates.length > 0}
			<span class="counter counter-dup">
				{$_('articles.import.count_dup', { values: { n: parsed.duplicates.length } })}
			</span>
		{/if}
		{#if parsed.invalid.length > 0}
			<span class="counter counter-invalid">
				{$_('articles.import.count_invalid', { values: { n: parsed.invalid.length } })}
			</span>
		{/if}
	</div>

	{#if overLimit}
		<p class="error" role="alert">
			{$_('articles.import.error_overlimit', {
				values: { n: parsed.valid.length, max: MAX_URLS_PER_JOB },
			})}
		</p>
	{/if}

	{#if parsed.invalid.length > 0}
		<details class="invalid-details">
			<summary>
				{$_('articles.import.invalid_details_summary', { values: { n: parsed.invalid.length } })}
			</summary>
			<ul class="invalid-list">
				{#each parsed.invalid as bad (bad)}
					<li><code>{bad}</code></li>
				{/each}
			</ul>
		</details>
	{/if}

	{#if error}
		<p class="error" role="alert">{error}</p>
	{/if}

	<div class="actions">
		<button
			type="button"
			class="primary"
			onclick={handleSubmit}
			disabled={busy || parsed.valid.length === 0 || overLimit}
		>
			{#if busy}
				{$_('articles.import.submit_busy')}
			{:else}
				{$_('articles.import.submit_label', { values: { n: parsed.valid.length } })}
			{/if}
		</button>
	</div>

	<p class="hint">{$_('articles.import.hint')}</p>
</div>

<style>
	.bulk-shell {
		max-width: 760px;
		margin: 0 auto;
		padding: 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.85rem;
	}
	.header h1 {
		margin: 0 0 0.25rem 0;
		font-size: 1.6rem;
	}
	.subtitle {
		margin: 0;
		color: var(--color-text-muted, #64748b);
		font-size: 0.95rem;
	}
	.url-area {
		width: 100%;
		min-height: 11rem;
		padding: 0.7rem 0.85rem;
		border-radius: 0.6rem;
		border: 1px solid var(--color-border, rgba(0, 0, 0, 0.15));
		background: var(--color-surface, transparent);
		font: inherit;
		color: inherit;
		font-family: 'SF Mono', Menlo, Consolas, monospace;
		font-size: 0.88rem;
		line-height: 1.45;
		resize: vertical;
	}
	.url-area:focus {
		outline: 2px solid #f97316;
		outline-offset: 1px;
		border-color: transparent;
	}
	.counter-row {
		display: flex;
		gap: 0.45rem;
		flex-wrap: wrap;
		font-size: 0.85rem;
	}
	.counter {
		padding: 0.15rem 0.55rem;
		border-radius: 999px;
		font-weight: 500;
	}
	.counter-valid {
		background: color-mix(in srgb, #16a34a 12%, transparent);
		color: #16a34a;
	}
	.counter-overlimit {
		background: rgba(239, 68, 68, 0.12);
		color: #ef4444;
	}
	.counter-dup {
		background: color-mix(in srgb, #f59e0b 12%, transparent);
		color: #b45309;
	}
	.counter-invalid {
		background: rgba(239, 68, 68, 0.12);
		color: #ef4444;
	}
	.invalid-details {
		font-size: 0.85rem;
	}
	.invalid-details summary {
		cursor: pointer;
		color: var(--color-text-muted, #64748b);
	}
	.invalid-list {
		margin: 0.45rem 0 0 0.5rem;
		padding-left: 0.85rem;
	}
	.invalid-list code {
		font-size: 0.82rem;
		word-break: break-all;
	}
	.error {
		margin: 0;
		padding: 0.55rem 0.85rem;
		border-radius: 0.5rem;
		background: rgba(239, 68, 68, 0.1);
		color: #ef4444;
		font-size: 0.9rem;
	}
	.actions {
		display: flex;
		gap: 0.5rem;
	}
	.primary {
		padding: 0.6rem 1.1rem;
		border-radius: 0.55rem;
		border: 1px solid #f97316;
		background: #f97316;
		color: white;
		font: inherit;
		font-weight: 500;
		cursor: pointer;
	}
	.primary:hover:not(:disabled) {
		background: #ea580c;
		border-color: #ea580c;
	}
	.primary:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.hint {
		margin: 0;
		color: var(--color-text-muted, #64748b);
		font-size: 0.82rem;
		line-height: 1.45;
	}
</style>
