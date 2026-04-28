/**
 * Singleton bootstrap endpoint.
 *
 * `POST /api/v1/me/bootstrap-singletons` — idempotently provisions the
 * per-user `userContext` singleton. Called once per webapp boot as a
 * reconciliation belt-and-suspenders for the signup-time hook
 * (databaseHooks.user.create.after).
 *
 * Why both: the signup hook is a zero-latency happy-path bootstrap but
 * fire-and-forget — a transient mana_sync outage during signup leaves
 * the user with no singleton and no signal that anything is wrong. The
 * boot-time endpoint converges to the right state on every load.
 * Idempotency in the bootstrap function makes double-invocation
 * harmless.
 *
 * The endpoint is deliberately simple: no body, no parameters. The
 * caller's identity (and thus the userId) comes from the JWT.
 *
 * Per-Space singletons used to be bootstrapped here too (kontextDoc),
 * but the kontextDoc table was retired in favour of the user-driven
 * `notes.isSpaceContext` flag — there is nothing to bootstrap per
 * Space anymore. The response shape keeps the `spaces` map for
 * backwards compatibility with older webapp builds; it is always
 * empty now.
 */

import { Hono } from 'hono';
import postgres from 'postgres';
import { logger } from '@mana/shared-hono';
import type { AuthUser } from '../middleware/jwt-auth';
import type { Database } from '../db/connection';
import { bootstrapUserSingletons } from '../services/bootstrap-singletons';

export interface BootstrapResponse {
	ok: true;
	bootstrapped: {
		userContext: boolean;
		spaces: Record<string, boolean>;
	};
}

export function createMeBootstrapRoutes(
	_db: Database,
	syncDatabaseUrl: string
): Hono<{ Variables: { user: AuthUser } }> {
	// Lazy module-scoped postgres pool. Mirrors routes/auth.ts and
	// better-auth.config.ts — process lifetime owns it; never closed
	// manually.
	let _syncSql: ReturnType<typeof postgres> | null = null;
	const getSyncSql = (): ReturnType<typeof postgres> => {
		if (!_syncSql) _syncSql = postgres(syncDatabaseUrl, { max: 2 });
		return _syncSql;
	};

	return new Hono<{ Variables: { user: AuthUser } }>().post('/', async (c) => {
		const user = c.get('user');
		const syncSql = getSyncSql();

		const result: BootstrapResponse = {
			ok: true,
			bootstrapped: { userContext: false, spaces: {} },
		};

		try {
			result.bootstrapped.userContext = await bootstrapUserSingletons(user.userId, syncSql);
		} catch (err) {
			logger.error('[me/bootstrap-singletons] userContext failed', {
				userId: user.userId,
				err: err instanceof Error ? err.message : String(err),
			});
			return c.json({ ok: false, error: 'userContext bootstrap failed' }, 500);
		}

		return c.json(result);
	});
}
