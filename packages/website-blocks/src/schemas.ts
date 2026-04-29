/**
 * Pure-Zod schema aggregation — no Svelte components imported here.
 *
 * This side-channel lets tests + server-side validators pull every
 * block's Zod schema without triggering the .svelte imports that
 * `registry.ts` needs (which drag in Svelte runtime and trip up
 * plain node/bun vitest runners).
 *
 * Keep the two in lockstep: a new block goes into both.
 */

import { HeroSchema, HERO_DEFAULTS } from './hero/schema';
import { RichTextSchema, RICH_TEXT_DEFAULTS } from './richText/schema';
import { CtaSchema, CTA_DEFAULTS } from './cta/schema';
import { ImageSchema, IMAGE_DEFAULTS } from './image/schema';
import { GallerySchema, GALLERY_DEFAULTS } from './gallery/schema';
import { FaqSchema, FAQ_DEFAULTS } from './faq/schema';
import { FormSchema, FORM_DEFAULTS } from './form/schema';
import { FormEmbedSchema, FORM_EMBED_DEFAULTS } from './formEmbed/schema';
import { ModuleEmbedSchema, MODULE_EMBED_DEFAULTS } from './moduleEmbed/schema';
import { AnalyticsSchema, ANALYTICS_DEFAULTS } from './analytics/schema';
import { ColumnsSchema, COLUMNS_DEFAULTS } from './columns/schema';
import { SpacerSchema, SPACER_DEFAULTS } from './spacer/schema';
import type { ZodTypeAny } from 'zod';

export const BLOCK_SCHEMAS: Record<string, ZodTypeAny> = {
	hero: HeroSchema,
	richText: RichTextSchema,
	cta: CtaSchema,
	image: ImageSchema,
	gallery: GallerySchema,
	faq: FaqSchema,
	form: FormSchema,
	formEmbed: FormEmbedSchema,
	moduleEmbed: ModuleEmbedSchema,
	analytics: AnalyticsSchema,
	columns: ColumnsSchema,
	spacer: SpacerSchema,
};

export const BLOCK_DEFAULTS: Record<string, unknown> = {
	hero: HERO_DEFAULTS,
	richText: RICH_TEXT_DEFAULTS,
	cta: CTA_DEFAULTS,
	image: IMAGE_DEFAULTS,
	gallery: GALLERY_DEFAULTS,
	faq: FAQ_DEFAULTS,
	form: FORM_DEFAULTS,
	formEmbed: FORM_EMBED_DEFAULTS,
	moduleEmbed: MODULE_EMBED_DEFAULTS,
	analytics: ANALYTICS_DEFAULTS,
	columns: COLUMNS_DEFAULTS,
	spacer: SPACER_DEFAULTS,
};

export function safeValidateSchema(
	type: string,
	props: unknown
): { success: true; data: unknown } | { success: false; error: unknown } {
	const schema = BLOCK_SCHEMAS[type];
	if (!schema) return { success: false, error: new Error(`Unknown block type "${type}"`) };
	const parsed = schema.safeParse(props);
	if (parsed.success) return { success: true, data: parsed.data };
	return { success: false, error: parsed.error };
}
