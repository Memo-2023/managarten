/**
 * formEmbed resolver — client-side function that looks up the
 * referenced Mana Form by its unlisted-share-token and inlines the
 * public schema into `block.props.resolved` at publish time.
 *
 * Why client-side: the webapp owns both the website AND the forms;
 * decrypting the form's title/fields/branching needs the master key,
 * which only lives on the client. The resolver runs in the same
 * publish transaction as `resolveEmbed` for moduleEmbed blocks.
 *
 * Token-only lookup (no formId): the block stores just the share-
 * token, which is the canonical identity for a published+unlisted
 * form. Token rotation invalidates the embed — the resolver reports
 * a clear error and the public renderer falls back to its lazy fetch.
 *
 * Plan: docs/plans/forms-module.md M8.
 */

import { decryptRecords } from '$lib/data/crypto';
import { formTable } from '$lib/modules/forms/collections';
import { toForm } from '$lib/modules/forms/queries';
import type { FormEmbedProps } from '@mana/website-blocks';
import type { LocalForm } from '$lib/modules/forms/types';

export async function resolveFormEmbed(
	props: FormEmbedProps
): Promise<NonNullable<FormEmbedProps['resolved']>> {
	const now = new Date().toISOString();
	if (!props.token) {
		return {
			formTitle: '',
			formDescription: null,
			fields: [],
			branching: [],
			settings: { submitButtonLabel: 'Senden', successMessage: 'Danke!' },
			resolvedAt: now,
			error: 'Kein Token gesetzt',
		};
	}

	try {
		// Linear scan over the user's forms — typical count is small
		// (<100), Dexie has no index on unlistedToken. The publish
		// pipeline runs once per click, so this stays cheap.
		const all = (await formTable.toArray()).filter(
			(f) => !f.deletedAt && f.unlistedToken === props.token
		);
		if (all.length === 0) {
			return {
				formTitle: '',
				formDescription: null,
				fields: [],
				branching: [],
				settings: { submitButtonLabel: 'Senden', successMessage: 'Danke!' },
				resolvedAt: now,
				error: 'Formular zum Token nicht gefunden',
			};
		}
		const decrypted = (await decryptRecords('forms', all)) as LocalForm[];
		const form = toForm(decrypted[0]);

		if (form.status !== 'published') {
			return {
				formTitle: form.title,
				formDescription: form.description,
				fields: [],
				branching: [],
				settings: {
					submitButtonLabel: form.settings.submitButtonLabel,
					successMessage: form.settings.successMessage,
				},
				resolvedAt: now,
				error: 'Formular ist nicht veröffentlicht',
			};
		}

		return {
			formTitle: form.title,
			formDescription: form.description,
			fields: form.fields.map((f) => ({
				id: f.id,
				type: f.type,
				label: f.label,
				helpText: f.helpText,
				required: f.required,
				options: f.options,
				config: f.config,
			})),
			branching: form.branching.map((r) => ({
				id: r.id,
				ifFieldId: r.ifFieldId,
				ifOperator: r.ifOperator,
				ifValue: r.ifValue,
				thenAction: r.thenAction,
				thenFieldIds: r.thenFieldIds,
				thenSkipToFieldId: r.thenSkipToFieldId,
			})),
			settings: {
				submitButtonLabel: form.settings.submitButtonLabel,
				successMessage: form.settings.successMessage,
			},
			resolvedAt: now,
		};
	} catch (err) {
		return {
			formTitle: '',
			formDescription: null,
			fields: [],
			branching: [],
			settings: { submitButtonLabel: 'Senden', successMessage: 'Danke!' },
			resolvedAt: now,
			error: err instanceof Error ? err.message : String(err),
		};
	}
}
