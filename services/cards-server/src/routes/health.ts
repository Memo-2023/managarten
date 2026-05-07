import { Hono } from 'hono';

export const healthRoutes = new Hono();

healthRoutes.get('/', (c) => {
	return c.json({
		status: 'ok',
		service: 'cards-server',
		timestamp: new Date().toISOString(),
	});
});
