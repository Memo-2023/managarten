import type { BlockSpec } from '../types';
import FormEmbed from './FormEmbed.svelte';
import FormEmbedInspector from './FormEmbedInspector.svelte';
import {
	FormEmbedSchema,
	FORM_EMBED_DEFAULTS,
	type FormEmbedProps,
	type FormEmbedField,
	type FormEmbedBranching,
} from './schema';

export const formEmbedBlockSpec: BlockSpec<FormEmbedProps> = {
	type: 'formEmbed',
	label: 'Mana-Formular',
	icon: 'clipboard',
	category: 'form',
	schema: FormEmbedSchema,
	schemaVersion: 1,
	defaults: FORM_EMBED_DEFAULTS,
	Component: FormEmbed,
	Inspector: FormEmbedInspector,
};

export type { FormEmbedProps, FormEmbedField, FormEmbedBranching };
export { FormEmbedSchema, FORM_EMBED_DEFAULTS };
