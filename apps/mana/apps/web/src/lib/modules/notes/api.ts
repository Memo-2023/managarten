/**
 * Notes API client — talks to apps/api `POST /api/v1/notes/import-url`.
 *
 * Crawls a URL via mana-crawler, optionally summarises the result with
 * mana-llm, and returns the markdown payload. The caller decides what
 * to do with the result — typically `notesStore.createNote({ title,
 * content })` to materialise it as a Note.
 */

import { authStore } from '$lib/stores/auth.svelte';
import { getManaApiUrl } from '$lib/api/config';

export type CrawlMode = 'single' | 'deep';

export interface ImportInput {
	url: string;
	mode: CrawlMode;
	summarize: boolean;
}

export interface ImportResponse {
	title: string;
	content: string;
	sourceUrl: string;
	crawlMode: CrawlMode;
	crawledAt: string;
	pageCount: number;
}

export async function crawlUrl(input: ImportInput): Promise<ImportResponse> {
	const token = await authStore.getValidToken();
	if (!token) throw new Error('not authenticated');
	const res = await fetch(`${getManaApiUrl()}/api/v1/notes/import-url`, {
		method: 'POST',
		headers: {
			'Content-Type': 'application/json',
			Authorization: `Bearer ${token}`,
		},
		body: JSON.stringify(input),
	});
	if (!res.ok) {
		const body = (await res.json().catch(() => ({}))) as { error?: string };
		throw new Error(body.error || `import failed (${res.status})`);
	}
	return (await res.json()) as ImportResponse;
}
