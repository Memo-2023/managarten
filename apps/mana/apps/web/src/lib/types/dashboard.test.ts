import { describe, it, expect } from 'vitest';
import {
	getWidgetMeta,
	WIDGET_REGISTRY,
	WIDGET_SIZE_CLASSES,
	type WidgetType,
	type WidgetSize,
} from './dashboard';

describe('WIDGET_REGISTRY', () => {
	it('should contain at least 16 widget definitions', () => {
		// Asserts a floor instead of an exact count so adding new dashboard
		// widgets doesn't ritualise updating the test on every PR.
		expect(WIDGET_REGISTRY.length).toBeGreaterThanOrEqual(16);
	});

	it('should have unique types for all widgets', () => {
		const types = WIDGET_REGISTRY.map((w) => w.type);
		const uniqueTypes = new Set(types);
		expect(uniqueTypes.size).toBe(types.length);
	});

	it('should have required fields for every widget', () => {
		for (const widget of WIDGET_REGISTRY) {
			expect(widget.type).toBeTruthy();
			expect(widget.nameKey).toBeTruthy();
			expect(widget.descriptionKey).toBeTruthy();
			expect(widget.icon).toBeTruthy();
			expect(widget.defaultSize).toBeTruthy();
			expect(typeof widget.allowMultiple).toBe('boolean');
		}
	});

	it('should have valid default sizes', () => {
		const validSizes: WidgetSize[] = ['small', 'medium', 'large', 'full'];
		for (const widget of WIDGET_REGISTRY) {
			expect(validSizes).toContain(widget.defaultSize);
		}
	});

	it('should have valid required backends', () => {
		const validBackends = [
			'todo',
			'calendar',
			'chat',
			'contacts',
			'quotes',
			'picture',
			'cards',
			'times',
			'storage',
			'music',
			'presi',
			'mana-auth',
			'food',
			'plants',
			'period',
			'body',
			undefined,
		];
		for (const widget of WIDGET_REGISTRY) {
			expect(validBackends).toContain(widget.requiredBackend);
		}
	});

	it('should include all expected widget types', () => {
		const types = WIDGET_REGISTRY.map((w) => w.type);
		expect(types).toContain('credits');
		expect(types).toContain('quick-actions');
		expect(types).toContain('transactions');
		expect(types).toContain('tasks-today');
		expect(types).toContain('tasks-upcoming');
		expect(types).toContain('calendar-events');
		expect(types).toContain('chat-recent');
		expect(types).toContain('contacts-favorites');
		expect(types).toContain('quotes-quote');
		expect(types).toContain('picture-recent');
		expect(types).toContain('clock-timers');
		expect(types).toContain('storage-usage');
		expect(types).toContain('music-library');
		expect(types).toContain('presi-decks');
	});

	it('should have i18n-style name keys', () => {
		for (const widget of WIDGET_REGISTRY) {
			expect(widget.nameKey).toMatch(/^dashboard\.widgets\..+\.title$/);
			expect(widget.descriptionKey).toMatch(/^dashboard\.widgets\..+\.description$/);
		}
	});
});

describe('getWidgetMeta', () => {
	it('should return metadata for a valid widget type', () => {
		const meta = getWidgetMeta('credits');
		expect(meta).toBeDefined();
		expect(meta!.type).toBe('credits');
		expect(meta!.requiredBackend).toBe('mana-auth');
	});

	it('should return undefined for an invalid widget type', () => {
		const meta = getWidgetMeta('nonexistent' as WidgetType);
		expect(meta).toBeUndefined();
	});

	it('should return correct metadata for clock-timers', () => {
		const meta = getWidgetMeta('clock-timers');
		expect(meta).toBeDefined();
		expect(meta!.defaultSize).toBe('small');
		expect(meta!.requiredBackend).toBe('times');
		expect(meta!.allowMultiple).toBe(false);
	});

	it('should return correct metadata for each widget type', () => {
		for (const widget of WIDGET_REGISTRY) {
			const meta = getWidgetMeta(widget.type);
			expect(meta).toBeDefined();
			expect(meta).toEqual(widget);
		}
	});
});

describe('WIDGET_SIZE_CLASSES', () => {
	it('should have all four size classes', () => {
		expect(WIDGET_SIZE_CLASSES).toHaveProperty('small');
		expect(WIDGET_SIZE_CLASSES).toHaveProperty('medium');
		expect(WIDGET_SIZE_CLASSES).toHaveProperty('large');
		expect(WIDGET_SIZE_CLASSES).toHaveProperty('full');
	});

	it('should contain col-span-12 in all sizes for mobile', () => {
		for (const [, className] of Object.entries(WIDGET_SIZE_CLASSES)) {
			expect(className).toContain('col-span-12');
		}
	});

	it('full size should only use col-span-12', () => {
		expect(WIDGET_SIZE_CLASSES.full).toBe('col-span-12');
	});
});
