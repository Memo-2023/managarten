/**
 * Forms tools — AI-accessible CRUD + aggregation for the forms module.
 * Plan: docs/plans/forms-module.md M5.
 *
 * Propose:
 *   - forms_create     — new form (draft)
 *   - forms_add_field  — append a field to an existing form
 *   - forms_publish    — draft → published
 *   - forms_close      — published → closed
 *
 * Auto:
 *   - forms_list                — metadata of forms in the active Space
 *   - forms_get_responses       — aggregate stats for one form
 *   - forms_summarize_responses — raw text answers + choice histograms
 *                                  (no LLM roundtrip, planner clusters)
 */

import type { ModuleTool } from '$lib/data/tools/types';
import { formsStore } from './stores/forms.svelte';
import { formTable, formResponseTable } from './collections';
import { decryptRecords, VaultLockedError } from '$lib/data/crypto';
import { toForm, toFormResponse } from './queries';
import { scopedForModule } from '$lib/data/scope';
import type {
	AnswerValue,
	FieldOption,
	FieldType,
	FormField,
	FormStatus,
	LocalForm,
	LocalFormResponse,
} from './types';

const FIELD_TYPES: readonly FieldType[] = [
	'short_text',
	'long_text',
	'single_choice',
	'multi_choice',
	'number',
	'date',
	'email',
	'yes_no',
	'rating',
	'section',
	'consent',
];

function asTrimmedString(raw: unknown): string {
	return typeof raw === 'string' ? raw.trim() : '';
}

function asEnum<T extends string>(raw: unknown, allowed: readonly T[]): T | undefined {
	if (typeof raw !== 'string') return undefined;
	return (allowed as readonly string[]).includes(raw) ? (raw as T) : undefined;
}

function buildFieldFromShape(raw: unknown): FormField | null {
	if (!raw || typeof raw !== 'object') return null;
	const obj = raw as Record<string, unknown>;
	const type = asEnum<FieldType>(obj.type, FIELD_TYPES);
	const label = asTrimmedString(obj.label);
	if (!type || !label) return null;
	const required = obj.required === true;
	const helpText = asTrimmedString(obj.helpText) || undefined;
	const field: FormField = { id: crypto.randomUUID(), type, label, required };
	if (helpText) field.helpText = helpText;

	if ((type === 'single_choice' || type === 'multi_choice') && Array.isArray(obj.options)) {
		const opts: FieldOption[] = [];
		for (const o of obj.options) {
			if (!o || typeof o !== 'object') continue;
			const optLabel = asTrimmedString((o as Record<string, unknown>).label);
			if (optLabel) opts.push({ id: crypto.randomUUID(), label: optLabel });
		}
		if (opts.length > 0) field.options = opts;
	}
	if (type === 'rating') {
		field.config = { ratingScale: 5 };
	}
	return field;
}

export const formsTools: ModuleTool[] = [
	{
		name: 'forms_create',
		module: 'forms',
		description: 'Erstellt ein neues Formular im Draft-Status',
		parameters: [
			{ name: 'title', type: 'string', description: 'Titel', required: true },
			{ name: 'description', type: 'string', description: 'Beschreibung', required: false },
			{ name: 'fields', type: 'array', description: 'Optionale Felder', required: false },
		],
		async execute(params) {
			const title = asTrimmedString(params.title);
			if (!title) return { success: false, message: 'title darf nicht leer sein' };

			const description = asTrimmedString(params.description) || null;
			const fields: FormField[] = [];
			if (Array.isArray(params.fields)) {
				for (const raw of params.fields) {
					const field = buildFieldFromShape(raw);
					if (field) fields.push(field);
				}
			}

			const form = await formsStore.createForm({
				title,
				description,
				fields,
			});
			return {
				success: true,
				data: { formId: form.id, title: form.title, fieldCount: form.fields.length },
				message: `Formular "${title}" angelegt (${fields.length} Felder)`,
			};
		},
	},
	{
		name: 'forms_add_field',
		module: 'forms',
		description: 'Fügt einem Formular ein Feld hinzu',
		parameters: [
			{ name: 'formId', type: 'string', description: 'ID', required: true },
			{ name: 'type', type: 'string', description: 'Feldtyp', required: true },
			{ name: 'label', type: 'string', description: 'Label', required: true },
			{ name: 'helpText', type: 'string', description: 'Hilfetext', required: false },
			{ name: 'required', type: 'boolean', description: 'Pflichtfeld', required: false },
			{
				name: 'options',
				type: 'array',
				description: 'Optionen für choice-Felder',
				required: false,
			},
		],
		async execute(params) {
			const formId = asTrimmedString(params.formId);
			if (!formId) return { success: false, message: 'formId darf nicht leer sein' };

			const existing = await formTable.get(formId);
			if (!existing || existing.deletedAt) {
				return { success: false, message: `Formular ${formId} nicht gefunden` };
			}

			const field = buildFieldFromShape(params);
			if (!field) {
				return {
					success: false,
					message: 'Feld konnte nicht gebaut werden — type oder label fehlt/ungültig',
				};
			}

			await formsStore.addField(formId, field);
			return {
				success: true,
				data: { formId, fieldId: field.id, type: field.type, label: field.label },
				message: `Feld "${field.label}" hinzugefügt`,
			};
		},
	},
	{
		name: 'forms_publish',
		module: 'forms',
		description: 'Setzt ein Formular auf "published"',
		parameters: [{ name: 'formId', type: 'string', description: 'ID', required: true }],
		async execute(params) {
			const formId = asTrimmedString(params.formId);
			if (!formId) return { success: false, message: 'formId darf nicht leer sein' };

			const existing = await formTable.get(formId);
			if (!existing || existing.deletedAt) {
				return { success: false, message: `Formular ${formId} nicht gefunden` };
			}

			const answerFields = (existing.fields ?? []).filter(
				(f) => f.type !== 'section' && f.type !== 'consent'
			);
			if (answerFields.length === 0) {
				return {
					success: false,
					message: 'Formular braucht mindestens ein Antwortfeld vor dem Veröffentlichen',
				};
			}

			await formsStore.setStatus(formId, 'published');
			return {
				success: true,
				data: { formId, status: 'published' },
				message: 'Formular veröffentlicht',
			};
		},
	},
	{
		name: 'forms_close',
		module: 'forms',
		description: 'Setzt ein Formular auf "closed"',
		parameters: [{ name: 'formId', type: 'string', description: 'ID', required: true }],
		async execute(params) {
			const formId = asTrimmedString(params.formId);
			if (!formId) return { success: false, message: 'formId darf nicht leer sein' };

			const existing = await formTable.get(formId);
			if (!existing || existing.deletedAt) {
				return { success: false, message: `Formular ${formId} nicht gefunden` };
			}

			await formsStore.setStatus(formId, 'closed');
			return {
				success: true,
				data: { formId, status: 'closed' },
				message: 'Formular geschlossen',
			};
		},
	},
	{
		name: 'forms_list',
		module: 'forms',
		description: 'Listet Formulare im aktiven Space',
		parameters: [
			{ name: 'status', type: 'string', description: 'Status-Filter', required: false },
			{ name: 'limit', type: 'number', description: 'Max. Anzahl', required: false },
		],
		async execute(params) {
			const status = asEnum<FormStatus>(params.status, ['draft', 'published', 'closed']);
			const limit = typeof params.limit === 'number' ? Math.max(1, params.limit) : 50;

			let items = (await scopedForModule<LocalForm, string>('forms', 'forms').toArray()).filter(
				(f) => !f.deletedAt
			);
			if (status) items = items.filter((f) => f.status === status);

			try {
				const decrypted = await decryptRecords('forms', items);
				const forms = decrypted.map(toForm).slice(0, limit);
				return {
					success: true,
					data: forms.map((f) => ({
						id: f.id,
						title: f.title,
						status: f.status,
						fieldCount: f.fields.length,
						responseCount: f.responseCount,
						visibility: f.visibility,
					})),
					message: `${forms.length} Formular(e) gefunden`,
				};
			} catch (err) {
				if (err instanceof VaultLockedError) {
					return {
						success: false,
						message: 'Vault ist verschlossen — Formulare können nicht entschlüsselt werden',
					};
				}
				throw err;
			}
		},
	},
	{
		name: 'forms_get_responses',
		module: 'forms',
		description: 'Aggregat-Stats über die Antworten eines Formulars',
		parameters: [
			{ name: 'formId', type: 'string', description: 'ID', required: true },
			{
				name: 'limit',
				type: 'number',
				description: 'Max. Text-Antworten pro Feld',
				required: false,
			},
		],
		async execute(params) {
			const formId = asTrimmedString(params.formId);
			if (!formId) return { success: false, message: 'formId darf nicht leer sein' };
			const limit = typeof params.limit === 'number' ? Math.max(1, params.limit) : 50;

			const formRow = await formTable.get(formId);
			if (!formRow || formRow.deletedAt) {
				return { success: false, message: `Formular ${formId} nicht gefunden` };
			}

			try {
				const [decryptedForm] = await decryptRecords('forms', [formRow]);
				const form = toForm(decryptedForm);

				const responseRows = (
					await scopedForModule<LocalFormResponse, string>('forms', 'formResponses').toArray()
				).filter((r) => !r.deletedAt && r.formId === formId);

				const decrypted = await decryptRecords('formResponses', responseRows);
				const responses = decrypted.map(toFormResponse);

				return {
					success: true,
					data: aggregateResponses(form.fields, responses, limit),
					message: `${responses.length} Antwort(en) aggregiert`,
				};
			} catch (err) {
				if (err instanceof VaultLockedError) {
					return {
						success: false,
						message: 'Vault ist verschlossen — Antworten können nicht entschlüsselt werden',
					};
				}
				throw err;
			}
		},
	},
	{
		name: 'forms_summarize_responses',
		module: 'forms',
		description: 'Rohdaten + Histogramme für LLM-Clustering im nächsten Planner-Schritt',
		parameters: [
			{ name: 'formId', type: 'string', description: 'ID', required: true },
			{ name: 'sinceDays', type: 'number', description: 'Nur letzte N Tage', required: false },
		],
		async execute(params) {
			const formId = asTrimmedString(params.formId);
			if (!formId) return { success: false, message: 'formId darf nicht leer sein' };

			const formRow = await formTable.get(formId);
			if (!formRow || formRow.deletedAt) {
				return { success: false, message: `Formular ${formId} nicht gefunden` };
			}

			const sinceDays = typeof params.sinceDays === 'number' ? params.sinceDays : null;
			const sinceIso =
				sinceDays !== null
					? new Date(Date.now() - sinceDays * 24 * 60 * 60 * 1000).toISOString()
					: null;

			try {
				const [decryptedForm] = await decryptRecords('forms', [formRow]);
				const form = toForm(decryptedForm);

				const responseRows = (
					await scopedForModule<LocalFormResponse, string>('forms', 'formResponses').toArray()
				).filter((r) => {
					if (r.deletedAt || r.formId !== formId) return false;
					if (sinceIso && r.submittedAt < sinceIso) return false;
					return true;
				});

				const decrypted = await decryptRecords('formResponses', responseRows);
				const responses = decrypted.map(toFormResponse);

				return {
					success: true,
					data: {
						formTitle: form.title,
						windowStart: sinceIso,
						windowDays: sinceDays,
						...aggregateResponses(form.fields, responses, 200),
					},
					message: `${responses.length} Antwort(en) für Clustering bereit`,
				};
			} catch (err) {
				if (err instanceof VaultLockedError) {
					return {
						success: false,
						message: 'Vault ist verschlossen',
					};
				}
				throw err;
			}
		},
	},
];

// ─── Aggregation Helper ─────────────────────────────────────

interface FieldHistogram {
	fieldId: string;
	label: string;
	type: FieldType;
	histogram: Record<string, number>;
}

interface FieldTextSamples {
	fieldId: string;
	label: string;
	type: FieldType;
	samples: string[];
	totalCount: number;
}

interface ResponseAggregate {
	totalCount: number;
	statusCounts: Record<string, number>;
	choiceHistograms: FieldHistogram[];
	textSamples: FieldTextSamples[];
	numericStats: {
		fieldId: string;
		label: string;
		min: number;
		max: number;
		avg: number;
		count: number;
	}[];
}

function aggregateResponses(
	fields: FormField[],
	responses: { status: string; answers: Record<string, AnswerValue> }[],
	textLimit: number
): ResponseAggregate {
	const statusCounts: Record<string, number> = {};
	for (const r of responses) {
		statusCounts[r.status] = (statusCounts[r.status] ?? 0) + 1;
	}

	const choiceHistograms: FieldHistogram[] = [];
	const textSamples: FieldTextSamples[] = [];
	const numericStats: ResponseAggregate['numericStats'] = [];

	for (const field of fields) {
		if (field.type === 'section' || field.type === 'consent') continue;

		if (field.type === 'single_choice' || field.type === 'multi_choice') {
			const optLabelById = new Map((field.options ?? []).map((o) => [o.id, o.label]));
			const histogram: Record<string, number> = {};
			for (const r of responses) {
				const v = r.answers[field.id];
				if (Array.isArray(v)) {
					for (const optId of v) {
						const key = optLabelById.get(String(optId)) ?? String(optId);
						histogram[key] = (histogram[key] ?? 0) + 1;
					}
				} else if (typeof v === 'string') {
					const key = optLabelById.get(v) ?? v;
					histogram[key] = (histogram[key] ?? 0) + 1;
				}
			}
			choiceHistograms.push({ fieldId: field.id, label: field.label, type: field.type, histogram });
		} else if (field.type === 'yes_no') {
			const histogram: Record<string, number> = {};
			for (const r of responses) {
				const v = r.answers[field.id];
				if (typeof v === 'boolean') {
					const key = v ? 'yes' : 'no';
					histogram[key] = (histogram[key] ?? 0) + 1;
				}
			}
			choiceHistograms.push({ fieldId: field.id, label: field.label, type: field.type, histogram });
		} else if (field.type === 'rating' || field.type === 'number') {
			const values: number[] = [];
			for (const r of responses) {
				const v = r.answers[field.id];
				if (typeof v === 'number') values.push(v);
			}
			if (values.length > 0) {
				const sum = values.reduce((a, b) => a + b, 0);
				numericStats.push({
					fieldId: field.id,
					label: field.label,
					min: Math.min(...values),
					max: Math.max(...values),
					avg: sum / values.length,
					count: values.length,
				});
			}
		} else {
			// short_text, long_text, email, date — collect samples verbatim
			const samples: string[] = [];
			let total = 0;
			for (const r of responses) {
				const v = r.answers[field.id];
				if (typeof v === 'string' && v.trim().length > 0) {
					total += 1;
					if (samples.length < textLimit) samples.push(v);
				}
			}
			textSamples.push({
				fieldId: field.id,
				label: field.label,
				type: field.type,
				samples,
				totalCount: total,
			});
		}
	}

	return {
		totalCount: responses.length,
		statusCounts,
		choiceHistograms,
		textSamples,
		numericStats,
	};
}
