/**
 * Block-schema tests. Pure Zod — no Svelte runtime needed, runs under
 * plain vitest in this package.
 *
 * Every block gets:
 *   - sanity: defaults pass the schema
 *   - a known-valid input
 *   - a known-invalid input (catches regex / enum / min / max drifts)
 */

import { describe, it, expect } from 'vitest';
import { BLOCK_SCHEMAS, BLOCK_DEFAULTS, safeValidateSchema } from './schemas';

describe('registry shape', () => {
	it('has the expected 12 block types', () => {
		const types = Object.keys(BLOCK_SCHEMAS).sort();
		expect(types).toEqual([
			'analytics',
			'columns',
			'cta',
			'faq',
			'form',
			'formEmbed',
			'gallery',
			'hero',
			'image',
			'moduleEmbed',
			'richText',
			'spacer',
		]);
	});

	it('every block has matching defaults', () => {
		const schemaTypes = Object.keys(BLOCK_SCHEMAS).sort();
		const defaultTypes = Object.keys(BLOCK_DEFAULTS).sort();
		expect(schemaTypes).toEqual(defaultTypes);
	});

	it('every block-default passes its own schema', () => {
		for (const [type, defaults] of Object.entries(BLOCK_DEFAULTS)) {
			const result = safeValidateSchema(type, defaults);
			expect(result.success, `defaults for ${type}`).toBe(true);
		}
	});

	it('safeValidateSchema returns error for unknown type', () => {
		const result = safeValidateSchema('not-a-block', {});
		expect(result.success).toBe(false);
	});
});

describe('hero', () => {
	it('accepts minimal valid props', () => {
		expect(safeValidateSchema('hero', { title: 'Hello' }).success).toBe(true);
	});
	it('requires non-empty title', () => {
		expect(safeValidateSchema('hero', { title: '' }).success).toBe(false);
	});
	it('rejects invalid align enum', () => {
		expect(safeValidateSchema('hero', { title: 'Hi', align: 'justify' }).success).toBe(false);
	});
	it('caps title length at 240', () => {
		expect(safeValidateSchema('hero', { title: 'a'.repeat(241) }).success).toBe(false);
	});
});

describe('richText', () => {
	it('accepts empty content (renders placeholder in edit)', () => {
		expect(safeValidateSchema('richText', { content: '' }).success).toBe(true);
	});
	it('caps content at 10k chars', () => {
		expect(safeValidateSchema('richText', { content: 'x'.repeat(10_001) }).success).toBe(false);
	});
	it('rejects invalid size', () => {
		expect(safeValidateSchema('richText', { size: 'huge' }).success).toBe(false);
	});
});

describe('cta', () => {
	it('requires non-empty buttonLabel', () => {
		expect(safeValidateSchema('cta', { buttonLabel: '' }).success).toBe(false);
	});
	it('accepts all variants', () => {
		for (const variant of ['primary', 'secondary', 'ghost']) {
			expect(safeValidateSchema('cta', { buttonLabel: 'Go', variant }).success).toBe(true);
		}
	});
});

describe('image', () => {
	it('accepts empty url (placeholder in edit)', () => {
		expect(safeValidateSchema('image', {}).success).toBe(true);
	});
	it('caps url at 1024', () => {
		expect(safeValidateSchema('image', { url: 'x'.repeat(1025) }).success).toBe(false);
	});
	it('accepts every declared aspectRatio', () => {
		for (const aspectRatio of ['auto', '16:9', '4:3', '1:1', '21:9']) {
			expect(safeValidateSchema('image', { aspectRatio }).success).toBe(true);
		}
	});
});

describe('gallery', () => {
	it('accepts empty image list', () => {
		expect(safeValidateSchema('gallery', { images: [] }).success).toBe(true);
	});
	it('caps at 60 images', () => {
		const images = Array.from({ length: 61 }, () => ({ url: 'https://x' }));
		expect(safeValidateSchema('gallery', { images }).success).toBe(false);
	});
	it('requires url on each image', () => {
		const result = safeValidateSchema('gallery', { images: [{ altText: 'x' }] });
		expect(result.success).toBe(false);
	});
	it('accepts only columns 2/3/4', () => {
		for (const columns of [2, 3, 4]) {
			expect(safeValidateSchema('gallery', { columns }).success).toBe(true);
		}
		expect(safeValidateSchema('gallery', { columns: 1 }).success).toBe(false);
		expect(safeValidateSchema('gallery', { columns: 5 }).success).toBe(false);
	});
});

describe('faq', () => {
	it('accepts items with question + answer', () => {
		const result = safeValidateSchema('faq', {
			items: [{ question: 'Q?', answer: 'A.' }],
		});
		expect(result.success).toBe(true);
	});
	it('rejects empty question', () => {
		const result = safeValidateSchema('faq', {
			items: [{ question: '', answer: 'A.' }],
		});
		expect(result.success).toBe(false);
	});
	it('caps answer at 2000 chars', () => {
		const result = safeValidateSchema('faq', {
			items: [{ question: 'Q', answer: 'a'.repeat(2001) }],
		});
		expect(result.success).toBe(false);
	});
});

describe('form', () => {
	function validField(overrides: Record<string, unknown> = {}) {
		return {
			name: 'name',
			label: 'Name',
			type: 'text',
			required: true,
			placeholder: '',
			helpText: '',
			maxLength: 100,
			...overrides,
		};
	}

	it('requires at least 1 field', () => {
		expect(safeValidateSchema('form', { fields: [] }).success).toBe(false);
	});
	it('caps at 20 fields', () => {
		const fields = Array.from({ length: 21 }, (_, i) => validField({ name: `f${i}` }));
		expect(safeValidateSchema('form', { fields }).success).toBe(false);
	});
	it('rejects field name with hyphen', () => {
		expect(
			safeValidateSchema('form', { fields: [validField({ name: 'has-hyphen' })] }).success
		).toBe(false);
	});
	it('rejects field name starting with digit', () => {
		expect(safeValidateSchema('form', { fields: [validField({ name: '1foo' })] }).success).toBe(
			false
		);
	});
	it('accepts all declared field types', () => {
		for (const type of ['text', 'email', 'tel', 'url', 'textarea', 'number']) {
			expect(
				safeValidateSchema('form', { fields: [validField({ type })] }).success,
				`type ${type}`
			).toBe(true);
		}
	});
});

describe('moduleEmbed', () => {
	it('accepts declared sources', () => {
		for (const source of ['picture.board', 'library.entries']) {
			expect(safeValidateSchema('moduleEmbed', { source }).success).toBe(true);
		}
	});
	it('rejects unknown source', () => {
		expect(safeValidateSchema('moduleEmbed', { source: 'spotify' }).success).toBe(false);
	});
	it('accepts maxItems 1..48', () => {
		expect(safeValidateSchema('moduleEmbed', { maxItems: 1 }).success).toBe(true);
		expect(safeValidateSchema('moduleEmbed', { maxItems: 48 }).success).toBe(true);
		expect(safeValidateSchema('moduleEmbed', { maxItems: 0 }).success).toBe(false);
		expect(safeValidateSchema('moduleEmbed', { maxItems: 49 }).success).toBe(false);
	});
});

describe('analytics', () => {
	it('accepts both providers', () => {
		for (const provider of ['plausible', 'umami']) {
			expect(safeValidateSchema('analytics', { provider }).success).toBe(true);
		}
	});
	it('rejects unknown provider', () => {
		expect(safeValidateSchema('analytics', { provider: 'ga4' }).success).toBe(false);
	});
});

describe('columns', () => {
	it('accepts count 2 and 3', () => {
		expect(safeValidateSchema('columns', { count: 2 }).success).toBe(true);
		expect(safeValidateSchema('columns', { count: 3 }).success).toBe(true);
	});
	it('rejects other counts', () => {
		expect(safeValidateSchema('columns', { count: 1 }).success).toBe(false);
		expect(safeValidateSchema('columns', { count: 4 }).success).toBe(false);
	});
	it('accepts all align enum values', () => {
		for (const align of ['start', 'center', 'stretch']) {
			expect(safeValidateSchema('columns', { align }).success).toBe(true);
		}
	});
});

describe('spacer', () => {
	it('accepts all sizes', () => {
		for (const size of ['sm', 'md', 'lg', 'xl']) {
			expect(safeValidateSchema('spacer', { size }).success).toBe(true);
		}
	});
	it('rejects invalid size', () => {
		expect(safeValidateSchema('spacer', { size: 'xxl' }).success).toBe(false);
	});
});
