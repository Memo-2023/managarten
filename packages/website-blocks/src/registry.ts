import type { BlockSpec } from './types';
import { heroBlockSpec } from './hero';
import { richTextBlockSpec } from './richText';
import { spacerBlockSpec } from './spacer';
import { imageBlockSpec } from './image';
import { ctaBlockSpec } from './cta';
import { faqBlockSpec } from './faq';
import { columnsBlockSpec } from './columns';
import { galleryBlockSpec } from './gallery';
import { formBlockSpec } from './form';
import { formEmbedBlockSpec } from './formEmbed';
import { moduleEmbedBlockSpec } from './moduleEmbed';
import { analyticsBlockSpec } from './analytics';

/**
 * The block registry — single source of truth for every block type the
 * website builder knows about. Editor insert palette, renderer, inspector,
 * schema validation, and future AI tools all consume this map.
 *
 * Adding a new block = create a folder under `src/{type}/`, export a
 * `BlockSpec` from its index, and list it here.
 */
export const BLOCK_SPECS: readonly BlockSpec<unknown>[] = [
	heroBlockSpec,
	richTextBlockSpec,
	ctaBlockSpec,
	imageBlockSpec,
	galleryBlockSpec,
	faqBlockSpec,
	formBlockSpec,
	formEmbedBlockSpec,
	moduleEmbedBlockSpec,
	analyticsBlockSpec,
	columnsBlockSpec,
	spacerBlockSpec,
] as unknown as readonly BlockSpec<unknown>[];

const BY_TYPE: Record<string, BlockSpec<unknown>> = (() => {
	const map: Record<string, BlockSpec<unknown>> = {};
	for (const spec of BLOCK_SPECS) {
		if (map[spec.type]) {
			throw new Error(`[website-blocks] duplicate block type "${spec.type}"`);
		}
		map[spec.type] = spec as BlockSpec<unknown>;
	}
	return map;
})();

export function getBlockSpec(type: string): BlockSpec<unknown> | undefined {
	return BY_TYPE[type];
}

export function requireBlockSpec(type: string): BlockSpec<unknown> {
	const spec = BY_TYPE[type];
	if (!spec) throw new Error(`[website-blocks] unknown block type "${type}"`);
	return spec;
}

export function getAllBlockSpecs(): readonly BlockSpec<unknown>[] {
	return BLOCK_SPECS;
}

/**
 * Validate props against a block type's schema. Returns the parsed props
 * (with defaults applied) on success, or throws with the Zod error.
 */
export function validateBlockProps(type: string, props: unknown): unknown {
	const spec = requireBlockSpec(type);
	return spec.schema.parse(props);
}

/**
 * Safe-validate: returns `{ success, data, error }` without throwing.
 * Used at boundaries (submit endpoint, snapshot builder) where we want
 * to collect all errors rather than fail on the first one.
 */
export function safeValidateBlockProps(
	type: string,
	props: unknown
): { success: true; data: unknown } | { success: false; error: unknown } {
	const spec = getBlockSpec(type);
	if (!spec) return { success: false, error: new Error(`Unknown block type "${type}"`) };
	const parsed = spec.schema.safeParse(props);
	if (parsed.success) return { success: true, data: parsed.data };
	return { success: false, error: parsed.error };
}
