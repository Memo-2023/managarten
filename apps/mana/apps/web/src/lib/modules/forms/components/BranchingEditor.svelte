<!--
  BranchingEditor — top-level section in the BuilderView listing every
  conditional-visibility rule on the form. Each rule pairs an IF clause
  (one field + operator + value) with a THEN action (show/hide/skip_to
  some target fields). The resolver in lib/branching.ts is the runtime
  contract — this component only mutates the schema array.
-->
<script lang="ts">
	import { _ } from 'svelte-i18n';
	import type { BranchAction, BranchOperator, BranchingRule, FormField } from '../types';

	let {
		fields,
		branching,
		onchange,
	}: {
		fields: FormField[];
		branching: BranchingRule[];
		onchange: (next: BranchingRule[]) => void;
	} = $props();

	const ANSWER_FIELDS = $derived(
		fields.filter((f) => f.type !== 'section' && f.type !== 'consent')
	);

	const OPERATORS: BranchOperator[] = ['equals', 'not_equals', 'contains', 'is_empty'];
	const ACTIONS: BranchAction[] = ['show', 'hide', 'skip_to'];

	function operatorLabel(op: BranchOperator): string {
		switch (op) {
			case 'equals':
				return $_('forms.branching.op.equals', { default: 'gleich' });
			case 'not_equals':
				return $_('forms.branching.op.notEquals', { default: 'ungleich' });
			case 'contains':
				return $_('forms.branching.op.contains', { default: 'enthält' });
			case 'is_empty':
				return $_('forms.branching.op.isEmpty', { default: 'ist leer' });
		}
	}

	function actionLabel(a: BranchAction): string {
		switch (a) {
			case 'show':
				return $_('forms.branching.action.show', { default: 'zeige' });
			case 'hide':
				return $_('forms.branching.action.hide', { default: 'verstecke' });
			case 'skip_to':
				return $_('forms.branching.action.skipTo', { default: 'springe zu' });
		}
	}

	function addRule() {
		const first = ANSWER_FIELDS[0];
		if (!first) return;
		const second = ANSWER_FIELDS[1] ?? first;
		const newRule: BranchingRule = {
			id: crypto.randomUUID(),
			ifFieldId: first.id,
			ifOperator: 'equals',
			ifValue: '',
			thenAction: 'hide',
			thenFieldIds: [second.id],
		};
		onchange([...branching, newRule]);
	}

	function patchRule(id: string, patch: Partial<BranchingRule>) {
		onchange(branching.map((r) => (r.id === id ? { ...r, ...patch } : r)));
	}

	function removeRule(id: string) {
		onchange(branching.filter((r) => r.id !== id));
	}

	function setIfValue(id: string, raw: string) {
		patchRule(id, { ifValue: raw });
	}

	function toggleTargetField(rule: BranchingRule, fieldId: string) {
		const current = rule.thenFieldIds ?? [];
		const next = current.includes(fieldId)
			? current.filter((id) => id !== fieldId)
			: [...current, fieldId];
		patchRule(rule.id, { thenFieldIds: next });
	}
</script>

<div class="branching-panel">
	<header class="panel-header">
		<p class="panel-title">
			{$_('forms.branching.title', { default: 'Logik (Wenn → Dann)' })}
		</p>
		<button type="button" class="add-rule" onclick={addRule} disabled={ANSWER_FIELDS.length < 1}>
			{$_('forms.branching.addRule', { default: '+ Regel' })}
		</button>
	</header>

	{#if branching.length === 0}
		<p class="empty">
			{#if ANSWER_FIELDS.length < 2}
				{$_('forms.branching.emptyNeedFields', {
					default: 'Lege mindestens zwei Antwortfelder an, um Logik zu bauen.',
				})}
			{:else}
				{$_('forms.branching.empty', {
					default: 'Keine Regeln. Klick "+ Regel" um eine Bedingung zu bauen.',
				})}
			{/if}
		</p>
	{:else}
		<ul class="rule-list">
			{#each branching as rule (rule.id)}
				<li class="rule">
					<div class="rule-row">
						<span class="kw">{$_('forms.branching.if', { default: 'Wenn' })}</span>
						<select
							value={rule.ifFieldId}
							onchange={(e) =>
								patchRule(rule.id, { ifFieldId: (e.currentTarget as HTMLSelectElement).value })}
						>
							{#each ANSWER_FIELDS as f}
								<option value={f.id}>{f.label || f.id}</option>
							{/each}
						</select>
						<select
							value={rule.ifOperator}
							onchange={(e) =>
								patchRule(rule.id, {
									ifOperator: (e.currentTarget as HTMLSelectElement).value as BranchOperator,
								})}
						>
							{#each OPERATORS as op}
								<option value={op}>{operatorLabel(op)}</option>
							{/each}
						</select>
						{#if rule.ifOperator !== 'is_empty'}
							<input
								type="text"
								class="value-input"
								value={typeof rule.ifValue === 'string' ? rule.ifValue : ''}
								oninput={(e) => setIfValue(rule.id, (e.currentTarget as HTMLInputElement).value)}
								placeholder={$_('forms.branching.valuePlaceholder', { default: 'Wert ...' })}
							/>
						{/if}
					</div>

					<div class="rule-row">
						<span class="kw">{$_('forms.branching.then', { default: 'Dann' })}</span>
						<select
							value={rule.thenAction}
							onchange={(e) =>
								patchRule(rule.id, {
									thenAction: (e.currentTarget as HTMLSelectElement).value as BranchAction,
								})}
						>
							{#each ACTIONS as a}
								<option value={a}>{actionLabel(a)}</option>
							{/each}
						</select>

						{#if rule.thenAction === 'skip_to'}
							<select
								value={rule.thenSkipToFieldId ?? ''}
								onchange={(e) =>
									patchRule(rule.id, {
										thenSkipToFieldId: (e.currentTarget as HTMLSelectElement).value || undefined,
									})}
							>
								<option value=""
									>{$_('forms.branching.pickField', { default: 'Feld wählen ...' })}</option
								>
								{#each ANSWER_FIELDS.filter((f) => f.id !== rule.ifFieldId) as f}
									<option value={f.id}>{f.label || f.id}</option>
								{/each}
							</select>
						{:else}
							<div class="target-chips">
								{#each ANSWER_FIELDS.filter((f) => f.id !== rule.ifFieldId) as f}
									{@const checked = (rule.thenFieldIds ?? []).includes(f.id)}
									<button
										type="button"
										class="target-chip"
										class:active={checked}
										onclick={() => toggleTargetField(rule, f.id)}
									>
										{f.label || f.id}
									</button>
								{/each}
							</div>
						{/if}
					</div>

					<button
						type="button"
						class="remove"
						onclick={() => removeRule(rule.id)}
						aria-label={$_('forms.branching.removeAria', { default: 'Regel löschen' })}>×</button
					>
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.branching-panel {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		padding: 0.875rem;
		background: rgb(255 255 255 / 0.03);
		border: 1px solid rgb(255 255 255 / 0.06);
		border-radius: 0.5rem;
	}

	.panel-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
	}

	.panel-title {
		margin: 0;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: rgb(255 255 255 / 0.5);
	}

	.add-rule {
		padding: 0.25rem 0.5rem;
		background: rgb(20 184 166 / 0.12);
		border: 1px solid rgb(20 184 166 / 0.25);
		border-radius: 0.25rem;
		color: rgb(94 234 212);
		font-size: 0.75rem;
		cursor: pointer;
	}

	.add-rule:hover {
		background: rgb(20 184 166 / 0.2);
	}

	.add-rule:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.empty {
		margin: 0;
		padding: 0.5rem 0;
		font-size: 0.8125rem;
		color: rgb(255 255 255 / 0.45);
	}

	.rule-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.rule {
		position: relative;
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
		padding: 0.625rem 2rem 0.625rem 0.75rem;
		background: rgb(255 255 255 / 0.03);
		border: 1px solid rgb(255 255 255 / 0.08);
		border-radius: 0.375rem;
	}

	.rule-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.8125rem;
	}

	.kw {
		min-width: 3rem;
		color: rgb(255 255 255 / 0.5);
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.rule-row select,
	.rule-row input.value-input {
		padding: 0.25rem 0.5rem;
		background: rgb(255 255 255 / 0.04);
		border: 1px solid rgb(255 255 255 / 0.08);
		border-radius: 0.25rem;
		color: inherit;
		font-size: 0.8125rem;
	}

	.target-chips {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
	}

	.target-chip {
		padding: 0.125rem 0.5rem;
		background: rgb(255 255 255 / 0.04);
		border: 1px solid rgb(255 255 255 / 0.08);
		border-radius: 999px;
		color: rgb(255 255 255 / 0.55);
		font-size: 0.75rem;
		cursor: pointer;
	}

	.target-chip:hover {
		background: rgb(255 255 255 / 0.07);
	}

	.target-chip.active {
		background: rgb(20 184 166 / 0.18);
		color: rgb(94 234 212);
		border-color: rgb(20 184 166 / 0.4);
	}

	.remove {
		position: absolute;
		top: 0.375rem;
		right: 0.375rem;
		width: 1.5rem;
		height: 1.5rem;
		padding: 0;
		display: inline-flex;
		justify-content: center;
		align-items: center;
		background: transparent;
		border: 1px solid rgb(255 255 255 / 0.08);
		border-radius: 0.25rem;
		color: rgb(255 255 255 / 0.4);
		font-size: 0.875rem;
		cursor: pointer;
	}

	.remove:hover {
		color: rgb(248 113 113);
		border-color: rgb(248 113 113 / 0.4);
	}
</style>
