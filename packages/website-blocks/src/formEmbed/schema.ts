/**
 * formEmbed — embed an existing Mana Form by its share-token.
 *
 * Different from the inline `form` block: that one is a self-contained
 * fields list rendered from the block's own props. formEmbed REFERENCES
 * a Form created in the /forms module — so the same form can be reused
 * across multiple website pages, the response-inbox lives at
 * /forms/[id]/responses, and Mana features (branching, auto-sync to
 * contacts/events, AI tools) all apply.
 *
 * The block stores the unlisted-share-token (32 chars base64url). At
 * publish time, the resolver fetches the form schema via the public
 * unlisted endpoint and inlines it into `resolved` — the public
 * renderer reads `resolved` directly without an extra round-trip on
 * each visitor pageview.
 *
 * Plan: docs/plans/forms-module.md M8.
 */

import { z } from 'zod';

const TOKEN_REGEX = /^[A-Za-z0-9_-]{32}$/;

export const FormFieldEmbedSchema = z.object({
	id: z.string(),
	type: z.enum([
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
	]),
	label: z.string(),
	helpText: z.string().optional(),
	required: z.boolean().optional(),
	options: z.array(z.object({ id: z.string(), label: z.string() })).optional(),
	config: z
		.object({
			minLength: z.number().optional(),
			maxLength: z.number().optional(),
			min: z.number().optional(),
			max: z.number().optional(),
			ratingScale: z.union([z.literal(5), z.literal(10)]).optional(),
		})
		.optional(),
});

export const BranchingRuleEmbedSchema = z.object({
	id: z.string(),
	ifFieldId: z.string(),
	ifOperator: z.enum(['equals', 'not_equals', 'contains', 'is_empty']),
	ifValue: z.union([z.string(), z.array(z.string())]).optional(),
	thenAction: z.enum(['show', 'hide', 'skip_to']),
	thenFieldIds: z.array(z.string()).optional(),
	thenSkipToFieldId: z.string().optional(),
});

export const FormEmbedResolvedSchema = z.object({
	formTitle: z.string(),
	formDescription: z.string().nullable().optional(),
	fields: z.array(FormFieldEmbedSchema),
	branching: z.array(BranchingRuleEmbedSchema).default([]),
	settings: z
		.object({
			submitButtonLabel: z.string().default('Senden'),
			successMessage: z.string().default('Danke! Deine Antwort wurde übermittelt.'),
		})
		.default({ submitButtonLabel: 'Senden', successMessage: 'Danke!' }),
	resolvedAt: z.string().optional(),
	error: z.string().optional(),
});

export const FormEmbedSchema = z.object({
	/** Mana Forms unlisted-share-token. Required to identify the form. */
	token: z
		.string()
		.regex(TOKEN_REGEX, 'Token muss 32 Zeichen base64url sein')
		.or(z.string().length(0)),
	/** Optional override of the form's title in the website rendering. */
	titleOverride: z.string().max(160).default(''),
	/**
	 * Filled at publish time. Public renderer reads this directly so a
	 * visitor pageview doesn't trigger a fetch on the unlisted endpoint
	 * for every form on every page.
	 */
	resolved: FormEmbedResolvedSchema.optional(),
});

export type FormEmbedProps = z.infer<typeof FormEmbedSchema>;
export type FormEmbedField = z.infer<typeof FormFieldEmbedSchema>;
export type FormEmbedBranching = z.infer<typeof BranchingRuleEmbedSchema>;

export const FORM_EMBED_DEFAULTS: FormEmbedProps = {
	token: '',
	titleOverride: '',
};
