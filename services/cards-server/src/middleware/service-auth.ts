/**
 * Service-to-service authentication. Used by `/api/v1/internal/*`
 * routes that other Mana services call (e.g. mana-credits-webhook
 * pinging us about a confirmed payment).
 */

import type { MiddlewareHandler } from 'hono';
import { UnauthorizedError } from '../lib/errors';

export function serviceAuth(expectedKey: string): MiddlewareHandler {
	return async (c, next) => {
		const key = c.req.header('X-Service-Key');
		if (!key || key !== expectedKey) {
			throw new UnauthorizedError('Invalid X-Service-Key');
		}
		await next();
	};
}
