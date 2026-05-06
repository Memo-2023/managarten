/**
 * Personas — internal/service-key endpoints for the persona-runner.
 *
 * Mounted at `/api/v1/personas/internal/*`. All requests must carry
 * `X-Service-Key`; no user JWT is involved.
 *
 *   GET  /due                 list personas due for a tick
 *   POST /:id/actions         batch of tool-call rows (≤ 500 per call)
 *   POST /:id/feedback        batch of rating rows (≤ 100 per call)
 *
 * Both write endpoints are append-only and idempotent by deterministic
 * row IDs derived from (tickId, …) so retries don't duplicate.
 *
 * Originally lived in mana-auth (`/api/v1/internal/personas/*`) but
 * moved here when the platform/product split landed: personas are
 * test-infrastructure for the Mana product, not a platform concern.
 */

import { Hono } from 'hono';
import { eq, isNull, lte, or, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import { serviceAuthMiddleware } from '@mana/shared-hono';
import { getConnection } from '../../lib/db';
import { personas, personaActions, personaFeedback } from './schema';

interface ActionRow {
	tickId: string;
	toolName: string;
	inputHash?: string;
	result: 'ok' | 'error';
	errorMessage?: string;
	latencyMs?: number;
}

interface FeedbackRow {
	tickId: string;
	module: string;
	rating: 1 | 2 | 3 | 4 | 5;
	notes?: string;
}

function isValidAction(row: unknown): row is ActionRow {
	if (!row || typeof row !== 'object') return false;
	const r = row as Record<string, unknown>;
	return (
		typeof r.tickId === 'string' &&
		typeof r.toolName === 'string' &&
		(r.result === 'ok' || r.result === 'error')
	);
}

function isValidFeedback(row: unknown): row is FeedbackRow {
	if (!row || typeof row !== 'object') return false;
	const r = row as Record<string, unknown>;
	return (
		typeof r.tickId === 'string' &&
		typeof r.module === 'string' &&
		typeof r.rating === 'number' &&
		r.rating >= 1 &&
		r.rating <= 5
	);
}

export const personasInternalRoutes = new Hono();

personasInternalRoutes.use('*', serviceAuthMiddleware());

const db = () =>
	drizzle(getConnection(), { schema: { personas, personaActions, personaFeedback } });

async function personaExists(personaId: string): Promise<boolean> {
	const [row] = await db()
		.select({ userId: personas.userId })
		.from(personas)
		.where(eq(personas.userId, personaId));
	return !!row;
}

// ─── GET /api/v1/personas/internal/due ──────────────────────────────
//
// hourly   — due if lastActiveAt is null or > 1 hour ago
// daily    — due if lastActiveAt is null or > 24 hours ago
// weekdays — daily + server clock is Mon–Fri
//
// `email` is denormalized on the personas row at upsert time, so the
// response shape is identical to the legacy mana-auth endpoint without
// needing a cross-database join.

personasInternalRoutes.get('/due', async (c) => {
	const now = new Date();
	const dow = now.getUTCDay();
	const isWeekday = dow >= 1 && dow <= 5;
	const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
	const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

	const rows = await db()
		.select({
			userId: personas.userId,
			email: personas.email,
			archetype: personas.archetype,
			systemPrompt: personas.systemPrompt,
			moduleMix: personas.moduleMix,
			tickCadence: personas.tickCadence,
			lastActiveAt: personas.lastActiveAt,
		})
		.from(personas)
		.where(
			or(
				sql`${personas.tickCadence} = 'hourly' AND (${personas.lastActiveAt} IS NULL OR ${personas.lastActiveAt} <= ${oneHourAgo})`,
				sql`${personas.tickCadence} = 'daily' AND (${personas.lastActiveAt} IS NULL OR ${personas.lastActiveAt} <= ${oneDayAgo})`,
				isWeekday
					? sql`${personas.tickCadence} = 'weekdays' AND (${personas.lastActiveAt} IS NULL OR ${personas.lastActiveAt} <= ${oneDayAgo})`
					: sql`false`
			)
		)
		.orderBy(sql`${personas.lastActiveAt} NULLS FIRST`);

	return c.json({ personas: rows, serverTime: now.toISOString() });
});

// ─── POST /:id/actions ──────────────────────────────────────────────

personasInternalRoutes.post('/:id/actions', async (c) => {
	const personaId = c.req.param('id');
	if (!(await personaExists(personaId))) {
		return c.json({ error: 'Persona not found' }, 404);
	}

	let body: unknown;
	try {
		body = await c.req.json();
	} catch {
		return c.json({ error: 'Invalid JSON' }, 400);
	}

	const rawActions = (body as { actions?: unknown[] })?.actions;
	if (!Array.isArray(rawActions) || rawActions.length === 0) {
		return c.json({ error: '`actions` array required' }, 400);
	}
	if (rawActions.length > 500) {
		return c.json({ error: '`actions` batch size must be ≤ 500' }, 400);
	}
	if (!rawActions.every(isValidAction)) {
		return c.json({ error: 'One or more action rows failed validation' }, 400);
	}

	const now = new Date();
	const values = rawActions.map((a, i) => ({
		// Deterministic per (tickId, index, toolName) so a retried batch
		// hits onConflictDoNothing instead of duplicating.
		id: `${a.tickId}-${i}-${a.toolName}`.slice(0, 255),
		personaId,
		tickId: a.tickId,
		toolName: a.toolName,
		inputHash: a.inputHash ?? null,
		result: a.result,
		errorMessage: a.errorMessage ?? null,
		latencyMs: a.latencyMs ?? null,
		createdAt: now,
	}));

	await db().insert(personaActions).values(values).onConflictDoNothing();
	await db().update(personas).set({ lastActiveAt: now }).where(eq(personas.userId, personaId));

	return c.json({ ok: true, written: values.length });
});

// ─── POST /:id/feedback ─────────────────────────────────────────────

personasInternalRoutes.post('/:id/feedback', async (c) => {
	const personaId = c.req.param('id');
	if (!(await personaExists(personaId))) {
		return c.json({ error: 'Persona not found' }, 404);
	}

	let body: unknown;
	try {
		body = await c.req.json();
	} catch {
		return c.json({ error: 'Invalid JSON' }, 400);
	}

	const rawFeedback = (body as { feedback?: unknown[] })?.feedback;
	if (!Array.isArray(rawFeedback) || rawFeedback.length === 0) {
		return c.json({ error: '`feedback` array required' }, 400);
	}
	if (rawFeedback.length > 100) {
		return c.json({ error: '`feedback` batch size must be ≤ 100' }, 400);
	}
	if (!rawFeedback.every(isValidFeedback)) {
		return c.json({ error: 'One or more feedback rows failed validation' }, 400);
	}

	const now = new Date();
	const values = rawFeedback.map((f) => ({
		id: `${f.tickId}-${f.module}`.slice(0, 255),
		personaId,
		tickId: f.tickId,
		module: f.module,
		rating: f.rating,
		notes: f.notes ?? null,
		createdAt: now,
	}));

	await db().insert(personaFeedback).values(values).onConflictDoNothing();

	return c.json({ ok: true, written: values.length });
});

void isNull;
void lte;
