/**
 * cards-server — Cards Marketplace + Community backend.
 *
 * Hono + Bun. Owns published decks, versions, subscriptions, forks,
 * pull-requests, discussions, moderation, and the credits-based
 * author payout pipeline.
 *
 * See apps/cards/docs/MARKETPLACE_PLAN.md for the full design.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { serviceErrorHandler as errorHandler } from '@mana/shared-hono';
import { loadConfig } from './config';
import { getDb } from './db/connection';
import { healthRoutes } from './routes/health';

// ─── Bootstrap ──────────────────────────────────────────────

const config = loadConfig();
// Eager-init the pool so a misconfigured DATABASE_URL fails at boot
// (instead of on the first user request).
getDb(config.databaseUrl);

// ─── App ────────────────────────────────────────────────────

const app = new Hono();

app.onError(errorHandler);
app.use(
	'*',
	cors({
		origin: config.cors.origins,
		credentials: true,
	})
);

// Health (no auth)
app.route('/health', healthRoutes);

// Versioned API surface — routes will land here in Phase α.3 onwards.
// The /v1 prefix is the public contract from day one (see
// MARKETPLACE_PLAN §3 architecture principle 1).
const v1 = new Hono();
v1.get('/', (c) =>
	c.json({
		service: 'cards-server',
		version: 1,
		message: 'See apps/cards/docs/MARKETPLACE_PLAN.md for the full plan.',
	})
);
app.route('/v1', v1);

// ─── Listen ────────────────────────────────────────────────

console.log(`[cards-server] listening on :${config.port}`);
export default {
	port: config.port,
	fetch: app.fetch,
};
