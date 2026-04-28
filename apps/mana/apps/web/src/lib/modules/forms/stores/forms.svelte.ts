import { formTable } from '../collections';
import { toForm } from '../queries';
import { encryptRecord } from '$lib/data/crypto';
import { DEFAULT_FORM_SETTINGS } from '../types';
import type { BranchingRule, Form, FormField, FormSettings, FormStatus, LocalForm } from '../types';

function nowIso(): string {
	return new Date().toISOString();
}

export const formsStore = {
	async createForm(data: {
		title: string;
		description?: string | null;
		fields?: FormField[];
		branching?: BranchingRule[];
		settings?: Partial<FormSettings>;
	}): Promise<Form> {
		const id = crypto.randomUUID();
		const newLocal: LocalForm = {
			id,
			title: data.title,
			description: data.description ?? null,
			fields: data.fields ?? [],
			branching: data.branching ?? [],
			status: 'draft',
			settings: { ...DEFAULT_FORM_SETTINGS, ...(data.settings ?? {}) },
			responseCount: 0,
			visibility: 'private',
		};

		const plaintextSnapshot = toForm(newLocal);
		await encryptRecord('forms', newLocal);
		await formTable.add(newLocal);
		return plaintextSnapshot;
	},

	async updateForm(
		id: string,
		data: Partial<Pick<LocalForm, 'title' | 'description' | 'fields' | 'branching' | 'settings'>>
	) {
		const diff: Partial<LocalForm> = { ...data };
		await encryptRecord('forms', diff);
		await formTable.update(id, diff);
	},

	async setStatus(id: string, status: FormStatus) {
		await formTable.update(id, { status });
	},

	async deleteForm(id: string) {
		await formTable.update(id, { deletedAt: nowIso() });
	},

	async addField(id: string, field: FormField) {
		const form = await formTable.get(id);
		if (!form) return;
		const fields = [...(form.fields ?? []), field];
		const diff: Partial<LocalForm> = { fields };
		await encryptRecord('forms', diff);
		await formTable.update(id, diff);
	},

	async updateField(id: string, fieldId: string, patch: Partial<FormField>) {
		const form = await formTable.get(id);
		if (!form) return;
		const fields = (form.fields ?? []).map((f) =>
			f.id === fieldId ? { ...f, ...patch, id: f.id } : f
		);
		const diff: Partial<LocalForm> = { fields };
		await encryptRecord('forms', diff);
		await formTable.update(id, diff);
	},

	async removeField(id: string, fieldId: string) {
		const form = await formTable.get(id);
		if (!form) return;
		const fields = (form.fields ?? []).filter((f) => f.id !== fieldId);
		const diff: Partial<LocalForm> = { fields };
		await encryptRecord('forms', diff);
		await formTable.update(id, diff);
	},

	async reorderFields(id: string, fieldIds: string[]) {
		const form = await formTable.get(id);
		if (!form) return;
		const byId = new Map((form.fields ?? []).map((f) => [f.id, f]));
		const reordered = fieldIds.map((fid) => byId.get(fid)).filter((f): f is FormField => !!f);
		const diff: Partial<LocalForm> = { fields: reordered };
		await encryptRecord('forms', diff);
		await formTable.update(id, diff);
	},
};
