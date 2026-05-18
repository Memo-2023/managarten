/**
 * Correlation Engine — Finds statistical relationships between daily
 * metrics from different modules.
 *
 * Computes Pearson correlation coefficients between pairs of daily
 * aggregates (e.g. "water intake" vs "tasks completed"). Only
 * correlations with |r| >= 0.3 and enough data points (>= 14 days)
 * are returned.
 *
 * All computation is local — no server, no LLM.
 */

import { queryEvents } from '$lib/data/events/event-store';
import type { Correlation } from '$lib/companion/memory/types';

const MIN_DAYS = 14;
const MIN_ABS_R = 0.3;
const LOOKBACK_DAYS = 60;

// ── Metric Definitions ──────────────────────────────

interface MetricDef {
	id: string;
	module: string;
	label: string;
	/** Extract a daily value from events for a given date */
	extract: (dayEvents: DayEventMap) => number;
}

type DayEventMap = Map<string, { type: string; payload: Record<string, unknown> }[]>;

function buildDayEventMap(
	events: { type: string; payload: unknown; meta: { timestamp: string } }[]
): DayEventMap {
	const map: DayEventMap = new Map();
	for (const e of events) {
		const date = e.meta.timestamp.split('T')[0];
		if (!map.has(date)) map.set(date, []);
		map.get(date)!.push({ type: e.type, payload: e.payload as Record<string, unknown> });
	}
	return map;
}

const METRICS: MetricDef[] = [
	{
		id: 'todo:completed',
		module: 'todo',
		label: 'Tasks erledigt',
		extract: (days) => countByType(days, 'TaskCompleted'),
	},
	{
		id: 'drink:water_ml',
		module: 'drink',
		label: 'Wasser (ml)',
		extract: (days) =>
			sumByTypeField(days, 'DrinkLogged', 'quantityMl', (p) => p.drinkType === 'water'),
	},
	{
		id: 'drink:coffee_count',
		module: 'drink',
		label: 'Kaffee (Tassen)',
		extract: (days) => countByType(days, 'DrinkLogged', (p) => p.drinkType === 'coffee'),
	},
	{
		id: 'calendar:events',
		module: 'calendar',
		label: 'Termine',
		extract: (days) => countByType(days, 'CalendarEventCreated'),
	},
	{
		id: 'places:visits',
		module: 'places',
		label: 'Orte besucht',
		extract: (days) => countByType(days, 'PlaceVisited'),
	},
];

function countByType(
	days: DayEventMap,
	eventType: string,
	filter?: (payload: Record<string, unknown>) => boolean
): number {
	let count = 0;
	for (const [, events] of days) {
		for (const e of events) {
			if (e.type === eventType && (!filter || filter(e.payload))) count++;
		}
	}
	return count;
}

function sumByTypeField(
	days: DayEventMap,
	eventType: string,
	field: string,
	filter?: (payload: Record<string, unknown>) => boolean
): number {
	let sum = 0;
	for (const [, events] of days) {
		for (const e of events) {
			if (e.type === eventType && (!filter || filter(e.payload))) {
				const val = e.payload[field];
				if (typeof val === 'number') sum += val;
			}
		}
	}
	return sum;
}

// ── Pearson Correlation ─────────────────────────────

function pearson(xs: number[], ys: number[]): number {
	const n = xs.length;
	if (n < 3) return 0;

	let sumX = 0,
		sumY = 0,
		sumXY = 0,
		sumX2 = 0,
		sumY2 = 0;
	for (let i = 0; i < n; i++) {
		sumX += xs[i];
		sumY += ys[i];
		sumXY += xs[i] * ys[i];
		sumX2 += xs[i] * xs[i];
		sumY2 += ys[i] * ys[i];
	}

	const denom = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));
	if (denom === 0) return 0;

	return (n * sumXY - sumX * sumY) / denom;
}

// ── Sentence Generation ─────────────────────────────

function generateSentence(labelA: string, labelB: string, r: number): string {
	const direction = r > 0 ? 'mehr' : 'weniger';
	const strength = Math.abs(r) > 0.6 ? 'deutlich' : 'etwas';
	return `An Tagen mit mehr ${labelA} hast du ${strength} ${direction} ${labelB}`;
}

// ── Main ────────────────────────────────────────────

/**
 * Compute correlations between all metric pairs.
 * Returns only significant correlations (|r| >= 0.3, >= 14 days).
 */
export async function computeCorrelations(): Promise<Correlation[]> {
	const since = new Date(Date.now() - LOOKBACK_DAYS * 86400000).toISOString();
	const allEvents = await queryEvents({ since, limit: 5000 });

	if (allEvents.length < 20) return [];

	const dayMap = buildDayEventMap(allEvents);
	const dates = [...dayMap.keys()].sort();

	if (dates.length < MIN_DAYS) return [];

	// Build daily metric vectors
	const metricVectors: Map<string, number[]> = new Map();
	for (const metric of METRICS) {
		const values: number[] = [];
		for (const date of dates) {
			const singleDayMap: DayEventMap = new Map([[date, dayMap.get(date) ?? []]]);
			values.push(metric.extract(singleDayMap));
		}
		// Skip metrics that are all zeros
		if (values.some((v) => v > 0)) {
			metricVectors.set(metric.id, values);
		}
	}

	// Compute pairwise correlations
	const correlations: Correlation[] = [];
	const metricIds = [...metricVectors.keys()];

	for (let i = 0; i < metricIds.length; i++) {
		for (let j = i + 1; j < metricIds.length; j++) {
			const idA = metricIds[i];
			const idB = metricIds[j];
			const metricA = METRICS.find((m) => m.id === idA)!;
			const metricB = METRICS.find((m) => m.id === idB)!;

			// Skip same-module correlations (trivially correlated)
			if (metricA.module === metricB.module) continue;

			const xs = metricVectors.get(idA)!;
			const ys = metricVectors.get(idB)!;
			const r = pearson(xs, ys);

			if (Math.abs(r) >= MIN_ABS_R) {
				correlations.push({
					id: `corr:${idA}:${idB}`,
					factorA: { module: metricA.module, metric: idA, label: metricA.label },
					factorB: { module: metricB.module, metric: idB, label: metricB.label },
					coefficient: Math.round(r * 100) / 100,
					sampleSize: dates.length,
					direction: r > 0 ? 'positive' : 'negative',
					sentence: generateSentence(metricA.label, metricB.label, r),
					computedAt: new Date().toISOString(),
				});
			}
		}
	}

	return correlations.sort((a, b) => Math.abs(b.coefficient) - Math.abs(a.coefficient));
}
