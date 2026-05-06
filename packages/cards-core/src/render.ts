/**
 * Markdown render helper for cards.
 *
 * Pipeline: marked (GFM) → DOMPurify. Used by the card face for basic /
 * type-in / basic-reverse, and by the cloze post-processor.
 *
 * Cloze callers should pass `{ skipParagraph: true }` so a single-line
 * fragment doesn't get wrapped in <p>.
 */

import { marked } from 'marked';
import DOMPurify from 'isomorphic-dompurify';

marked.setOptions({ gfm: true, breaks: true });

export interface RenderOptions {
	skipParagraph?: boolean;
}

export function renderMarkdown(source: string, opts: RenderOptions = {}): string {
	if (!source) return '';
	const raw = marked.parse(source, { async: false }) as string;
	let html = DOMPurify.sanitize(raw, {
		ADD_TAGS: ['mark'],
		ADD_ATTR: ['class'],
	});
	if (opts.skipParagraph) {
		html = html.replace(/^\s*<p>/, '').replace(/<\/p>\s*$/, '');
	}
	return html;
}
