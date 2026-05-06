<!--
  JobDetailView — live progress of a bulk-import job. Drives the
  /articles/import/[jobId] route.

  Header: status, total, counters, action bar (pause/resume/cancel/retry).
  Body:   per-item rows with state pill + URL + action link.

  Plan: docs/plans/articles-bulk-import.md.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { _ } from 'svelte-i18n';
	import { articleImportsStore } from '../stores/imports.svelte';
	import { useImportItems, useImportJob } from '../queries';
	import type { ArticleImportItem, ArticleImportItemState } from '../types';

	interface Props {
		jobId: string;
	}
	let { jobId }: Props = $props();

	const job$ = $derived(useImportJob(jobId));
	const items$ = $derived(useImportItems(jobId));
	const job = $derived(job$.value);
	const items = $derived(items$.value);

	let busyAction = $state<string | null>(null);

	const totalDone = $derived(job ? job.savedCount + job.duplicateCount + job.errorCount : 0);
	const progressPct = $derived(
		job && job.totalUrls > 0 ? Math.round((totalDone / job.totalUrls) * 100) : 0
	);

	async function withBusy(name: string, fn: () => Promise<unknown>) {
		busyAction = name;
		try {
			await fn();
		} finally {
			busyAction = null;
		}
	}

	function statePill(state: ArticleImportItemState): { label: string; klass: string } {
		switch (state) {
			case 'pending':
				return { label: $_('articles.import.item_pending'), klass: 'pill-pending' };
			case 'extracting':
				return { label: $_('articles.import.item_extracting'), klass: 'pill-extracting' };
			case 'extracted':
				return { label: $_('articles.import.item_extracted'), klass: 'pill-extracted' };
			case 'saved':
				return { label: $_('articles.import.item_saved'), klass: 'pill-saved' };
			case 'duplicate':
				return { label: $_('articles.import.item_duplicate'), klass: 'pill-dup' };
			case 'consent-wall':
				return { label: $_('articles.import.item_consent_wall'), klass: 'pill-warn' };
			case 'error':
				return { label: $_('articles.import.item_error'), klass: 'pill-error' };
			case 'cancelled':
				return { label: $_('articles.import.item_cancelled'), klass: 'pill-cancelled' };
		}
	}

	function shortUrl(item: ArticleImportItem): string {
		try {
			const u = new URL(item.url);
			return u.host + u.pathname.replace(/\/$/, '');
		} catch {
			return item.url;
		}
	}
</script>

<div class="job-shell">
	{#if !job}
		<p class="empty">{$_('articles.import.detail_not_found')}</p>
	{:else}
		{@const j = job}
		<header class="header">
			<div class="title-row">
				<h1>{$_('articles.import.detail_title')}</h1>
				<span class="status status-{j.status}">{j.status}</span>
			</div>
			<div class="progress-bar" aria-label={$_('articles.import.detail_progress_aria')}>
				<div class="progress-fill" style="width: {progressPct}%"></div>
			</div>
			<div class="counters">
				<span class="counter">
					{$_('articles.import.detail_counter_total', {
						values: { done: totalDone, total: j.totalUrls },
					})}
				</span>
				{#if j.savedCount > 0}
					<span class="counter ok">
						{$_('articles.import.detail_counter_saved', { values: { n: j.savedCount } })}
					</span>
				{/if}
				{#if j.duplicateCount > 0}
					<span class="counter dup">
						{$_('articles.import.detail_counter_dups', { values: { n: j.duplicateCount } })}
					</span>
				{/if}
				{#if j.warningCount > 0}
					<span class="counter warn">
						{$_('articles.import.detail_counter_warns', { values: { n: j.warningCount } })}
					</span>
				{/if}
				{#if j.errorCount > 0}
					<span class="counter err">
						{$_('articles.import.detail_counter_errors', { values: { n: j.errorCount } })}
					</span>
				{/if}
			</div>

			<div class="actions">
				{#if j.status === 'running' || j.status === 'queued'}
					<button
						type="button"
						class="secondary"
						disabled={busyAction !== null}
						onclick={() => withBusy('pause', () => articleImportsStore.pauseJob(jobId))}
					>
						{$_('articles.import.action_pause')}
					</button>
				{/if}
				{#if j.status === 'paused'}
					<button
						type="button"
						class="primary"
						disabled={busyAction !== null}
						onclick={() => withBusy('resume', () => articleImportsStore.resumeJob(jobId))}
					>
						{$_('articles.import.action_resume')}
					</button>
				{/if}
				{#if j.status === 'running' || j.status === 'queued' || j.status === 'paused'}
					<button
						type="button"
						class="danger"
						disabled={busyAction !== null}
						onclick={() => {
							if (confirm($_('articles.import.confirm_cancel')))
								void withBusy('cancel', () => articleImportsStore.cancelJob(jobId));
						}}
					>
						{$_('articles.import.action_cancel')}
					</button>
				{/if}
				{#if j.errorCount > 0}
					<button
						type="button"
						class="secondary"
						disabled={busyAction !== null}
						onclick={() => withBusy('retry', () => articleImportsStore.retryFailed(jobId))}
					>
						{$_('articles.import.action_retry')}
					</button>
				{/if}
				{#if j.status === 'done' || j.status === 'cancelled'}
					<button
						type="button"
						class="ghost"
						disabled={busyAction !== null}
						onclick={() => {
							if (confirm($_('articles.import.confirm_delete'))) {
								void withBusy('delete', async () => {
									await articleImportsStore.deleteJob(jobId);
									goto('/articles/import');
								});
							}
						}}
					>
						{$_('articles.import.action_delete')}
					</button>
				{/if}
			</div>
		</header>

		{#if j.warningCount > 0}
			<aside class="consent-hint" role="note">
				<strong>{$_('articles.import.consent_hint_strong')}</strong>:
				{$_('articles.import.consent_hint_body', { values: { n: j.warningCount } })}
				<a href="/articles/settings">{$_('articles.import.consent_hint_link')}</a>
				{$_('articles.import.consent_hint_after_link')}
			</aside>
		{/if}

		<ul class="items">
			{#each items as item (item.id)}
				{@const pill = statePill(item.state)}
				<li class="item">
					<span class="pill {pill.klass}">{pill.label}</span>
					<span class="url" title={item.url}>{shortUrl(item)}</span>
					{#if item.state === 'consent-wall' && item.articleId}
						<span class="action-group">
							<a class="action" href="/articles/{item.articleId}">
								{$_('articles.import.item_action_view_teaser')}
							</a>
							<a
								class="action action-rescue"
								href={`/articles/add?source=bookmarklet&url=${encodeURIComponent(item.url)}`}
								title={$_('articles.import.item_action_rescue_tip')}
							>
								{$_('articles.import.item_action_rescue')}
							</a>
						</span>
					{:else if item.articleId && (item.state === 'saved' || item.state === 'duplicate')}
						<a class="action" href="/articles/{item.articleId}">
							{$_('articles.import.item_action_open')}
						</a>
					{:else if item.state === 'error' && item.error}
						<span class="error-msg" title={item.error}>{item.error}</span>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.job-shell {
		max-width: 920px;
		margin: 0 auto;
		padding: 1.5rem;
	}
	.empty {
		color: var(--color-text-muted, #64748b);
	}
	.header {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		margin-bottom: 1.25rem;
	}
	.title-row {
		display: flex;
		gap: 0.6rem;
		align-items: baseline;
	}
	.title-row h1 {
		margin: 0;
		font-size: 1.45rem;
	}
	.status {
		font-size: 0.75rem;
		padding: 0.12rem 0.55rem;
		border-radius: 999px;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		font-weight: 600;
	}
	.status-queued,
	.status-paused {
		background: color-mix(in srgb, #64748b 14%, transparent);
		color: #475569;
	}
	.status-running {
		background: color-mix(in srgb, #f97316 16%, transparent);
		color: #ea580c;
	}
	.status-done {
		background: color-mix(in srgb, #16a34a 14%, transparent);
		color: #16a34a;
	}
	.status-cancelled {
		background: rgba(239, 68, 68, 0.14);
		color: #ef4444;
	}
	.progress-bar {
		height: 6px;
		border-radius: 999px;
		background: color-mix(in srgb, currentColor 8%, transparent);
		overflow: hidden;
	}
	.progress-fill {
		height: 100%;
		background: #f97316;
		transition: width 220ms ease;
	}
	.counters {
		display: flex;
		gap: 0.35rem;
		flex-wrap: wrap;
		font-size: 0.85rem;
	}
	.counter {
		padding: 0.12rem 0.55rem;
		border-radius: 999px;
		background: color-mix(in srgb, currentColor 6%, transparent);
	}
	.counter.ok {
		color: #16a34a;
	}
	.counter.dup {
		color: var(--color-text-muted, #64748b);
	}
	.counter.warn {
		color: #b45309;
	}
	.counter.err {
		color: #ef4444;
	}
	.actions {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
	}
	.actions button {
		padding: 0.4rem 0.85rem;
		border-radius: 0.45rem;
		border: 1px solid var(--color-border, rgba(0, 0, 0, 0.15));
		background: transparent;
		color: inherit;
		font: inherit;
		font-size: 0.85rem;
		cursor: pointer;
	}
	.actions .primary {
		background: #f97316;
		border-color: #f97316;
		color: white;
	}
	.actions .primary:hover:not(:disabled) {
		background: #ea580c;
	}
	.actions .danger:hover:not(:disabled) {
		border-color: #ef4444;
		color: #ef4444;
	}
	.actions .ghost {
		opacity: 0.7;
	}
	.actions button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.items {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
	}
	.item {
		display: grid;
		grid-template-columns: 9rem 1fr auto;
		gap: 0.65rem;
		align-items: center;
		padding: 0.4rem 0.7rem;
		border: 1px solid var(--color-border, rgba(0, 0, 0, 0.08));
		border-radius: 0.45rem;
		font-size: 0.88rem;
	}
	.pill {
		font-size: 0.76rem;
		padding: 0.1rem 0.5rem;
		border-radius: 999px;
		text-align: center;
		white-space: nowrap;
	}
	.pill-pending {
		background: color-mix(in srgb, #64748b 10%, transparent);
		color: #64748b;
	}
	.pill-extracting,
	.pill-extracted {
		background: color-mix(in srgb, #f97316 12%, transparent);
		color: #ea580c;
	}
	.pill-saved {
		background: color-mix(in srgb, #16a34a 14%, transparent);
		color: #16a34a;
	}
	.pill-dup {
		background: color-mix(in srgb, #64748b 12%, transparent);
		color: #475569;
	}
	.pill-warn {
		background: color-mix(in srgb, #f59e0b 14%, transparent);
		color: #b45309;
	}
	.pill-error {
		background: rgba(239, 68, 68, 0.14);
		color: #ef4444;
	}
	.pill-cancelled {
		background: color-mix(in srgb, #64748b 8%, transparent);
		color: #64748b;
		opacity: 0.7;
	}
	.url {
		font-family: 'SF Mono', Menlo, Consolas, monospace;
		font-size: 0.82rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.action {
		font-size: 0.82rem;
		color: #ea580c;
		text-decoration: none;
	}
	.action:hover {
		text-decoration: underline;
	}
	.action-group {
		display: inline-flex;
		gap: 0.65rem;
	}
	.action-rescue {
		color: #b45309;
	}
	.consent-hint {
		margin: 0 0 0.75rem 0;
		padding: 0.55rem 0.85rem;
		border-radius: 0.5rem;
		border: 1px solid color-mix(in srgb, #f59e0b 35%, transparent);
		background: color-mix(in srgb, #f59e0b 8%, transparent);
		font-size: 0.85rem;
		line-height: 1.5;
	}
	.consent-hint a {
		color: #b45309;
		text-decoration: underline;
	}
	.error-msg {
		font-size: 0.78rem;
		color: #ef4444;
		max-width: 18rem;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
