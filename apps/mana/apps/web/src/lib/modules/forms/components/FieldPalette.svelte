<!--
  FieldPalette — picker that emits one of the 11 field-types when the
  user clicks an entry. Used inside the BuilderView between the field
  list and any preview area.
-->
<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { FIELD_TYPE_LABELS } from '../types';
	import type { FieldType } from '../types';

	let { onpick }: { onpick: (type: FieldType) => void } = $props();

	const TYPES: FieldType[] = [
		'short_text',
		'long_text',
		'single_choice',
		'multi_choice',
		'number',
		'date',
		'email',
		'yes_no',
		'rating',
		'consent',
		'section',
	];

	const ICONS: Record<FieldType, string> = {
		short_text: 'Aa',
		long_text: '¶',
		single_choice: '○',
		multi_choice: '☑',
		number: '#',
		date: '📅',
		email: '@',
		yes_no: '?',
		rating: '★',
		consent: '✓',
		section: '—',
	};
</script>

<div class="palette">
	<p class="palette-title">
		{$_('forms.builder.palette.title', { default: 'Feld hinzufügen' })}
	</p>
	<div class="palette-grid">
		{#each TYPES as type}
			<button type="button" class="palette-btn" onclick={() => onpick(type)}>
				<span class="icon">{ICONS[type]}</span>
				<span class="label">{FIELD_TYPE_LABELS[type].de}</span>
			</button>
		{/each}
	</div>
</div>

<style>
	.palette {
		padding: 0.875rem;
		background: rgb(255 255 255 / 0.03);
		border: 1px solid rgb(255 255 255 / 0.06);
		border-radius: 0.5rem;
	}

	.palette-title {
		margin: 0 0 0.625rem;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: rgb(255 255 255 / 0.5);
	}

	.palette-grid {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(120px, 1fr));
		gap: 0.375rem;
	}

	.palette-btn {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		padding: 0.5rem 0.625rem;
		background: rgb(255 255 255 / 0.03);
		border: 1px solid rgb(255 255 255 / 0.08);
		border-radius: 0.375rem;
		color: inherit;
		font-size: 0.8125rem;
		cursor: pointer;
		text-align: left;
	}

	.palette-btn:hover {
		background: rgb(255 255 255 / 0.06);
		border-color: rgb(255 255 255 / 0.16);
	}

	.icon {
		display: inline-flex;
		justify-content: center;
		align-items: center;
		width: 1.25rem;
		height: 1.25rem;
		font-weight: 600;
		color: rgb(20 184 166 / 0.85);
	}

	.label {
		flex: 1;
	}
</style>
