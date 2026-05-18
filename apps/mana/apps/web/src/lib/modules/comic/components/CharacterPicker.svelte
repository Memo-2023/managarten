<!--
  CharacterPicker — selects the reference-image set that every panel
  in the story renders against. At minimum: primary face-ref from the
  active space's meImages. Optional: primary body-ref (for full-body framing).

  Outputs: `value: string[]` (mediaIds, face-ref at [0]). Emits via
  `onChange` on every add/remove.
-->
<script lang="ts">
	import { Plus, X, UserCircle, TShirt } from '@mana/shared-icons';
	import { useImageByPrimary } from '$lib/modules/profile/queries';
	import { _ } from 'svelte-i18n';

	interface Props {
		value: string[];
		onChange: (next: string[]) => void;
		disabled?: boolean;
	}

	let { value, onChange, disabled = false }: Props = $props();

	const face$ = useImageByPrimary('face-ref');
	const body$ = useImageByPrimary('body-ref');

	const face = $derived(face$.value);
	const body = $derived(body$.value);

	// Auto-seed face-ref at position [0] the first time it becomes
	// available and value is still empty. After that, mutations go
	// through the Add/Remove buttons.
	let seeded = false;
	$effect(() => {
		if (!seeded && face?.mediaId && value.length === 0) {
			seeded = true;
			onChange([face.mediaId]);
		}
	});

	const hasFace = $derived(Boolean(face?.mediaId));
	const hasBody = $derived(Boolean(body?.mediaId));

	const bodyInValue = $derived(body?.mediaId ? value.includes(body.mediaId) : false);

	function toggleBody() {
		if (!body?.mediaId) return;
		if (bodyInValue) {
			onChange(value.filter((id) => id !== body.mediaId));
		} else {
			const next = [...value];
			const insertAt = face?.mediaId && next[0] === face.mediaId ? 1 : 0;
			next.splice(insertAt, 0, body.mediaId);
			onChange(next);
		}
	}
</script>

<div class="space-y-3">
	<div>
		<h3 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
			{$_('comic.picker.section_title')}
		</h3>
	</div>

	<div class="flex flex-wrap items-start gap-2">
		<!-- Face ref tile — mandatory, not deselectable. -->
		<div class="flex flex-col items-center gap-1">
			{#if face?.publicUrl}
				<div
					class="relative h-20 w-20 overflow-hidden rounded-md border-2 border-primary/40"
					title={$_('comic.picker.face_required_title')}
				>
					<img
						src={face.thumbnailUrl ?? face.publicUrl}
						alt={$_('comic.picker.face_alt')}
						class="h-full w-full object-cover"
					/>
					<span
						class="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent px-1 py-0.5 text-center text-[9px] font-semibold uppercase tracking-wider text-white"
					>
						{$_('comic.picker.face_required_badge')}
					</span>
				</div>
			{:else}
				<div
					class="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border bg-muted/50 text-[10px] text-muted-foreground"
				>
					<UserCircle size={20} />
					<span>{$_('comic.picker.face_missing')}</span>
				</div>
			{/if}
			<span class="text-[10px] font-medium text-muted-foreground"
				>{$_('comic.picker.face_label')}</span
			>
		</div>

		<!-- Body ref tile — optional toggle. -->
		<div class="flex flex-col items-center gap-1">
			{#if body?.publicUrl}
				<button
					type="button"
					{disabled}
					onclick={toggleBody}
					class="group relative h-20 w-20 overflow-hidden rounded-md border-2 transition-all active:translate-y-px
						{bodyInValue
						? 'border-primary shadow-sm shadow-primary/20'
						: 'border-border opacity-60 hover:border-primary/50 hover:opacity-100 hover:shadow-sm'}"
					aria-pressed={bodyInValue}
					title={bodyInValue ? $_('comic.picker.toggle_remove') : $_('comic.picker.toggle_add')}
				>
					<img
						src={body.thumbnailUrl ?? body.publicUrl}
						alt={$_('comic.picker.body_alt')}
						class="h-full w-full object-cover"
					/>
					{#if !bodyInValue}
						<div
							class="absolute inset-0 flex items-center justify-center bg-background/50 text-foreground"
						>
							<Plus size={20} weight="bold" />
						</div>
					{:else}
						<div
							class="absolute inset-0 flex items-center justify-center bg-error/0 text-white opacity-0 transition-all group-hover:bg-error/60 group-hover:opacity-100"
						>
							<X size={20} weight="bold" />
						</div>
					{/if}
				</button>
			{:else}
				<div
					class="flex h-20 w-20 flex-col items-center justify-center gap-1 rounded-md border border-dashed border-border bg-muted/30 text-[10px] text-muted-foreground"
					title={$_('comic.picker.body_no_in_space')}
				>
					<UserCircle size={18} />
					<span>{$_('comic.picker.body_missing')}</span>
				</div>
			{/if}
			<span class="text-[10px] font-medium text-muted-foreground"
				>{$_('comic.picker.body_label')}</span
			>
		</div>
	</div>

	{#if !hasFace}
		<div class="rounded-md border border-error/30 bg-error/5 p-3 text-xs text-error" role="alert">
			<!-- eslint-disable-next-line svelte/no-at-html-tags -->
			{@html $_('comic.picker.no_face_alert_html')}
		</div>
	{:else if !hasBody}
		<p class="text-xs text-muted-foreground">
			<TShirt size={12} class="inline" />
			{$_('comic.picker.body_tip')}
		</p>
	{/if}
</div>
