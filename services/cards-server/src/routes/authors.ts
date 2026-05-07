import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthUser } from '../middleware/jwt-auth';
import type { AuthorService } from '../services/authors';
import { BadRequestError } from '../lib/errors';

const upsertSchema = z.object({
	slug: z.string(),
	displayName: z.string().min(1).max(80),
	bio: z.string().max(500).optional(),
	avatarUrl: z.string().url().max(512).optional(),
	pseudonym: z.boolean().optional(),
});

export function createAuthorRoutes(authorService: AuthorService) {
	const router = new Hono<{ Variables: { user: AuthUser } }>();

	router.post('/me', async (c) => {
		const user = c.get('user');
		const parsed = upsertSchema.safeParse(await c.req.json().catch(() => ({})));
		if (!parsed.success) throw new BadRequestError('Invalid body', parsed.error.format());
		const author = await authorService.upsertMe(user.userId, parsed.data);
		return c.json(author);
	});

	router.get('/me', async (c) => {
		const user = c.get('user');
		const author = await authorService.getByUserId(user.userId);
		return c.json(author);
	});

	router.get('/:slug', async (c) => {
		const author = await authorService.getPublicBySlug(c.req.param('slug'));
		return c.json(author);
	});

	return router;
}
