/**
 * Cloze parser — Anki-compatible {{cN::answer}} / {{cN::answer::hint}} syntax.
 *
 * A cloze card produces one *review* per distinct cluster index. The
 * `subIndex` of a review row is the cluster number (1-based), so basic
 * cards use subIndex 0 and cloze cards use subIndex 1, 2, ….
 *
 * Why parse to a tree of `Token`s instead of regex-replacing during
 * render? Because the same cluster can appear multiple times in one
 * text (e.g. `{{c1::Berlin}} … {{c1::Berlin}}`) and the renderer must
 * blank both occurrences. A token list keeps the renderer trivial and
 * lets us reuse the parse for stats / extraction.
 */

export interface ClozeCluster {
	/** 1-based cluster index, e.g. 1 for {{c1::…}}. */
	index: number;
	/** The answer text(s) belonging to this cluster, in source order. */
	answers: string[];
}

type Token =
	| { kind: 'text'; value: string }
	| { kind: 'cluster'; index: number; answer: string; hint?: string };

const CLOZE_RE = /\{\{c(\d+)::((?:(?!\}\}).)+?)\}\}/gs;

/**
 * Lex a cloze source string. Anything not matching {{cN::…}} is a
 * `text` token; matches become `cluster` tokens with their parsed
 * answer/hint.
 */
export function tokenize(source: string): Token[] {
	const tokens: Token[] = [];
	let lastIndex = 0;
	for (const match of source.matchAll(CLOZE_RE)) {
		const start = match.index ?? 0;
		if (start > lastIndex) {
			tokens.push({ kind: 'text', value: source.slice(lastIndex, start) });
		}
		const idx = Number.parseInt(match[1], 10);
		const inner = match[2];
		const hintSplit = inner.indexOf('::');
		const answer = hintSplit >= 0 ? inner.slice(0, hintSplit) : inner;
		const hint = hintSplit >= 0 ? inner.slice(hintSplit + 2) : undefined;
		tokens.push({ kind: 'cluster', index: idx, answer, hint });
		lastIndex = start + match[0].length;
	}
	if (lastIndex < source.length) {
		tokens.push({ kind: 'text', value: source.slice(lastIndex) });
	}
	return tokens;
}

/**
 * Distinct cluster indexes in ascending order. Each one becomes one
 * `cardReviews` row (subIndex = cluster index).
 */
export function clusterIndexes(source: string): number[] {
	const set = new Set<number>();
	for (const t of tokenize(source)) {
		if (t.kind === 'cluster') set.add(t.index);
	}
	return [...set].sort((a, b) => a - b);
}

/**
 * Group answers by cluster. Useful for the editor preview and for
 * generating the prompt that lists hints.
 */
export function clusters(source: string): ClozeCluster[] {
	const grouped = new Map<number, string[]>();
	for (const t of tokenize(source)) {
		if (t.kind !== 'cluster') continue;
		const arr = grouped.get(t.index) ?? [];
		arr.push(t.answer);
		grouped.set(t.index, arr);
	}
	return [...grouped.entries()]
		.sort(([a], [b]) => a - b)
		.map(([index, answers]) => ({ index, answers }));
}

export interface RenderedCloze {
	front: string;
	back: string;
	answer: string;
}

/**
 * Render a cloze prompt for a specific cluster index. Plain HTML —
 * Markdown coupling happens one level up.
 *
 * Hidden cluster:        `[…]` placeholder, with hint in parens if set
 * Other clusters:        rendered as plain answer text
 *
 * Back side reveals every cluster; the active one wears
 * `<mark class="cloze-active">…</mark>` so the UI can highlight it.
 */
export function renderCloze(source: string, hideIndex: number): RenderedCloze {
	const tokens = tokenize(source);
	const front: string[] = [];
	const back: string[] = [];
	const hiddenAnswers: string[] = [];

	for (const t of tokens) {
		if (t.kind === 'text') {
			front.push(escapeHtml(t.value));
			back.push(escapeHtml(t.value));
			continue;
		}
		const ans = escapeHtml(t.answer);
		if (t.index === hideIndex) {
			hiddenAnswers.push(t.answer);
			const placeholder = t.hint
				? `<span class="cloze-blank">[${escapeHtml(t.hint)}]</span>`
				: `<span class="cloze-blank">[…]</span>`;
			front.push(placeholder);
			back.push(`<mark class="cloze-active">${ans}</mark>`);
		} else {
			front.push(ans);
			back.push(ans);
		}
	}

	return {
		front: front.join(''),
		back: back.join(''),
		answer: hiddenAnswers.join(', '),
	};
}

function escapeHtml(s: string): string {
	return s
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}
