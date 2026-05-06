import { formTable } from '../collections';
import { toForm } from '../queries';
import { encryptRecord } from '$lib/data/crypto';
import { DEFAULT_FORM_SETTINGS } from '../types';
import type { BranchingRule, Form, FormField, FormSettings, FormStatus, LocalForm } from '../types';
import {
	publishUnlistedSnapshot,
	revokeUnlistedSnapshot,
	type VisibilityLevel,
} from '@mana/shared-privacy';
import { buildUnlistedBlob } from '$lib/data/unlisted/resolvers';
import { authStore } from '$lib/stores/auth.svelte';
import { getManaApiUrl } from '$lib/api/config';
import { getActiveSpace } from '$lib/data/scope';
import { getEffectiveUserId } from '$lib/data/current-user';

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

	async updateBranching(id: string, branching: BranchingRule[]) {
		const diff: Partial<LocalForm> = { branching };
		await encryptRecord('forms', diff);
		await formTable.update(id, diff);
	},

	/**
	 * Stamp the recurrence lastSentAt timestamp after the user fired a
	 * wave (M10b). The whole settings-blob travels encrypted, so we
	 * read the current settings, patch lastSentAt, then re-encrypt the
	 * full blob. Other settings stay untouched.
	 */
	async markWaveSent(id: string, sentAtIso: string = new Date().toISOString()) {
		const form = await formTable.get(id);
		if (!form) return;
		const settings = form.settings ?? DEFAULT_FORM_SETTINGS;
		if (!settings.recurrence) return;
		const nextSettings: typeof settings = {
			...settings,
			recurrence: { ...settings.recurrence, lastSentAt: sentAtIso },
		};
		const diff: Partial<LocalForm> = { settings: nextSettings };
		await encryptRecord('forms', diff);
		await formTable.update(id, diff);
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

	// ── Visibility / Unlisted-Sharing (M4b) ───────────────────

	/**
	 * Change a form's visibility level. Transitions to `unlisted` publish
	 * the public snapshot blob and assign a share token; transitions away
	 * revoke it. Only `published` forms can go public — the resolver
	 * defends this too, so a draft → unlisted attempt fails fast here
	 * with a clear message.
	 */
	async setVisibility(id: string, next: VisibilityLevel) {
		const existing = await formTable.get(id);
		if (!existing) throw new Error(`Form ${id} not found`);
		const before: VisibilityLevel = existing.visibility ?? 'private';
		if (before === next) return;

		if (next === 'unlisted' && existing.status !== 'published') {
			throw new Error(
				'Nur veröffentlichte Formulare können geteilt werden. Setze erst den Status auf "Veröffentlicht".'
			);
		}

		const now = nowIso();
		const patch: Partial<LocalForm> = {
			visibility: next,
			visibilityChangedAt: now,
			visibilityChangedBy: getEffectiveUserId() ?? undefined,
		};

		if (next === 'unlisted') {
			const jwt = await authStore.getValidToken();
			if (!jwt) throw new Error('Nicht eingeloggt — Share-Link kann nicht erzeugt werden.');
			const blob = await buildUnlistedBlob('forms', id);
			const spaceId =
				(existing as unknown as { spaceId?: string }).spaceId ?? getActiveSpace()?.id ?? '';
			const { token } = await publishUnlistedSnapshot({
				apiUrl: getManaApiUrl(),
				jwt,
				collection: 'forms',
				recordId: id,
				spaceId,
				blob,
			});
			patch.unlistedToken = token;
			patch.unlistedExpiresAt = null;
		} else if (before === 'unlisted') {
			const jwt = await authStore.getValidToken();
			if (jwt) {
				try {
					await revokeUnlistedSnapshot({
						apiUrl: getManaApiUrl(),
						jwt,
						collection: 'forms',
						recordId: id,
					});
				} catch {
					// Server may already have GC'd the row — local flip still correct.
				}
			}
			patch.unlistedToken = '';
			patch.unlistedExpiresAt = null;
		}

		await formTable.update(id, patch);
	},

	/**
	 * Rotate the share token. Old URL stops working immediately, new one
	 * carries the same expiry (if any). Useful when the link leaked.
	 */
	async regenerateUnlistedToken(id: string): Promise<string | null> {
		const existing = await formTable.get(id);
		if (!existing || existing.visibility !== 'unlisted') return null;
		const jwt = await authStore.getValidToken();
		if (!jwt) return null;

		try {
			await revokeUnlistedSnapshot({
				apiUrl: getManaApiUrl(),
				jwt,
				collection: 'forms',
				recordId: id,
			});
		} catch {
			// Defensive — proceed even if server GC'd the snapshot.
		}

		const blob = await buildUnlistedBlob('forms', id);
		const spaceId =
			(existing as unknown as { spaceId?: string }).spaceId ?? getActiveSpace()?.id ?? '';
		const { token } = await publishUnlistedSnapshot({
			apiUrl: getManaApiUrl(),
			jwt,
			collection: 'forms',
			recordId: id,
			spaceId,
			blob,
			expiresAt: existing.unlistedExpiresAt ? new Date(existing.unlistedExpiresAt) : undefined,
		});
		await formTable.update(id, { unlistedToken: token });
		return token;
	},

	/**
	 * Update the auto-revoke deadline. `null` = never expires. Server
	 * re-publishes the same blob with the new TTL.
	 */
	async setUnlistedExpiry(id: string, expiresAt: Date | null) {
		const existing = await formTable.get(id);
		if (!existing || existing.visibility !== 'unlisted') return;
		const jwt = await authStore.getValidToken();
		if (!jwt) return;

		const blob = await buildUnlistedBlob('forms', id);
		const spaceId =
			(existing as unknown as { spaceId?: string }).spaceId ?? getActiveSpace()?.id ?? '';
		const { token } = await publishUnlistedSnapshot({
			apiUrl: getManaApiUrl(),
			jwt,
			collection: 'forms',
			recordId: id,
			spaceId,
			blob,
			expiresAt: expiresAt ?? undefined,
		});
		await formTable.update(id, {
			unlistedToken: token,
			unlistedExpiresAt: expiresAt ? expiresAt.toISOString() : null,
		});
	},
};
