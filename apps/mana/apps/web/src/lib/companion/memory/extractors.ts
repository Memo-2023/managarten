/**
 * Pattern Extractors — Analyze event history to discover user patterns.
 *
 * Each extractor scans the event store for a specific type of pattern
 * and records/confirms facts in the memory store. Run periodically
 * (e.g. daily) or after a batch of events.
 *
 * All extractors are rule-based (no LLM). They look for:
 * - Recurring day-of-week patterns (e.g. "trains Mon/Wed/Fri")
 * - Time-of-day preferences (e.g. "completes tasks mostly before noon")
 * - Sequences (e.g. "always logs coffee before first event")
 * - Frequency patterns (e.g. "drinks 3 coffees per day on average")
 */

import { queryEvents } from '$lib/data/events/event-store';
import { memoryStore } from './store';

const DAY_NAMES = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const LOOKBACK_DAYS = 30;

function daysAgoISO(n: number): string {
	const d = new Date();
	d.setDate(d.getDate() - n);
	return d.toISOString();
}

function dayOfWeek(timestamp: string): number {
	return new Date(timestamp).getDay();
}

function hourOfDay(timestamp: string): number {
	return new Date(timestamp).getHours();
}

interface DayCount {
	[day: number]: number;
}

// ── Recurring Day Pattern ───────────────────────────

/**
 * Detects which days of the week an event type occurs most.
 * E.g. "DrinkLogged(coffee) happens mostly on Mon/Tue/Wed/Thu/Fri" → work days.
 */
async function extractDayOfWeekPattern(
	eventType: string,
	label: string,
	module: string,
	filterFn?: (payload: Record<string, unknown>) => boolean
): Promise<void> {
	const since = daysAgoISO(LOOKBACK_DAYS);
	const events = await queryEvents({ type: eventType, since, limit: 500 });
	const filtered = filterFn
		? events.filter((e) => filterFn(e.payload as Record<string, unknown>))
		: events;

	if (filtered.length < 7) return; // Not enough data

	const dayCounts: DayCount = {};
	for (const e of filtered) {
		const day = dayOfWeek(e.meta.timestamp);
		dayCounts[day] = (dayCounts[day] ?? 0) + 1;
	}

	// Find days that have significantly more events than average
	const total = filtered.length;
	const avgPerDay = total / 7;
	const activeDays = Object.entries(dayCounts)
		.filter(([, count]) => count > avgPerDay * 1.3)
		.map(([day]) => Number(day))
		.sort();

	if (activeDays.length === 0 || activeDays.length === 7) return; // No pattern or every day

	const dayLabels = activeDays.map((d) => DAY_NAMES[d]).join('/');
	const factKey = `pattern:${module}:day_of_week:${eventType}`;

	await memoryStore.recordFact({
		factKey,
		category: 'pattern',
		content: `${label} typischerweise an ${dayLabels}`,
		sourceModules: [module],
	});
}

// ── Time of Day Preference ──────────────────────────

/**
 * Detects preferred time windows for an event type.
 * E.g. "Tasks mostly completed between 9-12" → morning productivity.
 */
async function extractTimePreference(
	eventType: string,
	label: string,
	module: string
): Promise<void> {
	const since = daysAgoISO(LOOKBACK_DAYS);
	const events = await queryEvents({ type: eventType, since, limit: 500 });

	if (events.length < 10) return;

	const hourCounts: Record<number, number> = {};
	for (const e of events) {
		const h = hourOfDay(e.meta.timestamp);
		hourCounts[h] = (hourCounts[h] ?? 0) + 1;
	}

	// Find the peak 4-hour window
	let bestStart = 0;
	let bestCount = 0;
	for (let start = 5; start <= 20; start++) {
		let count = 0;
		for (let h = start; h < start + 4; h++) {
			count += hourCounts[h] ?? 0;
		}
		if (count > bestCount) {
			bestCount = count;
			bestStart = start;
		}
	}

	const peakPercent = Math.round((bestCount / events.length) * 100);
	if (peakPercent < 40) return; // No clear peak

	const timeLabel = bestStart < 12 ? 'morgens' : bestStart < 17 ? 'nachmittags' : 'abends';
	const factKey = `preference:${module}:time_of_day:${eventType}`;

	await memoryStore.recordFact({
		factKey,
		category: 'preference',
		content: `${label} hauptsaechlich ${timeLabel} (${bestStart}:00-${bestStart + 4}:00, ${peakPercent}% aller Eintraege)`,
		sourceModules: [module],
	});
}

// ── Frequency Pattern ───────────────────────────────

/**
 * Detects average daily frequency of an event type.
 * E.g. "3 Kaffee pro Tag im Durchschnitt"
 */
async function extractFrequencyPattern(
	eventType: string,
	label: string,
	module: string,
	filterFn?: (payload: Record<string, unknown>) => boolean
): Promise<void> {
	const since = daysAgoISO(LOOKBACK_DAYS);
	const events = await queryEvents({ type: eventType, since, limit: 1000 });
	const filtered = filterFn
		? events.filter((e) => filterFn(e.payload as Record<string, unknown>))
		: events;

	if (filtered.length < 5) return;

	// Count per day
	const dayCounts: Record<string, number> = {};
	for (const e of filtered) {
		const date = e.meta.timestamp.split('T')[0];
		dayCounts[date] = (dayCounts[date] ?? 0) + 1;
	}

	const activeDays = Object.keys(dayCounts).length;
	if (activeDays < 3) return;

	const avg = Math.round((filtered.length / activeDays) * 10) / 10;
	const factKey = `pattern:${module}:frequency:${eventType}`;

	await memoryStore.recordFact({
		factKey,
		category: 'pattern',
		content: `Durchschnittlich ${avg} ${label} pro Tag (letzte ${activeDays} aktive Tage)`,
		sourceModules: [module],
	});
}

// ── Run All Extractors ──────────────────────────────

/**
 * Run all pattern extractors. Call once daily (e.g. from a scheduled rule
 * or on app startup after data has loaded).
 */
export async function extractAllPatterns(): Promise<void> {
	await Promise.all([
		// Todo patterns
		extractDayOfWeekPattern('TaskCompleted', 'Tasks erledigt', 'todo'),
		extractTimePreference('TaskCompleted', 'Tasks erledigt', 'todo'),
		extractTimePreference('TaskCreated', 'Tasks erstellt', 'todo'),

		// Drink patterns
		extractDayOfWeekPattern(
			'DrinkLogged',
			'Kaffee getrunken',
			'drink',
			(p) => p.drinkType === 'coffee'
		),
		extractFrequencyPattern('DrinkLogged', 'Kaffee', 'drink', (p) => p.drinkType === 'coffee'),
		extractFrequencyPattern(
			'DrinkLogged',
			'Wasser-Eintraege',
			'drink',
			(p) => p.drinkType === 'water'
		),
		extractTimePreference('DrinkLogged', 'Getraenke geloggt', 'drink'),

		// Calendar patterns
		extractDayOfWeekPattern('CalendarEventCreated', 'Termine erstellt', 'calendar'),

		// Places patterns
		extractDayOfWeekPattern('PlaceVisited', 'Orte besucht', 'places'),
	]);

	// Apply decay to old facts
	await memoryStore.applyDecay();
}
