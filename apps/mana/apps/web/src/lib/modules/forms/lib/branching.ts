import type { AnswerValue, BranchingRule, FormField } from '../types';

/**
 * Pure branching resolver.
 *
 * Given a form's `fields`, its `branching` rules, and the current
 * answer state, returns the subset of fields that should be visible
 * to the respondent right now. The order of the returned array
 * matches the original `fields` order.
 *
 * Rules are evaluated in the order they appear. Each rule has an
 * IF clause (operator over a referenced field's answer) and a THEN
 * action (`show` / `hide` / `skip_to`). All actions affect later
 * fields only; a rule on field X cannot hide X itself (that would
 * make the IF clause unreadable). The default visibility for every
 * field is "show" — `hide` rules subtract, `show` rules add back.
 *
 * `skip_to` jumps the visibility cursor to the named field; every
 * field strictly between the rule's anchor and the skip target is
 * hidden. Fields after the target follow normal rules.
 *
 * `section` and `consent` field types are always treated as part of
 * the visible flow (they don't carry answers, so branching by them
 * is undefined behaviour).
 *
 * The function is intentionally side-effect-free + allocation-light:
 * no Dexie, no Svelte runes, no DOM. Used by the public form view
 * to render the next field set on every keystroke.
 */
export function resolveVisibleFields(
	fields: FormField[],
	branching: BranchingRule[],
	answers: Record<string, AnswerValue>
): FormField[] {
	if (fields.length === 0) return [];
	if (branching.length === 0) return fields.slice();

	// Map fieldId → index for fast jumps.
	const indexOf: Record<string, number> = {};
	for (let i = 0; i < fields.length; i++) {
		indexOf[fields[i].id] = i;
	}

	// Default-visibility array; rules toggle entries.
	const visible = new Array<boolean>(fields.length).fill(true);

	// Resolve rules in declaration order.
	for (const rule of branching) {
		if (!evaluateCondition(rule, answers)) continue;
		applyAction(rule, fields, indexOf, visible);
	}

	const result: FormField[] = [];
	for (let i = 0; i < fields.length; i++) {
		if (visible[i]) result.push(fields[i]);
	}
	return result;
}

function evaluateCondition(rule: BranchingRule, answers: Record<string, AnswerValue>): boolean {
	const value = answers[rule.ifFieldId];
	switch (rule.ifOperator) {
		case 'is_empty':
			return isEmpty(value);
		case 'equals':
			return matches(value, rule.ifValue, true);
		case 'not_equals':
			return !matches(value, rule.ifValue, true);
		case 'contains':
			return contains(value, rule.ifValue);
	}
}

function applyAction(
	rule: BranchingRule,
	fields: FormField[],
	indexOf: Record<string, number>,
	visible: boolean[]
): void {
	switch (rule.thenAction) {
		case 'show':
			for (const targetId of rule.thenFieldIds ?? []) {
				const idx = indexOf[targetId];
				if (idx !== undefined) visible[idx] = true;
			}
			return;
		case 'hide':
			for (const targetId of rule.thenFieldIds ?? []) {
				const idx = indexOf[targetId];
				if (idx !== undefined) visible[idx] = false;
			}
			return;
		case 'skip_to':
			if (!rule.thenSkipToFieldId) return;
			const anchorIdx = indexOf[rule.ifFieldId];
			const targetIdx = indexOf[rule.thenSkipToFieldId];
			if (anchorIdx === undefined || targetIdx === undefined) return;
			// Hide everything strictly between anchor (exclusive) and target
			// (exclusive). The anchor field itself is the rule's source,
			// so it must remain visible. The target field is the new
			// destination — also visible.
			for (let i = anchorIdx + 1; i < targetIdx; i++) {
				visible[i] = false;
			}
			return;
	}
}

function isEmpty(value: AnswerValue | undefined): boolean {
	if (value === null || value === undefined) return true;
	if (typeof value === 'string') return value.trim().length === 0;
	if (Array.isArray(value)) return value.length === 0;
	if (typeof value === 'boolean') return value === false;
	return false;
}

/**
 * Equals/not-equals semantics:
 *   - Single value vs single value: strict-eq after string coerce
 *   - Single value vs array: array contains the value
 *   - Array (multi-choice) vs single value: array contains the value
 *   - Array vs array: same set (order-insensitive)
 */
function matches(value: AnswerValue | undefined, expected: unknown, strict: boolean): boolean {
	if (expected === undefined) {
		// `equals` with no value → behave like is_empty when strict
		return strict ? isEmpty(value) : false;
	}
	const left = value;
	const right = expected;

	if (Array.isArray(left) && Array.isArray(right)) {
		if (left.length !== right.length) return false;
		const set = new Set(left.map(String));
		for (const r of right) {
			if (!set.has(String(r))) return false;
		}
		return true;
	}
	if (Array.isArray(left)) {
		return left.map(String).includes(String(right));
	}
	if (Array.isArray(right)) {
		return right.map(String).includes(String(left ?? ''));
	}
	if (left === undefined || left === null) return false;
	return String(left) === String(right);
}

function contains(value: AnswerValue | undefined, needle: unknown): boolean {
	if (needle === undefined || needle === null) return false;
	const needleStr = Array.isArray(needle) ? needle.map(String) : [String(needle)];
	if (Array.isArray(value)) {
		const hay = value.map(String);
		return needleStr.every((n) => hay.includes(n));
	}
	if (typeof value === 'string') {
		return needleStr.every((n) => value.toLowerCase().includes(n.toLowerCase()));
	}
	return false;
}
