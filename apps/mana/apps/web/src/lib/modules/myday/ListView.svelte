<!--
  Mein Tag — DaySnapshot overview as a workbench page.
  Shows tasks, events, drinks, nutrition, places at a glance.
-->
<script lang="ts">
	import { useDaySnapshot } from '$lib/data/projections/day-snapshot';
	import { useStreaks } from '$lib/data/projections/streaks';
	import { CheckCircle, CalendarBlank, Drop, MapPin, Fire } from '@mana/shared-icons';
	import { _ } from 'svelte-i18n';

	const day = useDaySnapshot();
	const streaks = useStreaks();
</script>

<div class="myday">
	<!-- Tasks -->
	<div class="section">
		<div class="section-header">
			<CheckCircle size={18} weight="bold" />
			<span>{$_('myday.list_view.section_tasks')}</span>
			<span class="badge"
				>{day.value.tasks.completed}/{day.value.tasks.total + day.value.tasks.completed}</span
			>
		</div>
		{#if day.value.tasks.overdue > 0}
			<div class="alert">
				{$_('myday.list_view.alert_overdue', { values: { n: day.value.tasks.overdue } })}
			</div>
		{/if}
		{#each day.value.tasks.dueToday.slice(0, 5) as t}
			<div class="item">• {t.title}</div>
		{/each}
		{#if day.value.tasks.dueToday.length === 0 && day.value.tasks.total === 0}
			<div class="empty">{$_('myday.list_view.empty_no_tasks')}</div>
		{/if}
	</div>

	<!-- Events -->
	<div class="section">
		<div class="section-header">
			<CalendarBlank size={18} weight="bold" />
			<span>{$_('myday.list_view.section_events')}</span>
			<span class="badge">{day.value.events.total}</span>
		</div>
		{#each day.value.events.upcoming.slice(0, 4) as e}
			<div class="item">
				<span class="time">{e.startTime.slice(11, 16)}</span>
				{e.title}
			</div>
		{/each}
		{#if day.value.events.total === 0}
			<div class="empty">{$_('myday.list_view.empty_no_events')}</div>
		{/if}
	</div>

	<!-- Drinks -->
	<div class="section">
		<div class="section-header">
			<Drop size={18} weight="bold" />
			<span>{$_('myday.list_view.section_water')}</span>
			<span class="badge">{day.value.drinks.water.percent}%</span>
		</div>
		<div class="progress-bar">
			<div
				class="progress-fill water"
				style:width="{Math.min(day.value.drinks.water.percent, 100)}%"
			></div>
		</div>
		<div class="stat">{day.value.drinks.water.ml} / {day.value.drinks.water.goal} ml</div>
		{#if day.value.drinks.coffee.count > 0}
			<div class="stat-secondary">
				{$_('myday.list_view.coffee_count', { values: { n: day.value.drinks.coffee.count } })}
			</div>
		{/if}
	</div>

	<!-- Streaks -->
	{#if streaks.value.length > 0}
		<div class="section">
			<div class="section-header">
				<Fire size={18} weight="bold" />
				<span>{$_('myday.list_view.section_streaks')}</span>
			</div>
			{#each streaks.value as s}
				<div class="streak-row">
					<span class="streak-label">{s.label}</span>
					<span
						class="streak-count"
						class:active={s.status === 'active'}
						class:risk={s.status === 'at_risk'}
						class:broken={s.status === 'broken'}
					>
						{s.currentStreak}d
					</span>
				</div>
			{/each}
		</div>
	{/if}
</div>

<style>
	.myday {
		padding: 0.75rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}

	.section {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.section-header {
		display: flex;
		align-items: center;
		gap: 0.375rem;
		font-weight: 600;
		font-size: 0.8125rem;
		color: hsl(var(--color-foreground));
	}

	.badge {
		margin-left: auto;
		font-size: 0.75rem;
		font-weight: 500;
		color: hsl(var(--color-muted-foreground));
	}

	.item {
		font-size: 0.8125rem;
		color: hsl(var(--color-foreground));
		padding-left: 1.5rem;
	}

	.time {
		font-size: 0.75rem;
		color: hsl(var(--color-primary));
		font-weight: 500;
		margin-right: 0.375rem;
	}

	.alert {
		font-size: 0.75rem;
		color: hsl(var(--color-error, 0 84% 60%));
		font-weight: 500;
		padding-left: 1.5rem;
	}

	.empty {
		font-size: 0.75rem;
		color: hsl(var(--color-muted-foreground));
		padding-left: 1.5rem;
		font-style: italic;
	}

	.progress-bar {
		height: 4px;
		background: hsl(var(--color-muted) / 0.3);
		border-radius: 2px;
		overflow: hidden;
	}

	.progress-fill {
		height: 100%;
		border-radius: 2px;
		transition: width 0.3s ease;
	}
	.progress-fill.water {
		background: hsl(200 80% 55%);
	}

	.stat {
		font-size: 0.75rem;
		color: hsl(var(--color-foreground));
	}

	.stat-secondary {
		font-size: 0.6875rem;
		color: hsl(var(--color-muted-foreground));
	}

	.streak-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		padding-left: 1.5rem;
	}

	.streak-label {
		font-size: 0.8125rem;
		color: hsl(var(--color-foreground));
	}

	.streak-count {
		font-size: 0.75rem;
		font-weight: 600;
		padding: 0.125rem 0.5rem;
		border-radius: 9999px;
	}
	.streak-count.active {
		background: hsl(142 71% 45% / 0.15);
		color: hsl(142 71% 45%);
	}
	.streak-count.risk {
		background: hsl(45 93% 47% / 0.15);
		color: hsl(45 93% 47%);
	}
	.streak-count.broken {
		background: hsl(var(--color-muted) / 0.2);
		color: hsl(var(--color-muted-foreground));
	}
</style>
