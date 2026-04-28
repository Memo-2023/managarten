<!--
  AI Missions app — workbench card.
  Renders inside AppPage, which provides the ModuleShell + window chrome.
  Master-detail inline (list ↔ create ↔ detail) in a single panel.
-->
<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { formatDateTime } from '$lib/i18n/format';
	import { ArrowLeft, Play, Pause, Check, Trash, Plus } from '@mana/shared-icons';
	import { useMissions } from '$lib/data/ai/missions/queries';
	import {
		createMission,
		pauseMission,
		resumeMission,
		completeMission,
		deleteMission,
		addIterationFeedback,
		revokeMissionGrant,
		requestIterationCancel,
	} from '$lib/data/ai/missions/store';
	import { onDestroy } from 'svelte';
	import { runMission } from '$lib/data/ai/missions/runner';
	import { productionDeps } from '$lib/data/ai/missions/setup';
	import MissionInputPicker from '$lib/components/ai/MissionInputPicker.svelte';
	import MissionGrantDialog from '$lib/components/ai/MissionGrantDialog.svelte';
	import AgentPicker from '$lib/components/ai/AgentPicker.svelte';
	import AiDebugBlock from '$lib/components/ai/AiDebugBlock.svelte';
	import { isAiDebugEnabled, setAiDebugEnabled } from '$lib/data/ai/missions/debug';
	import { isMissionGrantsEnabled } from '$lib/api/config';
	import type { Mission, MissionCadence, MissionInputRef } from '$lib/data/ai/missions/types';

	const missions = $derived(useMissions());

	let mode = $state<'list' | 'create' | 'detail'>('list');
	let selectedId = $state<string | null>(null);
	let debugEnabled = $state(isAiDebugEnabled());

	function toggleDebug() {
		debugEnabled = !debugEnabled;
		setAiDebugEnabled(debugEnabled);
	}
	const selected = $derived(
		selectedId ? (missions.value.find((m) => m.id === selectedId) ?? null) : null
	);

	let formTitle = $state('');
	let formObjective = $state('');
	let formConcept = $state('');
	let formCadenceKind = $state<MissionCadence['kind']>('manual');
	let formIntervalMin = $state(60);
	let formDailyHour = $state(9);
	let formInputs = $state<MissionInputRef[]>([]);
	let formAgentId = $state<string | undefined>(undefined);
	let creating = $state(false);

	function buildCadence(): MissionCadence {
		switch (formCadenceKind) {
			case 'manual':
				return { kind: 'manual' };
			case 'interval':
				return { kind: 'interval', everyMinutes: formIntervalMin };
			case 'daily':
				return { kind: 'daily', atHour: formDailyHour, atMinute: 0 };
			case 'weekly':
				return { kind: 'weekly', dayOfWeek: 1, atHour: formDailyHour };
			case 'cron':
				return { kind: 'cron', expression: '' };
		}
	}

	async function handleCreate() {
		if (!formTitle.trim() || !formObjective.trim()) return;
		creating = true;
		try {
			const m = await createMission({
				title: formTitle.trim(),
				objective: formObjective.trim(),
				conceptMarkdown: formConcept,
				inputs: formInputs,
				cadence: buildCadence(),
				agentId: formAgentId,
			});
			formTitle = '';
			formObjective = '';
			formConcept = '';
			formInputs = [];
			formAgentId = undefined;
			formCadenceKind = 'manual';
			selectedId = m.id;
			mode = 'detail';
		} finally {
			creating = false;
		}
	}

	let runningNow = $state(false);
	async function handleRunNow(m: Mission) {
		runningNow = true;
		try {
			await runMission(m.id, productionDeps);
		} catch (err) {
			console.error(err);
		} finally {
			runningNow = false;
		}
	}

	let feedbackDraft = $state('');
	async function handleFeedback(m: Mission, iterationId: string) {
		if (!feedbackDraft.trim()) return;
		await addIterationFeedback(m.id, iterationId, feedbackDraft.trim());
		feedbackDraft = '';
	}

	// ── Key-Grant (server-side execution) ──────────────────
	const ENCRYPTED_SERVER_TABLES = new Set(['notes', 'tasks', 'events', 'journalEntries']);
	function hasEncryptedInputs(m: Mission): boolean {
		return m.inputs.some((i) => ENCRYPTED_SERVER_TABLES.has(i.table));
	}
	const grantsEnabled = $derived(isMissionGrantsEnabled());
	function grantStatus(m: Mission): 'none' | 'active' | 'expired' {
		if (!m.grant) return 'none';
		return Date.parse(m.grant.expiresAt) < Date.now() ? 'expired' : 'active';
	}
	function formatGrantExpiry(m: Mission): string {
		if (!m.grant) return '—';
		return formatRelative(m.grant.expiresAt);
	}
	let grantDialogOpen = $state(false);

	function describeCadence(c: MissionCadence): string {
		switch (c.kind) {
			case 'manual':
				return $_('ai-missions.list_view.cadence_describe_manual');
			case 'interval':
				return $_('ai-missions.list_view.cadence_describe_interval', {
					values: { minutes: c.everyMinutes },
				});
			case 'daily':
				return $_('ai-missions.list_view.cadence_describe_daily', {
					values: {
						hh: String(c.atHour).padStart(2, '0'),
						mm: String(c.atMinute).padStart(2, '0'),
					},
				});
			case 'weekly':
				return $_('ai-missions.list_view.cadence_describe_weekly', {
					values: { day: c.dayOfWeek, hour: c.atHour },
				});
			case 'cron':
				return $_('ai-missions.list_view.cadence_describe_cron', {
					values: { expression: c.expression },
				});
		}
	}
	function describeState(s: Mission['state']): string {
		return $_('ai-missions.list_view.state_' + s);
	}
	function formatRelative(iso: string | undefined): string {
		if (!iso) return $_('ai-missions.list_view.none_dash');
		const d = new Date(iso);
		const deltaMs = d.getTime() - Date.now();
		const mins = Math.round(Math.abs(deltaMs) / 60_000);
		const hours = Math.round(mins / 60);
		const days = Math.round(hours / 24);
		const value = mins < 60 ? `${mins}m` : hours < 24 ? `${hours}h` : `${days}d`;
		return deltaMs < 0
			? $_('ai-missions.list_view.relative_past', { values: { value } })
			: $_('ai-missions.list_view.relative_future', { values: { value } });
	}

	function openDetail(id: string) {
		selectedId = id;
		mode = 'detail';
	}

	// ── Live elapsed-time ticker for `running` iterations ────────
	// $state-backed `now` updates every second; any $derived that reads
	// it gets recomputed, so the UI counter ticks without a Dexie write.
	let now = $state(Date.now());
	const tickHandle = setInterval(() => (now = Date.now()), 1000);
	onDestroy(() => clearInterval(tickHandle));

	function elapsedSeconds(iso: string): number {
		return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
	}

	function formatElapsed(seconds: number): string {
		if (seconds < 60) return `${seconds}s`;
		const m = Math.floor(seconds / 60);
		const s = seconds % 60;
		return `${m}m ${String(s).padStart(2, '0')}s`;
	}

	const PHASE_KEY_MAP: Record<string, string> = {
		'resolving-inputs': 'phase_resolving_inputs',
		'calling-llm': 'phase_calling_llm',
		'parsing-response': 'phase_parsing_response',
		'staging-proposals': 'phase_staging_proposals',
		finalizing: 'phase_finalizing',
	};
	function phaseLabel(phase: string | undefined): string {
		if (!phase) return $_('ai-missions.list_view.phase_initializing');
		const key = PHASE_KEY_MAP[phase];
		return key ? $_('ai-missions.list_view.' + key) : phase;
	}

	let cancelling = $state<string | null>(null);
	async function handleCancel(missionId: string, iterationId: string) {
		cancelling = iterationId;
		try {
			await requestIterationCancel(missionId, iterationId);
		} finally {
			cancelling = null;
		}
	}
</script>

{#if mode === 'list'}
	<div class="pane">
		<header class="bar">
			<button type="button" class="primary" onclick={() => (mode = 'create')}>
				<Plus size={14} /><span>{$_('ai-missions.list_view.action_new')}</span>
			</button>
		</header>
		{#if missions.value.length === 0}
			<p class="empty">
				{$_('ai-missions.list_view.empty_text')}
			</p>
		{:else}
			<ul class="m-list">
				{#each missions.value as m (m.id)}
					<li>
						<button type="button" class="m-item" onclick={() => openDetail(m.id)}>
							<span class="m-title">
								<span class="dot dot-{m.state}"></span>
								{m.title}
							</span>
							<span class="m-meta">
								<span>{describeCadence(m.cadence)}</span>
								<span
									>{$_('ai-missions.list_view.iter_short', {
										values: { count: m.iterations.length },
									})}</span
								>
								{#if m.nextRunAt}
									<span
										>{$_('ai-missions.list_view.next_label', {
											values: { when: formatRelative(m.nextRunAt) },
										})}</span
									>
								{/if}
							</span>
						</button>
					</li>
				{/each}
			</ul>
		{/if}
	</div>
{:else if mode === 'create'}
	<form class="create" onsubmit={(e) => (e.preventDefault(), handleCreate())}>
		<button type="button" class="back-btn" onclick={() => (mode = 'list')}>
			<ArrowLeft size={14} /><span>{$_('ai-missions.list_view.action_cancel')}</span>
		</button>
		<label>
			<span class="lbl">{$_('ai-missions.list_view.label_title')}</span>
			<input
				bind:value={formTitle}
				placeholder={$_('ai-missions.list_view.placeholder_title')}
				required
			/>
		</label>
		<label>
			<span class="lbl">{$_('ai-missions.list_view.label_objective')}</span>
			<input
				bind:value={formObjective}
				placeholder={$_('ai-missions.list_view.placeholder_objective')}
				required
			/>
		</label>
		<label>
			<span class="lbl">{$_('ai-missions.list_view.label_concept')}</span>
			<textarea
				bind:value={formConcept}
				placeholder={$_('ai-missions.list_view.placeholder_concept')}
				rows="5"
			></textarea>
		</label>
		<fieldset>
			<legend>{$_('ai-missions.list_view.legend_agent')}</legend>
			<AgentPicker
				value={formAgentId}
				onSelect={(id) => (formAgentId = id)}
				label={$_('ai-missions.list_view.agent_picker_label')}
			/>
		</fieldset>
		<fieldset>
			<legend>{$_('ai-missions.list_view.legend_inputs')}</legend>
			<MissionInputPicker bind:value={formInputs} />
		</fieldset>
		<fieldset>
			<legend>{$_('ai-missions.list_view.legend_cadence')}</legend>
			<div class="cadence-row">
				<label class="inline">
					<input type="radio" bind:group={formCadenceKind} value="manual" />
					{$_('ai-missions.list_view.cadence_manual')}
				</label>
				<label class="inline">
					<input type="radio" bind:group={formCadenceKind} value="interval" />
					{$_('ai-missions.list_view.cadence_interval')}
					{#if formCadenceKind === 'interval'}
						<input
							class="inline-num"
							type="number"
							bind:value={formIntervalMin}
							min="5"
							max="1440"
						/>
						<span>{$_('ai-missions.list_view.cadence_min_unit')}</span>
					{/if}
				</label>
				<label class="inline">
					<input type="radio" bind:group={formCadenceKind} value="daily" />
					{$_('ai-missions.list_view.cadence_daily')}
					{#if formCadenceKind === 'daily'}
						<input class="inline-num" type="number" bind:value={formDailyHour} min="0" max="23" />
						:00
					{/if}
				</label>
			</div>
		</fieldset>
		<div class="form-actions">
			<button type="submit" class="primary" disabled={creating}>
				{creating
					? $_('ai-missions.list_view.action_creating')
					: $_('ai-missions.list_view.action_create')}
			</button>
		</div>
	</form>
{:else if selected}
	<div class="detail">
		<button type="button" class="back-btn" onclick={() => (mode = 'list')}>
			<ArrowLeft size={14} /><span>{$_('ai-missions.list_view.action_back_list')}</span>
		</button>
		<h2 class="detail-title">{selected.title}</h2>
		<div class="detail-actions">
			<button type="button" onclick={() => handleRunNow(selected)} disabled={runningNow}>
				<Play size={12} /><span
					>{runningNow
						? $_('ai-missions.list_view.action_running')
						: $_('ai-missions.list_view.action_run_now')}</span
				>
			</button>
			<label class="debug-toggle" title={$_('ai-missions.list_view.debug_title')}>
				<input type="checkbox" checked={debugEnabled} onchange={toggleDebug} />
				<span>{$_('ai-missions.list_view.debug_label')}</span>
			</label>
			{#if selected.state === 'active'}
				<button type="button" onclick={() => pauseMission(selected.id)}>
					<Pause size={12} /><span>{$_('ai-missions.list_view.action_pause')}</span>
				</button>
			{:else if selected.state === 'paused'}
				<button type="button" onclick={() => resumeMission(selected.id)}>
					<Play size={12} /><span>{$_('ai-missions.list_view.action_resume')}</span>
				</button>
			{/if}
			{#if selected.state !== 'done'}
				<button type="button" onclick={() => completeMission(selected.id)}>
					<Check size={12} /><span>{$_('ai-missions.list_view.action_complete')}</span>
				</button>
			{/if}
			<button
				type="button"
				class="danger"
				onclick={() => {
					if (confirm($_('ai-missions.list_view.confirm_delete'))) {
						deleteMission(selected.id);
						mode = 'list';
						selectedId = null;
					}
				}}
			>
				<Trash size={12} />
			</button>
		</div>

		<dl class="meta">
			<dt>{$_('ai-missions.list_view.meta_objective')}</dt>
			<dd>{selected.objective}</dd>
			<dt>{$_('ai-missions.list_view.meta_cadence')}</dt>
			<dd>
				{$_('ai-missions.list_view.meta_cadence_value', {
					values: {
						cadence: describeCadence(selected.cadence),
						state: describeState(selected.state),
					},
				})}
			</dd>
			<dt>{$_('ai-missions.list_view.meta_next')}</dt>
			<dd>{formatRelative(selected.nextRunAt)}</dd>
			<dt>{$_('ai-missions.list_view.meta_inputs')}</dt>
			<dd>
				{#if selected.inputs.length === 0}{$_('ai-missions.list_view.none_dash')}{:else}
					{selected.inputs.map((i) => `${i.module}/${i.id}`).join(', ')}
				{/if}
			</dd>
		</dl>

		{#if selected.conceptMarkdown}
			<details>
				<summary>{$_('ai-missions.list_view.concept_summary')}</summary>
				<pre>{selected.conceptMarkdown}</pre>
			</details>
		{/if}

		{#if grantsEnabled && hasEncryptedInputs(selected)}
			<section class="grant-box">
				<div class="grant-head">
					<span class="grant-title">{$_('ai-missions.list_view.grant_title')}</span>
					{#if grantStatus(selected) === 'active'}
						<span class="grant-pill grant-pill-ok"
							>{$_('ai-missions.list_view.grant_active', {
								values: { when: formatGrantExpiry(selected) },
							})}</span
						>
					{:else if grantStatus(selected) === 'expired'}
						<span class="grant-pill grant-pill-warn"
							>{$_('ai-missions.list_view.grant_expired')}</span
						>
					{:else}
						<span class="grant-pill grant-pill-muted">{$_('ai-missions.list_view.grant_none')}</span
						>
					{/if}
				</div>
				<p class="grant-note">
					{#if grantStatus(selected) === 'active'}
						{$_('ai-missions.list_view.grant_note_active')}
					{:else}
						{$_('ai-missions.list_view.grant_note_inactive')}
					{/if}
				</p>
				<div class="grant-actions">
					{#if selected.grant}
						<button type="button" class="btn-ghost" onclick={() => revokeMissionGrant(selected.id)}>
							{$_('ai-missions.list_view.action_revoke')}
						</button>
					{/if}
					<button type="button" class="btn-primary" onclick={() => (grantDialogOpen = true)}>
						{selected.grant
							? $_('ai-missions.list_view.action_grant_renew')
							: $_('ai-missions.list_view.action_grant')}
					</button>
				</div>
			</section>
			<MissionGrantDialog mission={selected} bind:open={grantDialogOpen} />
		{/if}

		<h3 class="section-title">{$_('ai-missions.list_view.section_iterations')}</h3>
		{#if selected.iterations.length === 0}
			<p class="empty">{$_('ai-missions.list_view.empty_iterations')}</p>
		{:else}
			{#each [...selected.iterations].reverse() as it (it.id)}
				{@const isRunning = it.overallStatus === 'running'}
				<article class="it" class:it-running={isRunning}>
					<header>
						<span class="it-date">{formatDateTime(new Date(it.startedAt))}</span>
						<span class="badge badge-{it.overallStatus}">{it.overallStatus}</span>
					</header>

					{#if isRunning}
						<div class="phase-block">
							<div class="phase-line">
								<span class="phase-spinner" aria-hidden="true">⏳</span>
								<span class="phase-label">
									{phaseLabel(it.currentPhase ?? undefined)}
									{#if it.phaseDetail}<span class="phase-detail"
											>{$_('ai-missions.list_view.phase_detail_separator', {
												values: { detail: it.phaseDetail },
											})}</span
										>{/if}
								</span>
								<span class="elapsed"
									>{$_('ai-missions.list_view.elapsed_prefix', {
										values: { time: formatElapsed(elapsedSeconds(it.startedAt)) },
									})}</span
								>
							</div>
							<div class="phase-actions">
								<button
									type="button"
									class="cancel-btn"
									disabled={cancelling === it.id || it.cancelRequested}
									onclick={() => handleCancel(selected.id, it.id)}
								>
									{it.cancelRequested
										? $_('ai-missions.list_view.action_cancelling')
										: $_('ai-missions.list_view.action_cancel_iter')}
								</button>
							</div>
						</div>
					{/if}

					{#if it.summary}<p class="it-summary">{it.summary}</p>{/if}

					{#if it.overallStatus === 'failed' && it.errorDetails}
						<details class="err-details">
							<summary>
								<span class="err-name">{it.errorDetails.name}</span>
								{#if it.errorDetails.phase}
									<span class="err-phase"
										>{$_('ai-missions.list_view.err_phase_in', {
											values: { phase: phaseLabel(it.errorDetails.phase) },
										})}</span
									>
								{/if}
							</summary>
							<p class="err-message">{it.errorDetails.message}</p>
							{#if it.errorDetails.stack}
								<pre class="err-stack">{it.errorDetails.stack}</pre>
							{/if}
						</details>
						<div class="retry-row">
							<button
								type="button"
								class="retry-btn"
								disabled={runningNow}
								onclick={() => handleRunNow(selected)}
							>
								{runningNow
									? $_('ai-missions.list_view.action_retry_running')
									: $_('ai-missions.list_view.action_retry')}
							</button>
						</div>
					{/if}

					<AiDebugBlock iterationId={it.id} />

					{#if it.userFeedback}
						<blockquote class="fb">{it.userFeedback}</blockquote>
					{:else if it.overallStatus === 'awaiting-review'}
						<form
							class="fb-form"
							onsubmit={(e) => (e.preventDefault(), handleFeedback(selected, it.id))}
						>
							<textarea
								bind:value={feedbackDraft}
								placeholder={$_('ai-missions.list_view.placeholder_feedback')}
								rows="2"
							></textarea>
							<button type="submit" disabled={!feedbackDraft.trim()}
								>{$_('ai-missions.list_view.action_save_feedback')}</button
							>
						</form>
					{/if}
				</article>
			{/each}
		{/if}
	</div>
{/if}

<style>
	.pane,
	.create,
	.detail {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		padding: 0.75rem 1rem 1.5rem;
	}
	.bar {
		display: flex;
		justify-content: flex-end;
	}
	.primary {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.75rem;
		border: 1px solid color-mix(in oklab, hsl(var(--color-primary)) 45%, transparent);
		border-radius: 0.375rem;
		background: color-mix(in oklab, hsl(var(--color-primary)) 12%, hsl(var(--color-surface)));
		color: hsl(var(--color-primary));
		cursor: pointer;
		font: inherit;
		font-size: 0.8125rem;
	}
	.primary:disabled {
		opacity: 0.5;
	}
	.empty {
		padding: 1.5rem 1rem;
		color: hsl(var(--color-muted-foreground));
		font-size: 0.875rem;
		text-align: center;
	}
	.m-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}
	.m-item {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		padding: 0.625rem 0.75rem;
		border: 1px solid hsl(var(--color-border));
		border-radius: 0.5rem;
		background: hsl(var(--color-surface));
		text-align: left;
		cursor: pointer;
		width: 100%;
		font: inherit;
		color: hsl(var(--color-foreground));
	}
	.m-item:hover {
		border-color: hsl(var(--color-primary));
	}
	.m-title {
		display: inline-flex;
		gap: 0.375rem;
		align-items: center;
		font-weight: 600;
		font-size: 0.9375rem;
	}
	.dot {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 999px;
	}
	.dot-active {
		background: hsl(var(--color-success));
	}
	.dot-paused {
		background: hsl(var(--color-warning));
	}
	.dot-done {
		background: hsl(var(--color-muted-foreground));
	}
	.dot-archived {
		background: hsl(var(--color-muted-foreground) / 0.5);
	}
	.m-meta {
		display: flex;
		gap: 0.75rem;
		font-size: 0.75rem;
		color: hsl(var(--color-muted-foreground));
	}
	.back-btn {
		align-self: flex-start;
		display: inline-flex;
		gap: 0.25rem;
		align-items: center;
		padding: 0.25rem 0.5rem;
		border: none;
		background: none;
		color: hsl(var(--color-muted-foreground));
		cursor: pointer;
		font-size: 0.8125rem;
	}
	.back-btn:hover {
		color: hsl(var(--color-foreground));
	}
	.create label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.lbl {
		font-size: 0.75rem;
		font-weight: 600;
		color: hsl(var(--color-muted-foreground));
	}
	.create input:not([type]),
	.create textarea {
		padding: 0.375rem 0.5rem;
		border: 1px solid hsl(var(--color-border));
		border-radius: 0.375rem;
		font: inherit;
	}
	.create textarea {
		font-family: var(--font-mono, ui-monospace, monospace);
		resize: vertical;
	}
	.create fieldset {
		border: 1px solid hsl(var(--color-border));
		border-radius: 0.375rem;
		padding: 0.5rem 0.75rem;
	}
	.cadence-row {
		display: flex;
		flex-wrap: wrap;
		gap: 0.625rem;
	}
	.inline {
		flex-direction: row !important;
		align-items: center;
		gap: 0.25rem !important;
	}
	.inline-num {
		width: 4rem;
	}
	.form-actions {
		display: flex;
		justify-content: flex-end;
	}
	.detail-title {
		margin: 0;
		font-size: 1.125rem;
	}
	.detail-actions {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}
	.detail-actions button {
		display: inline-flex;
		gap: 0.25rem;
		align-items: center;
		padding: 0.25rem 0.5rem;
		border: 1px solid hsl(var(--color-border));
		border-radius: 0.375rem;
		background: hsl(var(--color-surface));
		font: inherit;
		font-size: 0.75rem;
		cursor: pointer;
	}
	.detail-actions button.danger {
		color: hsl(var(--color-error));
	}
	.debug-toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		margin-left: auto;
		padding: 0.25rem 0.5rem;
		border: 1px solid hsl(var(--color-border));
		border-radius: 0.375rem;
		font-size: 0.75rem;
		color: hsl(var(--color-muted-foreground));
		cursor: pointer;
		user-select: none;
	}
	.debug-toggle input {
		margin: 0;
	}
	.meta {
		display: grid;
		grid-template-columns: auto 1fr;
		gap: 0.25rem 0.75rem;
		font-size: 0.8125rem;
		margin: 0;
	}
	.meta dt {
		color: hsl(var(--color-muted-foreground));
	}
	.meta dd {
		margin: 0;
	}
	details pre {
		white-space: pre-wrap;
		padding: 0.5rem;
		background: hsl(var(--color-surface));
		border-radius: 0.375rem;
		font-size: 0.75rem;
		margin: 0.375rem 0 0;
	}
	.section-title {
		margin: 0.5rem 0 0;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		color: hsl(var(--color-muted-foreground));
	}
	.it {
		padding: 0.625rem 0.75rem;
		border: 1px solid hsl(var(--color-border));
		border-radius: 0.375rem;
	}
	.it header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 0.375rem;
	}
	.it-date {
		font-size: 0.75rem;
		color: hsl(var(--color-muted-foreground));
	}
	.badge {
		padding: 0.125rem 0.375rem;
		border-radius: 0.25rem;
		font-size: 0.6875rem;
		background: hsl(var(--color-surface));
		text-transform: uppercase;
	}
	.badge-awaiting-review {
		background: hsl(var(--color-warning) / 0.18);
		color: hsl(var(--color-warning));
	}
	.badge-approved {
		background: hsl(var(--color-success) / 0.18);
		color: hsl(var(--color-success));
	}
	.badge-rejected,
	.badge-failed {
		background: hsl(var(--color-error) / 0.18);
		color: hsl(var(--color-error));
	}
	.badge-running {
		background: hsl(var(--color-primary) / 0.18);
		color: hsl(var(--color-primary));
	}
	.it-running {
		border-color: color-mix(in oklab, hsl(var(--color-primary)) 35%, hsl(var(--color-border)));
	}
	.phase-block {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding: 0.5rem 0.625rem;
		margin: 0.375rem 0;
		background: hsl(var(--color-primary) / 0.08);
		border-radius: 0.375rem;
	}
	.phase-line {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.8125rem;
	}
	.phase-spinner {
		display: inline-flex;
		font-size: 0.875rem;
		animation: phase-pulse 1.4s ease-in-out infinite;
	}
	@keyframes phase-pulse {
		0%,
		100% {
			opacity: 0.5;
		}
		50% {
			opacity: 1;
		}
	}
	.phase-label {
		flex: 1;
		font-weight: 500;
	}
	.phase-detail {
		color: hsl(var(--color-muted-foreground));
		font-weight: 400;
	}
	.elapsed {
		font-variant-numeric: tabular-nums;
		font-size: 0.75rem;
		color: hsl(var(--color-muted-foreground));
	}
	.phase-actions {
		display: flex;
		justify-content: flex-end;
	}
	.cancel-btn {
		padding: 0.25rem 0.625rem;
		border: 1px solid hsl(var(--color-border));
		border-radius: 0.25rem;
		background: hsl(var(--color-surface));
		color: hsl(var(--color-muted-foreground));
		cursor: pointer;
		font: inherit;
		font-size: 0.75rem;
	}
	.cancel-btn:hover:not(:disabled) {
		color: hsl(var(--color-error));
		border-color: hsl(var(--color-error) / 0.5);
	}
	.cancel-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.err-details {
		margin-top: 0.375rem;
		border: 1px solid hsl(var(--color-error) / 0.3);
		border-radius: 0.375rem;
		padding: 0.375rem 0.5rem;
		background: hsl(var(--color-error) / 0.05);
		font-size: 0.8125rem;
	}
	.err-details summary {
		cursor: pointer;
		display: flex;
		gap: 0.375rem;
		align-items: center;
	}
	.err-name {
		font-family: var(--font-mono, ui-monospace, monospace);
		font-weight: 600;
		color: hsl(var(--color-error));
	}
	.err-phase {
		color: hsl(var(--color-muted-foreground));
		font-size: 0.75rem;
	}
	.err-message {
		margin: 0.375rem 0 0;
		color: hsl(var(--color-error));
		word-break: break-word;
	}
	.err-stack {
		margin: 0.375rem 0 0;
		padding: 0.375rem 0.5rem;
		background: hsl(var(--color-surface));
		border-radius: 0.25rem;
		font-family: var(--font-mono, ui-monospace, monospace);
		font-size: 0.6875rem;
		max-height: 10rem;
		overflow: auto;
		white-space: pre-wrap;
		color: hsl(var(--color-muted-foreground));
	}
	.retry-row {
		display: flex;
		justify-content: flex-end;
		margin-top: 0.375rem;
	}
	.retry-btn {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.25rem 0.625rem;
		border: 1px solid color-mix(in oklab, hsl(var(--color-primary)) 45%, transparent);
		border-radius: 0.25rem;
		background: color-mix(in oklab, hsl(var(--color-primary)) 12%, hsl(var(--color-surface)));
		color: hsl(var(--color-primary));
		cursor: pointer;
		font: inherit;
		font-size: 0.75rem;
	}
	.retry-btn:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.it-summary {
		margin: 0 0 0.375rem;
		font-size: 0.8125rem;
	}
	.fb {
		margin: 0.25rem 0 0;
		padding: 0.375rem 0.5rem;
		border-left: 3px solid hsl(var(--color-border));
		font-style: italic;
		font-size: 0.8125rem;
		color: hsl(var(--color-muted-foreground));
	}
	.fb-form {
		display: flex;
		gap: 0.375rem;
		margin-top: 0.5rem;
	}
	.fb-form textarea {
		flex: 1;
		padding: 0.375rem 0.5rem;
		border: 1px solid hsl(var(--color-border));
		border-radius: 0.375rem;
		font: inherit;
	}
	.fb-form button {
		align-self: flex-end;
		padding: 0.375rem 0.625rem;
		border: 1px solid hsl(var(--color-border));
		border-radius: 0.375rem;
		background: hsl(var(--color-surface));
		cursor: pointer;
	}
	.grant-box {
		padding: 0.75rem 0.875rem;
		border: 1px solid hsl(var(--color-border));
		border-radius: 0.5rem;
		background: color-mix(in oklab, hsl(var(--color-primary)) 4%, hsl(var(--color-surface)));
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.grant-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
	}
	.grant-title {
		font-weight: 600;
		font-size: 0.8125rem;
	}
	.grant-pill {
		font-size: 0.6875rem;
		padding: 0.125rem 0.5rem;
		border-radius: 999px;
	}
	.grant-pill-ok {
		background: hsl(var(--color-success) / 0.18);
		color: hsl(var(--color-success));
	}
	.grant-pill-warn {
		background: hsl(var(--color-warning) / 0.18);
		color: hsl(var(--color-warning));
	}
	.grant-pill-muted {
		background: hsl(var(--color-surface));
		color: hsl(var(--color-muted-foreground));
		border: 1px solid hsl(var(--color-border));
	}
	.grant-note {
		margin: 0;
		font-size: 0.75rem;
		color: hsl(var(--color-muted-foreground));
	}
	.grant-actions {
		display: flex;
		gap: 0.375rem;
		justify-content: flex-end;
		flex-wrap: wrap;
	}
	.grant-actions .btn-ghost,
	.grant-actions .btn-primary {
		padding: 0.25rem 0.625rem;
		border-radius: 0.375rem;
		font: inherit;
		font-size: 0.75rem;
		cursor: pointer;
	}
	.grant-actions .btn-ghost {
		border: 1px solid hsl(var(--color-border));
		background: hsl(var(--color-surface));
		color: hsl(var(--color-foreground));
	}
	.grant-actions .btn-primary {
		border: 1px solid color-mix(in oklab, hsl(var(--color-primary)) 45%, transparent);
		background: color-mix(in oklab, hsl(var(--color-primary)) 18%, hsl(var(--color-surface)));
		color: hsl(var(--color-primary));
	}
</style>
