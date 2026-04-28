/**
 * Consent-wall heuristic shared by every server-side article-extract
 * path:
 *   - `/api/v1/articles/extract` and `/extract/html` (single-URL)
 *   - The bulk-import worker's `extractOneItem` (background)
 *
 * When the extracted text is suspiciously short AND contains GDPR /
 * cookie-consent vocabulary, the server's anonymous fetch most likely
 * hit a consent dialog instead of the article itself. The caller can
 * use the flag to nudge the user toward the browser-HTML bookmarklet
 * (which fetches with the user's existing session cookies) rather
 * than silently persisting the GDPR overlay text as the article body.
 */

const CONSENT_KEYWORDS = [
	'cookies zustimmen',
	'cookie consent',
	'zustimmung',
	'accept all cookies',
	'consent to the use',
	'enable javascript',
	'javascript is disabled',
	'please enable',
	'privacy center',
	'datenschutz­einstellungen',
	'datenschutzeinstellungen',
];

/** Wordcount floor below which the heuristic is considered. Real
 *  articles are typically >300 words; consent dialogs are <50. */
const CONSENT_WORDCOUNT_THRESHOLD = 300;

export function looksLikeConsentWall(content: string, wordCount: number): boolean {
	if (wordCount >= CONSENT_WORDCOUNT_THRESHOLD) return false;
	const haystack = content.toLowerCase();
	return CONSENT_KEYWORDS.some((needle) => haystack.includes(needle));
}
