import { describe, it, expect } from 'vitest';
import {
	buildContactFromAnswers,
	buildEventGuestFromAnswers,
	buildLibraryEntryFromAnswers,
	buildSpaceInviteFromAnswers,
} from './auto-sync';

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

describe('buildEventGuestFromAnswers', () => {
	it('maps name/email/phone/note straight through', () => {
		const result = buildEventGuestFromAnswers(
			{
				'f-name': 'Anna Mustermann',
				'f-email': 'anna@example.com',
				'f-phone': '+49 30 12345',
				'f-note': 'Bringe Salat mit',
			},
			{ 'f-name': 'name', 'f-email': 'email', 'f-phone': 'phone', 'f-note': 'note' }
		);
		expect(result).toEqual({
			name: 'Anna Mustermann',
			email: 'anna@example.com',
			phone: '+49 30 12345',
			note: 'Bringe Salat mit',
		});
	});

	it('parses plusOnes as a non-negative integer', () => {
		expect(buildEventGuestFromAnswers({ 'f-plus': '2' }, { 'f-plus': 'plusOnes' })).toEqual({
			plusOnes: 2,
		});
		expect(
			buildEventGuestFromAnswers({ 'f-plus': '2.7' as unknown as string }, { 'f-plus': 'plusOnes' })
		).toEqual({ plusOnes: 2 });
		// Negative + non-numeric → drop silently
		expect(buildEventGuestFromAnswers({ 'f-plus': '-1' }, { 'f-plus': 'plusOnes' })).toEqual({});
		expect(buildEventGuestFromAnswers({ 'f-plus': 'abc' }, { 'f-plus': 'plusOnes' })).toEqual({});
	});

	it('skips empty / null / undefined answers', () => {
		const result = buildEventGuestFromAnswers(
			{ 'f-name': '', 'f-email': null },
			{ 'f-name': 'name', 'f-email': 'email' }
		);
		expect(result).toEqual({});
	});

	it('ignores unknown contact-style keys (firstName/lastName)', () => {
		// guest model has no firstName — only `name`. Mappings to non-
		// guest keys are silently dropped.
		const result = buildEventGuestFromAnswers(
			{ 'f-fn': 'Anna', 'f-name': 'Anna Mustermann' },
			{ 'f-fn': 'firstName', 'f-name': 'name' }
		);
		expect(result).toEqual({ name: 'Anna Mustermann' });
	});
});

describe('buildLibraryEntryFromAnswers', () => {
	it('maps title / creators / year / review', () => {
		expect(
			buildLibraryEntryFromAnswers(
				{
					'f-title': 'Dune',
					'f-creators': 'Frank Herbert',
					'f-year': '1965',
					'f-review': 'Tolles Buch',
				},
				{
					'f-title': 'title',
					'f-creators': 'creators',
					'f-year': 'year',
					'f-review': 'review',
				}
			)
		).toEqual({
			title: 'Dune',
			creators: ['Frank Herbert'],
			year: 1965,
			review: 'Tolles Buch',
		});
	});

	it('splits multi-creator strings on comma/semicolon/newline', () => {
		expect(
			buildLibraryEntryFromAnswers(
				{ 'f-c': 'Frank Herbert; Brian Herbert\nKevin J. Anderson' },
				{ 'f-c': 'creators' }
			)
		).toEqual({ creators: ['Frank Herbert', 'Brian Herbert', 'Kevin J. Anderson'] });
	});

	it('rejects out-of-range years', () => {
		expect(buildLibraryEntryFromAnswers({ 'f-y': '1800' }, { 'f-y': 'year' })).toEqual({});
		expect(buildLibraryEntryFromAnswers({ 'f-y': '2200' }, { 'f-y': 'year' })).toEqual({});
		expect(buildLibraryEntryFromAnswers({ 'f-y': '2026' }, { 'f-y': 'year' })).toEqual({
			year: 2026,
		});
	});

	it('skips empty / non-string values gracefully', () => {
		expect(
			buildLibraryEntryFromAnswers(
				{ 'f-title': '', 'f-year': null },
				{ 'f-title': 'title', 'f-year': 'year' }
			)
		).toEqual({});
	});
});

describe('buildSpaceInviteFromAnswers', () => {
	it('extracts the first valid email mapped to "email"', () => {
		expect(
			buildSpaceInviteFromAnswers({ 'f-mail': 'anna@example.com' }, { 'f-mail': 'email' })
		).toEqual({ email: 'anna@example.com' });
	});

	it('rejects malformed emails', () => {
		expect(
			buildSpaceInviteFromAnswers({ 'f-mail': 'not-an-email' }, { 'f-mail': 'email' })
		).toEqual({});
		expect(buildSpaceInviteFromAnswers({ 'f-mail': 'foo@' }, { 'f-mail': 'email' })).toEqual({});
	});

	it('ignores fields not mapped to "email"', () => {
		expect(
			buildSpaceInviteFromAnswers(
				{ 'f-name': 'Anna', 'f-mail': 'anna@example.com' },
				{ 'f-name': 'name', 'f-mail': 'email' }
			)
		).toEqual({ email: 'anna@example.com' });
	});

	it('returns empty when no mapping has key=email', () => {
		expect(buildSpaceInviteFromAnswers({ 'f-name': 'Anna' }, { 'f-name': 'firstName' })).toEqual(
			{}
		);
	});

	it('returns empty for non-string answers', () => {
		expect(
			buildSpaceInviteFromAnswers({ 'f-mail': null as unknown as string }, { 'f-mail': 'email' })
		).toEqual({});
	});
});
