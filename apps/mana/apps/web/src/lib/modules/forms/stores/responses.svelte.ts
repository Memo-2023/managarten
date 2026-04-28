import { formResponseTable, formTable } from '../collections';
import { toFormResponse } from '../queries';
import { encryptRecord } from '$lib/data/crypto';
import type { AnswerValue, FormResponse, LocalFormResponse, ResponseStatus } from '../types';

function nowIso(): string {
	return new Date().toISOString();
}

export const responsesStore = {
	/**
	 * Record a response submitted via the in-app builder preview. The
	 * public-submit pipeline (M3) writes server-side and round-trips
	 * through mana-sync, so it does not call this store.
	 */
	async submitResponse(data: {
		formId: string;
		answers: Record<string, AnswerValue>;
		submitterEmail?: string | null;
		submitterName?: string | null;
	}): Promise<FormResponse> {
		const id = crypto.randomUUID();
		const now = nowIso();
		const newLocal: LocalFormResponse = {
			id,
			formId: data.formId,
			submittedAt: now,
			answers: data.answers,
			submitterEmail: data.submitterEmail ?? undefined,
			submitterName: data.submitterName ?? undefined,
			status: 'new',
		};

		const plaintextSnapshot = toFormResponse(newLocal);
		await encryptRecord('formResponses', newLocal);
		await formResponseTable.add(newLocal);

		// Bump denormalized counter on the parent form. Read-modify-write
		// is fine here — collisions resolve via field-level LWW in sync,
		// and the count is a UI-only signal (re-deriveable from a query).
		const parent = await formTable.get(data.formId);
		if (parent) {
			await formTable.update(data.formId, {
				responseCount: (parent.responseCount ?? 0) + 1,
			});
		}

		return plaintextSnapshot;
	},

	async setStatus(id: string, status: ResponseStatus) {
		await formResponseTable.update(id, { status });
	},

	async deleteResponse(id: string) {
		await formResponseTable.update(id, { deletedAt: nowIso() });
	},
};
