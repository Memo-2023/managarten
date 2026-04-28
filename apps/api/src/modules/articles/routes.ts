/**
 * Articles module — server-side URL extraction.
 *
 * Two endpoints, both thin wrappers around `@mana/shared-rss`:
 *
 *   POST /extract         ← server fetches the URL itself, then runs
 *                           Readability on the HTML it got back. Works
 *                           for simple sites but fails on anything behind
 *                           a cookie-consent wall or a paywall — the
 *                           server has no user session.
 *   POST /extract/html    ← client already has the rendered HTML (from a
 *                           browser bookmarklet running in the user's
 *                           own tab with all their cookies applied).
 *                           Server just runs Readability on that. This
 *                           is how we bypass Golem / Spiegel / Zeit /
 *                           Heise-style consent dialogs: use the user's
 *                           already-consented session, not the server's
 *                           anonymous fetch.
 *
 * Consent-wall heuristic: when /extract returns a suspiciously short
 * payload that contains consent-dialog vocabulary we still hand the
 * extracted text back but flag it with `warning: 'probable_consent_wall'`
 * so the client can offer the bookmarklet-v2 path instead of pretending
 * a 4-line "Cookies zustimmen" blob is the article.
 */

import { Hono } from 'hono';
import { extractFromUrl, extractFromHtml } from '@mana/shared-rss';
import { looksLikeConsentWall } from './consent-wall';

const routes = new Hono();

function isValidHttpUrl(url: string): boolean {
	try {
		const u = new URL(url);
		return u.protocol === 'http:' || u.protocol === 'https:';
	} catch {
		return false;
	}
}

// POST /extract — server fetches the URL + extracts. Legacy path.
routes.post('/extract', async (c) => {
	const body = await c.req.json<{ url?: string }>().catch(() => ({}) as { url?: string });
	const url = body.url;
	if (!url || typeof url !== 'string') {
		return c.json({ error: 'URL is required' }, 400);
	}
	if (!isValidHttpUrl(url)) {
		return c.json({ error: 'Invalid URL' }, 400);
	}

	const extracted = await extractFromUrl(url);
	if (!extracted) {
		return c.json({ error: 'Extraction failed' }, 502);
	}

	const warning = looksLikeConsentWall(extracted.content, extracted.wordCount)
		? 'probable_consent_wall'
		: undefined;

	return c.json({
		originalUrl: url,
		title: extracted.title,
		excerpt: extracted.excerpt,
		content: extracted.content,
		htmlContent: extracted.htmlContent,
		author: extracted.byline,
		siteName: extracted.siteName,
		wordCount: extracted.wordCount,
		readingTimeMinutes: extracted.readingTimeMinutes,
		...(warning && { warning }),
	});
});

// POST /extract/html — client supplies HTML (from the user's browser
// tab, where cookies + JS rendering already happened). We only run
// Readability on it. Cap payload to 10 MiB so a pathological site
// can't exhaust server memory via the bookmarklet — typical rendered
// article HTML is 200-800 KB.
const MAX_HTML_BYTES = 10 * 1024 * 1024;

routes.post('/extract/html', async (c) => {
	const body = await c.req
		.json<{ url?: string; html?: string }>()
		.catch(() => ({}) as { url?: string; html?: string });
	const url = body.url;
	const html = body.html;
	if (!url || typeof url !== 'string') {
		return c.json({ error: 'URL is required' }, 400);
	}
	if (!html || typeof html !== 'string') {
		return c.json({ error: 'HTML is required' }, 400);
	}
	if (!isValidHttpUrl(url)) {
		return c.json({ error: 'Invalid URL' }, 400);
	}
	if (html.length > MAX_HTML_BYTES) {
		return c.json({ error: 'HTML payload too large' }, 413);
	}

	const extracted = await extractFromHtml(html, url);
	if (!extracted) {
		return c.json({ error: 'Extraction failed' }, 502);
	}

	// The consent-wall heuristic still applies here — a rare case is
	// that the user bookmarklet-fires BEFORE the consent dialog is
	// dismissed. Flag it so the client doesn't silently persist garbage.
	const warning = looksLikeConsentWall(extracted.content, extracted.wordCount)
		? 'probable_consent_wall'
		: undefined;

	return c.json({
		originalUrl: url,
		title: extracted.title,
		excerpt: extracted.excerpt,
		content: extracted.content,
		htmlContent: extracted.htmlContent,
		author: extracted.byline,
		siteName: extracted.siteName,
		wordCount: extracted.wordCount,
		readingTimeMinutes: extracted.readingTimeMinutes,
		...(warning && { warning }),
	});
});

export { routes as articlesRoutes };
