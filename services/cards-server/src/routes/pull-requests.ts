import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthUser } from '../middleware/jwt-auth';
import type { PullRequestService } from '../services/pull-requests';
import { BadRequestError, UnauthorizedError } from '../lib/errors';

function requireUser(user: AuthUser | undefined): AuthUser {
	if (!user || !user.userId) throw new UnauthorizedError();
	return user;
}

const cardTypes = [
	'basic',
	'basic-reverse',
	'cloze',
	'type-in',
	'image-occlusion',
	'audio',
	'multiple-choice',
] as const;

const cardPayloadSchema = z.object({
	type: z.enum(cardTypes),
	fields: z.record(z.string(), z.string()),
});

const createPrSchema = z.object({
	title: z.string().min(1).max(140),
	body: z.string().max(4000).optional(),
	diff: z.object({
		add: z.array(cardPayloadSchema).default([]),
		modify: z
			.array(
				cardPayloadSchema.extend({
					previousContentHash: z.string().min(1),
				})
			)
			.default([]),
		remove: z.array(z.object({ contentHash: z.string().min(1) })).default([]),
	}),
});

const mergeSchema = z.object({
	newSemver: z
		.string()
		.regex(/^\d+\.\d+\.\d+$/)
		.optional(),
	mergeNote: z.string().max(2000).optional(),
});

export function createPullRequestRoutes(service: PullRequestService) {
	const router = new Hono<{ Variables: { user?: AuthUser } }>();

	router.post('/decks/:slug/pull-requests', async (c) => {
		const user = requireUser(c.get('user'));
		const parsed = createPrSchema.safeParse(await c.req.json().catch(() => ({})));
		if (!parsed.success) throw new BadRequestError('Invalid body', parsed.error.format());
		const pr = await service.create(user.userId, c.req.param('slug'), parsed.data);
		return c.json(pr, 201);
	});

	router.get('/decks/:slug/pull-requests', async (c) => {
		const url = new URL(c.req.url);
		const status = url.searchParams.get('status');
		const valid = ['open', 'merged', 'closed', 'rejected'] as const;
		const statusFilter = (valid as readonly string[]).includes(status ?? '')
			? (status as (typeof valid)[number])
			: undefined;
		const list = await service.list(c.req.param('slug'), statusFilter);
		return c.json(list);
	});

	router.get('/pull-requests/:id', async (c) => {
		const pr = await service.get(c.req.param('id'));
		return c.json(pr);
	});

	router.post('/pull-requests/:id/close', async (c) => {
		const user = requireUser(c.get('user'));
		await service.close(user.userId, c.req.param('id'));
		return c.json({ ok: true });
	});

	router.post('/pull-requests/:id/reject', async (c) => {
		const user = requireUser(c.get('user'));
		await service.reject(user.userId, c.req.param('id'));
		return c.json({ ok: true });
	});

	router.post('/pull-requests/:id/merge', async (c) => {
		const user = requireUser(c.get('user'));
		const parsed = mergeSchema.safeParse(await c.req.json().catch(() => ({})));
		if (!parsed.success) throw new BadRequestError('Invalid body', parsed.error.format());
		const result = await service.merge(user.userId, c.req.param('id'), parsed.data);
		return c.json(result, 201);
	});

	return router;
}
