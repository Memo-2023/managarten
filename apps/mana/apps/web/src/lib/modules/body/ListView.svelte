<!--
  Body — main module view.

  Composes the actual feature components: workout logger when a session
  is running, otherwise a "start" prompt; weight chart with quick-log;
  daily energy/sleep/soreness/mood card; recent workouts.
-->
<script lang="ts">
	import { _ } from 'svelte-i18n';
	import {
		useAllBodyExercises,
		useAllBodyRoutines,
		useAllBodyWorkouts,
		useAllBodySets,
		useAllBodyMeasurements,
		useAllBodyChecks,
		useAllBodyPhases,
		getActiveWorkout,
		getActivePhase,
	} from './queries';
	import { bodyStore } from './stores/body.svelte';
	import WorkoutLogger from './components/WorkoutLogger.svelte';
	import MeasurementForm from './components/MeasurementForm.svelte';
	import WeightChart from './components/WeightChart.svelte';
	import DailyCheckCard from './components/DailyCheckCard.svelte';
	import RecentWorkouts from './components/RecentWorkouts.svelte';
	import RoutineManager from './components/RoutineManager.svelte';
	import PhaseManager from './components/PhaseManager.svelte';
	import ExerciseProgressionChart from './components/ExerciseProgressionChart.svelte';

	const exercisesQuery = useAllBodyExercises();
	const routinesQuery = useAllBodyRoutines();
	const workoutsQuery = useAllBodyWorkouts();
	const setsQuery = useAllBodySets();
	const measurementsQuery = useAllBodyMeasurements();
	const checksQuery = useAllBodyChecks();
	const phasesQuery = useAllBodyPhases();

	let exercises = $derived(exercisesQuery.value);
	let routines = $derived(routinesQuery.value);
	let workouts = $derived(workoutsQuery.value);
	let sets = $derived(setsQuery.value);
	let measurements = $derived(measurementsQuery.value);
	let checks = $derived(checksQuery.value);
	let phases = $derived(phasesQuery.value);

	let activeWorkout = $derived(getActiveWorkout(workouts));
	let activePhase = $derived(getActivePhase(phases));
	let activeExercises = $derived(exercises.filter((e) => !e.isArchived));

	async function startWorkout() {
		await bodyStore.startWorkout({});
	}
</script>

<svelte:head>
	<title>{$_('body.title', { default: 'Body' })} - Mana</title>
</svelte:head>

<div class="body-page">
	<section class="card">
		<PhaseManager {activePhase} />
	</section>

	<section class="card workout-card">
		{#if activeWorkout}
			<WorkoutLogger workout={activeWorkout} {sets} exercises={activeExercises} />
		{:else}
			<div class="start-row">
				<div>
					<h2>{$_('body.readyToTrain', { default: 'Bereit für ein Workout?' })}</h2>
					<p class="muted">
						{$_('body.startHint', { default: 'Starte eine neue Session und logge deine Sätze' })}
					</p>
				</div>
				<button type="button" onclick={startWorkout}>
					{$_('body.startWorkout', { default: 'Workout starten' })}
				</button>
			</div>
		{/if}
	</section>

	<section class="card">
		<RoutineManager {routines} {exercises} />
	</section>

	<section class="card">
		<h2>{$_('body.progression', { default: 'Progression' })}</h2>
		<ExerciseProgressionChart {sets} {exercises} />
	</section>

	<section class="card">
		<h2>{$_('body.weight', { default: 'Gewicht' })}</h2>
		<WeightChart {measurements} />
		<MeasurementForm />
	</section>

	<section class="card">
		<h2>{$_('body.dailyCheck', { default: 'Heute' })}</h2>
		<DailyCheckCard {checks} />
	</section>

	<section class="card">
		<h2>{$_('body.recent', { default: 'Letzte Workouts' })}</h2>
		<RecentWorkouts {workouts} {sets} />
	</section>
</div>

<style>
	.body-page {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 0 1rem;
		max-width: 720px;
	}
	.card {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 1rem;
		border-radius: 0.75rem;
		background: hsl(var(--color-card));
		border: 1px solid hsl(var(--color-border));
	}
	.card h2 {
		font-size: 0.875rem;
		font-weight: 600;
		color: hsl(var(--color-foreground));
	}
	.workout-card {
		gap: 0.875rem;
	}
	.start-row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
	}
	.start-row h2 {
		font-size: 1rem;
	}
	.muted {
		font-size: 0.8125rem;
		color: hsl(var(--color-muted-foreground));
	}
	button {
		padding: 0.625rem 1rem;
		border-radius: 0.5rem;
		background: hsl(var(--color-primary));
		color: hsl(var(--color-primary-foreground));
		font-size: 0.875rem;
		font-weight: 500;
		border: none;
		cursor: pointer;
	}
</style>
