import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthUser } from '../middleware/jwt-auth';
import type { AuthorService } from '../services/authors';
import { BadRequestError, UnauthorizedError } from '../lib/errors';

const upsertSchema = z.object({
	slug: z.string(),
	displayName: z.string().min(1).max(80),
	bio: z.string().max(500).optional(),
	avatarUrl: z.string().url().max(512).optional(),
	pseudonym: z.boolean().optional(),
});

function requireUser(user: AuthUser | undefined): AuthUser {
	if (!user || !user.userId) throw new UnauthorizedError();
	return user;
}

export function createAuthorRoutes(authorService: AuthorService) {
	const router = new Hono<{ Variables: { user?: AuthUser } }>();

	// POST /me + GET /me are write/private — auth required.
	router.post('/me', async (c) => {
		const user = requireUser(c.get('user'));
		const parsed = upsertSchema.safeParse(await c.req.json().catch(() => ({})));
		if (!parsed.success) throw new BadRequestError('Invalid body', parsed.error.format());
		const author = await authorService.upsertMe(user.userId, parsed.data);
		return c.json(author);
	});

	router.get('/me', async (c) => {
		const user = requireUser(c.get('user'));
		const author = await authorService.getByUserId(user.userId);
		return c.json(author);
	});

	// GET /:slug is public — anyone can look up an author profile.
	router.get('/:slug', async (c) => {
		const author = await authorService.getPublicBySlug(c.req.param('slug'));
		return c.json(author);
	});

	return router;
}
