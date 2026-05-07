import { Hono } from 'hono';
import type { AuthUser } from '../middleware/jwt-auth';
import type { SubscriptionService } from '../services/subscriptions';
import { BadRequestError, UnauthorizedError } from '../lib/errors';

function requireUser(user: AuthUser | undefined): AuthUser {
	if (!user || !user.userId) throw new UnauthorizedError();
	return user;
}

export function createSubscriptionRoutes(service: SubscriptionService) {
	const router = new Hono<{ Variables: { user?: AuthUser } }>();

	// User-scoped routes -----------------------------------------------------

	router.get('/me/subscriptions', async (c) => {
		const user = requireUser(c.get('user'));
		const list = await service.listForUser(user.userId);
		return c.json(list);
	});

	router.post('/decks/:slug/subscribe', async (c) => {
		const user = requireUser(c.get('user'));
		const result = await service.subscribe(user.userId, c.req.param('slug'));
		return c.json(result, 201);
	});

	router.delete('/decks/:slug/subscribe', async (c) => {
		const user = requireUser(c.get('user'));
		await service.unsubscribe(user.userId, c.req.param('slug'));
		return c.json({ ok: true });
	});

	// Public read routes -----------------------------------------------------

	router.get('/decks/:slug/versions/:semver', async (c) => {
		const semver = c.req.param('semver');
		if (!/^\d+\.\d+\.\d+$/.test(semver)) {
			throw new BadRequestError('semver must look like 1.0.0');
		}
		const payload = await service.versionWithCards(c.req.param('slug'), semver);
		return c.json(payload);
	});

	router.get('/decks/:slug/diff', async (c) => {
		const url = new URL(c.req.url);
		const from = url.searchParams.get('from');
		if (!from || !/^\d+\.\d+\.\d+$/.test(from)) {
			throw new BadRequestError('?from=<semver> required, e.g. ?from=1.0.0');
		}
		const diff = await service.diffSince(c.req.param('slug'), from);
		return c.json(diff);
	});

	return router;
}
