/**
 * Mana Unified API Server
 *
 * Consolidates all app compute servers into one Hono/Bun process.
 * Each module registers its routes under /api/v1/{module}/*.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import {
	authMiddleware,
	healthRoute,
	errorHandler,
	notFoundHandler,
	rateLimitMiddleware,
	requireTier,
	type AuthVariables,
} from '@mana/shared-hono';

// MCP server
import { handleMcpRequest } from './mcp/server';

// Prometheus metrics
import { register as metricsRegister } from './lib/metrics';

// Module routes
import { calendarRoutes } from './modules/calendar/routes';
import { contactsRoutes } from './modules/contacts/routes';
import { musicRoutes } from './modules/music/routes';
import { chatRoutes } from './modules/chat/routes';
import { notesRoutes } from './modules/notes/routes';
import { pictureRoutes } from './modules/picture/routes';
import { profileRoutes } from './modules/profile/routes';
import { storageRoutes } from './modules/storage/routes';
import { todoRoutes } from './modules/todo/routes';
import { guidesRoutes } from './modules/guides/routes';
import { newsResearchRoutes } from './modules/news-research/routes';
import { articlesRoutes } from './modules/articles/routes';
import { startArticleImportWorker } from './modules/articles/import-worker';
import { tracesRoutes } from './modules/traces/routes';
import { writingRoutes } from './modules/writing/routes';
import { comicRoutes } from './modules/comic/routes';
import { presiRoutes } from './modules/presi/routes';
import { researchRoutes } from './modules/research/routes';
import { websiteRoutes } from './modules/website/routes';
import { websitePublicRoutes } from './modules/website/public-routes';
import { unlistedRoutes } from './modules/unlisted/routes';
import { unlistedPublicRoutes } from './modules/unlisted/public-routes';
import { formsPublicRoutes } from './modules/forms/public-routes';
import { startFormsWaveWorker } from './modules/forms/wave-worker';
import { wetterRoutes } from './modules/wetter/routes';
import { personasInternalRoutes } from './modules/personas/internal-routes';
import { personasAdminRoutes } from './modules/personas/admin-routes';

const PORT = parseInt(process.env.PORT || '3060', 10);
const CORS_ORIGINS = (process.env.CORS_ORIGINS || 'http://localhost:5173').split(',');

const app = new Hono<{ Variables: AuthVariables }>();

// ─── Global Middleware ──────────────────────────────────────
app.onError(errorHandler);
app.notFound(notFoundHandler);
app.use('*', cors({ origin: CORS_ORIGINS, credentials: true }));
app.route('/health', healthRoute('mana-api'));

// Prometheus scrape endpoint. Unauthenticated on purpose — the Grafana
// / Prometheus stack runs on the internal network; we rely on the
// reverse-proxy layer to block external access to /metrics.
app.get('/metrics', async (c) => {
	c.header('Content-Type', metricsRegister.contentType);
	return c.text(await metricsRegister.metrics());
});

app.use('/api/*', rateLimitMiddleware({ max: 200, windowMs: 60_000 }));

// Public routes — no auth required (weather data is public, published
// websites are by definition public, unlisted-share tokens are public
// by design).
app.route('/api/v1/wetter', wetterRoutes);
app.route('/api/v1/website/public', websitePublicRoutes);
app.route('/api/v1/unlisted/public', unlistedPublicRoutes);
app.route('/api/v1/forms/public', formsPublicRoutes);

// Service-key gated — mounted before the JWT-required global authMiddleware
// because the persona-runner has no JWT, only X-Service-Key. The route
// file enforces serviceAuthMiddleware internally.
app.route('/api/v1/personas/internal', personasInternalRoutes);

app.use('/api/*', authMiddleware());

// ─── Tier Gating ────────────────────────────────────────────
// Defense-in-depth on top of per-route credits validation.
// Routes that call LLMs, image-gen, or external search APIs are gated
// to `beta`+ so that unauthenticated guest fallbacks (tier='public'
// from a missing claim) can't hit paid infrastructure.
// Pure CRUD modules (calendar, contacts, music, storage, todo, news,
// presi) rely on authMiddleware alone — users access only
// their own records.
const RESOURCE_MODULES = [
	'chat',
	'guides',
	'kontext',
	'news-research',
	'notes',
	'picture',
	'research',
	'traces',
	'writing',
] as const;
for (const mod of RESOURCE_MODULES) {
	app.use(`/api/v1/${mod}/*`, requireTier('beta'));
}

// ─── MCP Endpoint ──────────────────────────────────────────
// Streamable HTTP transport: POST (messages), GET (SSE stream), DELETE (close)
// MCP exposes the full tool catalog including LLM/research tools, so it
// gets the same minimum tier.
app.use('/api/v1/mcp', requireTier('beta'));
app.all('/api/v1/mcp', (c) => handleMcpRequest(c.req.raw, c.get('userId')));

// ─── Module Routes ──────────────────────────────────────────
app.route('/api/v1/calendar', calendarRoutes);
app.route('/api/v1/contacts', contactsRoutes);
app.route('/api/v1/music', musicRoutes);
app.route('/api/v1/chat', chatRoutes);
app.route('/api/v1/notes', notesRoutes);
app.route('/api/v1/picture', pictureRoutes);
app.route('/api/v1/profile', profileRoutes);
app.route('/api/v1/storage', storageRoutes);
app.route('/api/v1/todo', todoRoutes);
app.route('/api/v1/guides', guidesRoutes);
app.route('/api/v1/news-research', newsResearchRoutes);
app.route('/api/v1/articles', articlesRoutes);
app.route('/api/v1/traces', tracesRoutes);
app.route('/api/v1/presi', presiRoutes);
app.route('/api/v1/research', researchRoutes);
app.route('/api/v1/website', websiteRoutes);
app.route('/api/v1/unlisted', unlistedRoutes);
app.route('/api/v1/writing', writingRoutes);
app.route('/api/v1/comic', comicRoutes);
app.route('/api/v1/personas/admin', personasAdminRoutes);

// ─── Background Workers ─────────────────────────────────────
// Articles bulk-import: ticks every 2s, advisory-lock-gated so multiple
// apps/api replicas never double-process. See
// docs/plans/articles-bulk-import.md.
startArticleImportWorker();

// Forms wave-cron (M10d): scans unlisted snapshots with internal_meta
// for forms-recurrence configs, fires due waves via mana-mail's
// internal bulk-send route. Advisory-lock-gated. See
// docs/plans/forms-module.md M10d.
startFormsWaveWorker();

// ─── Server Info ────────────────────────────────────────────
console.log(`mana-api starting on port ${PORT}...`);

export default { port: PORT, fetch: app.fetch };
