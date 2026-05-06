/**
 * Cohort math for recurring forms (M10).
 *
 * A cohort is a string label that buckets a form-response into a time
 * window matching the form's `recurrence.frequency`. Examples:
 *
 *   weekly  → "2026-W18"   (ISO 8601 week-of-year)
 *   monthly → "2026-04"    (calendar month)
 *
 * Why ISO weeks: the week-anchor is consistent across years (avoids the
 * "week 53 vs week 1" mess of naive day-of-year math) and cohorts sort
 * lexicographically into chronological order, which matters for the
 * ResponsesView chip rendering.
 *
 * Pure — no Dexie, no Date.now() side effects. The caller passes in
 * the submission ISO timestamp; tests can pin time without mocks.
 */

export type RecurrenceFrequency = 'weekly' | 'monthly';

export function computeCohort(submittedAtIso: string, frequency: RecurrenceFrequency): string {
	const date = new Date(submittedAtIso);
	if (Number.isNaN(date.getTime())) {
		// Defensive — bad timestamps should not poison the bucket index.
		return '';
	}
	switch (frequency) {
		case 'weekly':
			return isoWeekKey(date);
		case 'monthly':
			return monthKey(date);
	}
}

/**
 * ISO 8601 year-week. The "ISO year" can differ from the calendar year
 * around January 1st (e.g. 2027-01-01 may belong to 2026-W53). The
 * algorithm is the canonical one from RFC 8601 §3.1.4 and matches what
 * `Intl.DateTimeFormat` would produce on Node ≥ 22.
 */
function isoWeekKey(date: Date): string {
	const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
	// Make Sunday → 7 so the offset to Thursday is straightforward.
	const dayOfWeek = utc.getUTCDay() || 7;
	utc.setUTCDate(utc.getUTCDate() + 4 - dayOfWeek);
	const year = utc.getUTCFullYear();
	const yearStart = Date.UTC(year, 0, 1);
	const week = Math.ceil(((utc.getTime() - yearStart) / 86_400_000 + 1) / 7);
	return `${year}-W${String(week).padStart(2, '0')}`;
}

function monthKey(date: Date): string {
	const year = date.getUTCFullYear();
	const month = date.getUTCMonth() + 1;
	return `${year}-${String(month).padStart(2, '0')}`;
}

/**
 * Human-readable label for a cohort key. Used by the ResponsesView
 * filter chips. Returns the raw key as fallback so unknown shapes
 * (legacy responses with stale cohorts) still render cleanly.
 */
export function cohortLabel(
	cohort: string,
	frequency: RecurrenceFrequency,
	now: Date = new Date()
): string {
	if (frequency === 'weekly') {
		const m = cohort.match(/^(\d{4})-W(\d{2})$/);
		if (!m) return cohort;
		const year = Number(m[1]);
		const week = Number(m[2]);
		const currentYear = now.getUTCFullYear();
		const currentWeek = Number(isoWeekKey(now).split('-W')[1]);
		if (year === currentYear && week === currentWeek) return 'Diese Woche';
		if (year === currentYear && week === currentWeek - 1) return 'Letzte Woche';
		return `KW ${week} / ${year}`;
	}
	const m = cohort.match(/^(\d{4})-(\d{2})$/);
	if (!m) return cohort;
	const year = Number(m[1]);
	const month = Number(m[2]);
	if (month < 1 || month > 12) return cohort;
	const monthNames = [
		'Januar',
		'Februar',
		'März',
		'April',
		'Mai',
		'Juni',
		'Juli',
		'August',
		'September',
		'Oktober',
		'November',
		'Dezember',
	];
	const currentYear = now.getUTCFullYear();
	const currentMonth = now.getUTCMonth() + 1;
	if (year === currentYear && month === currentMonth) return 'Dieser Monat';
	if (year === currentYear && month === currentMonth - 1) return 'Letzter Monat';
	return `${monthNames[month - 1]} ${year}`;
}

/**
 * Sort cohorts newest-first (descending) for the chip-bar. Lexicographic
 * order works because both "YYYY-WNN" and "YYYY-MM" preserve the
 * chronological ordering as strings.
 */
export function sortCohortsDesc(cohorts: readonly string[]): string[] {
	return [...cohorts].sort((a, b) => b.localeCompare(a));
}
