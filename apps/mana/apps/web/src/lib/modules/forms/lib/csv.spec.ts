import { describe, it, expect } from 'vitest';
import { buildResponsesCsv } from './csv';
import { DEFAULT_FORM_SETTINGS } from '../types';
import type { Form, FormResponse } from '../types';

function makeForm(): Form {
	return {
		id: 'f1',
		title: 'Pulse Check',
		description: null,
		fields: [
			{ id: 'name', type: 'short_text', label: 'Name', required: true },
			{ id: 'mood', type: 'rating', label: 'Stimmung', required: false },
			{ id: 'tags', type: 'multi_choice', label: 'Themen', required: false },
			// Excluded from CSV: section + consent fields
			{ id: 'section1', type: 'section', label: 'Abschnitt', required: false },
			{ id: 'agree', type: 'consent', label: 'Einwilligung', required: true },
		],
		branching: [],
		status: 'published',
		settings: DEFAULT_FORM_SETTINGS,
		responseCount: 0,
		visibility: 'private',
		unlistedToken: '',
		unlistedExpiresAt: null,
		createdAt: '2026-04-28T10:00:00Z',
		updatedAt: '2026-04-28T10:00:00Z',
	};
}

function makeResponse(overrides: Partial<FormResponse> = {}): FormResponse {
	return {
		id: 'r1',
		formId: 'f1',
		submittedAt: '2026-04-28T12:00:00Z',
		answers: { name: 'Anna', mood: 4, tags: ['arbeit', 'familie'] },
		submitterEmail: 'anna@example.com',
		submitterName: 'Anna Mustermann',
		submitterMeta: null,
		status: 'new',
		syncedTargets: [],
		cohort: null,
		createdAt: '2026-04-28T12:00:00Z',
		updatedAt: '2026-04-28T12:00:00Z',
		...overrides,
	};
}

describe('buildResponsesCsv', () => {
	it('emits header row with submittedAt + status + submitter columns + form fields (sans section/consent)', () => {
		const csv = buildResponsesCsv(makeForm(), []);
		expect(csv).toBe('submittedAt,status,submitter,submitterEmail,Name,Stimmung,Themen');
	});

	it('emits one data row per response with answers in field order', () => {
		const csv = buildResponsesCsv(makeForm(), [makeResponse()]);
		const lines = csv.split('\n');
		expect(lines).toHaveLength(2);
		expect(lines[1]).toBe(
			'2026-04-28T12:00:00Z,new,Anna Mustermann,anna@example.com,Anna,4,arbeit; familie'
		);
	});

	it('escapes cells containing commas, quotes, or newlines per RFC-4180', () => {
		const r = makeResponse({
			answers: { name: 'Anna, "die Erste"\nZweiter Versuch', mood: 5, tags: [] },
		});
		const csv = buildResponsesCsv(makeForm(), [r]);
		const lines = csv.split('\n');
		// Comma-or-newline-or-quote → must be wrapped in double quotes,
		// internal quotes doubled. The newline keeps the row lenient
		// across the literal split('\n') above; we just check the cell.
		expect(csv).toContain('"Anna, ""die Erste""');
	});

	it('renders empty answer as empty string, boolean as yes/no, array joined with semicolons', () => {
		const f: Form = {
			...makeForm(),
			fields: [
				{ id: 'a', type: 'short_text', label: 'A', required: false },
				{ id: 'b', type: 'yes_no', label: 'B', required: false },
				{ id: 'c', type: 'multi_choice', label: 'C', required: false },
			],
		};
		const r = makeResponse({ answers: { b: true, c: ['x', 'y'] } });
		const csv = buildResponsesCsv(f, [r]);
		const lines = csv.split('\n');
		expect(lines[1]).toBe('2026-04-28T12:00:00Z,new,Anna Mustermann,anna@example.com,,yes,x; y');
	});

	it('omits submitter columns when response has anonymous submitter (null name + null email)', () => {
		const r = makeResponse({ submitterName: null, submitterEmail: null });
		const csv = buildResponsesCsv(makeForm(), [r]);
		const lines = csv.split('\n');
		// Empty cells, not "null" string
		expect(lines[1]).toContain(',,,Anna,4,');
	});
});
