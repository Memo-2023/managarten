<!--
  FieldEditor — inline editor for a single FormField inside the
  BuilderView. Type-specific config (options for choice fields,
  min/max for number, ratingScale for rating) lives in a collapsible
  "Erweitert" section to keep the default surface terse.

  Save semantics: every edit calls `onchange(patch)` with a partial
  patch the parent then merges into store state. The parent is
  responsible for the persistence path (autosave-on-blur).
-->
<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { FIELD_TYPE_LABELS } from '../types';
	import type { FieldOption, FieldType, FormField } from '../types';

	let {
		field,
		index,
		onchange,
		onremove,
	}: {
		field: FormField;
		index: number;
		onchange: (patch: Partial<FormField>) => void;
		onremove: () => void;
	} = $props();

	let advancedOpen = $state(false);

	function patchOptions(next: FieldOption[]) {
		onchange({ options: next });
	}

	function addOption() {
		const next: FieldOption[] = [...(field.options ?? []), { id: crypto.randomUUID(), label: '' }];
		patchOptions(next);
	}

	function updateOption(optionId: string, label: string) {
		const next = (field.options ?? []).map((o) => (o.id === optionId ? { ...o, label } : o));
		patchOptions(next);
	}

	function removeOption(optionId: string) {
		const next = (field.options ?? []).filter((o) => o.id !== optionId);
		patchOptions(next);
	}

	function patchConfig<K extends keyof NonNullable<FormField['config']>>(
		key: K,
		value: NonNullable<FormField['config']>[K] | undefined
	) {
		const cfg = { ...(field.config ?? {}) };
		if (value === undefined || value === null) {
			delete cfg[key];
		} else {
			cfg[key] = value;
		}
		onchange({ config: cfg });
	}

	function setType(type: FieldType) {
		// Switching type — drop type-specific config so we don't keep
		// stale options/ratingScale dangling.
		const patch: Partial<FormField> = { type };
		if (type === 'single_choice' || type === 'multi_choice') {
			if (!field.options || field.options.length === 0) {
				patch.options = [
					{ id: crypto.randomUUID(), label: 'Option 1' },
					{ id: crypto.randomUUID(), label: 'Option 2' },
				];
			}
		} else {
			patch.options = undefined;
		}
		if (type !== 'rating' && type !== 'short_text' && type !== 'long_text' && type !== 'number') {
			patch.config = undefined;
		}
		if (type === 'rating' && !field.config?.ratingScale) {
			patch.config = { ratingScale: 5 };
		}
		onchange(patch);
	}
</script>

<div class="field-editor" data-type={field.type}>
	<div class="header">
		<span class="index">{index + 1}.</span>
		<input
			type="text"
			class="label-input"
			value={field.label}
			oninput={(e) => onchange({ label: (e.currentTarget as HTMLInputElement).value })}
			placeholder={$_('forms.builder.field.labelPlaceholder', { default: 'Feldfrage ...' })}
			aria-label={$_('forms.builder.field.labelAria', { default: 'Feldlabel' })}
		/>
		<button
			type="button"
			class="remove"
			onclick={onremove}
			aria-label={$_('forms.builder.field.removeAria', { default: 'Feld löschen' })}>×</button
		>
	</div>

	<div class="row">
		<select
			class="type-select"
			value={field.type}
			onchange={(e) => setType((e.currentTarget as HTMLSelectElement).value as FieldType)}
		>
			{#each Object.entries(FIELD_TYPE_LABELS) as [type, labels]}
				<option value={type}>{labels.de}</option>
			{/each}
		</select>

		<label class="required-toggle">
			<input
				type="checkbox"
				checked={field.required}
				onchange={(e) => onchange({ required: (e.currentTarget as HTMLInputElement).checked })}
			/>
			<span>{$_('forms.builder.field.required', { default: 'Pflichtfeld' })}</span>
		</label>

		<button
			type="button"
			class="advanced-toggle"
			onclick={() => (advancedOpen = !advancedOpen)}
			aria-expanded={advancedOpen}
		>
			{advancedOpen
				? $_('forms.builder.field.lessOptions', { default: '− weniger' })
				: $_('forms.builder.field.moreOptions', { default: '+ mehr' })}
		</button>
	</div>

	{#if advancedOpen}
		<div class="advanced">
			<input
				type="text"
				class="help-input"
				value={field.helpText ?? ''}
				oninput={(e) => {
					const val = (e.currentTarget as HTMLInputElement).value;
					onchange({ helpText: val.length > 0 ? val : undefined });
				}}
				placeholder={$_('forms.builder.field.helpPlaceholder', {
					default: 'Hilfetext (optional)',
				})}
			/>

			{#if field.type === 'single_choice' || field.type === 'multi_choice'}
				<div class="options-block">
					<p class="block-label">
						{$_('forms.builder.field.options', { default: 'Optionen' })}
					</p>
					{#each field.options ?? [] as option (option.id)}
						<div class="option-row">
							<input
								type="text"
								value={option.label}
								oninput={(e) =>
									updateOption(option.id, (e.currentTarget as HTMLInputElement).value)}
								placeholder={$_('forms.builder.field.optionPlaceholder', {
									default: 'Option ...',
								})}
							/>
							<button
								type="button"
								class="option-remove"
								onclick={() => removeOption(option.id)}
								aria-label={$_('forms.builder.field.optionRemoveAria', {
									default: 'Option löschen',
								})}>×</button
							>
						</div>
					{/each}
					<button type="button" class="option-add" onclick={addOption}>
						{$_('forms.builder.field.addOption', { default: '+ Option hinzufügen' })}
					</button>
				</div>
			{:else if field.type === 'rating'}
				<label class="config-row">
					<span>{$_('forms.builder.field.ratingScale', { default: 'Skala' })}</span>
					<select
						value={String(field.config?.ratingScale ?? 5)}
						onchange={(e) =>
							patchConfig(
								'ratingScale',
								Number((e.currentTarget as HTMLSelectElement).value) as 5 | 10
							)}
					>
						<option value="5">{$_('forms.builder.field.scale5', { default: '1–5' })}</option>
						<option value="10">{$_('forms.builder.field.scale10', { default: '1–10' })}</option>
					</select>
				</label>
			{:else if field.type === 'number'}
				<div class="config-grid">
					<label class="config-row">
						<span>{$_('forms.builder.field.min', { default: 'Minimum' })}</span>
						<input
							type="number"
							value={field.config?.min ?? ''}
							oninput={(e) => {
								const raw = (e.currentTarget as HTMLInputElement).value;
								patchConfig('min', raw === '' ? undefined : Number(raw));
							}}
						/>
					</label>
					<label class="config-row">
						<span>{$_('forms.builder.field.max', { default: 'Maximum' })}</span>
						<input
							type="number"
							value={field.config?.max ?? ''}
							oninput={(e) => {
								const raw = (e.currentTarget as HTMLInputElement).value;
								patchConfig('max', raw === '' ? undefined : Number(raw));
							}}
						/>
					</label>
				</div>
			{:else if field.type === 'short_text' || field.type === 'long_text'}
				<div class="config-grid">
					<label class="config-row">
						<span>{$_('forms.builder.field.maxLength', { default: 'Max. Länge' })}</span>
						<input
							type="number"
							value={field.config?.maxLength ?? ''}
							min="1"
							oninput={(e) => {
								const raw = (e.currentTarget as HTMLInputElement).value;
								patchConfig('maxLength', raw === '' ? undefined : Number(raw));
							}}
						/>
					</label>
				</div>
			{/if}
		</div>
	{/if}
</div>

<style>
	.field-editor {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.75rem;
		background: rgb(255 255 255 / 0.03);
		border: 1px solid rgb(255 255 255 / 0.08);
		border-radius: 0.5rem;
	}

	.header {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}

	.index {
		min-width: 1.5rem;
		font-variant-numeric: tabular-nums;
		color: rgb(255 255 255 / 0.45);
		font-size: 0.875rem;
	}

	.label-input {
		flex: 1;
		padding: 0.5rem 0.625rem;
		background: rgb(255 255 255 / 0.04);
		border: 1px solid rgb(255 255 255 / 0.08);
		border-radius: 0.375rem;
		color: inherit;
		font-size: 0.9375rem;
		font-weight: 500;
	}

	.label-input:focus {
		outline: none;
		border-color: rgb(20 184 166 / 0.5);
	}

	.remove,
	.option-remove {
		width: 1.75rem;
		height: 1.75rem;
		padding: 0;
		display: inline-flex;
		justify-content: center;
		align-items: center;
		background: transparent;
		color: rgb(255 255 255 / 0.4);
		border: 1px solid rgb(255 255 255 / 0.08);
		border-radius: 0.25rem;
		font-size: 1rem;
		cursor: pointer;
	}

	.remove:hover,
	.option-remove:hover {
		color: rgb(248 113 113);
		border-color: rgb(248 113 113 / 0.4);
	}

	.row {
		display: flex;
		align-items: center;
		gap: 0.625rem;
		flex-wrap: wrap;
	}

	.type-select,
	.advanced .help-input,
	.option-row input,
	.config-row input,
	.config-row select {
		padding: 0.375rem 0.5rem;
		background: rgb(255 255 255 / 0.04);
		border: 1px solid rgb(255 255 255 / 0.08);
		border-radius: 0.25rem;
		color: inherit;
		font-size: 0.8125rem;
	}

	.type-select {
		max-width: 220px;
	}

	.required-toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.375rem;
		font-size: 0.8125rem;
		color: rgb(255 255 255 / 0.7);
		cursor: pointer;
	}

	.advanced-toggle {
		margin-left: auto;
		padding: 0.25rem 0.5rem;
		background: transparent;
		border: 1px solid rgb(255 255 255 / 0.08);
		border-radius: 0.25rem;
		color: rgb(255 255 255 / 0.55);
		font-size: 0.75rem;
		cursor: pointer;
	}

	.advanced {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
		margin-top: 0.25rem;
	}

	.help-input {
		width: 100%;
	}

	.options-block .block-label {
		margin: 0 0 0.375rem;
		font-size: 0.6875rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: rgb(255 255 255 / 0.4);
	}

	.option-row {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		margin-bottom: 0.25rem;
	}

	.option-row input {
		flex: 1;
	}

	.option-add {
		margin-top: 0.25rem;
		padding: 0.375rem 0.625rem;
		background: rgb(20 184 166 / 0.12);
		border: 1px solid rgb(20 184 166 / 0.25);
		border-radius: 0.25rem;
		color: rgb(94 234 212);
		font-size: 0.75rem;
		cursor: pointer;
	}

	.option-add:hover {
		background: rgb(20 184 166 / 0.2);
	}

	.config-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 0.5rem;
	}

	.config-row {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.75rem;
		color: rgb(255 255 255 / 0.55);
	}

	.config-row input,
	.config-row select {
		width: 100%;
	}
</style>
