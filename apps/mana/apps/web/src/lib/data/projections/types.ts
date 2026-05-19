/**
 * Projection types for the Companion Brain.
 *
 * Projections are live-reactive aggregations over module data.
 * They answer high-level questions ("What's happening today?",
 * "Which streaks are at risk?") without consumers needing to
 * know which tables to query.
 */

// ── DaySnapshot ─────────────────────────────────────

export interface TaskSummary {
	id: string;
	title: string;
	priority?: string;
	projectId?: string;
}

export interface EventSummary {
	id: string;
	title: string;
	startTime: string;
	endTime: string;
	isAllDay: boolean;
	calendarId: string;
}

export interface DaySnapshot {
	date: string; // YYYY-MM-DD

	tasks: {
		total: number;
		completed: number;
		overdue: number;
		dueToday: TaskSummary[];
	};

	events: {
		upcoming: EventSummary[];
		total: number;
		nextEvent: EventSummary | null;
	};

	drinks: {
		water: { ml: number; goal: number; percent: number };
		coffee: { ml: number; count: number };
		total: { ml: number; count: number };
	};
}

// ── Streaks ─────────────────────────────────────────

export interface StreakInfo {
	id: string;
	moduleId: string;
	label: string;
	currentStreak: number;
	longestStreak: number;
	lastActiveDate: string; // YYYY-MM-DD
	status: 'active' | 'at_risk' | 'broken';
}
