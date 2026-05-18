/**
 * Reactive Queries & Pure Helpers for the Body module.
 *
 * Read-side only — mutations live in stores/body.svelte.ts.
 */

import { useScopedLiveQuery } from '$lib/data/scope/use-scoped-live-query.svelte';
import { deriveUpdatedAt } from '$lib/data/sync';
import { decryptRecords } from '$lib/data/crypto';
import { db } from '$lib/data/database';
import { scopedForModule } from '$lib/data/scope';
import type {
	LocalBodyExercise,
	LocalBodyRoutine,
	LocalBodyWorkout,
	LocalBodySet,
	LocalBodyMeasurement,
	LocalBodyCheck,
	LocalBodyPhase,
	BodyExercise,
	BodyRoutine,
	BodyWorkout,
	BodySet,
	BodyMeasurement,
	BodyCheck,
	BodyPhase,
} from './types';

// ─── Type Converters ────────────────────────────────────────

export function toBodyExercise(local: LocalBodyExercise): BodyExercise {
	const now = new Date().toISOString();
	return {
		id: local.id,
		name: local.name,
		muscleGroup: local.muscleGroup,
		equipment: local.equipment,
		notes: local.notes ?? null,
		isArchived: local.isArchived,
		isPreset: local.isPreset,
		createdAt: local.createdAt ?? now,
		updatedAt: deriveUpdatedAt(local),
	};
}

export function toBodyRoutine(local: LocalBodyRoutine): BodyRoutine {
	const now = new Date().toISOString();
	return {
		id: local.id,
		name: local.name,
		description: local.description ?? null,
		exerciseIds: local.exerciseIds ?? [],
		order: local.order,
		isArchived: local.isArchived,
		createdAt: local.createdAt ?? now,
		updatedAt: deriveUpdatedAt(local),
	};
}

export function toBodyWorkout(local: LocalBodyWorkout): BodyWorkout {
	const now = new Date().toISOString();
	return {
		id: local.id,
		startedAt: local.startedAt,
		endedAt: local.endedAt ?? null,
		routineId: local.routineId ?? null,
		title: local.title ?? null,
		notes: local.notes ?? null,
		rpe: local.rpe ?? null,
		createdAt: local.createdAt ?? now,
		updatedAt: deriveUpdatedAt(local),
	};
}

export function toBodySet(local: LocalBodySet): BodySet {
	return {
		id: local.id,
		workoutId: local.workoutId,
		exerciseId: local.exerciseId,
		order: local.order,
		reps: local.reps,
		weight: local.weight,
		weightUnit: local.weightUnit,
		rpe: local.rpe ?? null,
		isWarmup: local.isWarmup,
		notes: local.notes ?? null,
		createdAt: local.createdAt ?? new Date().toISOString(),
	};
}

export function toBodyMeasurement(local: LocalBodyMeasurement): BodyMeasurement {
	return {
		id: local.id,
		date: local.date,
		type: local.type,
		value: local.value,
		unit: local.unit,
		notes: local.notes ?? null,
		createdAt: local.createdAt ?? new Date().toISOString(),
	};
}

export function toBodyCheck(local: LocalBodyCheck): BodyCheck {
	return {
		id: local.id,
		date: local.date,
		energy: local.energy ?? null,
		sleep: local.sleep ?? null,
		soreness: local.soreness ?? null,
		mood: local.mood ?? null,
		notes: local.notes ?? null,
		createdAt: local.createdAt ?? new Date().toISOString(),
	};
}

export function toBodyPhase(local: LocalBodyPhase): BodyPhase {
	const now = new Date().toISOString();
	return {
		id: local.id,
		kind: local.kind,
		startDate: local.startDate,
		endDate: local.endDate ?? null,
		startWeight: local.startWeight ?? null,
		targetWeight: local.targetWeight ?? null,
		notes: local.notes ?? null,
		createdAt: local.createdAt ?? now,
		updatedAt: deriveUpdatedAt(local),
	};
}

// ─── Live Queries ───────────────────────────────────────────

export function useAllBodyExercises() {
	return useScopedLiveQuery(async () => {
		const locals = await scopedForModule<LocalBodyExercise, string>(
			'body',
			'bodyExercises'
		).toArray();
		const visible = locals.filter((e) => !e.deletedAt);
		const decrypted = await decryptRecords('bodyExercises', visible);
		return decrypted.map(toBodyExercise).sort((a, b) => a.name.localeCompare(b.name));
	}, [] as BodyExercise[]);
}

export function useAllBodyRoutines() {
	return useScopedLiveQuery(async () => {
		const locals = await scopedForModule<LocalBodyRoutine, string>('body', 'bodyRoutines').sortBy(
			'order'
		);
		const visible = locals.filter((r) => !r.deletedAt);
		const decrypted = await decryptRecords('bodyRoutines', visible);
		return decrypted.map(toBodyRoutine);
	}, [] as BodyRoutine[]);
}

export function useAllBodyWorkouts() {
	return useScopedLiveQuery(async () => {
		const locals = await scopedForModule<LocalBodyWorkout, string>(
			'body',
			'bodyWorkouts'
		).toArray();
		const visible = locals.filter((w) => !w.deletedAt);
		const decrypted = await decryptRecords('bodyWorkouts', visible);
		return decrypted.map(toBodyWorkout).sort((a, b) => b.startedAt.localeCompare(a.startedAt));
	}, [] as BodyWorkout[]);
}

export function useAllBodySets() {
	return useScopedLiveQuery(async () => {
		const locals = await scopedForModule<LocalBodySet, string>('body', 'bodySets').toArray();
		const visible = locals.filter((s) => !s.deletedAt);
		const decrypted = await decryptRecords('bodySets', visible);
		return decrypted.map(toBodySet);
	}, [] as BodySet[]);
}

export function useSetsForWorkout(workoutId: string) {
	return useScopedLiveQuery(async () => {
		const locals = await db
			.table<LocalBodySet>('bodySets')
			.where('workoutId')
			.equals(workoutId)
			.toArray();
		const visible = locals.filter((s) => !s.deletedAt);
		const decrypted = await decryptRecords('bodySets', visible);
		return decrypted.map(toBodySet).sort((a, b) => a.order - b.order);
	}, [] as BodySet[]);
}

export function useAllBodyMeasurements() {
	return useScopedLiveQuery(async () => {
		const locals = await scopedForModule<LocalBodyMeasurement, string>(
			'body',
			'bodyMeasurements'
		).toArray();
		const visible = locals.filter((m) => !m.deletedAt);
		const decrypted = await decryptRecords('bodyMeasurements', visible);
		return decrypted.map(toBodyMeasurement).sort((a, b) => b.date.localeCompare(a.date));
	}, [] as BodyMeasurement[]);
}

export function useAllBodyChecks() {
	return useScopedLiveQuery(async () => {
		const locals = await scopedForModule<LocalBodyCheck, string>('body', 'bodyChecks').toArray();
		const visible = locals.filter((c) => !c.deletedAt);
		const decrypted = await decryptRecords('bodyChecks', visible);
		return decrypted.map(toBodyCheck).sort((a, b) => b.date.localeCompare(a.date));
	}, [] as BodyCheck[]);
}

export function useAllBodyPhases() {
	return useScopedLiveQuery(async () => {
		const locals = await scopedForModule<LocalBodyPhase, string>('body', 'bodyPhases').toArray();
		const visible = locals.filter((p) => !p.deletedAt);
		const decrypted = await decryptRecords('bodyPhases', visible);
		return decrypted.map(toBodyPhase).sort((a, b) => b.startDate.localeCompare(a.startDate));
	}, [] as BodyPhase[]);
}

/** Helper: YYYY-MM-DD `n` days ago. */
export function dateNDaysAgo(n: number): string {
	const d = new Date();
	d.setDate(d.getDate() - n);
	return d.toISOString().split('T')[0];
}

// ─── Pure Helpers ───────────────────────────────────────────

/** Today as YYYY-MM-DD. */
export function todayDateStr(): string {
	return new Date().toISOString().split('T')[0];
}

/** Latest weight measurement (in whatever unit the user logged it). */
export function getLatestWeight(measurements: BodyMeasurement[]): BodyMeasurement | null {
	return measurements.find((m) => m.type === 'weight') ?? null;
}

/** Volume = sum(reps * weight) for non-warmup sets, in the unit of the first set. */
export function getWorkoutVolume(sets: BodySet[]): number {
	return sets.filter((s) => !s.isWarmup).reduce((sum, s) => sum + s.reps * s.weight, 0);
}

/**
 * Best (heaviest) working set per exercise across the supplied sets.
 * Used for the "PR feed" + per-exercise progression chart.
 */
export function getBestSetByExercise(sets: BodySet[]): Map<string, BodySet> {
	const best = new Map<string, BodySet>();
	for (const s of sets) {
		if (s.isWarmup) continue;
		const current = best.get(s.exerciseId);
		if (!current || s.weight > current.weight) {
			best.set(s.exerciseId, s);
		}
	}
	return best;
}

/** Estimated 1-rep-max via the Epley formula. */
export function estimateOneRepMax(weight: number, reps: number): number {
	if (reps <= 0) return 0;
	if (reps === 1) return weight;
	return Math.round(weight * (1 + reps / 30));
}

/** Active (non-archived) exercises sorted by name. */
export function getActiveExercises(exercises: BodyExercise[]): BodyExercise[] {
	return exercises.filter((e) => !e.isArchived);
}

/** The currently-running workout (endedAt = null), if any. */
export function getActiveWorkout(workouts: BodyWorkout[]): BodyWorkout | null {
	return workouts.find((w) => w.endedAt === null) ?? null;
}

/** Phase that is currently in progress, if any. */
export function getActivePhase(phases: BodyPhase[]): BodyPhase | null {
	return phases.find((p) => p.endDate === null) ?? null;
}

/**
 * Most recent working (non-warmup) set for each exercise across the
 * supplied set list. Used by the exercise picker to render the
 * "Last: 80kg × 8 (3 days ago)" hint.
 */
export function getLastSetByExercise(sets: BodySet[]): Map<string, BodySet> {
	const out = new Map<string, BodySet>();
	for (const s of sets) {
		if (s.isWarmup) continue;
		const current = out.get(s.exerciseId);
		if (!current || s.createdAt > current.createdAt) {
			out.set(s.exerciseId, s);
		}
	}
	return out;
}

/** Estimated 1RM (Epley) timeline for one exercise across all sets. */
export interface E1rmPoint {
	date: string;
	value: number;
}
export function getE1rmTimeline(sets: BodySet[], exerciseId: string): E1rmPoint[] {
	// Best (highest) e1RM per calendar day — collapses multiple working sets
	// in one session down to the most informative point so the chart isn't
	// noisy with within-workout fluctuations.
	const bestPerDay = new Map<string, number>();
	for (const s of sets) {
		if (s.exerciseId !== exerciseId || s.isWarmup) continue;
		const day = (s.createdAt ?? '').split('T')[0];
		if (!day) continue;
		const e = estimateOneRepMax(s.weight, s.reps);
		const prev = bestPerDay.get(day) ?? 0;
		if (e > prev) bestPerDay.set(day, e);
	}
	return [...bestPerDay.entries()]
		.sort((a, b) => a[0].localeCompare(b[0]))
		.map(([date, value]) => ({ date, value }));
}

/** Coarse "X days ago" formatter. */
export function relativeDays(iso: string, now = new Date()): string {
	const then = new Date(iso);
	const days = Math.floor((now.getTime() - then.getTime()) / (1000 * 60 * 60 * 24));
	if (days <= 0) return 'heute';
	if (days === 1) return 'gestern';
	if (days < 7) return `vor ${days} Tagen`;
	if (days < 30) return `vor ${Math.floor(days / 7)} Wochen`;
	return `vor ${Math.floor(days / 30)} Monaten`;
}
