/**
 * MyDay Tools — LLM-accessible day summary.
 *
 * Single read-only tool that aggregates today's snapshot + streaks
 * into one response. Gives the agent full daily context in one call.
 */

import type { ModuleTool } from '$lib/data/tools/types';
import { db } from '$lib/data/database';
import { decryptRecords } from '$lib/data/crypto';
import { DEFAULT_DAILY_GOAL_ML } from '$lib/modules/drink/types';
import type { LocalTask } from '$lib/modules/todo/types';
import type { LocalDrinkEntry } from '$lib/modules/drink/types';
import type { LocalPlace } from '$lib/modules/places/types';
import type { LocalTimeBlock } from '$lib/data/time-blocks/types';
import type { LocalGoal } from '$lib/companion/goals/types';

function todayStr(): string {
	return new Date().toISOString().split('T')[0];
}

export const mydayTools: ModuleTool[] = [
	{
		name: 'get_myday_summary',
		module: 'myday',
		description:
			'Gibt eine komplette Tageszusammenfassung zurueck: Tasks, Termine, Trinken, Ernaehrung, Orte, Habits/Streaks und aktive Ziele. Nutze dieses Tool zuerst, um den vollen Tageskontext zu bekommen.',
		parameters: [],
		async execute() {
			const today = todayStr();
			const now = new Date().toISOString();
			const todayStart = `${today}T00:00:00`;
			const todayEnd = `${today}T23:59:59`;

			// ── Parallel queries ────────────────────────
			const [allTasks, blocks, allDrinks, allPlaces, streakStates, goals] = await Promise.all([
				db.table<LocalTask>('tasks').toArray(),
				db
					.table<LocalTimeBlock>('timeBlocks')
					.where('startDate')
					.between(todayStart, todayEnd + '\uffff')
					.toArray(),
				db.table<LocalDrinkEntry>('drinkEntries').toArray(),
				db.table<LocalPlace>('places').toArray(),
				db.table('_streakState').toArray(),
				db.table<LocalGoal>('companionGoals').toArray(),
			]);

			// ── Filter + decrypt ────────────────────────
			const activeTasks = allTasks.filter((t) => !t.deletedAt);
			const eventBlocks = blocks.filter(
				(b) => !b.deletedAt && b.type === 'event' && b.sourceModule === 'calendar'
			);
			const todayDrinks = allDrinks.filter((d) => !d.deletedAt && d.date === today);

			const [decTasks, decBlocks, decDrinks] = await Promise.all([
				decryptRecords<LocalTask>('tasks', activeTasks),
				decryptRecords<LocalTimeBlock>('timeBlocks', eventBlocks),
				decryptRecords<LocalDrinkEntry>('drinkEntries', todayDrinks),
			]);

			// ── Tasks ───────────────────────────────────
			const openTasks = decTasks.filter((t) => !t.isCompleted);
			const completedCount = decTasks.filter((t) => t.isCompleted).length;
			const overdue = openTasks.filter((t) => t.dueDate != null && (t.dueDate as string) < today);
			const dueToday = openTasks.filter((t) => (t.dueDate as string) === today);

			// ── Events ──────────────────────────────────
			const events = decBlocks
				.sort((a, b) => (a.startDate as string).localeCompare(b.startDate as string))
				.map((b) => ({
					title: (b.title as string) ?? '',
					startTime: b.startDate,
					endTime: b.endDate ?? b.startDate,
					isAllDay: b.allDay ?? false,
				}));
			const upcoming = events.filter((e) => e.startTime >= now);

			// ── Drinks ──────────────────────────────────
			let waterMl = 0;
			let coffeeMl = 0;
			let coffeeCount = 0;
			let totalMl = 0;
			for (const d of decDrinks) {
				const ml = d.quantityMl ?? 0;
				totalMl += ml;
				if (d.drinkType === 'water') waterMl += ml;
				if (d.drinkType === 'coffee') {
					coffeeMl += ml;
					coffeeCount++;
				}
			}

			// ── Places ──────────────────────────────────
			const visitedToday = allPlaces.filter(
				(p) => !p.deletedAt && p.lastVisitedAt && (p.lastVisitedAt as string).startsWith(today)
			).length;

			// ── Streaks ─────────────────────────────────
			const yesterday = new Date();
			yesterday.setDate(yesterday.getDate() - 1);
			const yesterdayS = yesterday.toISOString().split('T')[0];

			const streaks = (streakStates as Array<Record<string, unknown>>)
				.filter((s) => s.lastActiveDate === today || s.lastActiveDate === yesterdayS)
				.map((s) => ({
					label: s.label as string,
					streak: s.currentStreak as number,
					status: s.lastActiveDate === today ? 'active' : 'at_risk',
				}));

			// ── Active Goals ────────────────────────────
			const activeGoals = goals
				.filter((g) => g.status === 'active' && !g.deletedAt)
				.map((g) => ({
					title: g.title,
					current: g.currentValue,
					target: g.target.value,
					period: g.target.period,
					percent: Math.round((g.currentValue / g.target.value) * 100),
				}));

			const summary = {
				date: today,
				tasks: {
					open: openTasks.length,
					completed: completedCount,
					overdue: overdue.length,
					dueToday: dueToday.slice(0, 10).map((t) => ({
						title: (t.title as string) ?? '',
						priority: t.priority as string | undefined,
					})),
				},
				events: {
					total: events.length,
					upcoming: upcoming.slice(0, 5).map((e) => ({
						title: e.title,
						startTime: e.startTime,
						isAllDay: e.isAllDay,
					})),
				},
				drinks: {
					water: {
						ml: waterMl,
						goal: DEFAULT_DAILY_GOAL_ML,
						percent: Math.round((waterMl / DEFAULT_DAILY_GOAL_ML) * 100),
					},
					coffee: { count: coffeeCount },
					total: { ml: totalMl, count: decDrinks.length },
				},
				places: { visitedToday },
				streaks,
				goals: activeGoals,
			};

			const parts: string[] = [];
			parts.push(
				`${today}: ${openTasks.length} offene Tasks (${completedCount} erledigt, ${overdue.length} ueberfaellig)`
			);
			if (upcoming.length > 0)
				parts.push(`${events.length} Termine (naechster: ${upcoming[0].title})`);
			parts.push(`Wasser: ${waterMl}/${DEFAULT_DAILY_GOAL_ML}ml, ${coffeeCount} Kaffee`);
			if (activeGoals.length > 0) parts.push(`${activeGoals.length} aktive Ziele`);

			return {
				success: true,
				data: summary,
				message: parts.join(' · '),
			};
		},
	},
];
