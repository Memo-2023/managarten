import { Hono } from 'hono';
import type { AuthUser } from '../middleware/jwt-auth';
import type { ExploreService, SortOption } from '../services/explore';

const sorts: SortOption[] = ['recent', 'popular', 'trending'];

export function createExploreRoutes(service: ExploreService) {
	const router = new Hono<{ Variables: { user?: AuthUser } }>();

	router.get('/explore', async (c) => {
		const result = await service.explore();
		return c.json(result);
	});

	router.get('/decks', async (c) => {
		const url = new URL(c.req.url);
		const sortParam = url.searchParams.get('sort');
		const sort = sorts.includes(sortParam as SortOption) ? (sortParam as SortOption) : 'recent';
		const limit = parseInt(url.searchParams.get('limit') ?? '20', 10);
		const offset = parseInt(url.searchParams.get('offset') ?? '0', 10);

		const result = await service.browse({
			q: url.searchParams.get('q') ?? undefined,
			tag: url.searchParams.get('tag') ?? undefined,
			language: url.searchParams.get('lang') ?? undefined,
			authorSlug: url.searchParams.get('author') ?? undefined,
			sort,
			limit,
			offset,
		});
		return c.json(result);
	});

	router.get('/tags', async (c) => {
		const tree = await service.tagTree();
		return c.json(tree);
	});

	return router;
}
