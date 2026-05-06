import { useScopedLiveQuery } from '$lib/data/scope/use-scoped-live-query.svelte';
import { deriveUpdatedAt } from '$lib/data/sync';
import { scopedForModule } from '$lib/data/scope';
import { decryptRecords } from '$lib/data/crypto';
import { DEFAULT_FORM_SETTINGS } from './types';
import type {
	Form,
	FormResponse,
	FormStatus,
	LocalForm,
	LocalFormResponse,
	ResponseStatus,
} from './types';

// ─── Type Converters ───────────────────────────────────────

export function toForm(local: LocalForm): Form {
	return {
		id: local.id,
		spaceId: (local as unknown as { spaceId?: string }).spaceId ?? '',
		title: local.title,
		description: local.description,
		fields: local.fields ?? [],
		branching: local.branching ?? [],
		status: local.status,
		settings: { ...DEFAULT_FORM_SETTINGS, ...(local.settings ?? {}) },
		responseCount: local.responseCount ?? 0,
		visibility: local.visibility ?? 'private',
		unlistedToken: local.unlistedToken ?? '',
		unlistedExpiresAt: local.unlistedExpiresAt ?? null,
		createdAt: local.createdAt ?? new Date().toISOString(),
		updatedAt: deriveUpdatedAt(local),
	};
}

export function toFormResponse(local: LocalFormResponse): FormResponse {
	return {
		id: local.id,
		formId: local.formId,
		submittedAt: local.submittedAt,
		answers: local.answers ?? {},
		submitterEmail: local.submitterEmail ?? null,
		submitterName: local.submitterName ?? null,
		submitterMeta: local.submitterMeta ?? null,
		status: local.status,
		syncedTargets: local.syncedTargets ?? [],
		cohort: local.cohort ?? null,
		createdAt: local.createdAt ?? new Date().toISOString(),
		updatedAt: deriveUpdatedAt(local),
	};
}

// ─── Live Queries ──────────────────────────────────────────

export function useAllForms() {
	return useScopedLiveQuery(async () => {
		const visible = (await scopedForModule<LocalForm, string>('forms', 'forms').toArray()).filter(
			(f) => !f.deletedAt
		);
		const decrypted = await decryptRecords('forms', visible);
		return decrypted.map(toForm).sort(compareForms);
	}, [] as Form[]);
}

export function useFormsByStatus(status: FormStatus) {
	return useScopedLiveQuery(async () => {
		const visible = (await scopedForModule<LocalForm, string>('forms', 'forms').toArray()).filter(
			(f) => !f.deletedAt && f.status === status
		);
		const decrypted = await decryptRecords('forms', visible);
		return decrypted.map(toForm).sort(compareForms);
	}, [] as Form[]);
}

export function useFormResponses(formId: string) {
	return useScopedLiveQuery(async () => {
		const visible = (
			await scopedForModule<LocalFormResponse, string>('forms', 'formResponses').toArray()
		).filter((r) => !r.deletedAt && r.formId === formId);
		const decrypted = await decryptRecords('formResponses', visible);
		return decrypted.map(toFormResponse).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
	}, [] as FormResponse[]);
}

export function useResponsesByStatus(formId: string, status: ResponseStatus) {
	return useScopedLiveQuery(async () => {
		const visible = (
			await scopedForModule<LocalFormResponse, string>('forms', 'formResponses').toArray()
		).filter((r) => !r.deletedAt && r.formId === formId && r.status === status);
		const decrypted = await decryptRecords('formResponses', visible);
		return decrypted.map(toFormResponse).sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));
	}, [] as FormResponse[]);
}

// ─── Pure Helpers ──────────────────────────────────────────

function compareForms(a: Form, b: Form): number {
	// Drafts at the top while editing, then published, then closed.
	const order: Record<FormStatus, number> = { draft: 0, published: 1, closed: 2 };
	if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
	return b.updatedAt.localeCompare(a.updatedAt);
}

export function searchForms(forms: Form[], query: string): Form[] {
	if (!query.trim()) return forms;
	const q = query.toLowerCase();
	return forms.filter((f) => {
		const haystack = [f.title, f.description].filter(Boolean).join(' ').toLowerCase();
		return haystack.includes(q);
	});
}
