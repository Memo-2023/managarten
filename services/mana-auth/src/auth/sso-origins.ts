/**
 * Single source of truth for SSO trusted origins.
 *
 * Extracted into a standalone module (no Better Auth imports) so it can
 * also be consumed by infra tooling (compose env generators, monitoring
 * jobs, etc.) without pulling in the full auth stack.
 *
 * Better Auth rejects any cross-origin auth request whose Origin header
 * isn't in this list — silent login failure on mis-configured apps. When
 * adding a new top-level domain (NOT a path under mana.how), update both:
 *
 *   1. `PRODUCTION_TRUSTED_ORIGINS` below
 *   2. The `mana-auth` `CORS_ORIGINS` env var in
 *      `docker-compose.macmini.yml` (must be a superset of this list)
 *
 * `sso-config.spec.ts` enforces both invariants. The unified app under
 * `mana.how` does NOT need per-module subdomains here — modules are routed
 * by path on the same origin.
 */

/** HTTPS origins Better Auth accepts in production. */
export const PRODUCTION_TRUSTED_ORIGINS = [
	// Unified app — all productivity apps live under mana.how
	'https://mana.how',
	'https://auth.mana.how',
	// Separate apps (not part of the unified app)
	'https://whopxl.mana.how', // Games
	'https://cards.mana.how', // Cards spaced-repetition spinoff (own SvelteKit container, not the unified app)
	'https://cards-api.mana.how', // Cards marketplace + community backend (cards-server)
	'https://memoro-app.mana.how', // Memoro web SPA (separate deploy under mana e.V.)
] as const;

/** Local dev origins — web dev server + the auth server itself. */
export const LOCAL_TRUSTED_ORIGINS = ['http://localhost:3001', 'http://localhost:5173'] as const;

/** Full trusted-origins list passed to Better Auth. */
export const TRUSTED_ORIGINS: string[] = [...PRODUCTION_TRUSTED_ORIGINS, ...LOCAL_TRUSTED_ORIGINS];
