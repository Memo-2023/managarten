<!--
  JobsList — index of all bulk-import jobs in the active space, newest
  first. Click → /articles/import/[jobId].

  Plan: docs/plans/articles-bulk-import.md.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { _ } from 'svelte-i18n';
	import { useImportJobs } from '../queries';
	import type { ArticleImportJob } from '../types';

	type Filter = 'all' | 'active' | 'done' | 'errors';

	const jobs$ = useImportJobs();
	const allJobs = $derived(jobs$.value);
	let filter = $state<Filter>('all');

	const activeCount = $derived(
		allJobs.filter((j) => j.status === 'queued' || j.status === 'running' || j.status === 'paused')
			.length
	);
	const doneCount = $derived(allJobs.filter((j) => j.status === 'done').length);
	const errorCount = $derived(allJobs.filter((j) => j.errorCount > 0).length);

	const visibleJobs = $derived(
		filter === 'all'
			? allJobs
			: filter === 'active'
				? allJobs.filter(
						(j) => j.status === 'queued' || j.status === 'running' || j.status === 'paused'
					)
				: filter === 'done'
					? allJobs.filter((j) => j.status === 'done')
					: allJobs.filter((j) => j.errorCount > 0)
	);

	function progress(job: ArticleImportJob): string {
		const done = job.savedCount + job.duplicateCount + job.errorCount;
		return `${done} / ${job.totalUrls}`;
	}

	function statusLabel(s: ArticleImportJob['status']): string {
		switch (s) {
			case 'queued':
				return $_('articles.import.status_queued');
			case 'running':
				return $_('articles.import.status_running');
			case 'paused':
				return $_('articles.import.status_paused');
			case 'done':
				return $_('articles.import.status_done');
			case 'cancelled':
				return $_('articles.import.status_cancelled');
		}
	}
</script>

{#if allJobs.length > 0}
	<section class="jobs-list">
		<header class="list-header">
			<h2>{$_('articles.import.jobs_heading')}</h2>
			<nav class="filter-tabs" aria-label="Filter">
				<button
					type="button"
					class="tab"
					class:tab-active={filter === 'all'}
					onclick={() => (filter = 'all')}
				>
					{$_('articles.import.filter_all', { values: { n: allJobs.length } })}
				</button>
				<button
					type="button"
					class="tab"
					class:tab-active={filter === 'active'}
					onclick={() => (filter = 'active')}
					disabled={activeCount === 0}
				>
					{$_('articles.import.filter_active', { values: { n: activeCount } })}
				</button>
				<button
					type="button"
					class="tab"
					class:tab-active={filter === 'done'}
					onclick={() => (filter = 'done')}
					disabled={doneCount === 0}
				>
					{$_('articles.import.filter_done', { values: { n: doneCount } })}
				</button>
				<button
					type="button"
					class="tab"
					class:tab-active={filter === 'errors'}
					onclick={() => (filter = 'errors')}
					disabled={errorCount === 0}
				>
					{$_('articles.import.filter_errors', { values: { n: errorCount } })}
				</button>
			</nav>
		</header>
		{#if visibleJobs.length === 0}
			<p class="empty-filter">{$_('articles.import.empty_filter')}</p>
		{/if}
		<ul>
			{#each visibleJobs as job (job.id)}
				<button type="button" class="row" onclick={() => goto(`/articles/import/${job.id}`)}>
					<span class="status status-{job.status}">{statusLabel(job.status)}</span>
					<span class="progress">{progress(job)}</span>
					<span class="meta">
						{#if job.errorCount > 0}
							<span class="meta-err">
								{$_('articles.import.jobs_meta_errors', { values: { n: job.errorCount } })}
							</span>
						{/if}
						{#if job.duplicateCount > 0}
							<span class="meta-dup">
								{$_('articles.import.jobs_meta_dups', { values: { n: job.duplicateCount } })}
							</span>
						{/if}
						{#if job.warningCount > 0}
							<span class="meta-warn">
								{$_('articles.import.jobs_meta_warnings', { values: { n: job.warningCount } })}
							</span>
						{/if}
					</span>
					<span class="when">{new Date(job.createdAt).toLocaleString()}</span>
				</button>
			{/each}
		</ul>
	</section>
{/if}

<style>
	.jobs-list {
		max-width: 760px;
		margin: 1.5rem auto 0;
		padding: 0 1.5rem;
	}
	.list-header {
		display: flex;
		gap: 0.85rem;
		align-items: baseline;
		flex-wrap: wrap;
		margin-bottom: 0.65rem;
	}
	.jobs-list h2 {
		margin: 0;
		font-size: 1.05rem;
	}
	.filter-tabs {
		display: flex;
		gap: 0.25rem;
		flex-wrap: wrap;
	}
	.tab {
		padding: 0.18rem 0.55rem;
		border-radius: 999px;
		border: 1px solid var(--color-border, rgba(0, 0, 0, 0.12));
		background: transparent;
		color: var(--color-text-muted, #64748b);
		font: inherit;
		font-size: 0.78rem;
		cursor: pointer;
	}
	.tab:hover:not(:disabled) {
		border-color: color-mix(in srgb, #f97316 60%, transparent);
		color: inherit;
	}
	.tab:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}
	.tab-active {
		background: #f97316;
		color: white;
		border-color: #f97316;
	}
	.tab-active:hover:not(:disabled) {
		background: #ea580c;
		color: white;
	}
	.empty-filter {
		margin: 0.5rem 0 0 0;
		color: var(--color-text-muted, #64748b);
		font-size: 0.85rem;
	}
	.jobs-list ul {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
	}
	.row {
		display: grid;
		grid-template-columns: 6rem 5rem 1fr auto;
		gap: 0.65rem;
		align-items: center;
		padding: 0.55rem 0.75rem;
		border: 1px solid var(--color-border, rgba(0, 0, 0, 0.1));
		border-radius: 0.55rem;
		background: var(--color-surface, transparent);
		font: inherit;
		text-align: left;
		cursor: pointer;
	}
	.row:hover {
		border-color: color-mix(in srgb, #f97316 60%, transparent);
	}
	.status {
		font-size: 0.78rem;
		font-weight: 500;
		padding: 0.12rem 0.5rem;
		border-radius: 999px;
		text-align: center;
	}
	.status-queued,
	.status-paused {
		background: color-mix(in srgb, #64748b 12%, transparent);
		color: #475569;
	}
	.status-running {
		background: color-mix(in srgb, #f97316 14%, transparent);
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
	.progress {
		font-variant-numeric: tabular-nums;
		font-size: 0.9rem;
	}
	.meta {
		display: flex;
		gap: 0.4rem;
		flex-wrap: wrap;
		font-size: 0.78rem;
		color: var(--color-text-muted, #64748b);
	}
	.meta-err {
		color: #ef4444;
	}
	.meta-warn {
		color: #b45309;
	}
	.meta-dup {
		color: var(--color-text-muted, #64748b);
	}
	.when {
		font-size: 0.78rem;
		color: var(--color-text-muted, #64748b);
		white-space: nowrap;
	}
</style>
