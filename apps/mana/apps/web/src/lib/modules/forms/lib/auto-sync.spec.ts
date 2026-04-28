import { describe, it, expect } from 'vitest';
import { buildContactFromAnswers } from './auto-sync';

describe('buildContactFromAnswers', () => {
	it('maps form-fields to contact-fields directly', () => {
		const result = buildContactFromAnswers(
			{ 'f-name': 'Anna Mustermann', 'f-email': 'anna@example.com', 'f-phone': '+49 30 12345' },
			{ 'f-name': 'firstName', 'f-email': 'email', 'f-phone': 'phone' }
		);
		expect(result).toEqual({
			firstName: 'Anna Mustermann',
			email: 'anna@example.com',
			phone: '+49 30 12345',
		});
	});

	it('special-cases the synthetic "name" target by splitting on first whitespace', () => {
		const result = buildContactFromAnswers(
			{ 'f-name': 'Anna Mustermann von Beispiel' },
			{ 'f-name': 'name' }
		);
		expect(result).toEqual({ firstName: 'Anna', lastName: 'Mustermann von Beispiel' });
	});

	it('puts a single-word name into firstName and leaves lastName unset', () => {
		const result = buildContactFromAnswers({ 'f-name': 'Madonna' }, { 'f-name': 'name' });
		expect(result).toEqual({ firstName: 'Madonna' });
	});

	it('skips empty / null / undefined answers', () => {
		const result = buildContactFromAnswers(
			{ 'f-name': '', 'f-email': null, 'f-phone': undefined as unknown as string },
			{ 'f-name': 'firstName', 'f-email': 'email', 'f-phone': 'phone' }
		);
		expect(result).toEqual({});
	});

	it('coerces non-string answers to string before mapping', () => {
		const result = buildContactFromAnswers(
			{ 'f-num': 42 as unknown as string },
			{ 'f-num': 'phone' }
		);
		expect(result).toEqual({ phone: '42' });
	});

	it('ignores form-fields that have no mapping', () => {
		const result = buildContactFromAnswers(
			{ 'f-name': 'Anna', 'f-extra': 'something' },
			{ 'f-name': 'firstName' }
		);
		expect(result).toEqual({ firstName: 'Anna' });
	});
});
