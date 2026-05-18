/**
 * Built-in Pulse Rules for the 5 pilot modules.
 */

import type { PulseRule } from './types';

export const waterReminderRule: PulseRule = {
	id: 'water-reminder',
	name: 'Wasser-Erinnerung',
	trigger: { kind: 'interval', minutes: 90 },
	check(ctx) {
		const { water } = ctx.day.drinks;
		if (water.percent >= 100) return null;
		if (ctx.hour < 8 || ctx.hour > 21) return null;

		const remaining = water.goal - water.ml;
		const hoursLeft = Math.max(21 - ctx.hour, 1);
		const mlPerHour = Math.ceil(remaining / hoursLeft);

		return {
			id: `water-${ctx.day.date}-${ctx.hour}`,
			type: 'water_reminder',
			title: 'Wasser trinken',
			body: `Noch ${remaining}ml bis zum Ziel (~${mlPerHour}ml/Stunde).`,
			priority: water.percent < 50 ? 'medium' : 'low',
			actionLabel: 'Glas loggen',
			actionRoute: '/drink',
		};
	},
};

export const streakWarningRule: PulseRule = {
	id: 'streak-warning',
	name: 'Streak-Warnung',
	trigger: { kind: 'schedule', hours: [18] },
	check(ctx) {
		const atRisk = ctx.streaks.filter((s) => s.status === 'at_risk');
		if (atRisk.length === 0) return null;

		const best = atRisk.reduce((a, b) => (a.currentStreak > b.currentStreak ? a : b));

		return {
			id: `streak-${ctx.day.date}`,
			type: 'streak_warning',
			title: `${best.label}-Streak in Gefahr!`,
			body: `${best.currentStreak} Tage — nicht heute verlieren.`,
			priority: best.currentStreak > 7 ? 'high' : 'medium',
		};
	},
};

export const morningSummaryRule: PulseRule = {
	id: 'morning-summary',
	name: 'Morgen-Zusammenfassung',
	trigger: { kind: 'schedule', hours: [8] },
	check(ctx) {
		const { tasks, events } = ctx.day;
		const parts: string[] = [];

		if (tasks.dueToday.length > 0) {
			parts.push(`${tasks.dueToday.length} Tasks faellig`);
		}
		if (tasks.overdue > 0) {
			parts.push(`${tasks.overdue} ueberfaellig`);
		}
		if (events.total > 0) {
			parts.push(`${events.total} Termine`);
		}

		if (parts.length === 0) {
			return {
				id: `morning-${ctx.day.date}`,
				type: 'morning_summary',
				title: 'Guten Morgen!',
				body: 'Keine Tasks oder Termine heute — freier Tag.',
				priority: 'low',
			};
		}

		return {
			id: `morning-${ctx.day.date}`,
			type: 'morning_summary',
			title: 'Guten Morgen!',
			body: `Heute: ${parts.join(', ')}.`,
			priority: tasks.overdue > 0 ? 'medium' : 'low',
		};
	},
};

export const overdueTasksRule: PulseRule = {
	id: 'overdue-tasks',
	name: 'Ueberfaellige Tasks',
	trigger: { kind: 'schedule', hours: [10, 15] },
	check(ctx) {
		if (ctx.day.tasks.overdue === 0) return null;

		return {
			id: `overdue-${ctx.day.date}-${ctx.hour}`,
			type: 'overdue_tasks',
			title: `${ctx.day.tasks.overdue} ueberfaellige Tasks`,
			body: 'Erledigen oder verschieben?',
			priority: ctx.day.tasks.overdue > 3 ? 'high' : 'medium',
			actionLabel: 'Tasks anzeigen',
			actionRoute: '/todo',
		};
	},
};

/** All built-in rules */
export const DEFAULT_RULES: PulseRule[] = [
	waterReminderRule,
	streakWarningRule,
	morningSummaryRule,
	overdueTasksRule,
];
