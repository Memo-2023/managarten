/**
 * Forms — public-submit endpoint.
 *
 * POST /:token/submit  — accepts an answer payload from an
 *                        unauthenticated submitter, resolves the
 *                        form-owner via the unlisted-snapshots table,
 *                        and writes the response into mana_sync as
 *                        a fresh `formResponses` insert. The owner's
 *                        client picks it up on the next sync pull.
 *
 * Mounted pre-auth in index.ts. Rate-limited per-token + per-IP, same
 * shape as the unlisted public read endpoint.
 *
 * Security model:
 *   - The token is a 32-char base64url string from `unlistedSnapshots`.
 *     Unknown / expired / revoked tokens → 410/404, no information leak.
 *   - Server-side validation against the snapshot's `fields` array
 *     ensures the submitter can't inject arbitrary keys into the
 *     response — only field-ids that exist in the published schema.
 *   - The blob's `settings.responseLimit`, `closedAt`, etc. are
 *     intentionally NOT in the public snapshot (see resolvers.ts) so
 *     enforcement of those happens client-side / in M-future.
 *   - Server stores plaintext `answers` blob in sync_changes; the
 *     webapp's encrypt-registry decrypt path is no-op for non-encrypted
 *     shapes (record-helpers.ts:241). Encrypted-at-rest for public
 *     submissions is M6 (ZK-Mode) future work.
 *
 * Plan: docs/plans/forms-module.md M3.b.
 */

import { Hono } from 'hono';
import { rateLimitMiddleware } from '@mana/shared-hono';
import { eq } from 'drizzle-orm';
import { makeFieldMeta, type Actor, type FieldOrigin } from '@mana/shared-ai';
import { errorResponse } from '../../lib/responses';
import { getSyncConnection } from '../../mcp/sync-db';
import { db, snapshots } from '../unlisted/schema';

const routes = new Hono();

const TOKEN_REGEX = /^[A-Za-z0-9_-]{32}$/;
const CLIENT_ID = 'forms-public-submit';

const SUBMITTER_ACTOR: Actor = Object.freeze({
	kind: 'system' as const,
	principalId: 'system:forms-public-submit',
	displayName: 'Form-Antwort',
});
const SUBMITTER_ORIGIN: FieldOrigin = 'system';

// Token-scoped rate limit. 10 submits/min per token covers a busy
// signup form without enabling spam — typeform-class form-spam from a
// single tab is the realistic abuse pattern.
routes.use(
	'/:token/submit',
	rateLimitMiddleware({
		max: 10,
		windowMs: 60_000,
		keyFn: (c) => `forms:submit:token:${c.req.param('token')}`,
	})
);

// IP-scoped rate limit. Stacks on the token limit.
routes.use(
	'/:token/submit',
	rateLimitMiddleware({
		max: 30,
		windowMs: 60_000,
		keyFn: (c) => {
			const ip =
				c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ||
				c.req.header('x-real-ip') ||
				'unknown';
			return `forms:submit:ip:${ip}`;
		},
	})
);

interface FormSnapshotBlob {
	title?: string;
	description?: string | null;
	fields?: Array<{
		id: string;
		type: string;
		label?: string;
		required?: boolean;
		options?: Array<{ id: string; label: string }>;
	}>;
	branching?: unknown[];
	settings?: { submitButtonLabel?: string; successMessage?: string };
	recurrence?: { frequency?: 'weekly' | 'monthly' };
}

/**
 * Compute the cohort label for a response based on the form's
 * recurrence frequency. Mirror of `lib/cohort.ts` in the webapp —
 * duplicated here because the apps/api surface can't import from
 * apps/mana/. ISO 8601 week math.
 */
function computeCohort(submittedAtIso: string, frequency: 'weekly' | 'monthly'): string {
	const date = new Date(submittedAtIso);
	if (Number.isNaN(date.getTime())) return '';
	if (frequency === 'monthly') {
		const year = date.getUTCFullYear();
		const month = date.getUTCMonth() + 1;
		return `${year}-${String(month).padStart(2, '0')}`;
	}
	const utc = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
	const dayOfWeek = utc.getUTCDay() || 7;
	utc.setUTCDate(utc.getUTCDate() + 4 - dayOfWeek);
	const year = utc.getUTCFullYear();
	const yearStart = Date.UTC(year, 0, 1);
	const week = Math.ceil(((utc.getTime() - yearStart) / 86_400_000 + 1) / 7);
	return `${year}-W${String(week).padStart(2, '0')}`;
}

interface SubmitBody {
	answers?: Record<string, unknown>;
	submitterEmail?: string | null;
	submitterName?: string | null;
}

routes.post('/:token/submit', async (c) => {
	const token = c.req.param('token');
	if (!TOKEN_REGEX.test(token)) {
		return errorResponse(c, 'Invalid token format', 400, { code: 'INVALID_TOKEN' });
	}

	const rows = await db
		.select({
			token: snapshots.token,
			userId: snapshots.userId,
			spaceId: snapshots.spaceId,
			collection: snapshots.collection,
			recordId: snapshots.recordId,
			blob: snapshots.blob,
			expiresAt: snapshots.expiresAt,
			revokedAt: snapshots.revokedAt,
		})
		.from(snapshots)
		.where(eq(snapshots.token, token))
		.limit(1);

	const row = rows[0];
	if (!row) {
		return errorResponse(c, 'Link nicht gefunden', 404, { code: 'NOT_FOUND' });
	}
	if (row.collection !== 'forms') {
		return errorResponse(c, 'Link gehoert nicht zu einem Formular', 400, {
			code: 'WRONG_COLLECTION',
		});
	}
	if (row.revokedAt) {
		return errorResponse(c, 'Link wurde widerrufen', 410, { code: 'REVOKED' });
	}
	if (row.expiresAt && row.expiresAt.getTime() < Date.now()) {
		return errorResponse(c, 'Link ist abgelaufen', 410, { code: 'EXPIRED' });
	}

	let body: SubmitBody;
	try {
		body = (await c.req.json()) as SubmitBody;
	} catch {
		return errorResponse(c, 'Body muss valid JSON sein', 400, { code: 'INVALID_JSON' });
	}

	const blob = (row.blob ?? {}) as FormSnapshotBlob;
	const fields = Array.isArray(blob.fields) ? blob.fields : [];
	const validFieldIds = new Set(
		fields.filter((f) => f && typeof f.id === 'string' && f.type !== 'section').map((f) => f.id)
	);

	// Filter answers to only keys that exist in the published schema.
	const cleanAnswers: Record<string, unknown> = {};
	const incomingAnswers = body.answers ?? {};
	for (const [key, value] of Object.entries(incomingAnswers)) {
		if (validFieldIds.has(key)) {
			cleanAnswers[key] = value;
		}
	}

	// Required-field check — same constraint the client enforces, but
	// authoritative on the server.
	for (const field of fields) {
		if (field.required && field.type !== 'section' && field.type !== 'consent') {
			const v = cleanAnswers[field.id];
			if (
				v === null ||
				v === undefined ||
				(typeof v === 'string' && v.trim().length === 0) ||
				(Array.isArray(v) && v.length === 0)
			) {
				return errorResponse(c, `Feld "${field.label ?? field.id}" ist erforderlich`, 400, {
					code: 'REQUIRED_MISSING',
					details: { field: field.id },
				});
			}
		}
		// Consent fields: must be true if required.
		if (field.required && field.type === 'consent') {
			if (cleanAnswers[field.id] !== true) {
				return errorResponse(c, `Einwilligung "${field.label ?? field.id}" ist erforderlich`, 400, {
					code: 'CONSENT_REQUIRED',
					details: { field: field.id },
				});
			}
		}
	}

	const submitterEmail =
		typeof body.submitterEmail === 'string' && body.submitterEmail.trim().length > 0
			? body.submitterEmail.trim()
			: null;
	const submitterName =
		typeof body.submitterName === 'string' && body.submitterName.trim().length > 0
			? body.submitterName.trim()
			: null;

	// Hash the IP rather than store raw — privacy-preserving anti-abuse
	// fingerprint. Owner can spot patterns ("5 submissions from one
	// hash in an hour → spam") without ever seeing the plaintext IP.
	const ip =
		c.req.header('x-forwarded-for')?.split(',')[0]?.trim() || c.req.header('x-real-ip') || '';
	const ipHash = ip ? await sha256Hex(ip) : undefined;
	const userAgent = c.req.header('user-agent') ?? undefined;
	const referrer = c.req.header('referer') ?? undefined;

	const responseId = crypto.randomUUID();
	const submittedAt = new Date().toISOString();

	const data: Record<string, unknown> = {
		id: responseId,
		formId: row.recordId,
		submittedAt,
		answers: cleanAnswers,
		status: 'new',
		spaceId: row.spaceId,
	};
	if (submitterEmail) data.submitterEmail = submitterEmail;
	if (submitterName) data.submitterName = submitterName;
	if (blob.recurrence?.frequency) {
		const cohort = computeCohort(submittedAt, blob.recurrence.frequency);
		if (cohort) data.cohort = cohort;
	}
	if (ipHash || userAgent || referrer) {
		data.submitterMeta = {
			...(ipHash ? { ipHash } : {}),
			...(userAgent ? { userAgent: userAgent.slice(0, 200) } : {}),
			...(referrer ? { referrer: referrer.slice(0, 500) } : {}),
		};
	}

	const fieldMeta: Record<string, unknown> = {};
	for (const key of Object.keys(data)) {
		fieldMeta[key] = makeFieldMeta(submittedAt, SUBMITTER_ACTOR, SUBMITTER_ORIGIN);
	}

	const sql = getSyncConnection();
	await sql.begin(async (tx) => {
		await tx`SELECT set_config('app.current_user_id', ${row.userId}, true)`;
		await tx`
			INSERT INTO sync_changes
				(app_id, table_name, record_id, user_id, op, data, field_meta, client_id, schema_version, actor, origin)
			VALUES
				('forms', 'formResponses', ${responseId}, ${row.userId}, 'insert',
				 ${tx.json(data as never)}, ${tx.json(fieldMeta as never)},
				 ${CLIENT_ID}, 1, ${tx.json(SUBMITTER_ACTOR as never)}, ${SUBMITTER_ORIGIN})
		`;
	});

	return c.json({
		ok: true,
		responseId,
		submittedAt,
	});
});

async function sha256Hex(input: string): Promise<string> {
	const data = new TextEncoder().encode(input);
	const digest = await crypto.subtle.digest('SHA-256', data);
	return Array.from(new Uint8Array(digest))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('');
}

export const formsPublicRoutes = routes;
