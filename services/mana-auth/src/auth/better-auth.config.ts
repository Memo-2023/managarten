/**
 * Better Auth Configuration
 *
 * This file configures Better Auth with:
 * - Email/password authentication
 * - Organization plugin for B2B (multi-tenant)
 * - JWT plugin with minimal claims
 * - Drizzle adapter for PostgreSQL
 *
 * ARCHITECTURE DECISION (2024-12):
 * We use MINIMAL JWT claims. Organization and credit data should be fetched
 * via API calls, not embedded in JWTs. See docs/AUTHENTICATION_ARCHITECTURE.md
 *
 * @see https://www.better-auth.com/docs
 */

import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { jwt } from 'better-auth/plugins/jwt';
import { organization } from 'better-auth/plugins/organization';
import { twoFactor } from 'better-auth/plugins/two-factor';
import { magicLink } from 'better-auth/plugins/magic-link';
import { passkey } from '@better-auth/passkey';
import postgres from 'postgres';
import { logger } from '@mana/shared-hono';
import { getDb } from '../db/connection';
import { organizations, members, invitations } from '../db/schema/organizations';
import {
	users,
	sessions,
	accounts,
	verificationTokens,
	jwks,
	twoFactorAuth,
	passkeys,
} from '../db/schema/auth';
import {
	sendPasswordResetEmail,
	sendInvitationEmail,
	sendVerificationEmail,
	sendMagicLinkEmail,
} from '../email/send';
import { sourceAppStore, passwordResetRedirectStore } from './stores';
import { TRUSTED_ORIGINS } from './sso-origins';
import {
	assertValidSpaceMetadataForCreate,
	assertSpaceIsDeletable,
	createPersonalSpaceFor,
} from '../spaces';

// Re-export so existing imports (`import { TRUSTED_ORIGINS } from './better-auth.config'`)
// keep working. New code should import from './sso-origins' directly.
export { TRUSTED_ORIGINS };

/**
 * JWT Custom Payload Interface
 *
 * MINIMAL claims only. Organization context and credits are available via:
 * - GET /organization/get-active-member - org membership & role
 * - GET /api/v1/credits/balance - credit balance
 *
 * Why minimal claims?
 * 1. Credit balance changes frequently - JWT would be stale
 * 2. Organization context available via Better Auth org plugin APIs
 * 3. Smaller tokens = better performance
 * 4. Follows Better Auth's session-based design
 */
export interface JWTCustomPayload {
	/** User ID (standard JWT claim) */
	sub: string;

	/** User email */
	email: string;

	/** User role (user, admin, service) */
	role: string;

	/** Session ID for reference */
	sid: string;

	/** Access tier for app-level gating (guest, public, beta, alpha, founder) */
	tier: string;
}

/**
 * WebAuthn configuration for the passkey plugin. Kept as a separate
 * argument so the call site (src/index.ts) can wire it in from the
 * loaded config without coupling better-auth.config.ts to config.ts.
 */
export interface BetterAuthWebAuthnOptions {
	rpId: string;
	rpName: string;
	origin: string | string[];
}

/**
 * Create Better Auth instance
 *
 * @param databaseUrl - PostgreSQL connection URL for the auth DB
 * @param syncDatabaseUrl - PostgreSQL connection URL for `mana_sync`. Held
 *   for use by the per-user `userContext` bootstrap; currently no
 *   per-Space singletons are written here (the kontextDoc that used to
 *   live here was retired in the Option-B cleanup).
 * @param webauthn - WebAuthn settings for the passkey plugin
 * @returns Better Auth instance
 */
export function createBetterAuth(
	databaseUrl: string,
	syncDatabaseUrl: string,
	webauthn: BetterAuthWebAuthnOptions
) {
	const db = getDb(databaseUrl);

	// Lazy module-scoped sync SQL pool. Mirrors the pattern in
	// routes/auth.ts so we don't open a second pool just for the
	// org-create hook. Process lifetime owns it; never closed manually.
	let _syncSql: ReturnType<typeof postgres> | null = null;
	const getSyncSql = (): ReturnType<typeof postgres> => {
		if (!_syncSql) _syncSql = postgres(syncDatabaseUrl, { max: 2 });
		return _syncSql;
	};

	return betterAuth({
		// Database adapter (Drizzle with PostgreSQL)
		database: drizzleAdapter(db, {
			provider: 'pg',
			schema: {
				// Auth tables (actual Drizzle table objects)
				user: users,
				session: sessions,
				account: accounts,
				verification: verificationTokens,

				// Organization tables
				organization: organizations,
				member: members,
				invitation: invitations,

				// JWT plugin table
				jwks: jwks,

				// Two-Factor Authentication table
				twoFactor: twoFactorAuth,

				// Passkey plugin table — Drizzle field names match
				// @better-auth/passkey's plugin schema (see src/db/schema/
				// auth.ts comment for the alignment rationale).
				passkey: passkeys,
			},
		}),

		// Custom user fields (must be declared so Better Auth includes them in the user object)
		user: {
			additionalFields: {
				accessTier: {
					type: 'string',
					defaultValue: 'public',
					input: false, // Not settable via sign-up
				},
				kind: {
					type: 'string',
					defaultValue: 'human',
					input: false, // Set only via admin endpoints, never sign-up
				},
			},
		},

		// Email/password authentication with password reset
		emailAndPassword: {
			enabled: true,
			requireEmailVerification: true,
			minPasswordLength: 8,
			maxPasswordLength: 128,

			/**
			 * Password Reset Configuration
			 *
			 * Better Auth provides password reset via:
			 * - auth.api.requestPasswordReset({ body: { email } }) - Sends reset email
			 * - auth.api.resetPassword({ body: { newPassword, token } }) - Resets password
			 *
			 * The reset URL is modified to include callbackURL parameter
			 * so users are redirected back to the app they requested reset from.
			 *
			 * @see https://www.better-auth.com/docs/authentication/email-password#password-reset
			 */
			sendResetPassword: async ({
				user,
				url,
			}: {
				user: { email: string; name: string };
				url: string;
			}) => {
				// Check if we have a redirect URL stored for this user's password reset request
				const redirectUrl = passwordResetRedirectStore.get(user.email);

				// Modify reset URL to include callbackURL parameter
				let resetUrl = url;
				if (redirectUrl) {
					const urlObj = new URL(url);
					urlObj.searchParams.set('callbackURL', redirectUrl);
					resetUrl = urlObj.toString();
				}

				await sendPasswordResetEmail(user.email, resetUrl, user.name);
			},
		},

		/**
		 * Email Verification Configuration
		 *
		 * Sends verification email when user registers.
		 * User must verify email before they can log in.
		 *
		 * The verification URL is modified to include redirectTo parameter
		 * so users are redirected back to the app they registered from.
		 */
		emailVerification: {
			sendOnSignUp: true,
			autoSignInAfterVerification: true,
			sendVerificationEmail: async ({
				user,
				url,
			}: {
				user: { email: string; name: string };
				url: string;
			}) => {
				// Check if we have a source app URL stored for this user
				// Note: We get the URL without deleting it here since it might be needed
				// during the verification process in the passthrough controller
				const sourceAppUrl = sourceAppStore.get(user.email);

				// Modify verification URL: set callbackURL so Better Auth redirects
				// back to the source app after email verification
				let verificationUrl = url;
				if (sourceAppUrl) {
					const urlObj = new URL(url);
					urlObj.searchParams.set('callbackURL', sourceAppUrl);
					verificationUrl = urlObj.toString();
				}

				await sendVerificationEmail(user.email, verificationUrl, user.name);
			},
		},

		// Session configuration
		session: {
			expiresIn: 60 * 60 * 24 * 7, // 7 days
			updateAge: 60 * 60 * 24, // Update session once per day
		},

		/**
		 * Database hooks — lifecycle callbacks for core tables.
		 *
		 * `user.create.after` runs after a successful signup and provisions
		 * the user's personal Space (a Better Auth organization of type
		 * `personal`). Every user needs one because modules store private
		 * data like mood, dreams, sleep there. Failure propagates: an
		 * orphan user without a personal space is a worse state than a
		 * retry-able signup error.
		 *
		 * See docs/plans/spaces-foundation.md and ../spaces/personal-space.ts.
		 */
		databaseHooks: {
			user: {
				create: {
					after: async (user) => {
						const result = await createPersonalSpaceFor(db, {
							id: user.id,
							email: user.email,
							name: user.name,
							accessTier: (user as { accessTier?: string | null }).accessTier,
						});
					},
				},
			},
		},

		// Base URL for callbacks and redirects
		baseURL: process.env.BASE_URL || 'http://localhost:3001',

		/**
		 * Advanced Cookie Configuration for Cross-Domain SSO
		 *
		 * By setting the cookie domain to '.mana.how', session cookies are shared
		 * across all subdomains (calendar.mana.how, todo.mana.how, etc.).
		 * This enables Single Sign-On: login once, authenticated everywhere.
		 *
		 * For local development (localhost), leave domain undefined to use default behavior.
		 */
		advanced: {
			// Cookie prefix for all auth cookies
			cookiePrefix: 'mana',

			// Cross-subdomain cookie configuration
			crossSubDomainCookies: {
				// Enable cross-subdomain cookies in production
				enabled: !!process.env.COOKIE_DOMAIN,
				// Domain for cookies (e.g., '.mana.how' - note the leading dot)
				domain: process.env.COOKIE_DOMAIN || undefined,
			},

			// Default cookie options for all auth cookies
			defaultCookieAttributes: {
				// Secure in production, allow http in development
				secure: process.env.NODE_ENV === 'production',
				// SameSite=None is required for cross-subdomain SSO via fetch()
				// Lax only sends cookies on top-level navigations, not programmatic fetch()
				// None requires Secure=true (ensured by production check above)
				sameSite: process.env.COOKIE_DOMAIN ? ('none' as const) : ('lax' as const),
				// Cookies accessible to all paths
				path: '/',
				// Prevent JavaScript access to cookies
				httpOnly: true,
			},
		},

		// Trusted origins for cross-origin requests (must match CORS_ORIGINS in production)
		// IMPORTANT: Every app that uses SSO must be listed here, otherwise
		// Better Auth will reject cross-origin requests with credentials.
		// When adding a new app, add its production domain here AND to
		// CORS_ORIGINS in docker-compose.macmini.yml.
		// Single source of truth: TRUSTED_ORIGINS (exported below).
		trustedOrigins: TRUSTED_ORIGINS,

		// Plugins
		plugins: [
			/**
			 * Organization Plugin (B2B)
			 *
			 * Provides complete organization management:
			 * - Create/update/delete organizations
			 * - Invite/add/remove members
			 * - Role-based access control
			 * - Active organization tracking (session.activeOrganizationId)
			 *
			 * Client apps use these endpoints for org context:
			 * - GET /organization/get-active-member
			 * - GET /organization/get-active-member-role
			 * - POST /organization/set-active
			 */
			organization({
				// Allow users to create their own organizations
				allowUserToCreateOrganization: true,

				// Email invitation handler
				async sendInvitationEmail(data) {
					const { email, organization, inviter } = data;
					const baseUrl = process.env.BASE_URL || 'https://mana.how';
					const inviteUrl = `${baseUrl}/accept-invitation?id=${data.id}`;
					await sendInvitationEmail(
						email,
						organization.name,
						inviter?.user?.name || 'Ein Teammitglied',
						inviteUrl
					);
				},

				/**
				 * Spaces — enforce that every organization carries a valid
				 * `metadata.type` (the Space type), and block deletion of the
				 * user's personal space. The per-Space `kontextDoc` singleton
				 * that used to be bootstrapped here was retired in favour of
				 * the user-driven `notes.isSpaceContext` flag (Option B
				 * cleanup), so the after-create hook is currently empty —
				 * kept as a hook anchor for future per-Space bootstrap needs.
				 */
				organizationHooks: {
					beforeCreateOrganization: async ({ organization }) => {
						assertValidSpaceMetadataForCreate(organization.metadata);
					},
					beforeDeleteOrganization: async ({ organization }) => {
						assertSpaceIsDeletable(organization.metadata);
					},
				},

				// Custom roles and permissions
				organizationRole: {
					owner: {
						permissions: [
							'organization:update',
							'organization:delete',
							'members:invite',
							'members:remove',
							'members:update_role',
							'credits:allocate',
							'credits:view_all',
						],
					},
					admin: {
						permissions: [
							'organization:update',
							'members:invite',
							'members:remove',
							'credits:view_all',
						],
					},
					member: {
						permissions: ['credits:view_own'],
					},
				},
			}),

			/**
			 * JWT Plugin
			 *
			 * Generates JWT tokens with MINIMAL claims.
			 *
			 * DO NOT add complex claims like:
			 * - credit_balance (stale after 15min, fetch via API instead)
			 * - organization details (use Better Auth org plugin APIs)
			 * - customer_type (derive from activeOrganizationId presence)
			 *
			 * Apps should call APIs for dynamic data:
			 * - Credits: GET /api/v1/credits/balance
			 * - Org info: GET /organization/get-active-member
			 */
			jwt({
				jwt: {
					// For OIDC compatibility, issuer MUST match the discovery document
					// Use BASE_URL to match /.well-known/openid-configuration issuer
					issuer: process.env.BASE_URL || process.env.JWT_ISSUER || 'http://localhost:3001',
					audience: process.env.JWT_AUDIENCE || 'mana',
					expirationTime: '15m',

					/**
					 * Define minimal JWT payload
					 *
					 * Only includes static user info that doesn't change frequently.
					 */
					definePayload({ user, session }: { user: any; session: any }) {
						return {
							sub: user.id,
							email: user.email,
							role: (user as { role?: string }).role || 'user',
							sid: session.id,
							tier: (user as { accessTier?: string }).accessTier || 'public',
						};
					},
				},
			}),

			/**
			 * Two-Factor Authentication Plugin (TOTP)
			 *
			 * Provides TOTP-based 2FA with backup codes.
			 * Endpoints provided automatically by Better Auth passthrough:
			 * - POST /two-factor/enable (requires password)
			 * - POST /two-factor/disable (requires password)
			 * - POST /two-factor/verify-totp (during login)
			 * - POST /two-factor/verify-backup-code (during login)
			 * - POST /two-factor/get-totp-uri
			 * - POST /two-factor/generate-backup-codes
			 */
			twoFactor({
				issuer: 'Mana',
			}),
			/**
			 * Magic Link Plugin (Passwordless Email Login)
			 *
			 * Sends a one-time login link via email.
			 * Endpoints via Better Auth passthrough:
			 * - POST /magic-link/send-magic-link
			 * - GET /magic-link/verify (callback from email)
			 */
			magicLink({
				sendMagicLink: async ({ email, url }: { email: string; url: string }) => {
					await sendMagicLinkEmail(email, url);
				},
				expiresIn: 600, // 10 minutes
			}),

			/**
			 * Passkey plugin — WebAuthn registration + authentication.
			 *
			 * rpID is the effective domain the credential binds to. For
			 * cross-subdomain SSO on `*.mana.how`, this MUST be `mana.how`
			 * (the bare apex), not any subdomain — otherwise a passkey
			 * registered on app.mana.how won't work on calendar.mana.how.
			 * In dev this resolves to `localhost`.
			 *
			 * `origin` is the full URL(s) where WebAuthn calls are made
			 * from; a mismatch causes a SecurityError on verify. We pass
			 * every CORS origin by default.
			 *
			 * Note: passkeys don't replace passwords in this build — every
			 * account keeps its password, and passkey is additive. This
			 * sidesteps the "user lost all passkeys" recovery-flow that
			 * passwordless-only accounts would require.
			 */
			passkey({
				rpID: webauthn.rpId,
				rpName: webauthn.rpName,
				origin: webauthn.origin,
			}),
		],
	});
}

/**
 * Export type for Better Auth instance
 */
export type BetterAuthInstance = ReturnType<typeof createBetterAuth>;
