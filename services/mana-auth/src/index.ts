/**
 * mana-auth — Central authentication service
 *
 * Hono + Bun runtime. Replaces NestJS-based mana-auth.
 * Uses Better Auth natively (fetch-based handler, no Express conversion).
 */

// Sentry/Glitchtip — must run before the rest of the module loads so
// uncaughtException + unhandledRejection get hooked. No-op when
// GLITCHTIP_DSN is unset (e.g. local dev).
import { initErrorTracking, captureException } from '@mana/shared-error-tracking';
initErrorTracking({
	serviceName: 'mana-auth',
	dsn: process.env.GLITCHTIP_DSN,
	environment: process.env.NODE_ENV,
	release: process.env.GIT_SHA,
});

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { trimTrailingSlash } from 'hono/trailing-slash';
import { loadConfig } from './config';
import { getDb } from './db/connection';
import { createBetterAuth } from './auth/better-auth.config';
import {
	serviceErrorHandler as errorHandler,
	initLogger,
	requestLogger,
	logger,
} from '@mana/shared-hono';
import { jwtAuth } from './middleware/jwt-auth';
import { serviceAuth } from './middleware/service-auth';
import { SecurityEventsService, AccountLockoutService } from './services/security';
import { PasskeyRateLimitService } from './services/passkey-rate-limit';
import { SignupLimitService } from './services/signup-limit';
import { ApiKeysService } from './services/api-keys';
import { UserDataService } from './services/user-data';
import { EncryptionVaultService } from './services/encryption-vault';
import { MissionGrantService } from './services/encryption-vault/mission-grant';
import { loadKek } from './services/encryption-vault/kek';
import { createAuthRoutes } from './routes/auth';
import { createPasskeyRoutes } from './routes/passkeys';
import { createGuildRoutes } from './routes/guilds';
import { createApiKeyRoutes, createApiKeyValidationRoute } from './routes/api-keys';
import { createMeRoutes } from './routes/me';
import { createMeBootstrapRoutes } from './routes/me-bootstrap';
import { createOnboardingRoutes } from './routes/onboarding';
import { createEncryptionVaultRoutes } from './routes/encryption-vault';
import { createAiMissionGrantRoutes } from './routes/ai-mission-grant';
import { createSettingsRoutes } from './routes/settings';
import { createAdminRoutes } from './routes/admin';
import { createAdminPersonasRoutes } from './routes/admin-personas';
import { createInternalPersonasRoutes } from './routes/internal-personas';

// ─── Bootstrap ──────────────────────────────────────────────

initLogger('mana-auth');
const config = loadConfig();
const db = getDb(config.databaseUrl);
const auth = createBetterAuth(config.databaseUrl, config.syncDatabaseUrl, config.webauthn);

// Load the Key Encryption Key before any vault operation can run.
// Top-level await is supported by Bun. Throws if MANA_AUTH_KEK is
// missing in production or malformed in any environment.
await loadKek(config.encryptionKek);

// Initialize services
const security = new SecurityEventsService(db);
const lockout = new AccountLockoutService(db);
const passkeyRateLimit = new PasskeyRateLimitService();
// Periodic sweep of expired passkey rate-limit buckets. 5 min cadence
// is short enough that high IP churn doesn't balloon memory, long
// enough that the overhead is negligible. setInterval + unref so the
// sweep doesn't keep the process alive on shutdown (Bun implements
// unref but Node typings don't always pick it up — the optional
// chain makes it safe).
setInterval(() => passkeyRateLimit.sweep(), 5 * 60 * 1000)?.unref?.();
const signupLimit = new SignupLimitService(db);
const apiKeysService = new ApiKeysService(db);
const userDataService = new UserDataService(db, config);
const encryptionVaultService = new EncryptionVaultService(db);
const missionGrantService = new MissionGrantService(
	encryptionVaultService,
	config.missionGrantPublicKeyPem
);

// ─── App ────────────────────────────────────────────────────

const app = new Hono();

app.onError((err, c) => {
	// Surface non-HTTPException errors to Glitchtip with request context.
	// HTTPException is intentional 4xx/422 etc. — not an "error" worth alerting on.
	const isHttpException = err.constructor.name === 'HTTPException';
	if (!isHttpException) {
		captureException(err, {
			path: c.req.path,
			method: c.req.method,
			query: Object.fromEntries(new URL(c.req.url).searchParams),
		});
	}
	return errorHandler(err, c);
});
app.use('*', requestLogger());
// Defense-in-depth for clients that accidentally request the trailing-slash
// form of a route (e.g. `/api/v1/me/onboarding/`). Hono's nested-router root
// match-up doesn't include the prefix-with-slash variant, so without this
// middleware those clients get a 404 even though the same path-without-slash
// would work. Trims the slash and 301-redirects on GET/HEAD, only when a
// non-trimmed lookup already produced a 404 — so the legitimate root path
// `/` is never touched.
app.use('*', trimTrailingSlash());
app.use(
	'*',
	cors({
		origin: config.cors.origins,
		credentials: true,
		allowHeaders: ['Content-Type', 'Authorization', 'X-Service-Key', 'X-App-Id'],
		exposeHeaders: ['Set-Cookie'],
	})
);

// ─── Health ─────────────────────────────────────────────────

app.get('/health', (c) =>
	c.json({ status: 'ok', service: 'mana-auth', timestamp: new Date().toISOString() })
);

// ─── Better Auth Native Handler ─────────────────────────────

app.all('/api/auth/*', async (c) => auth.handler(c.req.raw));
app.get('/.well-known/openid-configuration', async (c) => auth.handler(c.req.raw));

// ─── Custom Auth Endpoints ──────────────────────────────────

app.route('/api/v1/auth', createAuthRoutes(auth, config, security, lockout, signupLimit));
app.route(
	'/api/v1/auth/passkeys',
	createPasskeyRoutes(auth, config, config.webauthn, security, lockout, passkeyRateLimit)
);

// ─── Guilds ─────────────────────────────────────────────────

app.use('/api/v1/gilden/*', jwtAuth(config.baseUrl));
app.route('/api/v1/gilden', createGuildRoutes(auth, config));

// ─── API Keys ───────────────────────────────────────────────

app.use('/api/v1/api-keys/*', jwtAuth(config.baseUrl));
app.route('/api/v1/api-keys', createApiKeyRoutes(apiKeysService));
app.route('/api/v1/api-keys', createApiKeyValidationRoute(apiKeysService));

// ─── Me (GDPR) ──────────────────────────────────────────────

app.use('/api/v1/me/*', jwtAuth(config.baseUrl));
app.route('/api/v1/me', createMeRoutes(userDataService, db));

// ─── Encryption vault (per-user master key custody) ────────
// Mounted under /me so it inherits the JWT middleware above and shows
// up in the same self-service surface as the GDPR endpoints.
app.route('/api/v1/me/encryption-vault', createEncryptionVaultRoutes(encryptionVaultService));

// ─── AI Mission Grant ──────────────────────────────────────
// Mints per-mission Key-Grants so the mana-ai background runner can
// decrypt scoped encrypted records. Under /me so it inherits the JWT
// middleware above. See docs/plans/ai-mission-key-grant.md.
app.route('/api/v1/me/ai-mission-grant', createAiMissionGrantRoutes(missionGrantService));

// ─── Onboarding ────────────────────────────────────────────
// Per-user "did you finish the 3-screen onboarding flow yet" state.
// See docs/plans/onboarding-flow.md.
app.route('/api/v1/me/onboarding', createOnboardingRoutes(db));

// ─── Singleton Bootstrap ────────────────────────────────────
// Idempotent reconciliation endpoint for the per-user `userContext`
// singleton. Webapp boot calls this once; the signup-time hook remains
// the happy path. See docs/plans/sync-field-meta-overhaul.md and
// routes/me-bootstrap.ts.
app.route('/api/v1/me/bootstrap-singletons', createMeBootstrapRoutes(db, config.syncDatabaseUrl));

// ─── Settings ──────────────────────────────────────────────

app.use('/api/v1/settings/*', jwtAuth(config.baseUrl));
app.use('/api/v1/settings', jwtAuth(config.baseUrl));
app.route('/api/v1/settings', createSettingsRoutes(db));

// ─── Admin ──────────────────────────────────────────────────

app.use('/api/v1/admin/*', jwtAuth(config.baseUrl));
app.route('/api/v1/admin', createAdminRoutes(db, userDataService));
app.route('/api/v1/admin/personas', createAdminPersonasRoutes(db, auth));

// ─── Internal API ───────────────────────────────────────────

app.use('/api/v1/internal/*', serviceAuth(config.serviceKey));

app.route('/api/v1/internal/personas', createInternalPersonasRoutes(db));

app.get('/api/v1/internal/org/:orgId/member/:userId', async (c) => {
	const { orgId, userId } = c.req.param();
	const { members } = await import('./db/schema/organizations');
	const { eq, and } = await import('drizzle-orm');
	const [member] = await db
		.select()
		.from(members)
		.where(and(eq(members.organizationId, orgId), eq(members.userId, userId)))
		.limit(1);
	return c.json({ isMember: !!member, role: member?.role || '' });
});

/**
 * List every Space (organization) the given user is a member of. Used by
 * mana-sync to pass the current user's space-membership list into the
 * `app.current_user_space_ids` session setting so the multi-member RLS
 * policy can let space co-members read each other's records.
 *
 * Returns a flat array of organization ids — mana-sync doesn't care
 * about names/roles here, only the set. Cached 5 min client-side.
 */
app.get('/api/v1/internal/users/:userId/memberships', async (c) => {
	const { userId } = c.req.param();
	const { members } = await import('./db/schema/organizations');
	const { eq } = await import('drizzle-orm');
	const rows = await db
		.select({ organizationId: members.organizationId, role: members.role })
		.from(members)
		.where(eq(members.userId, userId));
	return c.json({
		userId,
		memberships: rows.map((r) => ({ organizationId: r.organizationId, role: r.role })),
	});
});

// ─── Login Page (OIDC) ─────────────────────────────────────

app.get('/login', (c) => {
	const q = c.req.query();
	return c.html(`<!DOCTYPE html>
<html><head><title>Mana Login</title></head>
<body style="font-family:system-ui;max-width:400px;margin:80px auto;padding:20px;">
<h1>Mana Login</h1>
<form method="POST" action="/api/auth/sign-in/email">
<input type="hidden" name="callbackURL" value="${q.callbackURL || '/'}" />
<label>Email<br><input type="email" name="email" required style="width:100%;padding:8px;margin:4px 0 12px;"></label>
<label>Password<br><input type="password" name="password" required style="width:100%;padding:8px;margin:4px 0 12px;"></label>
<button type="submit" style="width:100%;padding:10px;background:#3b82f6;color:white;border:none;cursor:pointer;">Login</button>
</form></body></html>`);
});

// ─── Start ──────────────────────────────────────────────────

logger.info(`mana-auth starting on port ${config.port}`);

export default { port: config.port, fetch: app.fetch };
