<script lang="ts">
	import { setContext } from 'svelte';
	import type { Snippet } from 'svelte';
	import {
		useAllBodyExercises,
		useAllBodyRoutines,
		useAllBodyWorkouts,
		useAllBodySets,
		useAllBodyMeasurements,
		useAllBodyChecks,
		useAllBodyPhases,
	} from '$lib/modules/body/queries';

	let { children }: { children: Snippet } = $props();

	setContext('bodyExercises', useAllBodyExercises());
	setContext('bodyRoutines', useAllBodyRoutines());
	setContext('bodyWorkouts', useAllBodyWorkouts());
	setContext('bodySets', useAllBodySets());
	setContext('bodyMeasurements', useAllBodyMeasurements());
	setContext('bodyChecks', useAllBodyChecks());
	setContext('bodyPhases', useAllBodyPhases());
</script>

{@render children()}
