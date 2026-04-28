import type { AnswerValue, Form, FormResponse } from '../types';

/**
 * Build a CSV blob from an array of responses against the parent form's
 * field definitions. Pure function — no DOM, no Dexie. The parent UI
 * is responsible for triggering the download.
 *
 * Column order: submittedAt, status, submitter (name + email if not
 * anonymous), then one column per field in field-order. Section /
 * consent fields are excluded from columns (no answer data).
 */
export function buildResponsesCsv(form: Form, responses: FormResponse[]): string {
	const fields = form.fields.filter((f) => f.type !== 'section' && f.type !== 'consent');
	const headers = [
		'submittedAt',
		'status',
		'submitter',
		'submitterEmail',
		...fields.map((f) => f.label || f.id),
	];

	const rows = responses.map((r) => {
		return [
			r.submittedAt,
			r.status,
			r.submitterName ?? '',
			r.submitterEmail ?? '',
			...fields.map((f) => formatAnswer(r.answers[f.id])),
		];
	});

	const lines = [headers, ...rows].map((row) => row.map(escapeCsvCell).join(','));
	return lines.join('\n');
}

function formatAnswer(value: AnswerValue | undefined): string {
	if (value === null || value === undefined) return '';
	if (Array.isArray(value)) return value.join('; ');
	if (typeof value === 'boolean') return value ? 'yes' : 'no';
	return String(value);
}

/**
 * RFC-4180 compliant escape: wrap in quotes if the cell contains
 * comma, quote, CR or LF; double up internal quotes.
 */
function escapeCsvCell(value: string): string {
	const str = String(value);
	if (/[",\r\n]/.test(str)) {
		return `"${str.replace(/"/g, '""')}"`;
	}
	return str;
}

/**
 * Browser-only convenience wrapper. Triggers a download of the CSV
 * blob with a filename derived from the form title + today's date.
 */
export function downloadResponsesCsv(form: Form, responses: FormResponse[]): void {
	const csv = buildResponsesCsv(form, responses);
	// Prepend BOM so Excel auto-detects UTF-8.
	const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
	const url = URL.createObjectURL(blob);
	const today = new Date().toISOString().slice(0, 10);
	const safeTitle = form.title.replace(/[^a-zA-Z0-9-_]+/g, '-').slice(0, 40) || 'form';
	const a = document.createElement('a');
	a.href = url;
	a.download = `${safeTitle}-responses-${today}.csv`;
	document.body.appendChild(a);
	a.click();
	document.body.removeChild(a);
	URL.revokeObjectURL(url);
}
