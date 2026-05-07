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
import { jwtAuth, type AuthUser } from './middleware/jwt-auth';
import { healthRoutes } from './routes/health';
import { AuthorService } from './services/authors';
import { DeckService } from './services/decks';
import { createAuthorRoutes } from './routes/authors';
import { createDeckRoutes } from './routes/decks';

// ─── Bootstrap ──────────────────────────────────────────────

const config = loadConfig();
const db = getDb(config.databaseUrl);

const authorService = new AuthorService(db);
const deckService = new DeckService(db, config.manaLlmUrl);

// ─── App ────────────────────────────────────────────────────

const app = new Hono<{ Variables: { user: AuthUser } }>();

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

// Versioned API surface — additive-only changes within v1, breaking
// changes go to /v2 (MARKETPLACE_PLAN §3 architecture principle 1).
const v1 = new Hono<{ Variables: { user: AuthUser } }>();

// Public reads on author + deck profiles allow anonymous access; the
// mutating endpoints in the same routers gate themselves by checking
// for `c.get('user')`. Until we have that anonymous-aware middleware
// (Phase γ adds optionalAuth), every /v1 route gates on JWT — public
// reads still work for any signed-in user, which covers the only
// surface we have right now (author dashboard + deck CRUD).
v1.use('/*', jwtAuth(config.manaAuthUrl));

v1.route('/authors', createAuthorRoutes(authorService));
v1.route('/decks', createDeckRoutes(authorService, deckService));

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
