/**
 * URL-safe slug helpers.
 *
 * `slugify` is best-effort — turns "Anna Lang!" into "anna-lang" — for
 * suggesting an initial slug. `validateSlug` is strict and what we
 * enforce on every write so the URL space stays predictable.
 */

const MAX_SLUG_LEN = 60;
const MIN_SLUG_LEN = 3;

const SLUG_RE = /^[a-z0-9](?:[a-z0-9-]{1,58}[a-z0-9])?$/;

const RESERVED_SLUGS = new Set([
	'admin',
	'api',
	'app',
	'auth',
	'docs',
	'explore',
	'feed',
	'help',
	'me',
	'mana',
	'new',
	'public',
	'search',
	'settings',
	'support',
	'system',
	'u',
	'd',
	'v1',
	'v2',
]);

export function slugify(input: string): string {
	return input
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '') // strip diacritics
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, MAX_SLUG_LEN);
}

export interface SlugValidation {
	ok: boolean;
	reason?: 'too-short' | 'too-long' | 'invalid-chars' | 'reserved';
}

export function validateSlug(slug: string): SlugValidation {
	if (slug.length < MIN_SLUG_LEN) return { ok: false, reason: 'too-short' };
	if (slug.length > MAX_SLUG_LEN) return { ok: false, reason: 'too-long' };
	if (!SLUG_RE.test(slug)) return { ok: false, reason: 'invalid-chars' };
	if (RESERVED_SLUGS.has(slug)) return { ok: false, reason: 'reserved' };
	return { ok: true };
}
