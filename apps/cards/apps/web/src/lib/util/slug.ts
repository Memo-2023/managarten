/**
 * Best-effort slug suggestion. Server-side validateSlug is the
 * authoritative gate; this just gives the user a sensible default
 * to edit.
 */
export function slugify(input: string): string {
	return input
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '')
		.slice(0, 60);
}
