/**
 * Notes module — server-side helpers.
 *
 * Today: a single `POST /import-url` endpoint that crawls a URL via
 * mana-crawler and optionally summarises the result with mana-llm. The
 * client treats the response as the body of a new Note (title +
 * markdown content). The same endpoint is reused by the (planned)
 * Brand/Firma-Space onboarding wizard to seed the Space-context note.
 */

import { Hono } from 'hono';
import { consumeCredits, validateCredits } from '@mana/shared-hono/credits';
import type { AuthVariables } from '@mana/shared-hono';
import { MANA_LLM } from '@mana/shared-ai';

const LLM_URL = process.env.MANA_LLM_URL || 'http://localhost:3025';
const CRAWLER_URL = process.env.MANA_CRAWLER_URL || 'http://localhost:3023';
const DEFAULT_SUMMARY_MODEL = MANA_LLM.FAST_TEXT;

const routes = new Hono<{ Variables: AuthVariables }>();

const DEEP_MAX_PAGES = 20;
const CRAWL_POLL_INTERVAL_MS = 1500;
const CRAWL_TIMEOUT_MS = 90_000;

/**
 * Local LLMs love to wrap Markdown in ```markdown fences or prepend
 * a "Hier ist die Zusammenfassung:" preamble. Strip those so the
 * output renders correctly when dropped into a Note body.
 */
function sanitizeSummary(raw: string): string {
	let s = raw.trim();
	const fenceMatch = s.match(/^```(?:markdown|md)?\s*\n([\s\S]*?)\n?```\s*$/i);
	if (fenceMatch) s = fenceMatch[1].trim();
	const lines = s.split('\n');
	if (lines.length > 2 && /^[^#\n].{0,80}:\s*$/.test(lines[0].trim())) {
		s = lines.slice(1).join('\n').trim();
	}
	s = s.replace(/^#\s+/, '## ');
	return s;
}

async function pollCrawlJob(jobId: string) {
	const deadline = Date.now() + CRAWL_TIMEOUT_MS;
	while (Date.now() < deadline) {
		await new Promise((r) => setTimeout(r, CRAWL_POLL_INTERVAL_MS));
		const res = await fetch(`${CRAWLER_URL}/api/v1/crawl/${jobId}`);
		if (!res.ok) throw new Error(`crawl status ${res.status}`);
		const job = (await res.json()) as { status: string; error?: string };
		if (job.status === 'completed') return;
		if (job.status === 'failed') throw new Error(job.error || 'crawl failed');
	}
	throw new Error('crawl timeout');
}

routes.post('/import-url', async (c) => {
	const userId = c.get('userId');
	const {
		url,
		mode = 'single',
		summarize = false,
	} = (await c.req.json()) as {
		url?: string;
		mode?: 'single' | 'deep';
		summarize?: boolean;
	};

	if (!url || !/^https?:\/\//i.test(url)) {
		return c.json({ error: 'valid http(s) url required' }, 400);
	}

	const creditCost = summarize ? 5 : 1;
	const validation = await validateCredits(userId, 'NOTES_IMPORT_URL', creditCost);
	if (!validation.hasCredits) {
		return c.json(
			{
				error: 'Insufficient credits',
				required: creditCost,
				available: validation.availableCredits,
			},
			402
		);
	}

	try {
		const crawlBody = {
			startUrl: url,
			config: {
				maxDepth: mode === 'deep' ? 3 : 0,
				maxPages: mode === 'deep' ? DEEP_MAX_PAGES : 1,
				rateLimit: 2,
				respectRobots: true,
				outputFormat: 'markdown',
			},
		};

		const startRes = await fetch(`${CRAWLER_URL}/api/v1/crawl`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(crawlBody),
		});
		if (!startRes.ok) return c.json({ error: 'crawler unreachable' }, 502);
		const { jobId } = (await startRes.json()) as { jobId: string };

		await pollCrawlJob(jobId);

		const resultsRes = await fetch(
			`${CRAWLER_URL}/api/v1/crawl/${jobId}/results?page=1&limit=${DEEP_MAX_PAGES}`
		);
		if (!resultsRes.ok) return c.json({ error: 'crawl results failed' }, 502);
		const results = (await resultsRes.json()) as {
			results: Array<{
				url: string;
				title?: string | null;
				markdown?: string | null;
				content?: string | null;
				depth: number;
			}>;
		};
		const items = (results.results || []).filter((it) => it.markdown || it.content);
		if (items.length === 0) return c.json({ error: 'no content crawled' }, 422);

		items.sort((a, b) => a.depth - b.depth);
		const root = items[0];
		const pageTitle = root.title || new URL(url).hostname;

		let content: string;
		if (mode === 'deep' && items.length > 1) {
			content = items
				.map((it) => `# ${it.title || it.url}\n\n_${it.url}_\n\n${it.markdown || it.content}`)
				.join('\n\n---\n\n');
		} else {
			content = root.markdown || root.content || '';
		}

		if (summarize) {
			const summaryRes = await fetch(`${LLM_URL}/api/v1/chat/completions`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					model: DEFAULT_SUMMARY_MODEL,
					max_tokens: 2000,
					messages: [
						{
							role: 'system',
							content:
								'Du bist ein Assistent, der Web-Inhalte in strukturierte Notiz-Dokumente zusammenfasst. ' +
								'Antworte ausschließlich in sauberem Markdown. Gliedere in H2-Abschnitte: ' +
								'"## Überblick", "## Kernaussagen", "## Details". Nutze die Sprache der Quelle. ' +
								'Schreibe die Antwort direkt, ohne Einleitung ("Hier ist…"), ohne Schlussformel, ' +
								'und OHNE Code-Fences (```) um die Antwort.',
						},
						{
							role: 'user',
							content: `Quelle: ${url}\n\n${content.slice(0, 60_000)}`,
						},
					],
				}),
			});
			if (summaryRes.ok) {
				const data = (await summaryRes.json()) as {
					choices?: Array<{ message?: { content?: string } }>;
				};
				const raw = data.choices?.[0]?.message?.content?.trim();
				if (raw) {
					content = sanitizeSummary(raw);
				}
			} else {
				return c.json({ error: 'summary failed' }, 502);
			}
		}

		await consumeCredits(
			userId,
			'NOTES_IMPORT_URL',
			creditCost,
			`URL import (${mode}${summarize ? ' + summary' : ''})`
		);

		return c.json({
			title: pageTitle,
			content,
			sourceUrl: url,
			crawlMode: mode,
			crawledAt: new Date().toISOString(),
			pageCount: items.length,
		});
	} catch (err) {
		const message = err instanceof Error ? err.message : 'import failed';
		return c.json({ error: message }, 500);
	}
});

export { routes as notesRoutes };
