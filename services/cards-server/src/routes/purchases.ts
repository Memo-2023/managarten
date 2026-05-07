import { Hono } from 'hono';
import type { AuthUser } from '../middleware/jwt-auth';
import type { PurchaseService } from '../services/purchases';
import { UnauthorizedError } from '../lib/errors';

function requireUser(user: AuthUser | undefined): AuthUser {
	if (!user || !user.userId) throw new UnauthorizedError();
	return user;
}

export function createPurchaseRoutes(service: PurchaseService) {
	const router = new Hono<{ Variables: { user?: AuthUser } }>();

	router.post('/decks/:slug/purchase', async (c) => {
		const user = requireUser(c.get('user'));
		const result = await service.purchase(user.userId, c.req.param('slug'));
		return c.json(result, result.alreadyOwned ? 200 : 201);
	});

	router.get('/me/purchases', async (c) => {
		const user = requireUser(c.get('user'));
		const list = await service.listForBuyer(user.userId);
		return c.json(list);
	});

	router.get('/authors/me/payouts', async (c) => {
		const user = requireUser(c.get('user'));
		const list = await service.listPayoutsForAuthor(user.userId);
		return c.json(list);
	});

	return router;
}
