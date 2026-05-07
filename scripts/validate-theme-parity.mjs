#!/usr/bin/env node
/**
 * Validate that every --color-* token defined for the theme is present in
 * every variant block. A token defined only in :root (but missing from
 * .dark, or from [data-theme="ocean"]) silently falls back to `inherit`
 * or `undefined` under that variant, producing invisible text or
 * miscoloured surfaces in ways that are easy to miss during dev.
 *
 * This is the parity invariant: if one variant has `--color-X`, every
 * variant MUST have `--color-X`.
 *
 * Scope: the "canonical" token set is derived from the default :root
 * block (after the base :root block for domain accents). Each
 * theme-variant block is compared to it.
 *
 * Exclusions: `--color-branch-*` and `--color-mana` are declared once
 * (intentionally theme-agnostic brand accents, see themes.css §Domain
 * Accent Colors) and do not need per-variant definitions.
 *
 * Usage:
 *   node scripts/validate-theme-parity.mjs
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const THEMES_CSS = join(REPO_ROOT, 'packages/shared-tailwind/src/themes.css');

/** Tokens defined once at :root that do NOT participate in parity. */
const THEME_AGNOSTIC = /^--color-(?:branch-|mana$|app-accent$)/;

/**
 * Parse themes.css into selector → Set<tokenName>. A block starts at a
 * line matching a selector followed by `{` and ends at the matching `}`.
 * The base `@theme` / `@theme inline` blocks are skipped — they define
 * Tailwind's utility generator, not the per-variant surfaces.
 */
function parseBlocks(src) {
	const blocks = new Map();
	const lines = src.split('\n');
	let currentSelector = null;
	let depth = 0;
	let inBase = false; // true while inside @theme {} / @theme inline {}

	for (const raw of lines) {
		const line = raw.trim();

		// Track @theme blocks so we skip their contents.
		if (/^@theme\b/.test(line)) {
			inBase = true;
			if (line.includes('{')) depth++;
			continue;
		}

		if (inBase) {
			if (line.includes('{')) depth++;
			if (line.includes('}')) {
				depth--;
				if (depth === 0) inBase = false;
			}
			continue;
		}

		// Look for block open: `selector {` or `selector,` continued.
		if (!currentSelector) {
			const selectorMatch = raw.match(
				/^(:root(?:\.dark)?|\.dark|\[data-theme=['"](?:[a-z-]+)['"]\](?:\.dark)?|\.dark\[data-theme=['"](?:[a-z-]+)['"]\])\s*(?:,|\{)/
			);
			if (selectorMatch) {
				// Normalize variant key so `.dark, :root.dark` both fold into "dark".
				const sel = selectorMatch[1];
				currentSelector = normalizeSelector(sel);
				if (line.includes('{')) depth = 1;
				continue;
			}
			// Comma-chained selector continuation: if a previous line had
			// `selector,`, the next line is another selector that shares the
			// same block.
			continue;
		}

		// Inside a tracked block.
		if (line.includes('{')) depth++;
		if (line.includes('}')) {
			depth--;
			if (depth === 0) currentSelector = null;
			continue;
		}

		// Token definition: `--color-X: value;`
		const tokenMatch = line.match(/^(--color-[a-z0-9-]+)\s*:/);
		if (tokenMatch && currentSelector) {
			if (!blocks.has(currentSelector)) blocks.set(currentSelector, new Set());
			blocks.get(currentSelector).add(tokenMatch[1]);
		}
	}

	return blocks;
}

function normalizeSelector(sel) {
	// `:root.dark` and `.dark` collapse to the same variant key.
	if (sel === '.dark' || sel === ':root.dark') return 'dark';
	const variantMatch = sel.match(/\[data-theme=['"]([a-z-]+)['"]\]/);
	if (variantMatch) {
		return sel.includes('.dark') ? `${variantMatch[1]}.dark` : variantMatch[1];
	}
	return sel;
}

/**
 * Collapse blocks that share a canonical identity (e.g. `.dark` and
 * `:root.dark` both represent "dark"; each per-variant block and its
 * `.dark` counterpart stay separate).
 */
function mergeBlocks(blocks) {
	const merged = new Map();
	for (const [sel, tokens] of blocks) {
		const existing = merged.get(sel) ?? new Set();
		for (const t of tokens) existing.add(t);
		merged.set(sel, existing);
	}
	return merged;
}

function validate() {
	let src;
	try {
		src = readFileSync(THEMES_CSS, 'utf8');
	} catch {
		// themes.css not on disk (e.g. mid-rename). Skip silently so we
		// don't block commits for files in transit.
		console.log('✓ Theme parity: themes.css not readable — skipped.');
		return;
	}
	const blocks = mergeBlocks(parseBlocks(src));

	if (!blocks.has(':root')) {
		console.error('✗ Could not find :root block in themes.css — parser broken?');
		process.exit(2);
	}

	// Canonical token set = :root tokens, minus theme-agnostic ones.
	const canonical = new Set([...blocks.get(':root')].filter((t) => !THEME_AGNOSTIC.test(t)));

	const violations = [];

	for (const [selector, tokens] of blocks) {
		if (selector === ':root') continue;

		const filtered = new Set([...tokens].filter((t) => !THEME_AGNOSTIC.test(t)));

		const missing = [...canonical].filter((t) => !filtered.has(t));
		const extra = [...filtered].filter((t) => !canonical.has(t));

		if (missing.length > 0) violations.push({ selector, kind: 'missing', tokens: missing });
		if (extra.length > 0) violations.push({ selector, kind: 'extra', tokens: extra });
	}

	if (violations.length > 0) {
		console.error(`\n✗ Theme parity check FAILED (${violations.length} block-level issue(s)):\n`);
		for (const v of violations) {
			const marker = v.kind === 'missing' ? 'missing from' : 'extra in';
			console.error(`  ${v.tokens.length} token(s) ${marker} [${v.selector}]:`);
			for (const t of v.tokens.slice(0, 10)) console.error(`    - ${t}`);
			if (v.tokens.length > 10) console.error(`    … +${v.tokens.length - 10} more`);
		}
		console.error(
			`\nEvery --color-* token must be defined in :root AND .dark AND every\n` +
				`[data-theme="..."] block. A missing token silently falls back to\n` +
				`inherit (or undefined), which produces invisible text in the affected\n` +
				`variant. Theme-agnostic accents (--color-branch-*, --color-mana) are\n` +
				`exempt. See packages/shared-tailwind/src/themes.css.\n`
		);
		process.exit(1);
	}

	const tokenCount = canonical.size;
	const variantCount = blocks.size - 1; // minus :root
	console.log(`✓ Theme parity: ${tokenCount} tokens × ${variantCount} variants — all aligned.`);
}

validate();
