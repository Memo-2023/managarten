/**
 * Body module typed contexts.
 *
 * Usage:
 *   Layout:  bodyExercisesCtx.provide(useAllBodyExercises());
 *   Page:    const exercises = bodyExercisesCtx.consume();
 *            let list = $derived(exercises.value);
 */

import { createModuleContext } from '$lib/data/module-context';
import type {
	BodyExercise,
	BodyRoutine,
	BodyWorkout,
	BodySet,
	BodyMeasurement,
	BodyCheck,
	BodyPhase,
} from './types';

export const bodyExercisesCtx = createModuleContext<BodyExercise[]>('bodyExercises');
export const bodyRoutinesCtx = createModuleContext<BodyRoutine[]>('bodyRoutines');
export const bodyWorkoutsCtx = createModuleContext<BodyWorkout[]>('bodyWorkouts');
export const bodySetsCtx = createModuleContext<BodySet[]>('bodySets');
export const bodyMeasurementsCtx = createModuleContext<BodyMeasurement[]>('bodyMeasurements');
export const bodyChecksCtx = createModuleContext<BodyCheck[]>('bodyChecks');
export const bodyPhasesCtx = createModuleContext<BodyPhase[]>('bodyPhases');
