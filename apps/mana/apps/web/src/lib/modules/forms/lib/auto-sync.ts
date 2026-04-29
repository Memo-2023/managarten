/**
 * Forms — auto-sync to other modules (M7a).
 *
 * Bei einer neuen Form-Antwort kann der Owner konfigurieren, dass die
 * Antwort automatisch in ein anderes Modul fliesst. v1 unterstuetzt
 * `contacts` — typischer Vereins-Anmeldungs-Flow:
 *   form-field-X (Name) → contact.firstName + lastName
 *   form-field-Y (Email) → contact.email
 *   form-field-Z (Telefon) → contact.phone
 *
 * Der Hook ist owner-side: laeuft, wenn der Client eine neue Antwort
 * sieht (Pull oder lokaler Insert) UND die Antwort noch keinen
 * `syncedTargets`-Eintrag fuer das konfigurierte Target hat. Der
 * Server kann das nicht — er hat keinen master-key fuer encrypted
 * tables wie `contacts`. Owner-side ist die richtige Stelle.
 *
 * Idempotenz: jede Anwendung schreibt einen `syncedTargets`-Eintrag
 * mit { target, recordId }. Beim naechsten Scan wird die Antwort
 * uebersprungen, weil der Eintrag bereits drin ist.
 *
 * Plan: docs/plans/forms-module.md M7.
 */

import { contactsStore } from '$lib/modules/contacts/stores/contacts.svelte';
import { eventGuestsStore } from '$lib/modules/events/stores/guests.svelte';
import { decryptRecords, isVaultUnlocked } from '$lib/data/crypto';
import { formResponseTable, formTable } from '../collections';
import { toForm, toFormResponse } from '../queries';
import type { AnswerValue, AutoSyncConfig, Form, FormResponse } from '../types';

/**
 * Build a contact-record patch from a form response, given the
 * field-mapping configured by the form owner. Pure — no Dexie writes.
 *
 * The mapping shape is:
 *   { [formFieldId]: 'firstName' | 'lastName' | 'email' | 'phone' | ... }
 *
 * Special case: a single mapping target `'name'` splits the answer
 * into firstName + lastName by the first whitespace. Useful when the
 * form has a single "Name"-field.
 */
export function buildContactFromAnswers(
	answers: Record<string, AnswerValue>,
	mapping: Record<string, string>
): Record<string, unknown> {
	const contact: Record<string, unknown> = {};

	for (const [fieldId, contactKey] of Object.entries(mapping)) {
		const value = answers[fieldId];
		if (value === null || value === undefined) continue;
		const str = typeof value === 'string' ? value.trim() : String(value);
		if (!str) continue;

		if (contactKey === 'name') {
			const parts = str.split(/\s+/);
			contact.firstName = parts.shift() ?? str;
			if (parts.length > 0) contact.lastName = parts.join(' ');
		} else {
			contact[contactKey] = str;
		}
	}

	return contact;
}

/**
 * Apply autoSync for a single response. Idempotent — checks
 * `syncedTargets` first; returns early if already synced. Mutates
 * the response row to record the new mapping.
 *
 * Throws if the form's `autoSync.target` is unsupported. Caller
 * decides whether to swallow (best-effort sweep) or surface the error
 * (interactive button click).
 */
export async function applyAutoSync(
	form: Form,
	response: FormResponse
): Promise<{ synced: boolean; recordId?: string }> {
	const cfg = form.settings.autoSync;
	if (!cfg) return { synced: false };

	const already = (response.syncedTargets ?? []).find((t) => t.target === cfg.target);
	if (already) return { synced: false, recordId: already.recordId };

	const recordId = await dispatchTarget(cfg, response.answers);
	if (!recordId) return { synced: false };

	const next = [...(response.syncedTargets ?? []), { target: cfg.target, recordId }];
	await formResponseTable.update(response.id, { syncedTargets: next });
	return { synced: true, recordId };
}

/**
 * Build an event-guest patch from a form response. Pure. The `name`
 * key is the synthetic auto-split target (firstName + lastName joined
 * with whitespace) — guest records carry a single `name` field, so we
 * collapse the contact-style split here.
 */
export function buildEventGuestFromAnswers(
	answers: Record<string, AnswerValue>,
	mapping: Record<string, string>
): {
	name?: string;
	email?: string;
	phone?: string;
	note?: string;
	plusOnes?: number;
} {
	const guest: { name?: string; email?: string; phone?: string; note?: string; plusOnes?: number } =
		{};

	for (const [fieldId, key] of Object.entries(mapping)) {
		const value = answers[fieldId];
		if (value === null || value === undefined) continue;
		const str = typeof value === 'string' ? value.trim() : String(value);
		if (!str) continue;

		switch (key) {
			case 'name':
				guest.name = str;
				break;
			case 'email':
				guest.email = str;
				break;
			case 'phone':
				guest.phone = str;
				break;
			case 'note':
				guest.note = str;
				break;
			case 'plusOnes': {
				const n = Number(str);
				if (Number.isFinite(n) && n >= 0) guest.plusOnes = Math.floor(n);
				break;
			}
		}
	}

	return guest;
}

async function dispatchTarget(
	cfg: AutoSyncConfig,
	answers: Record<string, AnswerValue>
): Promise<string | null> {
	switch (cfg.target) {
		case 'contacts': {
			const data = buildContactFromAnswers(answers, cfg.mapping);
			// Need at least a name or email to create a contact — anything
			// less leaks empty rows into /contacts.
			if (!data.firstName && !data.lastName && !data.email) {
				return null;
			}
			const contact = await contactsStore.createContact(data);
			return contact?.id ?? null;
		}
		case 'events': {
			if (!cfg.targetId) {
				throw new Error('autoSync.targetId (eventId) ist erforderlich für target=events');
			}
			const guest = buildEventGuestFromAnswers(answers, cfg.mapping);
			// Need at least a name to create a guest entry. Without one
			// the RSVP list collects empty rows.
			if (!guest.name) return null;
			const result = await eventGuestsStore.addGuest({
				eventId: cfg.targetId,
				name: guest.name,
				email: guest.email ?? null,
				phone: guest.phone ?? null,
				note: guest.note ?? null,
				plusOnes: guest.plusOnes ?? 0,
				rsvpStatus: 'yes',
			});
			return result.success ? result.id : null;
		}
		case 'feedback':
		case 'library':
		case 'space_member':
			// Out of M7b scope. feedback ist zentraler Public-Hub (eigene
			// Domain, keine Dexie), library + space_member brauchen mehr
			// Architektur (target-id picker für library, invite-flow für
			// space_member). Bleibt explicit "not yet" damit der UI-Filter
			// im SettingsPanel keine option-Werte vergibt, die runtime
			// brechen wuerden.
			throw new Error(`autoSync target "${cfg.target}" ist noch nicht implementiert`);
	}
}

/**
 * Sweep every response of every form with autoSync configured, applying
 * any pending sync. Idempotent — already-synced responses are skipped
 * via the syncedTargets check inside applyAutoSync.
 *
 * Vault-locked → no-op (decrypt would fail anyway). Per-response
 * failures are caught + logged so one bad mapping doesn't block the
 * rest of the queue.
 */
export async function runAutoSyncSweep(): Promise<{ scanned: number; synced: number }> {
	if (!isVaultUnlocked()) return { scanned: 0, synced: 0 };

	const rawForms = (await formTable.toArray()).filter((f) => !f.deletedAt);
	if (rawForms.length === 0) return { scanned: 0, synced: 0 };

	const decrypted = await decryptRecords('forms', rawForms);
	const forms = decrypted.map(toForm).filter((f) => f.settings?.autoSync?.target);
	if (forms.length === 0) return { scanned: 0, synced: 0 };

	let scanned = 0;
	let synced = 0;

	for (const form of forms) {
		const rawResponses = (await formResponseTable.where('formId').equals(form.id).toArray()).filter(
			(r) => !r.deletedAt
		);

		// Skip responses already synced for this target (cheap check on
		// plaintext field) before paying the decrypt cost.
		const target = form.settings.autoSync!.target;
		const candidates = rawResponses.filter(
			(r) => !(r.syncedTargets ?? []).some((t) => t.target === target)
		);
		if (candidates.length === 0) continue;

		const decryptedResponses = await decryptRecords('formResponses', candidates);
		const responses = decryptedResponses.map(toFormResponse);

		for (const r of responses) {
			scanned += 1;
			try {
				const result = await applyAutoSync(form, r);
				if (result.synced) synced += 1;
			} catch (err) {
				console.warn(`[forms-autosync] failed for response ${r.id}: ${(err as Error).message}`);
			}
		}
	}

	return { scanned, synced };
}
