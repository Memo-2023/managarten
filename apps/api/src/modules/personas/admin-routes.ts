/**
 * Personas — admin endpoints.
 *
 * Mounted at `/api/v1/personas/admin/*`. Caller must hold an admin-role
 * JWT (validated by the global authMiddleware in apps/api). All routes
 * include an inline role check as defence-in-depth.
 *
 *   POST   /              create-or-update by email (idempotent)
 *   GET    /              list with action counts
 *   GET    /:id           detail + recent actions + feedback aggregate
 *   DELETE /:id           hard delete (persona row + user via mana-auth)
 *
 * Persona creation flow:
 *   1. Resolve user by email via mana-auth (`/api/v1/admin/users?search=`)
 *   2. If absent, register via mana-auth (`/api/v1/auth/register`)
 *   3. Stamp tier=founder via mana-auth (`/api/v1/admin/users/:id/tier`)
 *   4. Stamp emailVerified + kind via mana-auth's internal stamp endpoint
 *   5. Upsert the persona row locally with email denormalised
 *
 * Step 4 needs a service-key endpoint on platform mana-auth — added
 * alongside this migration as `POST /api/v1/internal/users/:id/persona-stamp`.
 */

import { Hono } from 'hono';
import { count, desc, eq, gte } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import type { AuthVariables } from '@mana/shared-hono';
import { getConnection } from '../../lib/db';
import { personas, personaActions, personaFeedback } from './schema';

interface PersonaUpsertBody {
	email: string;
	name?: string;
	password: string;
	archetype: string;
	systemPrompt: string;
	moduleMix: Record<string, number>;
	tickCadence?: 'daily' | 'weekdays' | 'hourly';
}

const VALID_CADENCES = new Set(['daily', 'weekdays', 'hourly']);

function authBaseUrl(): string {
	return process.env.MANA_AUTH_URL ?? 'http://localhost:3001';
}

function serviceKey(): string {
	const key = process.env.MANA_SERVICE_KEY;
	if (!key) throw new Error('MANA_SERVICE_KEY is not set in apps/api env');
	return key;
}

async function manaAuth<T>(
	method: 'GET' | 'POST' | 'PUT' | 'DELETE',
	path: string,
	body?: unknown
): Promise<{ ok: boolean; status: number; body: T }> {
	const res = await fetch(`${authBaseUrl()}${path}`, {
		method,
		headers: {
			'content-type': 'application/json',
			'x-service-key': serviceKey(),
		},
		body: body ? JSON.stringify(body) : undefined,
	});
	const text = await res.text();
	let parsed: T;
	try {
		parsed = text ? (JSON.parse(text) as T) : ({} as T);
	} catch {
		parsed = {} as T;
	}
	return { ok: res.ok, status: res.status, body: parsed };
}

export const personasAdminRoutes = new Hono<{ Variables: AuthVariables }>();

// Defence-in-depth: the global authMiddleware already ran before we
// got here, but inline-checking role keeps this file self-contained
// if mounted under a different prefix later.
personasAdminRoutes.use('*', async (c, next) => {
	const role = c.get('userRole');
	if (role !== 'admin') {
		return c.json({ error: 'Forbidden', message: 'Admin access required' }, 403);
	}
	await next();
});

const db = () =>
	drizzle(getConnection(), { schema: { personas, personaActions, personaFeedback } });

// ─── POST / ─ create or update ──────────────────────────────────────

personasAdminRoutes.post('/', async (c) => {
	let body: PersonaUpsertBody;
	try {
		body = (await c.req.json()) as PersonaUpsertBody;
	} catch {
		return c.json({ error: 'Invalid JSON body' }, 400);
	}

	const errors: string[] = [];
	if (!body.email || !body.email.includes('@')) errors.push('email required');
	if (!body.password || body.password.length < 8) errors.push('password ≥ 8 chars required');
	if (!body.archetype) errors.push('archetype required');
	if (!body.systemPrompt) errors.push('systemPrompt required');
	if (!body.moduleMix || typeof body.moduleMix !== 'object')
		errors.push('moduleMix object required');
	if (body.tickCadence && !VALID_CADENCES.has(body.tickCadence)) {
		errors.push(`tickCadence must be one of ${[...VALID_CADENCES].join(', ')}`);
	}
	if (errors.length > 0) return c.json({ error: 'ValidationError', details: errors }, 400);

	// 1) Look up by email
	let userId: string | undefined;
	const lookup = await manaAuth<{ users?: Array<{ id: string; email: string }> }>(
		'GET',
		`/api/v1/admin/users?search=${encodeURIComponent(body.email)}`
	);
	if (lookup.ok) {
		userId = lookup.body.users?.find((u) => u.email === body.email)?.id;
	}

	// 2) Register if absent (public endpoint, no service-key needed but
	// we send it anyway — mana-auth ignores it on public routes).
	if (!userId) {
		const reg = await manaAuth<{ user?: { id: string }; userId?: string }>(
			'POST',
			'/api/v1/auth/register',
			{
				email: body.email,
				password: body.password,
				name: body.name ?? body.email.split('@')[0],
			}
		);
		if (!reg.ok) {
			return c.json({ error: 'Sign-up failed', detail: reg.body }, 500);
		}
		userId = reg.body.user?.id ?? reg.body.userId;
		if (!userId) return c.json({ error: 'Sign-up returned no user id' }, 500);
	}

	// 3) Stamp persona kind + emailVerified + tier via mana-auth.
	// The endpoint is service-key gated (added in platform mana-auth as
	// part of the personas migration).
	const stamp = await manaAuth(
		'POST',
		`/api/v1/internal/users/${encodeURIComponent(userId)}/persona-stamp`,
		{ accessTier: 'founder' }
	);
	if (!stamp.ok) {
		return c.json({ error: 'Persona stamp failed', detail: stamp.body }, 500);
	}

	// 4) Upsert persona row locally
	await db()
		.insert(personas)
		.values({
			userId,
			email: body.email,
			archetype: body.archetype,
			systemPrompt: body.systemPrompt,
			moduleMix: body.moduleMix,
			tickCadence: body.tickCadence ?? 'daily',
		})
		.onConflictDoUpdate({
			target: personas.userId,
			set: {
				email: body.email,
				archetype: body.archetype,
				systemPrompt: body.systemPrompt,
				moduleMix: body.moduleMix,
				tickCadence: body.tickCadence ?? 'daily',
			},
		});

	return c.json({ ok: true, userId, email: body.email });
});

// ─── GET / ─ list ───────────────────────────────────────────────────

personasAdminRoutes.get('/', async (c) => {
	const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

	const rows = await db()
		.select({
			userId: personas.userId,
			email: personas.email,
			archetype: personas.archetype,
			tickCadence: personas.tickCadence,
			lastActiveAt: personas.lastActiveAt,
			createdAt: personas.createdAt,
		})
		.from(personas)
		.orderBy(desc(personas.createdAt));

	const actionCounts = await db()
		.select({ personaId: personaActions.personaId, value: count() })
		.from(personaActions)
		.where(gte(personaActions.createdAt, sevenDaysAgo))
		.groupBy(personaActions.personaId);
	const countByPersona = new Map(actionCounts.map((r) => [r.personaId, Number(r.value)]));

	return c.json({
		personas: rows.map((r) => ({ ...r, actions7d: countByPersona.get(r.userId) ?? 0 })),
	});
});

// ─── GET /:id ─ detail ──────────────────────────────────────────────

personasAdminRoutes.get('/:id', async (c) => {
	const userId = c.req.param('id');

	const [row] = await db()
		.select({
			userId: personas.userId,
			email: personas.email,
			archetype: personas.archetype,
			systemPrompt: personas.systemPrompt,
			moduleMix: personas.moduleMix,
			tickCadence: personas.tickCadence,
			lastActiveAt: personas.lastActiveAt,
			createdAt: personas.createdAt,
		})
		.from(personas)
		.where(eq(personas.userId, userId));

	if (!row) return c.json({ error: 'Not found' }, 404);

	const recentActions = await db()
		.select()
		.from(personaActions)
		.where(eq(personaActions.personaId, userId))
		.orderBy(desc(personaActions.createdAt))
		.limit(20);

	const feedbackAgg = await db()
		.select({ module: personaFeedback.module, avgRating: count() })
		.from(personaFeedback)
		.where(eq(personaFeedback.personaId, userId))
		.groupBy(personaFeedback.module);

	return c.json({ persona: row, recentActions, feedbackByModule: feedbackAgg });
});

// ─── DELETE /:id ─ hard delete ──────────────────────────────────────
//
// Safety-checked by "row exists in personas" — apps/api owns this
// table, so the existence of a personas row IS the persona-marker.
// Real human users are never reachable here (no row → 404).

personasAdminRoutes.delete('/:id', async (c) => {
	const userId = c.req.param('id');

	const [row] = await db()
		.select({ userId: personas.userId })
		.from(personas)
		.where(eq(personas.userId, userId));
	if (!row) return c.json({ error: 'Not found' }, 404);

	// Local cascade: deleting the personas row also cascades to
	// persona_actions/persona_feedback via... wait — Drizzle doesn't
	// declare onDelete cascade across tables here, since they reference
	// personas.userId by plain text not FK. Delete each table explicitly.
	await db().delete(personaActions).where(eq(personaActions.personaId, userId));
	await db().delete(personaFeedback).where(eq(personaFeedback.personaId, userId));
	await db().delete(personas).where(eq(personas.userId, userId));

	// Then delete the user via mana-auth's admin DELETE.
	const del = await manaAuth('DELETE', `/api/v1/admin/users/${encodeURIComponent(userId)}/data`);
	if (!del.ok) {
		// Persona row is already gone locally; mana-auth deletion failed.
		// Return success-with-warning so the admin UI can show a cleanup hint.
		return c.json({
			ok: true,
			deleted: userId,
			warning: 'persona row deleted but mana-auth user deletion failed',
			detail: del.body,
		});
	}

	return c.json({ ok: true, deleted: userId });
});
