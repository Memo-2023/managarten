/**
 * Optional JWT — sets `c.get('user')` when a valid Bearer token is
 * present, but never rejects the request. Routes that need an
 * authenticated user fall back to `null` and decide what to do
 * (most public endpoints just hide private fields; mutation endpoints
 * still throw 401 explicitly).
 *
 * Why a separate middleware? `jwtAuth` is the strict gate for write
 * paths — same JWKS, same algo, but rejecting early. `optionalAuth`
 * is the read-path companion: it lets cards-api.mana.how serve the
 * marketplace surface to anonymous browsers (search engines, anti-
 * link-rot, share-link previews) while still recognising signed-in
 * users for star/follow state.
 */

import type { MiddlewareHandler } from 'hono';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { AuthUser } from './jwt-auth';

let jwks: ReturnType<typeof createRemoteJWKSet> | null = null;
function getJwks(authUrl: string) {
	if (!jwks) jwks = createRemoteJWKSet(new URL('/api/auth/jwks', authUrl));
	return jwks;
}

export function optionalAuth(authUrl: string): MiddlewareHandler {
	return async (c, next) => {
		const authHeader = c.req.header('Authorization');
		if (!authHeader?.startsWith('Bearer ')) {
			await next();
			return;
		}
		const token = authHeader.slice(7);
		try {
			const { payload } = await jwtVerify(token, getJwks(authUrl), {
				issuer: authUrl,
				audience: 'mana',
			});
			const user: AuthUser = {
				userId: payload.sub || '',
				email: (payload.email as string) || '',
				role: (payload.role as string) || 'user',
			};
			c.set('user', user);
		} catch {
			// Bad token = anonymous; the strict middleware rejects on
			// write paths.
		}
		await next();
	};
}
