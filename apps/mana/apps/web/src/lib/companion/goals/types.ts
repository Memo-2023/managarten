/**
 * Goal System types for the Companion Brain.
 *
 * Goals connect modules via metrics ("4x Sport/Woche", "8 Glaeser
 * Wasser/Tag"). Progress is tracked by subscribing to domain events.
 */

import type { VisibilityLevel } from '@mana/shared-privacy';

export interface LocalGoal {
	id: string;
	title: string;
	description?: string;

	/** How to measure progress */
	metric: GoalMetric;
	/** What counts as success */
	target: GoalTarget;

	/** Primary module */
	moduleId: string;

	status: 'active' | 'paused' | 'completed' | 'abandoned';

	/** Current period progress (resets each period) */
	currentValue: number;
	currentPeriodStart: string; // ISO date

	visibility?: VisibilityLevel;
	visibilityChangedAt?: string;
	visibilityChangedBy?: string;
	unlistedToken?: string;

	createdAt: string;
	updatedAt: string;
	deletedAt?: string;
}

export interface GoalMetric {
	/** How to aggregate */
	source: 'event_count' | 'event_sum';
	/** Which domain event to count/sum */
	eventType: string;
	/** Optional filter: only count events where payload[filterField] === filterValue */
	filterField?: string;
	filterValue?: string;
	/** For event_sum: which payload field to sum */
	sumField?: string;
}

export interface GoalTarget {
	value: number;
	period: 'day' | 'week' | 'month';
	/** gte = at least, lte = at most */
	comparison: 'gte' | 'lte';
}

// ── Templates ───────────────────────────────────────

export interface GoalTemplate {
	id: string;
	title: string;
	description: string;
	moduleId: string;
	metric: GoalMetric;
	target: GoalTarget;
}

export const GOAL_TEMPLATES: GoalTemplate[] = [
	{
		id: 'tpl-water-daily',
		title: '8 Glaeser Wasser am Tag',
		description: 'Taeglich 2000ml Wasser trinken',
		moduleId: 'drink',
		metric: {
			source: 'event_count',
			eventType: 'DrinkLogged',
			filterField: 'drinkType',
			filterValue: 'water',
		},
		target: { value: 8, period: 'day', comparison: 'gte' },
	},
	{
		id: 'tpl-tasks-daily',
		title: '5 Tasks pro Tag',
		description: 'Jeden Tag mindestens 5 Tasks erledigen',
		moduleId: 'todo',
		metric: { source: 'event_count', eventType: 'TaskCompleted' },
		target: { value: 5, period: 'day', comparison: 'gte' },
	},
	{
		id: 'tpl-places-weekly',
		title: 'Neue Orte entdecken',
		description: 'Mindestens 3 verschiedene Orte pro Woche besuchen',
		moduleId: 'places',
		metric: { source: 'event_count', eventType: 'PlaceVisited' },
		target: { value: 3, period: 'week', comparison: 'gte' },
	},
	{
		id: 'tpl-coffee-limit',
		title: 'Kaffee-Limit',
		description: 'Maximal 3 Kaffee pro Tag',
		moduleId: 'drink',
		metric: {
			source: 'event_count',
			eventType: 'DrinkLogged',
			filterField: 'drinkType',
			filterValue: 'coffee',
		},
		target: { value: 3, period: 'day', comparison: 'lte' },
	},
];
