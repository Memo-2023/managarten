import { Hono } from 'hono';
import type { AuthUser } from '../middleware/jwt-auth';
import type { EngagementService } from '../services/engagement';
import { UnauthorizedError } from '../lib/errors';

function requireUser(user: AuthUser | undefined): AuthUser {
	if (!user || !user.userId) throw new UnauthorizedError();
	return user;
}

export function createEngagementRoutes(service: EngagementService) {
	const router = new Hono<{ Variables: { user?: AuthUser } }>();

	router.post('/decks/:slug/star', async (c) => {
		const user = requireUser(c.get('user'));
		await service.starDeck(user.userId, c.req.param('slug'));
		return c.json({ ok: true });
	});

	router.delete('/decks/:slug/star', async (c) => {
		const user = requireUser(c.get('user'));
		await service.unstarDeck(user.userId, c.req.param('slug'));
		return c.json({ ok: true });
	});

	router.post('/authors/:slug/follow', async (c) => {
		const user = requireUser(c.get('user'));
		await service.followAuthor(user.userId, c.req.param('slug'));
		return c.json({ ok: true });
	});

	router.delete('/authors/:slug/follow', async (c) => {
		const user = requireUser(c.get('user'));
		await service.unfollowAuthor(user.userId, c.req.param('slug'));
		return c.json({ ok: true });
	});

	return router;
}
