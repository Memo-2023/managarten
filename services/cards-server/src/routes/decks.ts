import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthUser } from '../middleware/jwt-auth';
import type { AuthorService } from '../services/authors';
import type { DeckService } from '../services/decks';
import { BadRequestError, UnauthorizedError } from '../lib/errors';

const cardTypes = [
	'basic',
	'basic-reverse',
	'cloze',
	'type-in',
	'image-occlusion',
	'audio',
	'multiple-choice',
] as const;

const initSchema = z.object({
	slug: z.string(),
	title: z.string().min(1).max(140),
	description: z.string().max(2000).optional(),
	language: z.string().min(2).max(8).optional(),
	license: z.string().max(64).optional(),
	priceCredits: z.number().int().min(0).max(10_000).optional(),
});

const publishSchema = z.object({
	semver: z.string(),
	changelog: z.string().max(2000).optional(),
	cards: z
		.array(
			z.object({
				type: z.enum(cardTypes),
				fields: z.record(z.string(), z.string()),
			})
		)
		.min(1)
		.max(5_000),
});

function requireUser(user: AuthUser | undefined): AuthUser {
	if (!user || !user.userId) throw new UnauthorizedError();
	return user;
}

export function createDeckRoutes(authorService: AuthorService, deckService: DeckService) {
	const router = new Hono<{ Variables: { user?: AuthUser } }>();

	// Init = write, auth required.
	router.post('/', async (c) => {
		const user = requireUser(c.get('user'));
		await authorService.assertNotBanned(user.userId);
		const parsed = initSchema.safeParse(await c.req.json().catch(() => ({})));
		if (!parsed.success) throw new BadRequestError('Invalid body', parsed.error.format());
		const deck = await deckService.init(user.userId, parsed.data);
		return c.json(deck, 201);
	});

	// GET deck-by-slug is public — anyone can preview a deck.
	router.get('/:slug', async (c) => {
		const result = await deckService.getBySlug(c.req.param('slug'));
		return c.json(result);
	});

	router.post('/:slug/publish', async (c) => {
		const user = requireUser(c.get('user'));
		await authorService.assertNotBanned(user.userId);
		const parsed = publishSchema.safeParse(await c.req.json().catch(() => ({})));
		if (!parsed.success) throw new BadRequestError('Invalid body', parsed.error.format());
		const result = await deckService.publish(user.userId, c.req.param('slug'), parsed.data);
		return c.json(result, 201);
	});

	return router;
}
