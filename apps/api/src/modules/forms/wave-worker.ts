/**
 * Forms — headless wave-send worker (M10d).
 *
 * Periodic background tick that scans `unlisted.snapshots` for forms
 * with `internal_meta.kind='forms-recurrence'`, computes which waves
 * are due (lastSentAt + frequency-period <= now), and fires them via
 * mana-mail's internal `/api/v1/internal/mail/bulk-send` route. After
 * a successful send the worker UPDATEs the snapshot's
 * `internal_meta.recurrence.lastSentAt` so the next tick skips it
 * for one full period.
 *
 * Disable via `FORMS_WAVE_WORKER_DISABLED=true` (tests / multi-replica
 * deployments where another node is designated as the cron).
 *
 * Architecture parallels the articles import-worker:
 *   - 5-min tick
 *   - pg_advisory_xact_lock for soft single-worker coordination
 *   - per-snapshot per-tick errors get logged + skipped, not thrown
 *
 * The internal_meta column is owner-private — the public unlisted
 * GET endpoint never serialises it (see ../unlisted/public-routes.ts
 * select projection). Recipients + sender details stay between
 * owner-webapp and Mana services.
 *
 * Plan: docs/plans/forms-module.md M10d.
 */

import { and, eq, isNotNull, isNull, sql as drizzleSql } from 'drizzle-orm';
import { getSyncConnection } from '../../lib/sync-db';
import { db, snapshots } from '../unlisted/schema';

const TICK_INTERVAL_MS = 5 * 60 * 1000;
const ADVISORY_LOCK_KEY = 0x464f_5257; // 'FORW' (Forms Recurrence Wave)

const MANA_MAIL_URL = process.env.MANA_MAIL_URL ?? 'http://localhost:3042';
const MANA_SERVICE_KEY = process.env.MANA_SERVICE_KEY ?? 'dev-service-key';
const WEB_ORIGIN = process.env.MANA_WEB_ORIGIN ?? 'https://mana.how';

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

interface WaveInternalMeta {
	kind?: string;
	recurrence?: {
		frequency?: 'weekly' | 'monthly';
		recipientEmails?: string[];
		lastSentAt?: string | null;
	};
	sender?: {
		fromEmail?: string;
		fromName?: string;
		replyTo?: string | null;
		legalAddress?: string;
	};
	formMeta?: {
		title?: string;
		description?: string | null;
	};
}

interface FormBlob {
	title?: string;
	description?: string | null;
	settings?: { submitButtonLabel?: string; successMessage?: string };
}

export function startFormsWaveWorker(): void {
	if (timer) return;
	if (process.env.FORMS_WAVE_WORKER_DISABLED === 'true') {
		console.log('[forms-wave] worker disabled via env');
		return;
	}
	console.log(`[forms-wave] worker starting — tick=${TICK_INTERVAL_MS}ms`);
	timer = setInterval(() => {
		void runTickGuarded();
	}, TICK_INTERVAL_MS);
}

export function stopFormsWaveWorker(): void {
	if (timer) {
		clearInterval(timer);
		timer = null;
	}
}

async function runTickGuarded(): Promise<void> {
	if (running) return;
	running = true;
	try {
		await runTickOnce();
	} catch (err) {
		console.error('[forms-wave] tick error:', err);
	} finally {
		running = false;
	}
}

export async function runTickOnce(): Promise<{
	skipped: boolean;
	scanned: number;
	sent: number;
}> {
	if (!(await tryAcquireLock())) {
		return { skipped: true, scanned: 0, sent: 0 };
	}

	const candidates = await db
		.select({
			token: snapshots.token,
			userId: snapshots.userId,
			recordId: snapshots.recordId,
			blob: snapshots.blob,
			internalMeta: snapshots.internalMeta,
		})
		.from(snapshots)
		.where(
			and(
				eq(snapshots.collection, 'forms'),
				isNotNull(snapshots.internalMeta),
				isNull(snapshots.revokedAt)
			)
		);

	let sent = 0;
	const now = new Date();
	for (const row of candidates) {
		const meta = (row.internalMeta ?? {}) as WaveInternalMeta;
		if (meta.kind !== 'forms-recurrence') continue;
		if (!meta.recurrence?.frequency) continue;
		if (!isWaveDue(meta.recurrence.lastSentAt ?? null, meta.recurrence.frequency, now)) {
			continue;
		}
		try {
			await fireOneWave({
				token: row.token,
				userId: row.userId,
				blob: (row.blob ?? {}) as FormBlob,
				meta,
				now,
			});
			sent += 1;
		} catch (err) {
			console.warn(
				`[forms-wave] failed for token ${row.token.slice(0, 8)}…: ${(err as Error).message}`
			);
		}
	}

	return { skipped: false, scanned: candidates.length, sent };
}

function isWaveDue(
	lastSentIso: string | null,
	frequency: 'weekly' | 'monthly',
	now: Date
): boolean {
	if (!lastSentIso) return true; // never sent → fire immediately on first scan
	const last = new Date(lastSentIso);
	if (Number.isNaN(last.getTime())) return false;
	if (frequency === 'weekly') {
		return now.getTime() >= last.getTime() + 7 * 24 * 60 * 60 * 1000;
	}
	const due = new Date(last);
	due.setUTCMonth(due.getUTCMonth() + 1);
	return now.getTime() >= due.getTime();
}

function computeCohort(now: Date, frequency: 'weekly' | 'monthly'): string {
	if (frequency === 'monthly') {
		return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
	}
	const utc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
	const dayOfWeek = utc.getUTCDay() || 7;
	utc.setUTCDate(utc.getUTCDate() + 4 - dayOfWeek);
	const year = utc.getUTCFullYear();
	const yearStart = Date.UTC(year, 0, 1);
	const week = Math.ceil(((utc.getTime() - yearStart) / 86_400_000 + 1) / 7);
	return `${year}-W${String(week).padStart(2, '0')}`;
}

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

async function fireOneWave(opts: {
	token: string;
	userId: string;
	blob: FormBlob;
	meta: WaveInternalMeta;
	now: Date;
}): Promise<void> {
	const { token, userId, blob, meta, now } = opts;
	const recipients = meta.recurrence?.recipientEmails ?? [];
	if (recipients.length === 0) {
		throw new Error('no recipients in internal_meta');
	}
	const sender = meta.sender ?? {};
	if (!sender.fromEmail || !sender.fromName || !sender.legalAddress) {
		throw new Error('missing sender fields in internal_meta');
	}

	const title = blob.title ?? meta.formMeta?.title ?? '';
	const description = blob.description ?? meta.formMeta?.description ?? null;
	const cohort = computeCohort(now, meta.recurrence!.frequency!);
	const shareUrl = `${WEB_ORIGIN.replace(/\/$/, '')}/share/${token}`;

	const desc = description
		? `<p style="margin:0 0 1em;color:#374151;line-height:1.5;">${escapeHtml(description)}</p>`
		: '';
	const htmlBody = [
		'<!doctype html><html><body style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:2em auto;padding:0 1em;">',
		`<h1 style="margin:0 0 0.5em;font-size:1.25rem;">${escapeHtml(title)}</h1>`,
		desc,
		`<p style="margin:1.5em 0;"><a href="${escapeHtml(shareUrl)}" style="display:inline-block;padding:0.625rem 1.25rem;background:#14b8a6;color:white;border-radius:6px;text-decoration:none;font-weight:500;">Antworten</a></p>`,
		`<p style="margin:1em 0;color:#6b7280;font-size:0.875rem;">Oder direkt: <a href="${escapeHtml(shareUrl)}">${escapeHtml(shareUrl)}</a></p>`,
		`<hr style="border:none;border-top:1px solid #e5e7eb;margin:2em 0 1em;">`,
		`<p style="margin:0;color:#9ca3af;font-size:0.75rem;line-height:1.5;white-space:pre-wrap;">${escapeHtml(sender.legalAddress)}</p>`,
		`<p style="margin:0.5em 0 0;color:#9ca3af;font-size:0.75rem;"><a href="{{unsubscribe_url}}" style="color:#9ca3af;">Abmelden</a></p>`,
		'</body></html>',
	].join('');
	const textBody = [
		title,
		'',
		(description ? description + '\n\n' : '') + `Antworten: ${shareUrl}`,
		'',
		'---',
		sender.legalAddress,
		'',
		'Abmelden: {{unsubscribe_url}}',
	].join('\n');

	const payload = {
		userId,
		campaignId: `form-${opts.token}-${cohort}`.slice(0, 80),
		subject: `${title} — ${cohort}`,
		fromName: sender.fromName,
		fromEmail: sender.fromEmail,
		replyTo: sender.replyTo ?? undefined,
		htmlBody,
		textBody,
		recipients: recipients.map((email) => ({ email })),
	};

	const res = await fetch(`${MANA_MAIL_URL}/api/v1/internal/mail/bulk-send`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			'X-Service-Key': MANA_SERVICE_KEY,
		},
		body: JSON.stringify(payload),
	});
	if (!res.ok) {
		const text = await res.text().catch(() => '');
		throw new Error(`mana-mail ${res.status}: ${text.slice(0, 200)}`);
	}

	// Record success on the snapshot so the next tick skips this row
	// for one full frequency-period. Direct jsonb-merge — keeps any
	// other internal_meta fields intact.
	await db.execute(
		drizzleSql`
			UPDATE unlisted.snapshots
			SET internal_meta = jsonb_set(
				internal_meta,
				'{recurrence,lastSentAt}',
				to_jsonb(${now.toISOString()}::text),
				true
			), updated_at = now()
			WHERE token = ${token}
		`
	);

	console.log(
		`[forms-wave] sent wave for token=${token.slice(0, 8)}… → ${recipients.length} recipients`
	);
}

async function tryAcquireLock(): Promise<boolean> {
	const sql = getSyncConnection();
	let acquired = false;
	await sql.begin(async (tx) => {
		const rows = await tx<{ acquired: boolean }[]>`
			SELECT pg_try_advisory_xact_lock(${ADVISORY_LOCK_KEY}) AS acquired
		`;
		acquired = rows[0]?.acquired === true;
	});
	return acquired;
}
