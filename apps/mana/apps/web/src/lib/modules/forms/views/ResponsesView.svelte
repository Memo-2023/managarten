<!--
  Forms — ResponsesView (M3)

  Tabular display of every response for one form. Header row with
  status filter + CSV export + count. Click a row → open detail modal.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { _ } from 'svelte-i18n';
	import { onMount } from 'svelte';
	import { useFormResponses } from '../queries';
	import { downloadResponsesCsv } from '../lib/csv';
	import { runAutoSyncSweep } from '../lib/auto-sync';
	import { cohortLabel, sortCohortsDesc } from '../lib/cohort';
	import { RESPONSE_STATUS_LABELS } from '../types';
	import type { Form, FormResponse, ResponseStatus } from '../types';
	import ResponseDetailModal from '../components/ResponseDetailModal.svelte';

	let { form }: { form: Form } = $props();

	// svelte-ignore state_referenced_locally
	const responses$ = useFormResponses(form.id);
	const responses = $derived(responses$.value);

	let autoSyncSummary = $state<string | null>(null);

	// Auto-sync sweep on mount + every time the response list updates.
	// Idempotent — runs only on responses without syncedTargets entry
	// for the configured target. See lib/auto-sync.ts.
	onMount(() => {
		void triggerAutoSync();
	});

	$effect(() => {
		// Recompute on response-list change. The sweep itself is a
		// no-op when nothing is unsynced.
		void responses;
		void triggerAutoSync();
	});

	async function triggerAutoSync() {
		if (!form.settings.autoSync?.target) return;
		try {
			const result = await runAutoSyncSweep();
			if (result.synced > 0) {
				autoSyncSummary = `${result.synced} Antwort(en) automatisch synchronisiert.`;
				setTimeout(() => (autoSyncSummary = null), 4000);
			}
		} catch (err) {
			autoSyncSummary = `Auto-Sync-Fehler: ${(err as Error).message}`;
		}
	}

	type FilterTab = 'all' | ResponseStatus;
	let activeTab = $state<FilterTab>('all');
	let activeCohort = $state<string | null>(null);

	const recurrenceFrequency = $derived(form.settings.recurrence?.frequency ?? null);

	/** Distinct cohorts present on the response set, newest-first. */
	const cohorts = $derived(
		recurrenceFrequency
			? sortCohortsDesc(
					Array.from(new Set(responses.map((r) => r.cohort).filter((c): c is string => !!c)))
				)
			: []
	);

	const cohortFiltered = $derived(
		activeCohort ? responses.filter((r) => r.cohort === activeCohort) : responses
	);

	const counts = $derived({
		all: cohortFiltered.length,
		new: cohortFiltered.filter((r) => r.status === 'new').length,
		reviewed: cohortFiltered.filter((r) => r.status === 'reviewed').length,
		archived: cohortFiltered.filter((r) => r.status === 'archived').length,
		spam: cohortFiltered.filter((r) => r.status === 'spam').length,
	});

	const filtered = $derived(
		activeTab === 'all' ? cohortFiltered : cohortFiltered.filter((r) => r.status === activeTab)
	);

	function selectCohort(cohort: string | null) {
		activeCohort = cohort;
	}

	let detailResponseId = $state<string | null>(null);
	const detailResponse = $derived(
		detailResponseId ? responses.find((r) => r.id === detailResponseId) : null
	);

	function openDetail(r: FormResponse) {
		detailResponseId = r.id;
	}

	function closeDetail() {
		detailResponseId = null;
	}

	function handleExport() {
		downloadResponsesCsv(form, filtered);
	}

	function answerSnippet(r: FormResponse): string {
		const firstField = form.fields.find((f) => f.type !== 'section' && f.type !== 'consent');
		if (!firstField) return '';
		const v = r.answers[firstField.id];
		if (v === null || v === undefined) return '';
		const str = Array.isArray(v) ? v.join(', ') : String(v);
		return str.length > 60 ? str.slice(0, 57) + '...' : str;
	}

	function formatTime(iso: string): string {
		const d = new Date(iso);
		return d.toLocaleString();
	}
</script>

<div class="responses-view">
	<header class="top-bar">
		<button type="button" class="back" onclick={() => goto(`/forms/${form.id}`)}>
			{$_('forms.responses.back', { default: '← Zum Builder' })}
		</button>
		<h1 class="title">
			{$_('forms.responses.title', {
				default: 'Antworten — {form}',
				values: { form: form.title },
			})}
		</h1>
		<button
			type="button"
			class="export"
			onclick={handleExport}
			disabled={filtered.length === 0}
			title={$_('forms.responses.exportTitle', { default: 'CSV herunterladen' })}
		>
			{$_('forms.responses.export', { default: 'CSV-Export' })}
		</button>
	</header>

	{#if autoSyncSummary}
		<p class="auto-sync-toast">{autoSyncSummary}</p>
	{/if}

	{#if recurrenceFrequency && cohorts.length > 0}
		<div class="cohort-bar" role="group" aria-label="Wellen">
			<button
				type="button"
				class="cohort-chip"
				class:active={activeCohort === null}
				onclick={() => selectCohort(null)}
			>
				{$_('forms.responses.cohort.all', { default: 'Alle Wellen' })}
				<span class="cohort-count">{responses.length}</span>
			</button>
			{#each cohorts as c (c)}
				{@const cCount = responses.filter((r) => r.cohort === c).length}
				<button
					type="button"
					class="cohort-chip"
					class:active={activeCohort === c}
					onclick={() => selectCohort(c)}
				>
					{cohortLabel(c, recurrenceFrequency)}
					<span class="cohort-count">{cCount}</span>
				</button>
			{/each}
		</div>
	{/if}

	<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -->
	<nav class="tabs" role="tablist">
		{#each [['all', counts.all], ['new', counts.new], ['reviewed', counts.reviewed], ['archived', counts.archived], ['spam', counts.spam]] as const as [tab, count]}
			<button
				type="button"
				role="tab"
				aria-selected={activeTab === tab}
				class="tab"
				class:active={activeTab === tab}
				onclick={() => (activeTab = tab as FilterTab)}
			>
				<span class="tab-label">
					{tab === 'all'
						? $_('forms.responses.tabs.all', { default: 'Alle' })
						: RESPONSE_STATUS_LABELS[tab as ResponseStatus].de}
				</span>
				<span class="tab-count">{count}</span>
			</button>
		{/each}
	</nav>

	{#if responses$.loading}
		<p class="state">{$_('forms.responses.loading', { default: 'Lade Antworten ...' })}</p>
	{:else if filtered.length === 0}
		<div class="empty">
			{#if activeTab === 'all'}
				<p class="empty-title">
					{$_('forms.responses.emptyAll', { default: 'Noch keine Antworten.' })}
				</p>
				<p class="empty-hint">
					{$_('forms.responses.emptyHint', {
						default: 'Veröffentliche das Formular und teile den Link, um Antworten zu sammeln.',
					})}
				</p>
			{:else}
				<p class="empty-title">
					{$_('forms.responses.emptyTab', {
						default: 'Keine Antworten in dieser Ansicht.',
					})}
				</p>
			{/if}
		</div>
	{:else}
		<table class="response-table">
			<thead>
				<tr>
					<th>{$_('forms.responses.col.submittedAt', { default: 'Eingegangen' })}</th>
					<th>{$_('forms.responses.col.status', { default: 'Status' })}</th>
					<th>{$_('forms.responses.col.submitter', { default: 'Absender' })}</th>
					<th>{$_('forms.responses.col.snippet', { default: 'Antwort' })}</th>
				</tr>
			</thead>
			<tbody>
				{#each filtered as r (r.id)}
					<tr onclick={() => openDetail(r)} role="button" tabindex="0">
						<td class="time">{formatTime(r.submittedAt)}</td>
						<td>
							<span class="status-chip" data-status={r.status}>
								{RESPONSE_STATUS_LABELS[r.status].de}
							</span>
						</td>
						<td class="submitter">
							{#if r.submitterName}
								{r.submitterName}
							{:else if r.submitterEmail}
								{r.submitterEmail}
							{:else}
								<span class="muted">{$_('forms.responses.anonymous', { default: 'Anonym' })}</span>
							{/if}
						</td>
						<td class="snippet">{answerSnippet(r)}</td>
					</tr>
				{/each}
			</tbody>
		</table>
	{/if}
</div>

{#if detailResponse}
	<ResponseDetailModal {form} response={detailResponse} onclose={closeDetail} />
{/if}

<style>
	.responses-view {
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
		padding: 1rem;
		max-width: 960px;
		margin: 0 auto;
	}

	.top-bar {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		flex-wrap: wrap;
	}

	.back {
		padding: 0.375rem 0.625rem;
		background: rgb(255 255 255 / 0.04);
		border: 1px solid rgb(255 255 255 / 0.08);
		border-radius: 0.375rem;
		color: inherit;
		font-size: 0.8125rem;
		cursor: pointer;
	}

	.back:hover {
		background: rgb(255 255 255 / 0.07);
	}

	.title {
		flex: 1;
		min-width: 200px;
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
	}

	.export {
		padding: 0.375rem 0.75rem;
		background: rgb(20 184 166 / 0.12);
		border: 1px solid rgb(20 184 166 / 0.3);
		border-radius: 0.375rem;
		color: rgb(94 234 212);
		font-size: 0.8125rem;
		cursor: pointer;
	}

	.export:hover {
		background: rgb(20 184 166 / 0.2);
	}

	.export:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.auto-sync-toast {
		margin: 0;
		padding: 0.5rem 0.75rem;
		background: rgb(20 184 166 / 0.14);
		border: 1px solid rgb(20 184 166 / 0.3);
		border-radius: 0.375rem;
		color: rgb(94 234 212);
		font-size: 0.8125rem;
	}

	.cohort-bar {
		display: flex;
		gap: 0.25rem;
		flex-wrap: wrap;
	}

	.cohort-chip {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.25rem 0.625rem;
		background: rgb(255 255 255 / 0.04);
		border: 1px solid rgb(255 255 255 / 0.08);
		border-radius: 999px;
		color: rgb(255 255 255 / 0.55);
		font-size: 0.75rem;
		cursor: pointer;
	}

	.cohort-chip:hover {
		background: rgb(255 255 255 / 0.07);
	}

	.cohort-chip.active {
		background: rgb(20 184 166 / 0.18);
		color: rgb(94 234 212);
		border-color: rgb(20 184 166 / 0.4);
	}

	.cohort-count {
		min-width: 0.875rem;
		text-align: center;
		font-variant-numeric: tabular-nums;
		font-size: 0.6875rem;
		opacity: 0.7;
	}

	.tabs {
		display: flex;
		gap: 0.25rem;
		flex-wrap: wrap;
	}

	.tab {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.625rem;
		background: rgb(255 255 255 / 0.04);
		border: 1px solid rgb(255 255 255 / 0.08);
		border-radius: 0.375rem;
		color: rgb(255 255 255 / 0.55);
		font-size: 0.8125rem;
		cursor: pointer;
	}

	.tab:hover {
		background: rgb(255 255 255 / 0.07);
	}

	.tab.active {
		background: rgb(20 184 166 / 0.16);
		color: rgb(94 234 212);
		border-color: rgb(20 184 166 / 0.4);
	}

	.tab-count {
		min-width: 1rem;
		text-align: center;
		font-variant-numeric: tabular-nums;
		font-size: 0.6875rem;
		padding: 0.125rem 0.375rem;
		background: rgb(255 255 255 / 0.06);
		border-radius: 999px;
	}

	.empty {
		text-align: center;
		padding: 3rem 1rem;
		color: rgb(255 255 255 / 0.5);
	}

	.empty-title {
		font-size: 0.9375rem;
		margin: 0 0 0.5rem;
	}

	.empty-hint {
		font-size: 0.8125rem;
		color: rgb(255 255 255 / 0.4);
		margin: 0;
	}

	.state {
		text-align: center;
		padding: 2rem;
		color: rgb(255 255 255 / 0.5);
	}

	.response-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.8125rem;
	}

	.response-table th {
		text-align: left;
		padding: 0.5rem 0.625rem;
		background: rgb(255 255 255 / 0.03);
		font-weight: 500;
		color: rgb(255 255 255 / 0.55);
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		border-bottom: 1px solid rgb(255 255 255 / 0.08);
	}

	.response-table td {
		padding: 0.625rem;
		border-bottom: 1px solid rgb(255 255 255 / 0.04);
	}

	.response-table tbody tr {
		cursor: pointer;
	}

	.response-table tbody tr:hover {
		background: rgb(255 255 255 / 0.04);
	}

	.time {
		font-variant-numeric: tabular-nums;
		color: rgb(255 255 255 / 0.6);
		white-space: nowrap;
	}

	.status-chip {
		display: inline-block;
		padding: 0.125rem 0.5rem;
		border-radius: 999px;
		font-size: 0.6875rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.status-chip[data-status='new'] {
		background: rgb(20 184 166 / 0.18);
		color: rgb(94 234 212);
	}

	.status-chip[data-status='reviewed'] {
		background: rgb(255 255 255 / 0.08);
		color: rgb(255 255 255 / 0.7);
	}

	.status-chip[data-status='archived'] {
		background: rgb(255 255 255 / 0.04);
		color: rgb(255 255 255 / 0.4);
	}

	.status-chip[data-status='spam'] {
		background: rgb(248 113 113 / 0.18);
		color: rgb(252 165 165);
	}

	.submitter {
		max-width: 200px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.muted {
		color: rgb(255 255 255 / 0.35);
	}

	.snippet {
		color: rgb(255 255 255 / 0.7);
		max-width: 320px;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
</style>
