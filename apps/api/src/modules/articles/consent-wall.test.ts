import { describe, it, expect } from 'bun:test';
import { looksLikeConsentWall } from './consent-wall';

describe('looksLikeConsentWall', () => {
	it('flags short text containing German consent vocabulary', () => {
		const text =
			'Cookies zustimmen — Wir und unsere Partner speichern Informationen auf einem Endgerät.';
		expect(looksLikeConsentWall(text, 14)).toBe(true);
	});

	it('flags short English consent dialogs', () => {
		const text = 'Please accept all cookies to continue using this website.';
		expect(looksLikeConsentWall(text, 9)).toBe(true);
	});

	it('flags JavaScript-disabled walls', () => {
		const text = 'JavaScript is disabled. Please enable JavaScript to continue.';
		expect(looksLikeConsentWall(text, 7)).toBe(true);
	});

	it('does NOT flag long articles even if they mention cookies', () => {
		// Long-form article that happens to mention cookies in body. The
		// heuristic only fires below the wordcount threshold (300) so a
		// real article about cookies isn't misclassified.
		const text = 'cookie consent ' + 'lorem '.repeat(400);
		expect(looksLikeConsentWall(text, 800)).toBe(false);
	});

	it('does NOT flag short text without consent vocabulary', () => {
		const text = 'A short blog post about hiking trails in the Black Forest.';
		expect(looksLikeConsentWall(text, 11)).toBe(false);
	});

	it('is case-insensitive', () => {
		const text = 'COOKIES ZUSTIMMEN — KLICKE HIER';
		expect(looksLikeConsentWall(text, 4)).toBe(true);
	});

	it('returns false on empty content', () => {
		expect(looksLikeConsentWall('', 0)).toBe(false);
	});

	it('returns false at exactly the wordcount threshold (boundary check)', () => {
		const text = 'cookie consent ' + 'lorem '.repeat(300);
		expect(looksLikeConsentWall(text, 300)).toBe(false);
	});
});
