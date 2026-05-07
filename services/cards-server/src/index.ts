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
import { optionalAuth } from './middleware/optional-auth';
import { healthRoutes } from './routes/health';
import { AuthorService } from './services/authors';
import { DeckService } from './services/decks';
import { ExploreService } from './services/explore';
import { EngagementService } from './services/engagement';
import { SubscriptionService } from './services/subscriptions';
import { PullRequestService } from './services/pull-requests';
import { DiscussionService } from './services/discussions';
import { PurchaseService } from './services/purchases';
import { ModerationService } from './services/moderation';
import { createAuthorRoutes } from './routes/authors';
import { createDeckRoutes } from './routes/decks';
import { createExploreRoutes } from './routes/explore';
import { createEngagementRoutes } from './routes/engagement';
import { createSubscriptionRoutes } from './routes/subscriptions';
import { createPullRequestRoutes } from './routes/pull-requests';
import { createDiscussionRoutes } from './routes/discussions';
import { createPurchaseRoutes } from './routes/purchases';
import { createModerationRoutes } from './routes/moderation';
import { createNotifyClient } from './lib/notify';
import { createCreditsClient } from './lib/credits';

// ─── Bootstrap ──────────────────────────────────────────────

const config = loadConfig();
const db = getDb(config.databaseUrl);

const notify = createNotifyClient({
	url: config.manaNotifyUrl,
	serviceKey: config.serviceKey,
});

const credits = createCreditsClient({
	url: config.manaCreditsUrl,
	serviceKey: config.serviceKey,
});

const authorService = new AuthorService(db);
const deckService = new DeckService(db, config.manaLlmUrl);
const exploreService = new ExploreService(db);
const engagementService = new EngagementService(db);
const subscriptionService = new SubscriptionService(db);
const pullRequestService = new PullRequestService(db, notify);
const discussionService = new DiscussionService(db);
const purchaseService = new PurchaseService(
	db,
	credits,
	{
		standardAuthorBps: config.authorPayout.standardAuthorBps,
		verifiedAuthorBps: config.authorPayout.verifiedAuthorBps,
	},
	notify
);
const moderationService = new ModerationService(db, notify);

// ─── App ────────────────────────────────────────────────────

const app = new Hono<{ Variables: { user?: AuthUser } }>();

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
//
// Two auth tiers:
//   - jwtAuth: strict, used on writes (publish, profile updates,
//     star/follow). 401 if missing/invalid token.
//   - optionalAuth: opportunistic, used on every read. Sets
//     c.get('user') if a token validates, otherwise leaves it
//     undefined and lets the route serve anonymous content.
const v1 = new Hono<{ Variables: { user?: AuthUser } }>();

// Phase γ: public reads first — explore + browse + tags + author
// profile lookup + deck profile lookup. All read-only, no token
// required, but a present token enables logged-in extras (star
// state, follow state) once those flags land in the responses
// (MARKETPLACE_PLAN phase γ.3).
v1.use('/*', optionalAuth(config.manaAuthUrl));

// Mounted routers handle their own per-route auth requirements
// via requireUser() helpers when needed.
v1.route('/', createExploreRoutes(exploreService));
v1.route('/', createEngagementRoutes(engagementService));
v1.route('/', createSubscriptionRoutes(subscriptionService));
v1.route('/', createPullRequestRoutes(pullRequestService));
v1.route('/', createDiscussionRoutes(discussionService));
v1.route('/', createPurchaseRoutes(purchaseService));
v1.route('/', createModerationRoutes(moderationService));
v1.route('/authors', createAuthorRoutes(authorService));
v1.route('/decks', createDeckRoutes(authorService, deckService, purchaseService));

v1.get('/', (c) =>
	c.json({
		service: 'cards-server',
		version: 1,
		message: 'See apps/cards/docs/MARKETPLACE_PLAN.md for the full plan.',
	})
);

app.route('/v1', v1);

// Keep jwtAuth around — re-exported for callers that need to wrap
// individual mutating subroutes by hand. Not currently used at the
// app-level since we moved to optionalAuth + requireUser per route.
void jwtAuth;

// ─── Listen ────────────────────────────────────────────────

console.log(`[cards-server] listening on :${config.port}`);
export default {
	port: config.port,
	fetch: app.fetch,
};
