import { describe, it, expect } from 'vitest';
import { subIndexesFor } from './card-reviews';

describe('subIndexesFor', () => {
	it('basic → [0]', () => {
		expect(subIndexesFor({ type: 'basic', fields: { front: 'a', back: 'b' } })).toEqual([0]);
	});

	it('type-in → [0]', () => {
		expect(subIndexesFor({ type: 'type-in', fields: { front: 'a', back: 'b' } })).toEqual([0]);
	});

	it('basic-reverse → [0, 1]', () => {
		expect(subIndexesFor({ type: 'basic-reverse', fields: { front: 'a', back: 'b' } })).toEqual([
			0, 1,
		]);
	});

	it('cloze → cluster indexes', () => {
		expect(
			subIndexesFor({
				type: 'cloze',
				fields: { text: '{{c1::Berlin}} ist Hauptstadt von {{c2::Deutschland}}.' },
			})
		).toEqual([1, 2]);
	});

	it('cloze with no clusters falls back to [1]', () => {
		expect(subIndexesFor({ type: 'cloze', fields: { text: '' } })).toEqual([1]);
		expect(subIndexesFor({ type: 'cloze', fields: { text: 'no clozes here' } })).toEqual([1]);
	});

	it('cloze deduplicates repeated clusters', () => {
		expect(
			subIndexesFor({
				type: 'cloze',
				fields: { text: '{{c1::a}} und {{c1::b}} und {{c2::c}}' },
			})
		).toEqual([1, 2]);
	});

	it('phase-2 types stub to [0] (no crash)', () => {
		expect(subIndexesFor({ type: 'image-occlusion', fields: {} })).toEqual([0]);
		expect(subIndexesFor({ type: 'audio', fields: {} })).toEqual([0]);
		expect(subIndexesFor({ type: 'multiple-choice', fields: {} })).toEqual([0]);
	});
});
