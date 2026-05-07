import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthUser } from '../middleware/jwt-auth';
import type { DiscussionService } from '../services/discussions';
import { BadRequestError, UnauthorizedError } from '../lib/errors';

function requireUser(user: AuthUser | undefined): AuthUser {
	if (!user || !user.userId) throw new UnauthorizedError();
	return user;
}

const postSchema = z.object({
	deckSlug: z.string().min(1),
	body: z.string().min(1).max(4000),
	parentId: z.string().uuid().optional(),
});

export function createDiscussionRoutes(service: DiscussionService) {
	const router = new Hono<{ Variables: { user?: AuthUser } }>();

	router.get('/cards/:contentHash/discussions', async (c) => {
		const list = await service.listForCard(c.req.param('contentHash'));
		return c.json(list);
	});

	router.get('/decks/:slug/discussion-counts', async (c) => {
		const counts = await service.countsForDeck(c.req.param('slug'));
		return c.json(counts);
	});

	router.post('/cards/:contentHash/discussions', async (c) => {
		const user = requireUser(c.get('user'));
		const parsed = postSchema.safeParse(await c.req.json().catch(() => ({})));
		if (!parsed.success) throw new BadRequestError('Invalid body', parsed.error.format());
		const row = await service.post(
			user.userId,
			parsed.data.deckSlug,
			c.req.param('contentHash'),
			parsed.data.body,
			parsed.data.parentId
		);
		return c.json(row, 201);
	});

	router.post('/discussions/:id/hide', async (c) => {
		const user = requireUser(c.get('user'));
		await service.hide(user.userId, c.req.param('id'));
		return c.json({ ok: true });
	});

	return router;
}
