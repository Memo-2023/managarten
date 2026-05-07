import { Hono } from 'hono';
import { z } from 'zod';
import type { AuthUser } from '../middleware/jwt-auth';
import type { ModerationService } from '../services/moderation';
import { BadRequestError, ForbiddenError, UnauthorizedError } from '../lib/errors';

function requireUser(user: AuthUser | undefined): AuthUser {
	if (!user || !user.userId) throw new UnauthorizedError();
	return user;
}

function requireAdmin(user: AuthUser | undefined): AuthUser {
	const u = requireUser(user);
	if (u.role !== 'admin') throw new ForbiddenError('Admin role required');
	return u;
}

const reportSchema = z.object({
	deckSlug: z.string().min(1),
	cardContentHash: z.string().min(1).optional(),
	category: z.enum(['spam', 'copyright', 'nsfw', 'misinformation', 'hate', 'other']),
	body: z.string().max(2000).optional(),
});

const resolveSchema = z.object({
	action: z.enum(['dismiss', 'takedown', 'ban-author']),
	notes: z.string().max(1000).optional(),
});

const takedownSchema = z.object({
	reason: z.string().max(1000).optional(),
});

const verifySchema = z.object({
	verifiedMana: z.boolean(),
});

export function createModerationRoutes(service: ModerationService) {
	const router = new Hono<{ Variables: { user?: AuthUser } }>();

	// User-facing — anyone authed can file a report.
	router.post('/reports', async (c) => {
		const user = requireUser(c.get('user'));
		const parsed = reportSchema.safeParse(await c.req.json().catch(() => ({})));
		if (!parsed.success) throw new BadRequestError('Invalid body', parsed.error.format());
		const row = await service.createReport(user.userId, parsed.data);
		return c.json(row, 201);
	});

	// Admin inbox + actions.
	router.get('/admin/reports', async (c) => {
		requireAdmin(c.get('user'));
		const list = await service.listOpen();
		return c.json(list);
	});

	router.post('/admin/reports/:id/resolve', async (c) => {
		const admin = requireAdmin(c.get('user'));
		const parsed = resolveSchema.safeParse(await c.req.json().catch(() => ({})));
		if (!parsed.success) throw new BadRequestError('Invalid body', parsed.error.format());
		const result = await service.resolveReport(admin.userId, c.req.param('id'), parsed.data);
		return c.json(result);
	});

	router.post('/admin/decks/:slug/takedown', async (c) => {
		const admin = requireAdmin(c.get('user'));
		const parsed = takedownSchema.safeParse(await c.req.json().catch(() => ({})));
		if (!parsed.success) throw new BadRequestError('Invalid body', parsed.error.format());
		const result = await service.takedownDeck(
			admin.userId,
			c.req.param('slug'),
			parsed.data.reason
		);
		return c.json(result);
	});

	router.post('/admin/decks/:slug/restore', async (c) => {
		const admin = requireAdmin(c.get('user'));
		const result = await service.restoreDeck(admin.userId, c.req.param('slug'));
		return c.json(result);
	});

	router.post('/admin/authors/:slug/verify', async (c) => {
		const admin = requireAdmin(c.get('user'));
		const parsed = verifySchema.safeParse(await c.req.json().catch(() => ({})));
		if (!parsed.success) throw new BadRequestError('Invalid body', parsed.error.format());
		const result = await service.setVerifiedMana(
			admin.userId,
			c.req.param('slug'),
			parsed.data.verifiedMana
		);
		return c.json(result);
	});

	return router;
}
