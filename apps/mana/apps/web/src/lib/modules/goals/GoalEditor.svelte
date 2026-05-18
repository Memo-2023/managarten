<!--
  GoalEditor — Modal for creating custom goals with metric + target.
-->
<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { X } from '@mana/shared-icons';
	import { goalStore } from '$lib/companion/goals';

	interface Props {
		show: boolean;
		onClose: () => void;
	}

	let { show, onClose }: Props = $props();

	let title = $state('');
	let eventType = $state('TaskCompleted');
	let source = $state<'event_count' | 'event_sum'>('event_count');
	let filterField = $state('');
	let filterValue = $state('');
	let sumField = $state('');
	let targetValue = $state(5);
	let period = $state<'day' | 'week' | 'month'>('day');
	let comparison = $state<'gte' | 'lte'>('gte');
	let moduleId = $state('todo');
	let pending = $state(false);

	const EVENT_OPTIONS = $derived([
		{ value: 'TaskCompleted', label: $_('goals.editor.event_task_completed'), module: 'todo' },
		{ value: 'TaskCreated', label: $_('goals.editor.event_task_created'), module: 'todo' },
		{ value: 'DrinkLogged', label: $_('goals.editor.event_drink_logged'), module: 'drink' },
		{ value: 'HabitLogged', label: $_('goals.editor.event_habit_logged'), module: 'habits' },
		{
			value: 'JournalEntryCreated',
			label: $_('goals.editor.event_journal_entry_created'),
			module: 'journal',
		},
		{ value: 'NoteCreated', label: $_('goals.editor.event_note_created'), module: 'notes' },
		{ value: 'PlaceVisited', label: $_('goals.editor.event_place_visited'), module: 'places' },
		{ value: 'WorkoutFinished', label: $_('goals.editor.event_workout_finished'), module: 'body' },
		{
			value: 'MeditationCompleted',
			label: $_('goals.editor.event_meditation_completed'),
			module: 'meditate',
		},
		{ value: 'SleepLogged', label: $_('goals.editor.event_sleep_logged'), module: 'sleep' },
		{
			value: 'CalendarEventCreated',
			label: $_('goals.editor.event_calendar_event_created'),
			module: 'calendar',
		},
		{
			value: 'TransactionCreated',
			label: $_('goals.editor.event_transaction_created'),
			module: 'finance',
		},
	]);

	function onEventTypeChange() {
		const opt = EVENT_OPTIONS.find((o) => o.value === eventType);
		if (opt) moduleId = opt.module;
	}

	async function handleSubmit() {
		if (!title.trim() || pending) return;
		pending = true;
		try {
			await goalStore.create({
				title: title.trim(),
				moduleId,
				metric: {
					source,
					eventType,
					filterField: filterField || undefined,
					filterValue: filterValue || undefined,
					sumField: source === 'event_sum' ? sumField || undefined : undefined,
				},
				target: { value: targetValue, period, comparison },
			});
			// Reset
			title = '';
			targetValue = 5;
			onClose();
		} finally {
			pending = false;
		}
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onClose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

{#if show}
	<div class="backdrop" onclick={onClose} role="presentation" tabindex="-1">
		<!-- svelte-ignore a11y_click_events_have_key_events -->
		<div
			class="editor"
			role="dialog"
			aria-modal="true"
			tabindex="-1"
			onclick={(e) => e.stopPropagation()}
		>
			<div class="editor-header">
				<h3>{$_('goals.editor.title')}</h3>
				<button class="close-btn" onclick={onClose}><X size={16} /></button>
			</div>

			<form
				onsubmit={(e) => {
					e.preventDefault();
					handleSubmit();
				}}
			>
				<label class="field">
					<span class="label">{$_('goals.editor.label_title')}</span>
					<input
						type="text"
						bind:value={title}
						placeholder={$_('goals.editor.placeholder_title')}
						required
						maxlength="60"
					/>
				</label>

				<label class="field">
					<span class="label">{$_('goals.editor.label_what_to_count')}</span>
					<select bind:value={eventType} onchange={onEventTypeChange}>
						{#each EVENT_OPTIONS as opt}
							<option value={opt.value}>{opt.label}</option>
						{/each}
					</select>
				</label>

				<label class="field">
					<span class="label">{$_('goals.editor.label_how_to_count')}</span>
					<select bind:value={source}>
						<option value="event_count">{$_('goals.editor.source_count')}</option>
						<option value="event_sum">{$_('goals.editor.source_sum')}</option>
					</select>
				</label>

				{#if source === 'event_sum'}
					<label class="field">
						<span class="label">{$_('goals.editor.label_sum_field')}</span>
						<input
							type="text"
							bind:value={sumField}
							placeholder={$_('goals.editor.placeholder_sum_field')}
						/>
					</label>
				{/if}

				<div class="field-row">
					<label class="field">
						<span class="label">{$_('goals.editor.label_filter')}</span>
						<input
							type="text"
							bind:value={filterField}
							placeholder={$_('goals.editor.placeholder_filter_field')}
						/>
					</label>
					<label class="field">
						<span class="label">{$_('goals.editor.label_filter_value')}</span>
						<input
							type="text"
							bind:value={filterValue}
							placeholder={$_('goals.editor.placeholder_filter_value')}
						/>
					</label>
				</div>

				<div class="field-row">
					<label class="field">
						<span class="label">{$_('goals.editor.label_target')}</span>
						<div class="target-row">
							<select bind:value={comparison}>
								<option value="gte">{$_('goals.editor.comparison_gte')}</option>
								<option value="lte">{$_('goals.editor.comparison_lte')}</option>
							</select>
							<input type="number" bind:value={targetValue} min={1} max={10000} />
						</div>
					</label>
					<label class="field">
						<span class="label">{$_('goals.editor.label_period')}</span>
						<select bind:value={period}>
							<option value="day">{$_('goals.editor.period_day')}</option>
							<option value="week">{$_('goals.editor.period_week')}</option>
							<option value="month">{$_('goals.editor.period_month')}</option>
						</select>
					</label>
				</div>

				<div class="actions">
					<button type="button" class="btn-cancel" onclick={onClose}
						>{$_('goals.editor.action_cancel')}</button
					>
					<button type="submit" class="btn-create" disabled={!title.trim() || pending}>
						{pending ? '...' : $_('goals.editor.action_create')}
					</button>
				</div>
			</form>
		</div>
	</div>
{/if}

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		z-index: 200;
		background: hsl(0 0% 0% / 0.5);
		display: flex;
		align-items: center;
		justify-content: center;
		padding: 1rem;
	}
	.editor {
		background: hsl(var(--color-card));
		border-radius: 0.75rem;
		box-shadow: 0 12px 32px rgba(0, 0, 0, 0.2);
		max-width: 440px;
		width: 100%;
		padding: 1.25rem;
		animation: pop 0.18s ease-out;
	}
	@keyframes pop {
		from {
			opacity: 0;
			transform: scale(0.96);
		}
		to {
			opacity: 1;
			transform: scale(1);
		}
	}

	.editor-header {
		display: flex;
		align-items: center;
		justify-content: space-between;
		margin-bottom: 1rem;
	}
	.editor-header h3 {
		font-size: 1rem;
		font-weight: 600;
		color: hsl(var(--color-foreground));
		margin: 0;
	}
	.close-btn {
		border: none;
		background: none;
		color: hsl(var(--color-muted-foreground));
		cursor: pointer;
		padding: 0.25rem;
	}

	.field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin-bottom: 0.75rem;
	}
	.label {
		font-size: 0.6875rem;
		font-weight: 500;
		color: hsl(var(--color-muted-foreground));
	}

	.field input,
	.field select {
		padding: 0.4375rem 0.625rem;
		border-radius: 0.5rem;
		border: 1px solid hsl(var(--color-border));
		background: hsl(var(--color-background));
		color: hsl(var(--color-foreground));
		font-size: 0.8125rem;
		outline: none;
	}
	.field input:focus,
	.field select:focus {
		border-color: hsl(var(--color-primary));
	}

	.field-row {
		display: flex;
		gap: 0.5rem;
	}
	.field-row .field {
		flex: 1;
	}

	.target-row {
		display: flex;
		gap: 0.375rem;
	}
	.target-row select {
		flex: 1;
	}
	.target-row input {
		width: 80px;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}
	.btn-cancel {
		padding: 0.4375rem 0.75rem;
		border-radius: 0.5rem;
		border: none;
		background: transparent;
		color: hsl(var(--color-muted-foreground));
		font-size: 0.8125rem;
		cursor: pointer;
	}
	.btn-create {
		padding: 0.4375rem 1rem;
		border-radius: 0.5rem;
		border: none;
		background: hsl(var(--color-primary));
		color: hsl(var(--color-primary-foreground));
		font-size: 0.8125rem;
		font-weight: 500;
		cursor: pointer;
	}
	.btn-create:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.btn-create:hover:not(:disabled) {
		filter: brightness(1.08);
	}
</style>
