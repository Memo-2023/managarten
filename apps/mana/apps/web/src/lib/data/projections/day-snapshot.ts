/**
 * DaySnapshot — Live-reactive aggregation of today's data across modules.
 *
 * Answers: "What's happening today?" by querying all 5 pilot modules
 * and returning a single flat object. Updates automatically when any
 * underlying Dexie table changes (via liveQuery subscriptions).
 *
 * Usage in Svelte components:
 *   const day = useDaySnapshot();
 *   // day.value.tasks.completed, day.value.drinks.water.percent, ...
 */

import { useLiveQueryWithDefault } from '@mana/local-store/svelte';
import { db } from '../database';
import { decryptRecords } from '../crypto';
import { DEFAULT_DAILY_GOAL_ML } from '$lib/modules/drink/types';
import { trackingStore } from '$lib/modules/places/stores/tracking.svelte';
import type { LocalTask } from '$lib/modules/todo/types';
import type { LocalEvent } from '$lib/modules/calendar/types';
import type { LocalDrinkEntry } from '$lib/modules/drink/types';
import type { LocalPlace } from '$lib/modules/places/types';
import type { LocalTimeBlock } from '../time-blocks/types';
import type { DaySnapshot, TaskSummary, EventSummary } from './types';

function todayStr(): string {
	return new Date().toISOString().split('T')[0];
}

function emptySnapshot(date: string): DaySnapshot {
	return {
		date,
		tasks: { total: 0, completed: 0, overdue: 0, dueToday: [] },
		events: { upcoming: [], total: 0, nextEvent: null },
		drinks: {
			water: { ml: 0, goal: DEFAULT_DAILY_GOAL_ML, percent: 0 },
			coffee: { ml: 0, count: 0 },
			total: { ml: 0, count: 0 },
		},
		places: { visitedToday: 0, tracking: false },
	};
}

async function buildSnapshot(): Promise<DaySnapshot> {
	const today = todayStr();
	const now = new Date().toISOString();
	const todayStart = `${today}T00:00:00`;
	const todayEnd = `${today}T23:59:59`;

	// ── Parallel queries — all modules at once ──────
	const [allTasks, blocks, allDrinks, allPlaces] = await Promise.all([
		db.table<LocalTask>('tasks').toArray(),
		db
			.table<LocalTimeBlock>('timeBlocks')
			.where('startDate')
			.between(todayStart, todayEnd + '\uffff')
			.toArray(),
		db.table<LocalDrinkEntry>('drinkEntries').toArray(),
		db.table<LocalPlace>('places').toArray(),
	]);

	// ── Parallel decryption ─────────────────────────
	const activeTasks = allTasks.filter((t) => !t.deletedAt);
	const eventBlocks = blocks.filter(
		(b) => !b.deletedAt && b.type === 'event' && b.sourceModule === 'calendar'
	);
	const todayDrinks = allDrinks.filter((d) => !d.deletedAt && d.date === today);

	const [decryptedTasks, decryptedBlocks, decryptedDrinks] = await Promise.all([
		decryptRecords<LocalTask>('tasks', activeTasks),
		decryptRecords<LocalTimeBlock>('timeBlocks', eventBlocks),
		decryptRecords<LocalDrinkEntry>('drinkEntries', todayDrinks),
	]);

	// ── Tasks ───────────────────────────────────────
	const completedCount = decryptedTasks.filter((t) => t.isCompleted).length;
	const overdue = decryptedTasks.filter(
		(t) => !t.isCompleted && t.dueDate != null && (t.dueDate as string) < today
	);
	const dueToday = decryptedTasks.filter((t) => !t.isCompleted && (t.dueDate as string) === today);
	const dueTodaySummaries: TaskSummary[] = dueToday.map((t) => ({
		id: t.id,
		title: (t.title as string) ?? '',
		priority: t.priority as string | undefined,
		projectId: t.projectId as string | undefined,
	}));

	// ── Calendar Events ─────────────────────────────
	const eventSummaries: EventSummary[] = decryptedBlocks
		.sort((a, b) => (a.startDate as string).localeCompare(b.startDate as string))
		.map((b) => ({
			id: b.sourceId,
			title: (b.title as string) ?? '',
			startTime: b.startDate,
			endTime: b.endDate ?? b.startDate,
			isAllDay: b.allDay ?? false,
			calendarId: '',
		}));
	const upcomingEvents = eventSummaries.filter((e) => e.startTime >= now).slice(0, 5);
	const nextEvent = upcomingEvents[0] ?? null;

	// ── Drinks ──────────────────────────────────────
	let waterMl = 0;
	let coffeeMl = 0;
	let coffeeCount = 0;
	let totalMl = 0;
	let totalCount = 0;
	for (const d of decryptedDrinks) {
		const ml = d.quantityMl ?? 0;
		totalMl += ml;
		totalCount++;
		if (d.drinkType === 'water') waterMl += ml;
		if (d.drinkType === 'coffee') {
			coffeeMl += ml;
			coffeeCount++;
		}
	}

	// ── Places ──────────────────────────────────────
	const visitedToday = allPlaces.filter(
		(p) => !p.deletedAt && p.lastVisitedAt && (p.lastVisitedAt as string).startsWith(today)
	).length;

	return {
		date: today,
		tasks: {
			total: decryptedTasks.filter((t) => !t.isCompleted).length,
			completed: completedCount,
			overdue: overdue.length,
			dueToday: dueTodaySummaries,
		},
		events: {
			upcoming: upcomingEvents,
			total: eventSummaries.length,
			nextEvent,
		},
		drinks: {
			water: {
				ml: waterMl,
				goal: DEFAULT_DAILY_GOAL_ML,
				percent: Math.round((waterMl / DEFAULT_DAILY_GOAL_ML) * 100),
			},
			coffee: { ml: coffeeMl, count: coffeeCount },
			total: { ml: totalMl, count: totalCount },
		},
		places: {
			visitedToday,
			tracking: trackingStore.isTracking,
		},
	};
}

/**
 * Reactive DaySnapshot — updates automatically when any underlying
 * table changes. Use in Svelte components:
 *
 * ```svelte
 * const day = useDaySnapshot();
 * <p>{day.value.tasks.completed} Tasks erledigt</p>
 * ```
 */
export function useDaySnapshot() {
	return useLiveQueryWithDefault<DaySnapshot>(buildSnapshot, emptySnapshot(todayStr()));
}
