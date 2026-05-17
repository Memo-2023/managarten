/**
 * News module — Reads the curated article pool + extracts ad-hoc URLs.
 *
 * Pool population: handled by the Plattform-Service `mana-news-pool`
 * (Port 3079, eigene DB `mana_news_pool`, Schema `pool.curated_articles`).
 * Cutover am 2026-05-17: ehemals direkter Raw-SQL-Read auf
 * `mana_platform.news.curated_articles` aus dem `news-ingester:3066`-
 * Container. Hier nur noch HTTP-Proxy auf den Plattform-Pool.
 *
 * Saved articles (die persönliche Reading-List eines Users) leben
 * weiterhin client-side in der IndexedDB der unified Mana-App und
 * syncen via mana-sync; dieses Modul sieht sie nicht.
 */

import { Hono } from 'hono';
import { extractFromUrl } from '@mana/shared-rss';

const POOL_URL = process.env.MANA_NEWS_POOL_URL ?? 'http://mana-news-pool:3079';
const POOL_KEY = process.env.MANA_SERVICE_KEY ?? '';

// ─── Routes ─────────────────────────────────────────────────

const routes = new Hono();

// ─── Feed (proxy on mana-news-pool) ────────────────────────
//
// Query params:
//   topics  — comma-separated topic slugs (tech,wissenschaft,…)
//   lang    — 'de' | 'en' | 'all' (default 'all')
//   since   — ISO timestamp
//   limit   — default 50, max 200
//   offset  — default 0

routes.get('/feed', async (c) => {
	const passthrough = ['topics', 'lang', 'since', 'limit', 'offset'] as const;
	const url = new URL(`${POOL_URL}/feed`);
	for (const k of passthrough) {
		const v = c.req.query(k);
		if (v) url.searchParams.set(k, v);
	}

	try {
		const res = await fetch(url.toString(), {
			headers: { 'X-Service-Key': POOL_KEY },
			signal: AbortSignal.timeout(8_000),
		});
		if (!res.ok) {
			console.warn(`[news] pool ${url} → ${res.status}`);
			return c.json([] as Record<string, unknown>[]);
		}
		const data = (await res.json()) as Record<string, unknown>[];
		return c.json(data);
	} catch (err) {
		console.warn('[news] pool fetch failed', err);
		return c.json([] as Record<string, unknown>[]);
	}
});

// ─── Extract (content extraction for user-pasted URLs) ─────

routes.post('/extract/preview', async (c) => {
	const { url } = await c.req.json<{ url: string }>();
	if (!url) return c.json({ error: 'URL is required' }, 400);

	const article = await extractFromUrl(url);
	if (!article) return c.json({ error: 'Extraction failed' }, 502);
	return c.json(article);
});

routes.post('/extract/save', async (c) => {
	const { url } = await c.req.json<{ url: string }>();
	if (!url) return c.json({ error: 'URL is required' }, 400);

	const extracted = await extractFromUrl(url);
	if (!extracted) return c.json({ error: 'Extraction failed' }, 502);

	return c.json({
		id: crypto.randomUUID(),
		type: 'saved',
		sourceOrigin: 'user_saved',
		originalUrl: url,
		title: extracted.title,
		content: extracted.content,
		htmlContent: extracted.htmlContent,
		excerpt: extracted.excerpt,
		author: extracted.byline,
		siteName: extracted.siteName,
		wordCount: extracted.wordCount,
		readingTimeMinutes: extracted.readingTimeMinutes,
		isArchived: false,
	});
});

export { routes as newsRoutes };
