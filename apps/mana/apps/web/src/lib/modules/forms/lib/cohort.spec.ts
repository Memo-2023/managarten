import { describe, it, expect } from 'vitest';
import { computeCohort, cohortLabel, sortCohortsDesc } from './cohort';

describe('computeCohort', () => {
	it('returns YYYY-WNN for weekly frequency', () => {
		// 2026-05-06 is a Wednesday → ISO week 19 of 2026
		expect(computeCohort('2026-05-06T12:00:00Z', 'weekly')).toBe('2026-W19');
	});

	it('returns YYYY-MM for monthly frequency', () => {
		expect(computeCohort('2026-05-06T12:00:00Z', 'monthly')).toBe('2026-05');
	});

	it('handles ISO-week year boundary (Jan 1st belongs to W52/W53 of prior year)', () => {
		// 2027-01-01 is a Friday → ISO week 53 of 2026
		expect(computeCohort('2027-01-01T12:00:00Z', 'weekly')).toBe('2026-W53');
		// But monthly still says 2027-01 — calendar months don't slide.
		expect(computeCohort('2027-01-01T12:00:00Z', 'monthly')).toBe('2027-01');
	});

	it('week numbers are zero-padded for lex sort', () => {
		// Early-January stays in 2026 ISO-year if it falls before Thu
		expect(computeCohort('2026-01-08T00:00:00Z', 'weekly')).toMatch(/^\d{4}-W\d{2}$/);
		expect(computeCohort('2026-03-01T00:00:00Z', 'weekly')).toMatch(/^\d{4}-W\d{2}$/);
	});

	it('returns empty string for invalid timestamps', () => {
		expect(computeCohort('not-a-date', 'weekly')).toBe('');
		expect(computeCohort('not-a-date', 'monthly')).toBe('');
	});
});

describe('cohortLabel', () => {
	it('labels the current week as "Diese Woche"', () => {
		const now = new Date('2026-05-06T12:00:00Z'); // W19/2026
		expect(cohortLabel('2026-W19', 'weekly', now)).toBe('Diese Woche');
	});

	it('labels the previous week as "Letzte Woche"', () => {
		const now = new Date('2026-05-06T12:00:00Z'); // W19/2026
		expect(cohortLabel('2026-W18', 'weekly', now)).toBe('Letzte Woche');
	});

	it('falls back to "KW NN / YYYY" for older weeks', () => {
		const now = new Date('2026-05-06T12:00:00Z');
		expect(cohortLabel('2026-W10', 'weekly', now)).toBe('KW 10 / 2026');
	});

	it('labels the current month as "Dieser Monat"', () => {
		const now = new Date('2026-05-06T12:00:00Z');
		expect(cohortLabel('2026-05', 'monthly', now)).toBe('Dieser Monat');
	});

	it('labels the previous month as "Letzter Monat"', () => {
		const now = new Date('2026-05-06T12:00:00Z');
		expect(cohortLabel('2026-04', 'monthly', now)).toBe('Letzter Monat');
	});

	it('falls back to "Monatsname YYYY" for older months', () => {
		const now = new Date('2026-05-06T12:00:00Z');
		expect(cohortLabel('2026-01', 'monthly', now)).toBe('Januar 2026');
		expect(cohortLabel('2025-12', 'monthly', now)).toBe('Dezember 2025');
	});

	it('returns the raw key for malformed cohorts', () => {
		const now = new Date('2026-05-06T12:00:00Z');
		expect(cohortLabel('garbage', 'weekly', now)).toBe('garbage');
		expect(cohortLabel('2026-99', 'monthly', now)).toBe('2026-99');
	});
});

describe('sortCohortsDesc', () => {
	it('sorts weekly cohorts newest-first', () => {
		expect(sortCohortsDesc(['2026-W18', '2026-W19', '2025-W52'])).toEqual([
			'2026-W19',
			'2026-W18',
			'2025-W52',
		]);
	});

	it('sorts monthly cohorts newest-first', () => {
		expect(sortCohortsDesc(['2026-04', '2026-05', '2025-12'])).toEqual([
			'2026-05',
			'2026-04',
			'2025-12',
		]);
	});

	it('does not mutate the input', () => {
		const input = ['2026-W10', '2026-W11'];
		const out = sortCohortsDesc(input);
		expect(input).toEqual(['2026-W10', '2026-W11']);
		expect(out).not.toBe(input);
	});
});
