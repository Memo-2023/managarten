/**
 * Wave-send scheduling for recurring forms (M10b).
 *
 * Given a `RecurrenceConfig` and the current time, decide when the
 * next "wave" of the link should go out. Pure — no Date.now(), no
 * Dexie. The owner-action button in BuilderView reads `isWaveDue` to
 * decide whether to surface a reminder banner.
 *
 * Bucketing convention:
 *   - weekly  → next wave is 7 days after lastSentAt
 *   - monthly → next wave is 1 calendar month after lastSentAt
 *   - When `lastSentAt` is missing, the form has never been sent and
 *     the *first* wave is considered due immediately (so the user
 *     gets nudged after configuring recurrence).
 *
 * The intentionally-naive "+30 days" rule for monthly would drift over
 * the course of a year; we use UTC calendar math instead so "the 1st
 * of every month" stays the 1st.
 */

import type { RecurrenceConfig } from '../types';

export function nextWaveDueAt(recurrence: RecurrenceConfig | undefined): Date | null {
	if (!recurrence) return null;
	const lastIso = recurrence.lastSentAt;
	if (!lastIso) {
		// Never sent — treat the recurrence-startedAt (or epoch) as the
		// implicit first wave so the due-check returns true on day 1.
		return recurrence.startedAt ? new Date(recurrence.startedAt) : new Date(0);
	}
	const last = new Date(lastIso);
	if (Number.isNaN(last.getTime())) return null;

	if (recurrence.frequency === 'weekly') {
		return new Date(last.getTime() + 7 * 24 * 60 * 60 * 1000);
	}
	// Monthly: same day-of-month one month later, in UTC.
	const next = new Date(last);
	next.setUTCMonth(next.getUTCMonth() + 1);
	return next;
}

export function isWaveDue(
	recurrence: RecurrenceConfig | undefined,
	now: Date = new Date()
): boolean {
	const due = nextWaveDueAt(recurrence);
	if (!due) return false;
	return due.getTime() <= now.getTime();
}

/**
 * Build a mailto: URL with BCC recipients + subject + body containing
 * the share-link. Browsers cap mailto-URLs at ~2KB on average, hence
 * the recipient-cap upstream. For larger lists the user copies the
 * link manually.
 */
export function buildWaveMailto(opts: {
	recipientEmails: string[];
	subject: string;
	body: string;
}): string {
	const bcc = opts.recipientEmails.join(',');
	const params = new URLSearchParams();
	if (bcc) params.set('bcc', bcc);
	params.set('subject', opts.subject);
	params.set('body', opts.body);
	// Browsers prefer + for spaces in mailto bodies but URLSearchParams
	// emits %20; both work. Keep %20 for predictability.
	return `mailto:?${params.toString()}`;
}

/**
 * Parse a free-form recipient input (one email per line OR
 * comma-separated) into a deduplicated trimmed array. Invalid
 * shapes get dropped silently — the SettingsPanel surfaces the
 * accepted count back to the user.
 */
export function parseRecipientEmails(raw: string): string[] {
	const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
	const seen = new Set<string>();
	const out: string[] = [];
	for (const part of raw.split(/[\s,;]+/)) {
		const trimmed = part.trim();
		if (!trimmed) continue;
		if (!re.test(trimmed)) continue;
		const lower = trimmed.toLowerCase();
		if (seen.has(lower)) continue;
		seen.add(lower);
		out.push(trimmed);
	}
	return out;
}
