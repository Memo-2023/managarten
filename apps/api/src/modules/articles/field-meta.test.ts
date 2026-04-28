import { describe, it, expect } from 'bun:test';
import { fieldMetaTime } from './field-meta';

describe('fieldMetaTime — wire-shape adapter for sync_changes.field_meta', () => {
	it('passes through legacy plain ISO strings unchanged', () => {
		expect(fieldMetaTime('2026-04-28T21:14:30.000Z')).toBe('2026-04-28T21:14:30.000Z');
	});

	it('extracts the `at` field from F3 object stamps', () => {
		expect(
			fieldMetaTime({
				at: '2026-04-28T21:14:30.000Z',
				actor: { kind: 'system', principalId: 'system:foo', displayName: 'Foo' },
				origin: 'system',
			})
		).toBe('2026-04-28T21:14:30.000Z');
	});

	it('returns "" for undefined / null (so callers can fall back)', () => {
		expect(fieldMetaTime(undefined)).toBe('');
		expect(fieldMetaTime(null)).toBe('');
	});

	it('returns "" for malformed objects without an at-string', () => {
		expect(fieldMetaTime({})).toBe('');
		expect(fieldMetaTime({ at: 12345 })).toBe('');
		expect(fieldMetaTime({ at: null })).toBe('');
	});

	it('returns "" for non-string non-object inputs', () => {
		expect(fieldMetaTime(42)).toBe('');
		expect(fieldMetaTime(true)).toBe('');
		expect(fieldMetaTime([])).toBe('');
	});

	// Regression: this is the bug that triggered the cross-service fix.
	// Before fieldMetaTime, a string >= object compare evaluated to false
	// stably and the older value won. Now both shapes fold to comparable
	// ISO strings.
	it('makes string-vs-object comparison work correctly across both shapes', () => {
		const earlierLegacy = '2026-04-28T21:00:00.000Z';
		const laterF3 = {
			at: '2026-04-28T22:00:00.000Z',
			actor: { kind: 'user', principalId: 'u', displayName: 'Du' },
			origin: 'user',
		};
		// The F3 stamp is later in time, so its normalised form must
		// compare strictly greater than the legacy stamp.
		expect(fieldMetaTime(laterF3) > fieldMetaTime(earlierLegacy)).toBe(true);
	});
});
