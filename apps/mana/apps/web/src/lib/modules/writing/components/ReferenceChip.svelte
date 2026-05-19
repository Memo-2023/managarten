<!--
  ReferenceChip — compact pill for a single attached DraftReference in
  the briefing form. Purely presentational: the parent resolves the
  display label by looking up the target in the relevant module's live
  query.
-->
<script lang="ts">
	import type { DraftReference } from '../types';

	let {
		kind,
		label,
		note = null,
		onremove,
	}: {
		kind: DraftReference['kind'];
		label: string;
		note?: string | null;
		onremove: () => void;
	} = $props();

	const KIND_ICON: Record<DraftReference['kind'], string> = {
		note: '📝',
		library: '📚',
		kontext: '🗂',
		goal: '🎯',
		url: '🔗',
		'me-image': '🖼',
	};

	const KIND_LABEL: Record<DraftReference['kind'], string> = {
		note: 'Notiz',
		library: 'Library',
		kontext: 'Kontext',
		goal: 'Ziel',
		url: 'Link',
		'me-image': 'Bild',
	};
</script>

<span class="chip" title={note ?? KIND_LABEL[kind]}>
	<span aria-hidden="true">{KIND_ICON[kind]}</span>
	<span class="label">{label}</span>
	<button type="button" class="remove" onclick={onremove} aria-label="Quelle entfernen">×</button>
</span>

<style>
	.chip {
		display: inline-flex;
		align-items: center;
		gap: 0.35rem;
		padding: 0.2rem 0.5rem 0.2rem 0.55rem;
		border-radius: 999px;
		border: 1px solid hsl(var(--color-border));
		background: hsl(var(--color-surface));
		font-size: 0.8rem;
		max-width: 100%;
	}
	.label {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
		max-width: 18rem;
	}
	.remove {
		background: transparent;
		border: none;
		padding: 0 0.2rem;
		cursor: pointer;
		color: hsl(var(--color-muted-foreground));
		font: inherit;
		line-height: 1;
		font-size: 1rem;
	}
	.remove:hover {
		color: #ef4444;
	}
</style>
