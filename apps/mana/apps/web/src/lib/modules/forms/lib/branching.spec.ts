import { describe, it, expect } from 'vitest';
import { resolveVisibleFields } from './branching';
import type { BranchingRule, FormField } from '../types';

function f(id: string, type: FormField['type'] = 'short_text'): FormField {
	return { id, type, label: id, required: false };
}

describe('resolveVisibleFields', () => {
	const fields: FormField[] = [f('q1'), f('q2'), f('q3', 'long_text'), f('q4')];

	it('returns all fields when no branching rules exist', () => {
		expect(resolveVisibleFields(fields, [], {})).toEqual(fields);
	});

	it('hides a field when its hide-rule matches via equals', () => {
		const rules: BranchingRule[] = [
			{
				id: 'r1',
				ifFieldId: 'q1',
				ifOperator: 'equals',
				ifValue: 'no',
				thenAction: 'hide',
				thenFieldIds: ['q3'],
			},
		];
		const visible = resolveVisibleFields(fields, rules, { q1: 'no' });
		expect(visible.map((f) => f.id)).toEqual(['q1', 'q2', 'q4']);
	});

	it('keeps the field when the hide-rule does not match', () => {
		const rules: BranchingRule[] = [
			{
				id: 'r1',
				ifFieldId: 'q1',
				ifOperator: 'equals',
				ifValue: 'no',
				thenAction: 'hide',
				thenFieldIds: ['q3'],
			},
		];
		const visible = resolveVisibleFields(fields, rules, { q1: 'yes' });
		expect(visible.map((f) => f.id)).toEqual(['q1', 'q2', 'q3', 'q4']);
	});

	it('skip_to hides every field strictly between anchor and target', () => {
		const rules: BranchingRule[] = [
			{
				id: 'r1',
				ifFieldId: 'q1',
				ifOperator: 'equals',
				ifValue: 'fast-forward',
				thenAction: 'skip_to',
				thenSkipToFieldId: 'q4',
			},
		];
		const visible = resolveVisibleFields(fields, rules, { q1: 'fast-forward' });
		expect(visible.map((f) => f.id)).toEqual(['q1', 'q4']);
	});

	it('contains-operator on multi-choice array matches when array includes the value', () => {
		const fieldsWithTagsAndDetail: FormField[] = [f('tags', 'multi_choice'), f('q-detail')];
		// Default-hide q-detail unless tags includes 'urgent'.
		// Two rules: r1 hides whenever tags has any value but isn't empty;
		// r2 shows when 'urgent' is present.
		const ruleSet: BranchingRule[] = [
			{
				id: 'r1',
				ifFieldId: 'tags',
				ifOperator: 'not_equals',
				ifValue: '__sentinel__',
				thenAction: 'hide',
				thenFieldIds: ['q-detail'],
			},
			{
				id: 'r2',
				ifFieldId: 'tags',
				ifOperator: 'contains',
				ifValue: 'urgent',
				thenAction: 'show',
				thenFieldIds: ['q-detail'],
			},
		];
		// tags includes 'urgent' → r1 fires (hide), r2 fires (show) — show wins
		expect(
			resolveVisibleFields(fieldsWithTagsAndDetail, ruleSet, { tags: ['urgent', 'work'] }).map(
				(f) => f.id
			)
		).toEqual(['tags', 'q-detail']);
		// tags missing 'urgent' → r1 fires (hide), r2 does not fire — stays hidden
		expect(
			resolveVisibleFields(fieldsWithTagsAndDetail, ruleSet, { tags: ['work'] }).map((f) => f.id)
		).toEqual(['tags']);
	});

	it('not_equals hides when answer differs from the expected value', () => {
		const rules: BranchingRule[] = [
			{
				id: 'r1',
				ifFieldId: 'q1',
				ifOperator: 'not_equals',
				ifValue: 'a',
				thenAction: 'hide',
				thenFieldIds: ['q2'],
			},
		];
		// q1='b' (≠ 'a') → rule fires → q2 hidden
		expect(resolveVisibleFields(fields, rules, { q1: 'b' }).map((f) => f.id)).not.toContain('q2');
		// q1='a' → rule does not fire → q2 visible
		expect(resolveVisibleFields(fields, rules, { q1: 'a' }).map((f) => f.id)).toContain('q2');
	});

	it('is_empty matches null, undefined, empty string, empty array, false', () => {
		const rules: BranchingRule[] = [
			{
				id: 'r1',
				ifFieldId: 'flag',
				ifOperator: 'is_empty',
				thenAction: 'hide',
				thenFieldIds: ['follow-up'],
			},
		];
		const fs: FormField[] = [f('flag', 'yes_no'), f('follow-up')];
		expect(resolveVisibleFields(fs, rules, {}).map((f) => f.id)).toEqual(['flag']);
		expect(resolveVisibleFields(fs, rules, { flag: null }).map((f) => f.id)).toEqual(['flag']);
		expect(resolveVisibleFields(fs, rules, { flag: '' }).map((f) => f.id)).toEqual(['flag']);
		expect(resolveVisibleFields(fs, rules, { flag: false }).map((f) => f.id)).toEqual(['flag']);
		expect(resolveVisibleFields(fs, rules, { flag: [] }).map((f) => f.id)).toEqual(['flag']);
		expect(resolveVisibleFields(fs, rules, { flag: true }).map((f) => f.id)).toEqual([
			'flag',
			'follow-up',
		]);
	});

	it('multiple rules layer in declaration order — last write wins', () => {
		const rules: BranchingRule[] = [
			{
				id: 'r1',
				ifFieldId: 'q1',
				ifOperator: 'equals',
				ifValue: 'on',
				thenAction: 'hide',
				thenFieldIds: ['q2'],
			},
			{
				id: 'r2',
				ifFieldId: 'q1',
				ifOperator: 'equals',
				ifValue: 'on',
				thenAction: 'show',
				thenFieldIds: ['q2'],
			},
		];
		// Both rules fire; show comes after hide → q2 visible
		expect(resolveVisibleFields(fields, rules, { q1: 'on' }).map((f) => f.id)).toContain('q2');
	});

	it('returns empty array when fields are empty', () => {
		expect(resolveVisibleFields([], [], {})).toEqual([]);
	});

	it('ignores rules pointing to unknown field ids without crashing', () => {
		const rules: BranchingRule[] = [
			{
				id: 'r1',
				ifFieldId: 'does-not-exist',
				ifOperator: 'equals',
				ifValue: 'x',
				thenAction: 'hide',
				thenFieldIds: ['q2', 'also-missing'],
			},
		];
		// Anchor field doesn't exist, so the answer is undefined; equals
		// against 'x' fails; rule does not fire → all fields visible.
		expect(resolveVisibleFields(fields, rules, {}).map((f) => f.id)).toEqual([
			'q1',
			'q2',
			'q3',
			'q4',
		]);
	});

	it('preserves the original field order in the output', () => {
		const rules: BranchingRule[] = [
			{
				id: 'r1',
				ifFieldId: 'q1',
				ifOperator: 'equals',
				ifValue: 'x',
				thenAction: 'hide',
				thenFieldIds: ['q2'],
			},
		];
		expect(resolveVisibleFields(fields, rules, { q1: 'x' }).map((f) => f.id)).toEqual([
			'q1',
			'q3',
			'q4',
		]);
	});
});
