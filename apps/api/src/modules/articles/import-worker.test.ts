import { describe, it, expect } from 'bun:test';
import { countByState } from './import-worker';
import type { ImportItemRow } from './import-projection';

function item(state: ImportItemRow['state'], idx = 0): ImportItemRow {
	return {
		id: `i-${idx}`,
		userId: 'u-1',
		spaceId: 'sp-1',
		jobId: 'j-1',
		idx,
		url: `https://example.com/${idx}`,
		state,
		articleId: null,
		warning: null,
		error: null,
		attempts: 0,
		lastAttemptAt: null,
	};
}

describe('countByState — worker job-counter rollup', () => {
	it('returns zeros for empty input + allTerminal=false', () => {
		const c = countByState([]);
		expect(c).toEqual({
			saved: 0,
			duplicate: 0,
			error: 0,
			consentWall: 0,
			cancelled: 0,
			allTerminal: false,
		});
	});

	it('counts each terminal state independently', () => {
		const c = countByState([
			item('saved', 0),
			item('saved', 1),
			item('duplicate', 2),
			item('error', 3),
			item('cancelled', 4),
		]);
		expect(c.saved).toBe(2);
		expect(c.duplicate).toBe(1);
		expect(c.error).toBe(1);
		expect(c.cancelled).toBe(1);
		expect(c.allTerminal).toBe(true);
	});

	it('treats consent-wall as semantically saved (so progress UI advances)', () => {
		// One real-saved + two consent-wall = three "saved" from the
		// user's perspective, but the warning counter tracks the wall hits.
		const c = countByState([item('saved', 0), item('consent-wall', 1), item('consent-wall', 2)]);
		expect(c.saved).toBe(3);
		expect(c.consentWall).toBe(2);
		expect(c.allTerminal).toBe(true);
	});

	it('does not flag allTerminal when any item is non-terminal', () => {
		const states: ImportItemRow['state'][] = ['pending', 'extracting', 'extracted'];
		for (const nonTerminal of states) {
			const c = countByState([item('saved', 0), item(nonTerminal, 1)]);
			expect(c.allTerminal).toBe(false);
		}
	});

	it('preserves the saved + consent-wall sum when both are present', () => {
		// Regression check: saved must include consent-wall items so the
		// finished-counter UI doesn't off-by-one.
		const c = countByState([
			item('saved', 0),
			item('saved', 1),
			item('consent-wall', 2),
			item('error', 3),
		]);
		expect(c.saved).toBe(3); // 2 saved + 1 consent-wall
		expect(c.consentWall).toBe(1);
		expect(c.error).toBe(1);
	});
});
