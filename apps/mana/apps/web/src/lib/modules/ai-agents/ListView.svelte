<!--
  AI Agents app — workbench card.

  Master-detail inline (list ↔ create ↔ detail) in a single panel,
  mirroring the ai-missions module. Detail view exposes:
    - role + name rename
    - avatar (emoji)
    - system-prompt + memory (both are encrypted at rest via the
      crypto registry)
    - policy editor (coarse: defaultForAi + a few per-module overrides)
    - budget + concurrency
    - archive / delete

  Policy is intentionally exposed in a coarse form for v1 — per-tool
  overrides are powerful but noisy. The defaultForAi radio gives users
  a one-click "careful vs aggressive" switch; per-module overrides
  handle the common "let the agent touch todo but not calendar" case.
-->
<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { ArrowLeft, Plus, Pause, Play, Archive, Trash, Sparkle, Flag } from '@mana/shared-icons';
	import { goto } from '$app/navigation';
	import { useAgents } from '$lib/data/ai/agents/queries';
	import { useMissions } from '$lib/data/ai/missions/queries';
	import type { Mission } from '$lib/data/ai/missions/types';
	import { DEFAULT_AGENT_ID } from '@mana/shared-ai';
	import {
		createAgent,
		updateAgent,
		archiveAgent,
		pauseAgent,
		resumeAgent,
		deleteAgent,
		DuplicateAgentNameError,
	} from '$lib/data/ai/agents/store';
	import { DEFAULT_AI_POLICY } from '$lib/data/ai/policy';
	import type { Agent } from '$lib/data/ai/agents/types';
	import type { AiPolicy, PolicyDecision } from '@mana/shared-ai';
	import { TagSelector } from '@mana/shared-ui';
	import { useAllTags } from '@mana/shared-stores';
	import StylePicker from '$lib/modules/writing/components/StylePicker.svelte';

	const agents = $derived(useAgents());
	const allTags = $derived(useAllTags());

	let mode = $state<'list' | 'create' | 'detail'>('list');
	let selectedId = $state<string | null>(null);
	const selected = $derived<Agent | null>(
		selectedId ? (agents.value.find((a) => a.id === selectedId) ?? null) : null
	);

	// ── Create form ─────────────────────────────────────────
	let formName = $state('');
	let formAvatar = $state('🤖');
	let formRole = $state('');
	let formError = $state<string | null>(null);
	let creating = $state(false);

	async function handleCreate() {
		if (!formName.trim() || !formRole.trim()) return;
		formError = null;
		creating = true;
		try {
			const a = await createAgent({
				name: formName.trim(),
				avatar: formAvatar || undefined,
				role: formRole.trim(),
			});
			formName = '';
			formAvatar = '🤖';
			formRole = '';
			selectedId = a.id;
			mode = 'detail';
		} catch (err) {
			if (err instanceof DuplicateAgentNameError) {
				formError = $_('ai-agents.list_view.err_duplicate_name', { values: { name: err.name } });
			} else {
				formError = err instanceof Error ? err.message : String(err);
			}
		} finally {
			creating = false;
		}
	}

	// ── Detail edits ────────────────────────────────────────
	let editName = $state('');
	let editAvatar = $state('');
	let editRole = $state('');
	let editSystemPrompt = $state('');
	let editMemory = $state('');
	let editMaxConcurrent = $state(1);
	let editMaxTokensPerDay = $state<number | null>(null);
	let editScopeTagIds = $state<string[]>([]);
	let editDefaultWritingStyleId = $state<string | null>(null);
	let lastSyncedId = $state<string | null>(null);
	let saveError = $state<string | null>(null);
	let saving = $state(false);

	$effect(() => {
		if (selected && selected.id !== lastSyncedId) {
			editName = selected.name;
			editAvatar = selected.avatar ?? '';
			editRole = selected.role;
			editSystemPrompt = selected.systemPrompt ?? '';
			editMemory = selected.memory ?? '';
			editMaxConcurrent = selected.maxConcurrentMissions;
			editMaxTokensPerDay = selected.maxTokensPerDay ?? null;
			editScopeTagIds = [...(selected.scopeTagIds ?? [])];
			editDefaultWritingStyleId = selected.defaultWritingStyleId ?? null;
			lastSyncedId = selected.id;
			saveError = null;
		}
	});

	async function handleSave(agent: Agent) {
		saveError = null;
		saving = true;
		try {
			await updateAgent(agent.id, {
				name: editName.trim() !== agent.name ? editName.trim() : undefined,
				avatar: editAvatar || undefined,
				role: editRole.trim(),
				systemPrompt: editSystemPrompt || undefined,
				memory: editMemory || undefined,
				maxConcurrentMissions: editMaxConcurrent,
				maxTokensPerDay: editMaxTokensPerDay ?? undefined,
				scopeTagIds: editScopeTagIds.length > 0 ? editScopeTagIds : undefined,
				defaultWritingStyleId: editDefaultWritingStyleId ?? undefined,
			});
		} catch (err) {
			if (err instanceof DuplicateAgentNameError) {
				saveError = $_('ai-agents.list_view.err_duplicate_name', { values: { name: err.name } });
			} else {
				saveError = err instanceof Error ? err.message : String(err);
			}
		} finally {
			saving = false;
		}
	}

	// ── Missions for this agent ──────────────────────────────
	const allMissions = $derived(useMissions());
	const agentMissions = $derived(
		selected ? allMissions.value.filter((m: Mission) => m.agentId === selected.id) : []
	);

	function describeMissionState(m: Mission): string {
		return $_('ai-agents.list_view.mission_state_' + m.state);
	}

	// ── Policy editor ───────────────────────────────────────
	const POLICY_MODULES = ['todo', 'calendar', 'notes', 'finance', 'drink', 'food'];
	const POLICY_CHOICES: PolicyDecision[] = ['auto', 'propose', 'deny'];
	function policyLabel(c: PolicyDecision): string {
		return $_('ai-agents.list_view.policy_label_' + c);
	}
	let policyAdvanced = $state(false);

	/**
	 * Generate a natural-language summary of the current policy.
	 * Reads the agent's policy and produces a short i18n'd sentence.
	 */
	function describePolicyNatural(policy: AiPolicy): string {
		const parts: string[] = [];
		const denyTools: string[] = [];

		for (const [name, decision] of Object.entries(policy.tools)) {
			if (decision === 'deny') denyTools.push(name);
		}

		// Module overrides
		const moduleOverrides = Object.entries(policy.defaultsByModule ?? {});
		for (const [mod, decision] of moduleOverrides) {
			if (decision === 'auto')
				parts.push(
					$_('ai-agents.list_view.policy_natural_module_auto', { values: { module: mod } })
				);
			else if (decision === 'deny')
				parts.push(
					$_('ai-agents.list_view.policy_natural_module_deny', { values: { module: mod } })
				);
		}

		const defaultLabel =
			policy.defaultForAi === 'auto'
				? $_('ai-agents.list_view.policy_natural_default_auto')
				: policy.defaultForAi === 'deny'
					? $_('ai-agents.list_view.policy_natural_default_deny')
					: $_('ai-agents.list_view.policy_natural_default_propose');

		const lines: string[] = [];
		if (denyTools.length > 0) {
			const tools = denyTools.slice(0, 5).join(', ');
			lines.push(
				denyTools.length > 5
					? $_('ai-agents.list_view.policy_natural_blocked_more', { values: { tools } })
					: $_('ai-agents.list_view.policy_natural_blocked', { values: { tools } })
			);
		}
		if (parts.length > 0) {
			lines.push(parts.join(' · '));
		}
		lines.push(
			$_('ai-agents.list_view.policy_natural_otherwise', { values: { default: defaultLabel } })
		);
		return lines.join('\n');
	}

	/** Determine which template preset most closely matches the current
	 *  policy — used to pre-select the simple-mode radio. */
	function currentPolicyPreset(policy: AiPolicy): string {
		if (policy.defaultForAi === 'deny') return 'cautious';
		const hasAutoModules = Object.values(policy.defaultsByModule ?? {}).some((v) => v === 'auto');
		if (hasAutoModules) return 'aggressive';
		return 'standard';
	}

	async function setDefaultForAi(agent: Agent, value: PolicyDecision) {
		await updateAgent(agent.id, {
			policy: { ...agent.policy, defaultForAi: value },
		});
	}

	async function setModuleDefault(agent: Agent, moduleName: string, value: PolicyDecision) {
		const current = agent.policy.defaultsByModule ?? {};
		await updateAgent(agent.id, {
			policy: {
				...agent.policy,
				defaultsByModule: { ...current, [moduleName]: value },
			},
		});
	}

	async function clearModuleDefault(agent: Agent, moduleName: string) {
		const current = { ...(agent.policy.defaultsByModule ?? {}) };
		delete current[moduleName];
		await updateAgent(agent.id, {
			policy: { ...agent.policy, defaultsByModule: current },
		});
	}

	function moduleDecisionOrDefault(policy: AiPolicy, moduleName: string): PolicyDecision | '' {
		return (policy.defaultsByModule?.[moduleName] ?? '') as PolicyDecision | '';
	}

	// ── Templates ───────────────────────────────────────────
	const TEMPLATES = $derived<Array<{ key: string; label: string; policy: AiPolicy }>>([
		{
			key: 'standard',
			label: $_('ai-agents.list_view.template_standard_label'),
			policy: DEFAULT_AI_POLICY,
		},
		{
			key: 'cautious',
			label: $_('ai-agents.list_view.template_cautious_label'),
			policy: {
				...DEFAULT_AI_POLICY,
				tools: Object.fromEntries(
					Object.entries(DEFAULT_AI_POLICY.tools).map(([k, v]) => [
						k,
						v === 'auto' ? 'auto' : ('propose' as PolicyDecision),
					])
				),
				defaultForAi: 'propose',
			},
		},
		{
			key: 'aggressive',
			label: $_('ai-agents.list_view.template_aggressive_label'),
			policy: {
				...DEFAULT_AI_POLICY,
				defaultsByModule: { drink: 'auto', food: 'auto' },
			},
		},
	]);

	async function applyTemplate(agent: Agent, key: string) {
		const t = TEMPLATES.find((x) => x.key === key);
		if (!t) return;
		await updateAgent(agent.id, { policy: t.policy });
	}

	// ── Lifecycle helpers ───────────────────────────────────
	function openDetail(id: string) {
		selectedId = id;
		mode = 'detail';
	}

	async function handleDelete(agent: Agent) {
		if (!confirm($_('ai-agents.list_view.confirm_delete', { values: { name: agent.name } })))
			return;
		await deleteAgent(agent.id);
		mode = 'list';
		selectedId = null;
	}
</script>

{#if mode === 'list'}
	{@const onlyDefaultAgent = agents.value.length === 1 && agents.value[0].id === DEFAULT_AGENT_ID}
	<div class="pane">
		<header class="bar">
			<button type="button" class="primary" onclick={() => goto('/agents/templates')}>
				<Sparkle size={14} /><span>{$_('ai-agents.list_view.action_from_template')}</span>
			</button>
			<button type="button" class="secondary" onclick={() => (mode = 'create')}>
				<Plus size={14} /><span>{$_('ai-agents.list_view.action_custom_agent')}</span>
			</button>
		</header>

		{#if onlyDefaultAgent}
			<button type="button" class="promo" onclick={() => goto('/agents/templates')}>
				<span class="promo-icon"><Sparkle size={16} weight="fill" /></span>
				<span class="promo-body">
					<strong>{$_('ai-agents.list_view.promo_title')}</strong>
					<span class="promo-sub">
						{$_('ai-agents.list_view.promo_sub')}
					</span>
				</span>
			</button>
		{/if}

		{#if agents.value.length === 0}
			<p class="empty">
				{$_('ai-agents.list_view.empty_text')}
			</p>
		{:else}
			<ul class="m-list">
				{#each agents.value as a (a.id)}
					<li>
						<button type="button" class="m-item" onclick={() => openDetail(a.id)}>
							<span class="m-title">
								<span class="avatar">{a.avatar ?? '🤖'}</span>
								<span class="m-name">{a.name}</span>
								<span class="dot dot-{a.state}" title={a.state}></span>
							</span>
							<span class="m-meta">
								<span>{a.role}</span>
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
			<ArrowLeft size={14} /><span>{$_('ai-agents.list_view.action_cancel')}</span>
		</button>
		<label>
			<span class="lbl">{$_('ai-agents.list_view.label_name')}</span>
			<input
				bind:value={formName}
				placeholder={$_('ai-agents.list_view.placeholder_name')}
				required
			/>
		</label>
		<label>
			<span class="lbl">{$_('ai-agents.list_view.label_avatar')}</span>
			<input bind:value={formAvatar} maxlength="4" />
		</label>
		<label>
			<span class="lbl">{$_('ai-agents.list_view.label_role')}</span>
			<input
				bind:value={formRole}
				placeholder={$_('ai-agents.list_view.placeholder_role')}
				required
			/>
		</label>
		{#if formError}
			<p class="form-error">{formError}</p>
		{/if}
		<div class="form-actions">
			<button type="submit" class="primary" disabled={creating}>
				{creating
					? $_('ai-agents.list_view.action_creating')
					: $_('ai-agents.list_view.action_create')}
			</button>
		</div>
	</form>
{:else if selected}
	<div class="detail">
		<button type="button" class="back-btn" onclick={() => (mode = 'list')}>
			<ArrowLeft size={14} /><span>{$_('ai-agents.list_view.action_back_list')}</span>
		</button>
		<h2 class="detail-title">
			<span class="avatar">{selected.avatar ?? '🤖'}</span>
			<span>{selected.name}</span>
			<span class="state-pill state-{selected.state}">{selected.state}</span>
		</h2>
		<div class="detail-actions">
			{#if selected.state === 'active'}
				<button type="button" onclick={() => pauseAgent(selected.id)}>
					<Pause size={12} /><span>{$_('ai-agents.list_view.action_pause')}</span>
				</button>
			{:else if selected.state === 'paused'}
				<button type="button" onclick={() => resumeAgent(selected.id)}>
					<Play size={12} /><span>{$_('ai-agents.list_view.action_resume')}</span>
				</button>
			{/if}
			{#if selected.state !== 'archived'}
				<button type="button" onclick={() => archiveAgent(selected.id)}>
					<Archive size={12} /><span>{$_('ai-agents.list_view.action_archive')}</span>
				</button>
			{/if}
			<button type="button" class="danger" onclick={() => handleDelete(selected)}>
				<Trash size={12} />
			</button>
		</div>

		<section class="block">
			<h3>{$_('ai-agents.list_view.section_profile')}</h3>
			<label>
				<span class="lbl">{$_('ai-agents.list_view.label_name')}</span>
				<input bind:value={editName} />
			</label>
			<label>
				<span class="lbl">{$_('ai-agents.list_view.label_avatar')}</span>
				<input bind:value={editAvatar} maxlength="4" />
			</label>
			<label>
				<span class="lbl">{$_('ai-agents.list_view.label_role')}</span>
				<input bind:value={editRole} />
			</label>
		</section>

		<section class="block">
			<h3>{$_('ai-agents.list_view.section_behavior')}</h3>
			<label>
				<span class="lbl">{$_('ai-agents.list_view.label_system_prompt')}</span>
				<textarea
					bind:value={editSystemPrompt}
					rows="3"
					placeholder={$_('ai-agents.list_view.placeholder_system_prompt')}
				></textarea>
			</label>
			<label>
				<span class="lbl">{$_('ai-agents.list_view.label_memory')}</span>
				<textarea
					bind:value={editMemory}
					rows="5"
					placeholder={$_('ai-agents.list_view.placeholder_memory')}
				></textarea>
			</label>
		</section>

		<section class="block">
			<h3>{$_('ai-agents.list_view.section_scope')}</h3>
			<p class="hint">{$_('ai-agents.list_view.hint_scope')}</p>
			<TagSelector
				tags={allTags.value}
				selectedTags={allTags.value.filter((t) => editScopeTagIds.includes(t.id))}
				onTagsChange={(tags) => {
					editScopeTagIds = tags.map((t) => t.id);
				}}
				placeholder={$_('ai-agents.list_view.placeholder_scope')}
				addTagLabel={$_('ai-agents.list_view.action_add_scope')}
			/>
		</section>

		<section class="block">
			<h3>{$_('ai-agents.list_view.section_limits')}</h3>
			<label class="inline-field">
				<span class="lbl">{$_('ai-agents.list_view.label_max_concurrent')}</span>
				<input type="number" min="1" max="10" bind:value={editMaxConcurrent} />
			</label>
			<label class="inline-field">
				<span class="lbl">{$_('ai-agents.list_view.label_max_tokens')}</span>
				<input
					type="number"
					min="0"
					bind:value={editMaxTokensPerDay}
					placeholder={$_('ai-agents.list_view.placeholder_max_tokens')}
				/>
			</label>
		</section>

		<section class="block">
			<h3>{$_('ai-agents.list_view.section_writing')}</h3>
			<p class="hint">
				{$_('ai-agents.list_view.hint_writing')}
			</p>
			<StylePicker
				value={editDefaultWritingStyleId}
				onchange={(next) => (editDefaultWritingStyleId = next)}
			/>
		</section>

		<div class="save-row">
			{#if saveError}
				<span class="form-error">{saveError}</span>
			{/if}
			<button type="button" class="primary" disabled={saving} onclick={() => handleSave(selected)}>
				{saving ? $_('ai-agents.list_view.action_saving') : $_('ai-agents.list_view.action_save')}
			</button>
		</div>

		<!-- ── Missions for this Agent ──────────────────── -->
		<section class="block">
			<h3>
				<Flag size={12} />
				{$_('ai-agents.list_view.section_missions', { values: { count: agentMissions.length } })}
			</h3>
			{#if agentMissions.length === 0}
				<p class="hint">{$_('ai-agents.list_view.hint_no_missions')}</p>
			{:else}
				<ul class="mission-list">
					{#each agentMissions as m (m.id)}
						<li class="mission-item">
							<span class="dot dot-{m.state}"></span>
							<span class="mission-title-text">{m.title}</span>
							<span class="mission-state">{describeMissionState(m)}</span>
						</li>
					{/each}
				</ul>
			{/if}
			<button
				type="button"
				class="secondary mission-new-btn"
				onclick={() => goto(`/agents/templates`)}
			>
				<Plus size={12} /><span
					>{$_('ai-agents.list_view.action_new_mission', {
						values: { name: selected.name },
					})}</span
				>
			</button>
		</section>

		<!-- ── Policy ─────────────────────────────────── -->
		<section class="block">
			<h3>{$_('ai-agents.list_view.section_policy')}</h3>

			<!-- Natural language summary -->
			<pre class="policy-natural">{describePolicyNatural(selected.policy)}</pre>

			<!-- Simple mode: 3 radio presets -->
			<div class="policy-simple">
				{#each TEMPLATES as t (t.key)}
					<label class="radio-card" class:active={currentPolicyPreset(selected.policy) === t.key}>
						<input
							type="radio"
							name="policyPreset"
							value={t.key}
							checked={currentPolicyPreset(selected.policy) === t.key}
							onchange={() => applyTemplate(selected, t.key)}
						/>
						<span class="radio-card-label">{t.label}</span>
					</label>
				{/each}
			</div>

			<!-- Advanced toggle -->
			<button
				type="button"
				class="toggle-advanced"
				onclick={() => (policyAdvanced = !policyAdvanced)}
			>
				{policyAdvanced
					? $_('ai-agents.list_view.toggle_advanced_hide')
					: $_('ai-agents.list_view.toggle_advanced_show')}
			</button>

			{#if policyAdvanced}
				<div class="policy-row">
					<span class="lbl">{$_('ai-agents.list_view.label_global_default')}</span>
					<div class="radio-group">
						{#each POLICY_CHOICES as c}
							<label class="radio">
								<input
									type="radio"
									name="defaultForAi"
									value={c}
									checked={selected.policy.defaultForAi === c}
									onchange={() => setDefaultForAi(selected, c)}
								/>
								<span>{policyLabel(c)}</span>
							</label>
						{/each}
					</div>
				</div>

				<table class="policy-table">
					<thead>
						<tr>
							<th>{$_('ai-agents.list_view.th_module')}</th>
							<th>{$_('ai-agents.list_view.th_decision')}</th>
							<th></th>
						</tr>
					</thead>
					<tbody>
						{#each POLICY_MODULES as mod}
							{@const current = moduleDecisionOrDefault(selected.policy, mod)}
							<tr>
								<td><code>{mod}</code></td>
								<td>
									<select
										value={current}
										onchange={(e) => {
											const v = (e.target as HTMLSelectElement).value;
											if (!v) clearModuleDefault(selected, mod);
											else setModuleDefault(selected, mod, v as PolicyDecision);
										}}
									>
										<option value="">{$_('ai-agents.list_view.option_global_default')}</option>
										{#each POLICY_CHOICES as c}
											<option value={c}>{policyLabel(c)}</option>
										{/each}
									</select>
								</td>
								<td></td>
							</tr>
						{/each}
					</tbody>
				</table>
			{/if}
		</section>
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
		gap: 0.375rem;
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
	.secondary {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.75rem;
		border: 1px solid hsl(var(--color-border));
		border-radius: 0.375rem;
		background: hsl(var(--color-surface));
		color: hsl(var(--color-muted-foreground));
		cursor: pointer;
		font: inherit;
		font-size: 0.8125rem;
	}
	.promo {
		display: flex;
		gap: 0.625rem;
		align-items: center;
		width: 100%;
		padding: 0.75rem 0.875rem;
		border: 1px dashed color-mix(in oklab, hsl(var(--color-primary)) 50%, transparent);
		border-radius: 0.5rem;
		background: color-mix(in oklab, hsl(var(--color-primary)) 6%, hsl(var(--color-surface)));
		color: hsl(var(--color-foreground));
		text-align: left;
		cursor: pointer;
		font: inherit;
	}
	.promo:hover {
		background: color-mix(in oklab, hsl(var(--color-primary)) 10%, hsl(var(--color-surface)));
	}
	.promo-icon {
		color: hsl(var(--color-primary));
		flex-shrink: 0;
	}
	.promo-body {
		display: flex;
		flex-direction: column;
		gap: 0.125rem;
	}
	.promo-body strong {
		font-size: 0.875rem;
	}
	.promo-sub {
		font-size: 0.75rem;
		color: hsl(var(--color-muted-foreground));
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
		gap: 0.5rem;
		align-items: center;
		font-weight: 600;
		font-size: 0.9375rem;
	}
	.m-name {
		flex: 1;
	}
	.avatar {
		display: inline-block;
		font-size: 1rem;
	}
	.dot {
		width: 0.5rem;
		height: 0.5rem;
		border-radius: 999px;
	}
	.dot-active {
		background: #22c55e;
	}
	.dot-paused {
		background: #f59e0b;
	}
	.dot-archived {
		background: #6b7280;
	}
	.m-meta {
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
	.create label,
	.block label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.lbl {
		font-size: 0.6875rem;
		text-transform: uppercase;
		font-weight: 600;
		letter-spacing: 0.04em;
		color: hsl(var(--color-muted-foreground));
	}
	input,
	textarea,
	select {
		padding: 0.375rem 0.5rem;
		border: 1px solid hsl(var(--color-border));
		border-radius: 0.375rem;
		font: inherit;
		background: hsl(var(--color-surface));
		color: hsl(var(--color-foreground));
	}
	textarea {
		font-family: var(--font-mono, ui-monospace, monospace);
		resize: vertical;
	}
	.form-actions {
		display: flex;
		justify-content: flex-end;
	}
	.form-error {
		color: hsl(var(--color-error));
		font-size: 0.8125rem;
	}
	.detail-title {
		display: inline-flex;
		gap: 0.5rem;
		align-items: center;
		margin: 0;
		font-size: 1.125rem;
	}
	.state-pill {
		margin-left: auto;
		padding: 0.0625rem 0.375rem;
		border-radius: 999px;
		font-size: 0.6875rem;
		font-weight: 600;
		text-transform: uppercase;
	}
	.state-active {
		background: #d7f7e3;
		color: #1b7a3a;
	}
	.state-paused {
		background: #fde7c8;
		color: #8a4f00;
	}
	.state-archived {
		background: hsl(var(--color-surface));
		color: hsl(var(--color-muted-foreground));
		border: 1px solid hsl(var(--color-border));
	}
	.detail-actions {
		display: flex;
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
	.detail-actions .danger {
		color: hsl(var(--color-error));
	}
	.block {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.75rem;
		border: 1px solid hsl(var(--color-border));
		border-radius: 0.5rem;
	}
	.block h3 {
		margin: 0;
		font-size: 0.75rem;
		font-weight: 600;
		text-transform: uppercase;
		color: hsl(var(--color-muted-foreground));
	}
	.inline-field {
		flex-direction: row !important;
		gap: 0.5rem !important;
		align-items: center;
	}
	.inline-field input {
		width: 6rem;
	}
	.save-row {
		display: flex;
		justify-content: flex-end;
		align-items: center;
		gap: 0.5rem;
	}
	.hint {
		margin: 0;
		font-size: 0.75rem;
		color: hsl(var(--color-muted-foreground));
	}
	.policy-row {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		justify-content: space-between;
	}
	.radio-group {
		display: inline-flex;
		gap: 0.5rem;
	}
	.radio {
		flex-direction: row !important;
		gap: 0.25rem !important;
		align-items: center;
		font-size: 0.8125rem;
	}
	.policy-table {
		width: 100%;
		border-collapse: collapse;
		font-size: 0.8125rem;
	}
	.policy-table th,
	.policy-table td {
		text-align: left;
		padding: 0.25rem 0.375rem;
		border-bottom: 1px solid hsl(var(--color-border));
	}
	.policy-table th {
		font-weight: 600;
		font-size: 0.6875rem;
		text-transform: uppercase;
		color: hsl(var(--color-muted-foreground));
	}
	.policy-table code {
		font-size: 0.75rem;
	}

	/* ── Missions section ─── */
	.mission-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.mission-item {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.25rem 0;
		font-size: 0.8125rem;
	}
	.mission-title-text {
		flex: 1;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.mission-state {
		font-size: 0.6875rem;
		color: hsl(var(--color-muted-foreground));
		text-transform: uppercase;
	}
	.mission-new-btn {
		margin-top: 0.375rem;
	}

	/* ── Policy natural language ─── */
	.policy-natural {
		margin: 0;
		padding: 0.5rem 0.75rem;
		background: hsl(var(--color-background));
		border: 1px solid hsl(var(--color-border));
		border-radius: 0.375rem;
		font: inherit;
		font-size: 0.8125rem;
		line-height: 1.5;
		white-space: pre-wrap;
		color: hsl(var(--color-muted-foreground));
	}

	/* ── Policy simple mode ─── */
	.policy-simple {
		display: flex;
		gap: 0.375rem;
		flex-wrap: wrap;
	}
	.radio-card {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		padding: 0.375rem 0.75rem;
		border: 1px solid hsl(var(--color-border));
		border-radius: 0.375rem;
		font-size: 0.8125rem;
		cursor: pointer;
		transition:
			border-color 0.15s,
			background 0.15s;
	}
	.radio-card.active {
		border-color: hsl(var(--color-primary));
		background: color-mix(in oklab, hsl(var(--color-primary)) 8%, transparent);
	}
	.radio-card input[type='radio'] {
		margin: 0;
	}
	.radio-card-label {
		white-space: nowrap;
	}
	.toggle-advanced {
		align-self: flex-start;
		border: none;
		background: none;
		padding: 0.25rem 0;
		font: inherit;
		font-size: 0.75rem;
		color: hsl(var(--color-muted-foreground));
		cursor: pointer;
	}
	.toggle-advanced:hover {
		color: hsl(var(--color-foreground));
	}
</style>
