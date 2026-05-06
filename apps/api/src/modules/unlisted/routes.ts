/**
 * Unlisted Snapshots — authenticated create/update/revoke endpoints.
 *
 * POST   /:collection/:recordId  — publish or re-publish a snapshot.
 *                                   Body: { blob, expiresAt? }. Returns
 *                                   { token, url }. Re-publish keeps
 *                                   the existing active token unless
 *                                   it's been revoked (then a fresh
 *                                   row + fresh token).
 * DELETE /:collection/:recordId  — soft-revoke (revoked_at = now()).
 *                                   Idempotent; already-revoked is OK.
 *
 * Public GET lives in public-routes.ts — mounted pre-auth so anonymous
 * visitors can resolve tokens.
 *
 * See docs/plans/unlisted-sharing.md §2.
 */

import { Hono } from 'hono';
import { z } from 'zod';
import { and, eq, isNull } from 'drizzle-orm';
import type { AuthVariables } from '@mana/shared-hono';
import { errorResponse, validationError } from '../../lib/responses';
import { db, snapshots } from './schema';

const routes = new Hono<{ Variables: AuthVariables }>();

/**
 * Modules that are allowed to publish unlisted snapshots. v1 covers
 * the three pilot modules from plan §Scope — Calendar, Library,
 * Places. Expand as new modules adopt the system; keeps the server
 * honest about what it accepts (a confused client trying to publish
 * an arbitrary collection gets 400).
 */
const ALLOWED_COLLECTIONS = new Set<string>([
	'events',
	'libraryEntries',
	'places',
	'augurEntries',
	'lasts',
	'forms',
]);

const PublishBodySchema = z.object({
	spaceId: z.string().min(1).max(64),
	blob: z.record(z.string(), z.unknown()),
	expiresAt: z.string().datetime().optional(),
	/**
	 * Owner-private metadata for headless server-side jobs (M10d forms
	 * wave-cron). Stored on a separate column the public GET strips —
	 * recipients + sender details. Optional; omitted blobs leave the
	 * column NULL.
	 */
	internalMeta: z.record(z.string(), z.unknown()).nullable().optional(),
});

const TOKEN_BYTES = 24; // 24 random bytes → 32 base64url chars (~192 bits)

function generateToken(): string {
	const bytes = new Uint8Array(TOKEN_BYTES);
	crypto.getRandomValues(bytes);
	let bin = '';
	for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
	return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function buildShareUrl(
	token: string,
	c: { req: { header: (k: string) => string | undefined } }
): string {
	// The share URL points at the SvelteKit web app, not the api host.
	// In dev the web is on http://localhost:5173; in prod it's on
	// https://mana.how. The api doesn't know its sibling's public host
	// directly — use Origin/Referer, fall back to env, fall back to the
	// prod host.
	const envHost = process.env.MANA_WEB_ORIGIN;
	const origin = c.req.header('origin') ?? c.req.header('referer') ?? envHost ?? 'https://mana.how';
	const cleaned = origin.replace(/\/$/, '');
	return `${cleaned}/share/${token}`;
}

// ─── POST /:collection/:recordId ────────────────────────

routes.post('/:collection/:recordId', async (c) => {
	const userId = c.get('userId');
	const collection = c.req.param('collection');
	const recordId = c.req.param('recordId');

	if (!ALLOWED_COLLECTIONS.has(collection)) {
		return errorResponse(c, `Collection "${collection}" not allowed for unlisted sharing`, 400, {
			code: 'COLLECTION_NOT_ALLOWED',
		});
	}
	// Record ids in Mana are UUIDs client-side. Reject obviously malformed
	// values to keep the unique index healthy.
	if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(recordId)) {
		return errorResponse(c, 'recordId must be a UUID', 400, { code: 'INVALID_RECORD_ID' });
	}

	const parsed = PublishBodySchema.safeParse(await c.req.json().catch(() => null));
	if (!parsed.success) return validationError(c, parsed.error.issues);
	const { spaceId, blob, expiresAt, internalMeta } = parsed.data;

	// Is there already an active snapshot for this record? Re-publish
	// should reuse the existing token so link-shares don't break on edit.
	const existing = await db
		.select({ token: snapshots.token })
		.from(snapshots)
		.where(
			and(
				eq(snapshots.userId, userId),
				eq(snapshots.collection, collection),
				eq(snapshots.recordId, recordId),
				isNull(snapshots.revokedAt)
			)
		)
		.limit(1);

	const now = new Date();

	if (existing[0]) {
		await db
			.update(snapshots)
			.set({
				blob,
				expiresAt: expiresAt ? new Date(expiresAt) : null,
				updatedAt: now,
				...(internalMeta !== undefined ? { internalMeta } : {}),
			})
			.where(eq(snapshots.token, existing[0].token));
		return c.json({ token: existing[0].token, url: buildShareUrl(existing[0].token, c) }, 200);
	}

	const token = generateToken();
	await db.insert(snapshots).values({
		token,
		userId,
		spaceId,
		collection,
		recordId,
		blob,
		expiresAt: expiresAt ? new Date(expiresAt) : null,
		createdAt: now,
		updatedAt: now,
		...(internalMeta !== undefined ? { internalMeta } : {}),
	});
	return c.json({ token, url: buildShareUrl(token, c) }, 201);
});

// ─── DELETE /:collection/:recordId ──────────────────────

routes.delete('/:collection/:recordId', async (c) => {
	const userId = c.get('userId');
	const collection = c.req.param('collection');
	const recordId = c.req.param('recordId');

	// Idempotent — revoke any active row for (user + collection + record).
	// If there's none, 204 anyway. Keeps client-side logic simple: the
	// store can unconditionally call DELETE on setVisibility-away.
	const updated = await db
		.update(snapshots)
		.set({ revokedAt: new Date() })
		.where(
			and(
				eq(snapshots.userId, userId),
				eq(snapshots.collection, collection),
				eq(snapshots.recordId, recordId),
				isNull(snapshots.revokedAt)
			)
		)
		.returning({ token: snapshots.token });

	return c.json({ revoked: updated.length }, 200);
});

export const unlistedRoutes = routes;
