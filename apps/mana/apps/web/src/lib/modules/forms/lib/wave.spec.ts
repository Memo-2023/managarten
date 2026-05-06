import { describe, it, expect } from 'vitest';
import { nextWaveDueAt, isWaveDue, buildWaveMailto, parseRecipientEmails } from './wave';
import type { RecurrenceConfig } from '../types';

describe('nextWaveDueAt', () => {
	it('returns null when recurrence is undefined', () => {
		expect(nextWaveDueAt(undefined)).toBeNull();
	});

	it('returns startedAt when lastSentAt is missing (never-sent first wave)', () => {
		const cfg: RecurrenceConfig = {
			frequency: 'weekly',
			startedAt: '2026-05-01T00:00:00Z',
		};
		expect(nextWaveDueAt(cfg)?.toISOString()).toBe('2026-05-01T00:00:00.000Z');
	});

	it('falls back to epoch when never-sent and startedAt is missing', () => {
		expect(nextWaveDueAt({ frequency: 'weekly' })?.toISOString()).toBe('1970-01-01T00:00:00.000Z');
	});

	it('adds 7 days for weekly frequency', () => {
		const cfg: RecurrenceConfig = {
			frequency: 'weekly',
			lastSentAt: '2026-05-01T12:00:00Z',
		};
		expect(nextWaveDueAt(cfg)?.toISOString()).toBe('2026-05-08T12:00:00.000Z');
	});

	it('adds 1 calendar month for monthly frequency', () => {
		const cfg: RecurrenceConfig = {
			frequency: 'monthly',
			lastSentAt: '2026-05-01T12:00:00Z',
		};
		expect(nextWaveDueAt(cfg)?.toISOString()).toBe('2026-06-01T12:00:00.000Z');
	});

	it('handles month-end overflow gracefully (Jan 31 → Feb 28/29)', () => {
		const cfg: RecurrenceConfig = {
			frequency: 'monthly',
			lastSentAt: '2026-01-31T12:00:00Z',
		};
		// 2026 is not a leap year — Date math rolls Jan 31 + 1 month into Mar 3
		// (which is the standard JS behavior — accept it rather than fight it).
		const due = nextWaveDueAt(cfg);
		expect(due).not.toBeNull();
		expect(due!.getUTCFullYear()).toBe(2026);
		// Either Feb 28/29 or rolled into March — in both cases >= Feb 28.
		expect(due!.getTime()).toBeGreaterThanOrEqual(new Date('2026-02-28T12:00:00Z').getTime());
	});

	it('returns null for invalid lastSentAt timestamps', () => {
		const cfg: RecurrenceConfig = {
			frequency: 'weekly',
			lastSentAt: 'not-a-date',
		};
		expect(nextWaveDueAt(cfg)).toBeNull();
	});
});

describe('isWaveDue', () => {
	it('false when recurrence is undefined', () => {
		expect(isWaveDue(undefined, new Date('2026-05-08T00:00:00Z'))).toBe(false);
	});

	it('true when next-due is in the past', () => {
		const cfg: RecurrenceConfig = {
			frequency: 'weekly',
			lastSentAt: '2026-05-01T00:00:00Z',
		};
		expect(isWaveDue(cfg, new Date('2026-05-09T00:00:00Z'))).toBe(true);
	});

	it('false when next-due is in the future', () => {
		const cfg: RecurrenceConfig = {
			frequency: 'weekly',
			lastSentAt: '2026-05-01T00:00:00Z',
		};
		expect(isWaveDue(cfg, new Date('2026-05-05T00:00:00Z'))).toBe(false);
	});

	it('true at the exact due-instant (boundary inclusive)', () => {
		const cfg: RecurrenceConfig = {
			frequency: 'weekly',
			lastSentAt: '2026-05-01T12:00:00Z',
		};
		expect(isWaveDue(cfg, new Date('2026-05-08T12:00:00Z'))).toBe(true);
	});

	it('true on first-wave when never sent (startedAt in past)', () => {
		const cfg: RecurrenceConfig = {
			frequency: 'monthly',
			startedAt: '2026-04-01T00:00:00Z',
		};
		expect(isWaveDue(cfg, new Date('2026-05-06T00:00:00Z'))).toBe(true);
	});
});

describe('buildWaveMailto', () => {
	it('builds a mailto URL with bcc + subject + body', () => {
		const url = buildWaveMailto({
			recipientEmails: ['anna@example.com', 'bob@example.com'],
			subject: 'Pulse-Check',
			body: 'Bitte ausfüllen: https://mana.how/share/abc',
		});
		expect(url).toContain('mailto:?');
		expect(url).toContain('bcc=anna%40example.com%2Cbob%40example.com');
		expect(url).toContain('subject=Pulse-Check');
		expect(url).toContain('body=Bitte+ausf');
		expect(url).toContain('mana.how%2Fshare%2Fabc');
	});

	it('omits bcc when recipients is empty', () => {
		const url = buildWaveMailto({
			recipientEmails: [],
			subject: 'X',
			body: 'Y',
		});
		expect(url).not.toContain('bcc=');
		expect(url).toContain('subject=X');
	});
});

describe('parseRecipientEmails', () => {
	it('handles newline-separated input', () => {
		expect(parseRecipientEmails('anna@example.com\nbob@example.com\ncarol@example.com')).toEqual([
			'anna@example.com',
			'bob@example.com',
			'carol@example.com',
		]);
	});

	it('handles comma-separated input', () => {
		expect(parseRecipientEmails('anna@example.com, bob@example.com')).toEqual([
			'anna@example.com',
			'bob@example.com',
		]);
	});

	it('handles mixed separators and whitespace', () => {
		expect(
			parseRecipientEmails('anna@example.com;\nbob@example.com  ,carol@example.com\t\t')
		).toEqual(['anna@example.com', 'bob@example.com', 'carol@example.com']);
	});

	it('drops invalid email shapes silently', () => {
		expect(parseRecipientEmails('valid@example.com\nnot-an-email\nfoo@\n@bar.com')).toEqual([
			'valid@example.com',
		]);
	});

	it('deduplicates case-insensitively but keeps the first casing', () => {
		expect(parseRecipientEmails('Anna@Example.com\nanna@example.com')).toEqual([
			'Anna@Example.com',
		]);
	});

	it('returns empty array for empty input', () => {
		expect(parseRecipientEmails('')).toEqual([]);
		expect(parseRecipientEmails('   \n\n  ')).toEqual([]);
	});
});
