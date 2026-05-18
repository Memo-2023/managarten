/**
 * Context Document Generator — Produces a ~500 token text snapshot
 * of the user's current state for use as an LLM system prompt.
 *
 * Combines DaySnapshot + Streaks + Memory + Correlations into a
 * structured markdown string that any LLM tier can reason over.
 */

import type { DaySnapshot, StreakInfo } from './types';
import type { MemoryFact, Correlation } from '$lib/companion/memory/types';

function formatTime(iso: string): string {
	try {
		return new Date(iso).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
	} catch {
		return iso.slice(11, 16);
	}
}

/**
 * Generate a concise user context document.
 *
 * @param day          - Today's snapshot
 * @param streaks      - Current streak info
 * @param memory       - Extracted user patterns (optional)
 * @param correlations - Cross-module correlations (optional)
 * @returns Markdown string (~300-600 tokens)
 */
export function generateContextDocument(
	day: DaySnapshot,
	streaks: StreakInfo[],
	memory: MemoryFact[] = [],
	correlations: Correlation[] = []
): string {
	const lines: string[] = [];

	lines.push(`## Nutzer-Kontext (${day.date})\n`);

	// ── Today ───────────────────────────────────────
	lines.push('### Heute');

	// Tasks
	const taskLine = `- ${day.tasks.total} offene Tasks`;
	const extras: string[] = [];
	if (day.tasks.completed > 0) extras.push(`${day.tasks.completed} erledigt`);
	if (day.tasks.overdue > 0) extras.push(`${day.tasks.overdue} ueberfaellig`);
	if (day.tasks.dueToday.length > 0) extras.push(`${day.tasks.dueToday.length} heute faellig`);
	lines.push(extras.length > 0 ? `${taskLine} (${extras.join(', ')})` : taskLine);

	if (day.tasks.dueToday.length > 0) {
		for (const t of day.tasks.dueToday.slice(0, 5)) {
			lines.push(`  - "${t.title}"${t.priority === 'high' ? ' (hohe Prioritaet)' : ''}`);
		}
	}

	// Events
	if (day.events.total > 0) {
		lines.push(`- ${day.events.total} Termine`);
		if (day.events.nextEvent) {
			const e = day.events.nextEvent;
			lines.push(`  - Naechster: "${e.title}" um ${formatTime(e.startTime)}`);
		}
		for (const e of day.events.upcoming.slice(1, 4)) {
			lines.push(`  - "${e.title}" ${formatTime(e.startTime)}-${formatTime(e.endTime)}`);
		}
	} else {
		lines.push('- Keine Termine');
	}

	// Drinks
	lines.push(
		`- Wasser: ${day.drinks.water.ml}ml / ${day.drinks.water.goal}ml (${day.drinks.water.percent}%)`
	);
	if (day.drinks.coffee.count > 0) {
		lines.push(`- Kaffee: ${day.drinks.coffee.count}x (${day.drinks.coffee.ml}ml)`);
	}

	// Places
	if (day.places.visitedToday > 0) {
		lines.push(`- ${day.places.visitedToday} Orte besucht`);
	}
	if (day.places.tracking) {
		lines.push('- Standort-Tracking aktiv');
	}

	// ── Streaks ─────────────────────────────────────
	const activeStreaks = streaks.filter((s) => s.status === 'active');
	const atRisk = streaks.filter((s) => s.status === 'at_risk');
	const broken = streaks.filter((s) => s.status === 'broken' && s.currentStreak === 0);

	if (activeStreaks.length > 0 || atRisk.length > 0) {
		lines.push('\n### Streaks');
		for (const s of activeStreaks) {
			lines.push(`- ${s.label}: ${s.currentStreak} Tage (aktiv)`);
		}
		for (const s of atRisk) {
			lines.push(`- ${s.label}: ${s.currentStreak} Tage (GEFAEHRDET — heute noch nicht aktiv)`);
		}
		for (const s of broken) {
			if (s.longestStreak > 0) {
				lines.push(`- ${s.label}: unterbrochen (Rekord: ${s.longestStreak} Tage)`);
			}
		}
	}

	// ── Memory (Patterns & Preferences) ────────────────
	const highConfMemory = memory.filter((m) => m.confidence >= 0.5);
	if (highConfMemory.length > 0) {
		lines.push('\n### Bekannte Muster');
		for (const m of highConfMemory.slice(0, 6)) {
			lines.push(`- ${m.content}`);
		}
	}

	// ── Correlations ────────────────────────────────────
	if (correlations.length > 0) {
		lines.push('\n### Zusammenhaenge');
		for (const c of correlations.slice(0, 3)) {
			lines.push(`- ${c.sentence} (r=${c.coefficient})`);
		}
	}

	return lines.join('\n');
}
