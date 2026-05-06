import { describe, it, expect } from 'vitest';
import { tokenize, clusterIndexes, clusters, renderCloze } from './cloze';

describe('tokenize', () => {
	it('splits plain text and clusters', () => {
		const tokens = tokenize('A {{c1::B}} C');
		expect(tokens).toEqual([
			{ kind: 'text', value: 'A ' },
			{ kind: 'cluster', index: 1, answer: 'B', hint: undefined },
			{ kind: 'text', value: ' C' },
		]);
	});

	it('captures hints', () => {
		const [t] = tokenize('{{c1::Berlin::Hauptstadt}}');
		expect(t).toEqual({ kind: 'cluster', index: 1, answer: 'Berlin', hint: 'Hauptstadt' });
	});

	it('handles multiple clusters in one source', () => {
		const tokens = tokenize('{{c1::Berlin}} ist die Hauptstadt von {{c2::Deutschland}}.');
		const indexes = tokens.filter((t) => t.kind === 'cluster').map((t) => (t as any).index);
		expect(indexes).toEqual([1, 2]);
	});

	it('passes through unmatched braces', () => {
		const tokens = tokenize('foo {bar} baz');
		expect(tokens).toEqual([{ kind: 'text', value: 'foo {bar} baz' }]);
	});

	it('survives multi-line input', () => {
		const tokens = tokenize('Line 1\n{{c1::x}}\nLine 3');
		expect(tokens.length).toBe(3);
		expect((tokens[1] as any).answer).toBe('x');
	});
});

describe('clusterIndexes', () => {
	it('returns ascending unique indexes', () => {
		expect(clusterIndexes('{{c2::a}} {{c1::b}} {{c2::c}} {{c3::d}}')).toEqual([1, 2, 3]);
	});

	it('returns empty for plain text', () => {
		expect(clusterIndexes('no clozes here')).toEqual([]);
	});
});

describe('clusters', () => {
	it('groups answers under their cluster', () => {
		const result = clusters('{{c1::a}} {{c1::b}} {{c2::c}}');
		expect(result).toEqual([
			{ index: 1, answers: ['a', 'b'] },
			{ index: 2, answers: ['c'] },
		]);
	});
});

describe('renderCloze', () => {
	it('blanks the hidden cluster on front, reveals on back', () => {
		const r = renderCloze('{{c1::Berlin}} ist die Hauptstadt von {{c2::Deutschland}}.', 1);
		expect(r.front).toContain('[…]');
		expect(r.front).toContain('Deutschland');
		expect(r.back).toContain('Berlin');
		expect(r.back).toContain('cloze-active');
		expect(r.answer).toBe('Berlin');
	});

	it('uses hint when present', () => {
		const r = renderCloze('{{c1::Berlin::Hauptstadt}} ist eine Stadt.', 1);
		expect(r.front).toContain('[Hauptstadt]');
	});

	it('blanks every occurrence of the hidden cluster', () => {
		const r = renderCloze('{{c1::x}} und {{c1::x}}', 1);
		const blanks = r.front.match(/cloze-blank/g) ?? [];
		expect(blanks.length).toBe(2);
	});

	it('escapes HTML in user content', () => {
		const r = renderCloze('{{c1::<script>}}', 1);
		expect(r.back).not.toContain('<script>');
		expect(r.back).toContain('&lt;script&gt;');
	});
});
