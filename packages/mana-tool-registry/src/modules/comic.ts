/**
 * Comic — tools for agents to browse a user's comic stories and drive
 * the panel-generation pipeline. Four tools:
 *
 *   - comic.listStories    (read)   — what stories exist, filter by
 *                                     style / favorite
 *   - comic.createStory    (write)  — start a new story (empty, panels
 *                                     added later via generatePanel)
 *   - comic.generatePanel  (write)  — render + append a panel to a
 *                                     story; wraps picture/generate-
 *                                     with-reference with the story's
 *                                     fixed character refs + style
 *                                     prefix, consumes credits
 *   - comic.reorderPanels  (write)  — rewrite the reading order of an
 *                                     existing story
 *
 * Space scope: stories live in the active space. Character references
 * (meImages face-ref) are likewise space-scoped after v40. Every tool
 * filters `row.spaceId === ctx.spaceId` client-side mirroring the
 * webapp's scopedForModule behaviour.
 *
 * Why generatePanel writes the story update server-side:
 *   A comic panel's value is its position inside a story — leaving
 *   the panel orphan loses the story linkage and defeats the tool's
 *   purpose. So we pull the story row, decrypt panelMeta, append,
 *   re-encrypt, and push a field-level update back. A user with the
 *   webapp open will see the new panel via liveQuery within one sync
 *   tick.
 *
 * Plan: docs/plans/comic-module.md M5.
 */

import { z } from 'zod';
import { decryptRecordFields, encryptRecordFields } from '@mana/shared-crypto';
import { pullAll, push, pushInsert } from '../sync-client.ts';
import { registerTool } from '../registry.ts';
import type { ToolContext, ToolSpec } from '../types.ts';

const STORIES_APP_ID = 'comic';
const STORIES_TABLE = 'comicStories';
const STORY_ENCRYPTED_FIELDS = [
	'title',
	'description',
	'storyContext',
	'tags',
	'panelMeta',
] as const;

const SYNC_URL = () => process.env.MANA_SYNC_URL ?? 'http://localhost:3050';
const PICTURE_API_URL = () => process.env.MANA_API_URL ?? 'http://localhost:3060';
const CLIENT_ID = () => process.env.MANA_MCP_CLIENT_ID ?? 'mana-mcp';

function syncCfg(ctx: ToolContext) {
	return { baseUrl: SYNC_URL(), jwt: ctx.jwt, clientId: CLIENT_ID() };
}

// ─── Domain shapes (zod) ──────────────────────────────────────────

const comicStyle = z.enum(['comic', 'manga', 'cartoon', 'graphic-novel', 'webtoon']);
type ComicStyleT = z.infer<typeof comicStyle>;

const STYLE_PREFIXES: Record<ComicStyleT, string> = {
	comic:
		'US comic book illustration, bold clean linework, vivid cell-shaded coloring, dramatic lighting, high contrast, comic-panel framing',
	manga:
		'Japanese manga illustration, black and white line art with screen tones, dynamic perspective, expressive character design, dramatic motion lines',
	cartoon:
		'soft pastel cartoon illustration, rounded friendly shapes, warm saturated colors, Saturday-morning animation style, simple clean backgrounds',
	'graphic-novel':
		'graphic novel illustration, painterly watercolor style, muted atmospheric palette, cinematic composition, moody naturalistic lighting',
	webtoon:
		'modern webtoon illustration, clean vertical-scroll framing, bright saturated colors, soft cel-shading, expressive character close-ups',
};

interface PanelMeta {
	caption?: string;
	dialogue?: string;
	promptUsed?: string;
	sourceInput?: {
		module: 'journal' | 'notes' | 'library' | 'writing' | 'calendar';
		entryId: string;
	};
}

const storySchema = z.object({
	id: z.string(),
	title: z.string(),
	description: z.string().nullable(),
	style: comicStyle,
	characterMediaIds: z.array(z.string()),
	panelImageIds: z.array(z.string()),
	panelCount: z.number().int().nonnegative(),
	tags: z.array(z.string()),
	isFavorite: z.boolean(),
	storyContext: z.string().nullable(),
});

interface RawStoryRow {
	id?: string;
	title?: string;
	description?: string | null;
	style?: string;
	characterMediaIds?: string[];
	storyContext?: string | null;
	panelImageIds?: string[];
	panelMeta?: Record<string, PanelMeta>;
	tags?: string[];
	isFavorite?: boolean;
	isArchived?: boolean;
	deletedAt?: string | null;
	spaceId?: string | null;
	updatedAt?: string;
}

function composePanelPrompt(
	style: ComicStyleT,
	panelPrompt: string,
	caption?: string,
	dialogue?: string
): string {
	const parts: string[] = [STYLE_PREFIXES[style], panelPrompt.trim()];
	if (caption?.trim()) parts.push(`narration caption at the top reading: "${caption.trim()}"`);
	if (dialogue?.trim())
		parts.push(`character speaking in a speech bubble saying: "${dialogue.trim()}"`);
	return parts.join('. ');
}

// ─── comic.listStories ────────────────────────────────────────────

const listStoriesInput = z.object({
	style: comicStyle.optional(),
	favoriteOnly: z.boolean().default(false),
	limit: z.number().int().positive().max(200).default(50),
});

const listStoriesOutput = z.object({
	stories: z.array(storySchema),
});

export const comicListStories: ToolSpec<typeof listStoriesInput, typeof listStoriesOutput> = {
	name: 'comic.listStories',
	module: 'comic',
	scope: 'user-space',
	policyHint: 'read',
	description:
		"List the caller's comic stories in the active space. Filter by `style` and/or `favoriteOnly`. Returned rows include panelCount (for quick progress overviews) but NOT panelMeta — use the ids in `panelImageIds` to fetch individual panel images from picture.images if needed.",
	input: listStoriesInput,
	output: listStoriesOutput,
	encryptedFields: { table: STORIES_TABLE, fields: [...STORY_ENCRYPTED_FIELDS] },
	async handler(input, ctx) {
		const key = await ctx.getMasterKey();
		const res = await pullAll<RawStoryRow>(syncCfg(ctx), STORIES_APP_ID, STORIES_TABLE);
		const alive = res.changes
			.filter((c) => c.op !== 'delete' && c.data)
			.map((c) => c.data as RawStoryRow)
			.filter((row) => !row.deletedAt && !row.isArchived)
			.filter((row) => row.spaceId === ctx.spaceId);

		const decrypted = (await Promise.all(
			alive.map((row) =>
				decryptRecordFields(row as unknown as Record<string, unknown>, STORY_ENCRYPTED_FIELDS, key)
			)
		)) as unknown as RawStoryRow[];

		const filtered = decrypted
			.filter((row): row is RawStoryRow & { id: string; title: string; style: string } =>
				Boolean(row.id && row.title && row.style)
			)
			.filter((row) => !input.style || row.style === input.style)
			.filter((row) => !input.favoriteOnly || row.isFavorite === true)
			.slice(0, input.limit);

		const stories = filtered.map((row) => ({
			id: row.id,
			title: row.title,
			description: row.description ?? null,
			style: row.style as ComicStyleT,
			characterMediaIds: row.characterMediaIds ?? [],
			panelImageIds: row.panelImageIds ?? [],
			panelCount: (row.panelImageIds ?? []).length,
			tags: row.tags ?? [],
			isFavorite: row.isFavorite === true,
			storyContext: row.storyContext ?? null,
		}));

		ctx.logger.info('comic.listStories', {
			count: stories.length,
			style: input.style ?? 'all',
			favoriteOnly: input.favoriteOnly,
		});

		return { stories };
	},
};

// ─── comic.createStory ────────────────────────────────────────────

const createStoryInput = z.object({
	title: z.string().min(1).max(200),
	style: comicStyle,
	/** mediaIds of reference images (face-ref first, optional body-ref).
	 *  Must belong to app `me` — validated server-side by the picture
	 *  endpoint on the first generatePanel call. Cap 8 (server
	 *  MAX_REFERENCE_IMAGES). */
	characterMediaIds: z.array(z.string()).min(1).max(8),
	description: z.string().max(2000).nullable().default(null),
	storyContext: z.string().max(2000).nullable().default(null),
	tags: z.array(z.string()).max(20).default([]),
});

const createStoryOutput = z.object({
	story: storySchema,
});

export const comicCreateStory: ToolSpec<typeof createStoryInput, typeof createStoryOutput> = {
	name: 'comic.createStory',
	module: 'comic',
	scope: 'user-space',
	policyHint: 'write',
	description:
		'Start a new comic story in the active space. The style and character references are fixed once written — every future `generatePanel` call against this story uses the same refs + style-prefix. Start with 1–8 `characterMediaIds` (face-ref at index 0, body-ref optional). Returns the empty story; add panels via `comic.generatePanel`.',
	input: createStoryInput,
	output: createStoryOutput,
	encryptedFields: { table: STORIES_TABLE, fields: [...STORY_ENCRYPTED_FIELDS] },
	async handler(input, ctx) {
		const key = await ctx.getMasterKey();
		const id = crypto.randomUUID();
		const plaintext: Record<string, unknown> = {
			id,
			title: input.title,
			description: input.description,
			style: input.style,
			characterMediaIds: input.characterMediaIds,
			storyContext: input.storyContext,
			panelImageIds: [],
			panelMeta: {},
			tags: input.tags,
			isFavorite: false,
		};

		const encrypted = await encryptRecordFields(plaintext, STORY_ENCRYPTED_FIELDS, key);

		await pushInsert(syncCfg(ctx), STORIES_APP_ID, {
			table: STORIES_TABLE,
			id,
			spaceId: ctx.spaceId,
			data: encrypted,
		});

		ctx.logger.info('comic.createStory', {
			storyId: id,
			style: input.style,
			refs: input.characterMediaIds.length,
		});

		return {
			story: {
				id,
				title: input.title,
				description: input.description,
				style: input.style,
				characterMediaIds: input.characterMediaIds,
				panelImageIds: [],
				panelCount: 0,
				tags: input.tags,
				isFavorite: false,
				storyContext: input.storyContext,
			},
		};
	},
};

// ─── comic.generatePanel ──────────────────────────────────────────

const generatePanelInput = z.object({
	storyId: z.string(),
	panelPrompt: z.string().min(1).max(800),
	caption: z.string().max(200).optional(),
	dialogue: z.string().max(200).optional(),
	quality: z.enum(['low', 'medium', 'high']).default('medium'),
	/** 1024×1024 square is the default; pass `1024x1536` for vertical
	 *  framings (e.g. webtoon tall panels). */
	size: z.enum(['1024x1024', '1024x1536']).optional(),
	/** Rendering backend. Same closed set as Wardrobe's Try-On picker:
	 *  - `openai/gpt-image-2` (default) — mid-tier cost, strong
	 *    structure, server-side fallback to gpt-image-1 if org is
	 *    unverified.
	 *  - `google/gemini-3-pro-image-preview` — Nano Banana Pro, strong
	 *    character consistency, higher cost.
	 *  - `google/gemini-3.1-flash-image-preview` — Nano Banana 2,
	 *    newest + fast + cheap. */
	model: z
		.enum([
			'openai/gpt-image-2',
			'google/gemini-3-pro-image-preview',
			'google/gemini-3.1-flash-image-preview',
		])
		.default('openai/gpt-image-2'),
});

const generatePanelOutput = z.object({
	imageUrl: z.string(),
	mediaId: z.string(),
	prompt: z.string(),
	model: z.string(),
	panelIndex: z.number().int().nonnegative(),
	referenceMediaIds: z.array(z.string()),
});

export const comicGeneratePanel: ToolSpec<typeof generatePanelInput, typeof generatePanelOutput> = {
	name: 'comic.generatePanel',
	module: 'comic',
	// `write` rather than `destructive`: the result is additive (a new
	// picture.images row + an appended entry in the story's panelImageIds).
	// No existing data is overwritten.
	scope: 'user-space',
	policyHint: 'write',
	description:
		"Render and append a new panel to an existing comic story using OpenAI gpt-image-2. The story's style prefix + character references are applied automatically — just pass the panel-specific `panelPrompt` (what happens in the panel) plus optional `caption`/`dialogue` strings which get rendered directly into the image. Consumes credits at the standard picture-generate tarif (medium = 10). The panel is persisted back into the story's `panelImageIds` + `panelMeta` so the web app shows it immediately.",
	input: generatePanelInput,
	output: generatePanelOutput,
	encryptedFields: { table: STORIES_TABLE, fields: [...STORY_ENCRYPTED_FIELDS] },
	async handler(input, ctx) {
		const key = await ctx.getMasterKey();

		// 1. Fetch + decrypt the target story.
		const storiesRes = await pullAll<RawStoryRow>(syncCfg(ctx), STORIES_APP_ID, STORIES_TABLE);
		const raw = storiesRes.changes
			.filter((c) => c.op !== 'delete' && c.data)
			.map((c) => c.data as RawStoryRow)
			.find(
				(row) =>
					row.id === input.storyId &&
					!row.deletedAt &&
					!row.isArchived &&
					row.spaceId === ctx.spaceId
			);
		if (!raw) {
			throw new Error(`Comic story ${input.storyId} not found in the active space`);
		}
		const story = (await decryptRecordFields(
			raw as unknown as Record<string, unknown>,
			STORY_ENCRYPTED_FIELDS,
			key
		)) as unknown as RawStoryRow;

		const style = story.style as ComicStyleT | undefined;
		if (!style || !(style in STYLE_PREFIXES)) {
			throw new Error(`Story has invalid style "${story.style}"`);
		}
		const refs = story.characterMediaIds ?? [];
		if (refs.length === 0) {
			throw new Error('Story has no character references — cannot render a panel');
		}

		// 2. Compose prompt + call /picture/generate-with-reference.
		const composed = composePanelPrompt(style, input.panelPrompt, input.caption, input.dialogue);
		const effectiveSize = input.size ?? (style === 'webtoon' ? '1024x1536' : '1024x1024');
		const referenceMediaIds = refs.slice(0, 8);

		const res = await fetch(`${PICTURE_API_URL()}/api/v1/picture/generate-with-reference`, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				authorization: `Bearer ${ctx.jwt}`,
			},
			body: JSON.stringify({
				prompt: composed,
				referenceMediaIds,
				model: input.model,
				quality: input.quality,
				size: effectiveSize,
				n: 1,
			}),
		});

		if (!res.ok) {
			const text = await res.text().catch(() => '<unreadable body>');
			throw new Error(
				`picture.generate-with-reference failed: ${res.status} ${res.statusText} — ${text.slice(0, 500)}`
			);
		}

		const data = (await res.json()) as {
			images?: Array<{ imageUrl: string; mediaId?: string }>;
			imageUrl?: string;
			mediaId?: string;
			prompt: string;
			model: string;
		};
		const first =
			(data.images && data.images[0]) ??
			(data.imageUrl ? { imageUrl: data.imageUrl, mediaId: data.mediaId } : null);
		if (!first?.imageUrl || !first.mediaId) {
			throw new Error('picture endpoint returned no image');
		}

		// 3. Persist the panel into picture.images so the web-app gallery
		// shows it alongside other generated images. Uses the same
		// plaintext-only upload channel mana-sync accepts (picture.images
		// prompt/negativePrompt are encrypted client-side; MCP path here
		// pushes plaintext prompts — NOT writing
		// picture.images at all, but we go one step further because the
		// story needs the panel linkage).
		const panelImageId = crypto.randomUUID();
		const panelIndex = (story.panelImageIds ?? []).length;
		const nowIso = new Date().toISOString();

		await pushInsert(syncCfg(ctx), 'picture', {
			table: 'images',
			id: panelImageId,
			spaceId: ctx.spaceId,
			data: {
				id: panelImageId,
				prompt: data.prompt, // encrypted field — leaves plaintext for now
				negativePrompt: null,
				model: data.model,
				publicUrl: first.imageUrl,
				storagePath: first.mediaId,
				filename: `comic-panel-${input.storyId}-${panelIndex + 1}.png`,
				format: 'png',
				width: effectiveSize === '1024x1536' ? 1024 : 1024,
				height: effectiveSize === '1024x1536' ? 1536 : 1024,
				visibility: 'private',
				isFavorite: false,
				downloadCount: 0,
				generationMode: 'reference',
				referenceImageIds: referenceMediaIds,
				comicStoryId: input.storyId,
				comicPanelIndex: panelIndex,
				createdAt: nowIso,
				updatedAt: nowIso,
			},
		});

		// 4. Append the panel to the story: decrypt panelMeta, mutate,
		// re-encrypt as a whole, push a field-level LWW update so we
		// only rewrite the two fields that changed (not the whole row).
		const existingMeta = (story.panelMeta ?? {}) as Record<string, PanelMeta>;
		const newMeta: PanelMeta = {
			caption: input.caption?.trim() || undefined,
			dialogue: input.dialogue?.trim() || undefined,
			promptUsed: composed,
		};
		const nextIds = [...(story.panelImageIds ?? []), panelImageId];
		const nextMeta = { ...existingMeta, [panelImageId]: newMeta };

		const encryptedPatch = await encryptRecordFields(
			{ panelMeta: nextMeta } as Record<string, unknown>,
			['panelMeta'] as const,
			key
		);

		await push(syncCfg(ctx), STORIES_APP_ID, [
			{
				table: STORIES_TABLE,
				id: input.storyId,
				op: 'update',
				spaceId: ctx.spaceId,
				fields: {
					panelImageIds: { value: nextIds, updatedAt: nowIso },
					panelMeta: {
						value: (encryptedPatch as Record<string, unknown>).panelMeta,
						updatedAt: nowIso,
					},
					updatedAt: { value: nowIso, updatedAt: nowIso },
				},
			},
		]);

		ctx.logger.info('comic.generatePanel', {
			storyId: input.storyId,
			panelIndex,
			refs: referenceMediaIds.length,
			quality: input.quality,
		});

		return {
			imageUrl: first.imageUrl,
			mediaId: first.mediaId,
			prompt: data.prompt,
			model: data.model,
			panelIndex,
			referenceMediaIds,
		};
	},
};

// ─── comic.reorderPanels ──────────────────────────────────────────

const reorderPanelsInput = z.object({
	storyId: z.string(),
	/** New reading order. Must be a permutation of the current
	 *  `panelImageIds` — adding or removing ids is rejected so the tool
	 *  stays purely reorder (add via generatePanel, remove is a separate
	 *  concern not exposed via MCP yet). */
	panelImageIds: z.array(z.string()).min(1),
});

const reorderPanelsOutput = z.object({
	storyId: z.string(),
	panelImageIds: z.array(z.string()),
});

export const comicReorderPanels: ToolSpec<typeof reorderPanelsInput, typeof reorderPanelsOutput> = {
	name: 'comic.reorderPanels',
	module: 'comic',
	scope: 'user-space',
	policyHint: 'write',
	description:
		"Change the reading order of an existing comic story's panels. `panelImageIds` must be a permutation of the story's current ids — adding or removing panels is rejected (use `comic.generatePanel` to add, and the web UI to remove from the story). Pure reorder, no new image rendering, no credits consumed.",
	input: reorderPanelsInput,
	output: reorderPanelsOutput,
	async handler(input, ctx) {
		const key = await ctx.getMasterKey();

		const storiesRes = await pullAll<RawStoryRow>(syncCfg(ctx), STORIES_APP_ID, STORIES_TABLE);
		const raw = storiesRes.changes
			.filter((c) => c.op !== 'delete' && c.data)
			.map((c) => c.data as RawStoryRow)
			.find((row) => row.id === input.storyId && !row.deletedAt && row.spaceId === ctx.spaceId);
		if (!raw) {
			throw new Error(`Comic story ${input.storyId} not found in the active space`);
		}

		// panelImageIds is plaintext — no decrypt needed for the set-
		// equality check. Still need the key if we later want to touch
		// encrypted fields; here we only update one plaintext array.
		void key;

		const current = new Set(raw.panelImageIds ?? []);
		const next = new Set(input.panelImageIds);
		if (current.size !== next.size) {
			throw new Error(
				`reorder rejected: expected ${current.size} panelImageIds, got ${input.panelImageIds.length}`
			);
		}
		for (const id of current) {
			if (!next.has(id)) {
				throw new Error(`reorder rejected: panel ${id} missing from new order`);
			}
		}

		const nowIso = new Date().toISOString();
		await push(syncCfg(ctx), STORIES_APP_ID, [
			{
				table: STORIES_TABLE,
				id: input.storyId,
				op: 'update',
				spaceId: ctx.spaceId,
				fields: {
					panelImageIds: { value: input.panelImageIds, updatedAt: nowIso },
					updatedAt: { value: nowIso, updatedAt: nowIso },
				},
			},
		]);

		ctx.logger.info('comic.reorderPanels', {
			storyId: input.storyId,
			count: input.panelImageIds.length,
		});

		return {
			storyId: input.storyId,
			panelImageIds: input.panelImageIds,
		};
	},
};

// ═══════════════════════════════════════════════════════════════
//  COMIC-CHARACTERS (Mc4)
// ═══════════════════════════════════════════════════════════════
//
// Stylised character variants the user iterates BEFORE building a
// story (face-ref → manga / cartoon / etc.) — see
// docs/plans/comic-module.md §11. Same crypto envelope as stories
// (name + description + addPrompt + tags encrypted; ids + style +
// variant-list + booleans plaintext).
//
// Three of the four tools land in the picture pipeline:
//   - listCharacters: read-only (no credit cost)
//   - createCharacter: row-only (no credit cost). Splits creation
//     from generation so an agent can review the pinned-variant flow
//     before burning credits.
//   - generateVariant: fires `/picture/generate-with-reference` with
//     n=1..4 (server cap) under the user's JWT, persists each output
//     as a picture.images row + appends to the character's variant
//     list. Auto-pins the first variant if none pinned yet (mirrors
//     comicCharactersStore.appendVariant on the web side).
//   - pinVariant: row update only.

const CHARACTERS_TABLE = 'comicCharacters';
const CHARACTER_ENCRYPTED_FIELDS = ['name', 'description', 'addPrompt', 'tags'] as const;

const characterSchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string().nullable(),
	style: comicStyle,
	addPrompt: z.string().nullable(),
	sourceFaceMediaId: z.string(),
	sourceBodyMediaId: z.string().nullable(),
	variantMediaIds: z.array(z.string()),
	pinnedVariantId: z.string().nullable(),
	variantCount: z.number().int().nonnegative(),
	tags: z.array(z.string()),
	isFavorite: z.boolean(),
});

interface RawCharacterRow {
	id?: string;
	name?: string;
	description?: string | null;
	style?: string;
	addPrompt?: string | null;
	sourceFaceMediaId?: string;
	sourceBodyMediaId?: string | null;
	variantMediaIds?: string[];
	pinnedVariantId?: string | null;
	tags?: string[];
	isFavorite?: boolean;
	isArchived?: boolean;
	deletedAt?: string | null;
	spaceId?: string | null;
	updatedAt?: string;
}

function characterStylePrefix(style: ComicStyleT): string {
	return STYLE_PREFIXES[style];
}

function composeCharacterPrompt(style: ComicStyleT, addPrompt: string | null | undefined): string {
	const parts: string[] = [
		characterStylePrefix(style),
		'portrait of the user',
		'looking natural, head and shoulders visible',
		'neutral background, clear identity anchor — same face, same eyes, recognisable across panels',
	];
	const trimmed = addPrompt?.trim();
	if (trimmed) parts.push(trimmed);
	return parts.join('. ');
}

// ─── comic.listCharacters ─────────────────────────────────────────

const listCharactersInput = z.object({
	style: comicStyle.optional(),
	favoriteOnly: z.boolean().default(false),
	limit: z.number().int().positive().max(200).default(50),
});

const listCharactersOutput = z.object({
	characters: z.array(characterSchema),
});

export const comicListCharacters: ToolSpec<
	typeof listCharactersInput,
	typeof listCharactersOutput
> = {
	name: 'comic.listCharacters',
	module: 'comic',
	scope: 'user-space',
	policyHint: 'read',
	description:
		"List the caller's comic-characters in the active space. Filter by `style` and/or `favoriteOnly`. Returned rows include `pinnedVariantId` (the canonical look — null if no variant pinned yet) and `variantCount` for quick state-overview without loading the full variantMediaIds array.",
	input: listCharactersInput,
	output: listCharactersOutput,
	encryptedFields: { table: CHARACTERS_TABLE, fields: [...CHARACTER_ENCRYPTED_FIELDS] },
	async handler(input, ctx) {
		const key = await ctx.getMasterKey();
		const res = await pullAll<RawCharacterRow>(syncCfg(ctx), STORIES_APP_ID, CHARACTERS_TABLE);
		const alive = res.changes
			.filter((c) => c.op !== 'delete' && c.data)
			.map((c) => c.data as RawCharacterRow)
			.filter((row) => !row.deletedAt && !row.isArchived)
			.filter((row) => row.spaceId === ctx.spaceId);

		const decrypted = (await Promise.all(
			alive.map((row) =>
				decryptRecordFields(
					row as unknown as Record<string, unknown>,
					CHARACTER_ENCRYPTED_FIELDS,
					key
				)
			)
		)) as unknown as RawCharacterRow[];

		const filtered = decrypted
			.filter((row): row is RawCharacterRow & { id: string; name: string; style: string } =>
				Boolean(row.id && row.name && row.style)
			)
			.filter((row) => !input.style || row.style === input.style)
			.filter((row) => !input.favoriteOnly || row.isFavorite === true)
			.slice(0, input.limit);

		const characters = filtered.map((row) => ({
			id: row.id,
			name: row.name,
			description: row.description ?? null,
			style: row.style as ComicStyleT,
			addPrompt: row.addPrompt ?? null,
			sourceFaceMediaId: row.sourceFaceMediaId ?? '',
			sourceBodyMediaId: row.sourceBodyMediaId ?? null,
			variantMediaIds: row.variantMediaIds ?? [],
			pinnedVariantId: row.pinnedVariantId ?? null,
			variantCount: (row.variantMediaIds ?? []).length,
			tags: row.tags ?? [],
			isFavorite: row.isFavorite === true,
		}));

		ctx.logger.info('comic.listCharacters', {
			count: characters.length,
			style: input.style ?? 'all',
			favoriteOnly: input.favoriteOnly,
		});

		return { characters };
	},
};

// ─── comic.createCharacter ────────────────────────────────────────

const createCharacterInput = z.object({
	name: z.string().min(1).max(200),
	style: comicStyle,
	sourceFaceMediaId: z.string(),
	sourceBodyMediaId: z.string().nullable().default(null),
	addPrompt: z.string().max(500).nullable().default(null),
	description: z.string().max(2000).nullable().default(null),
	tags: z.array(z.string()).max(20).default([]),
});

const createCharacterOutput = z.object({
	character: characterSchema,
});

export const comicCreateCharacter: ToolSpec<
	typeof createCharacterInput,
	typeof createCharacterOutput
> = {
	name: 'comic.createCharacter',
	module: 'comic',
	scope: 'user-space',
	policyHint: 'write',
	description:
		'Create a fresh comic-character row WITHOUT generating any variants yet. Splits creation from rendering so the user can review name/style/source pick before any credits are spent. Use `comic.generateVariant` afterwards (typically n=4) to populate the variant pool. The first generated variant auto-pins; user re-pins via `comic.pinVariant`. Source mediaIds must reference rows owned by the caller in app `me` (face/body).',
	input: createCharacterInput,
	output: createCharacterOutput,
	encryptedFields: { table: CHARACTERS_TABLE, fields: [...CHARACTER_ENCRYPTED_FIELDS] },
	async handler(input, ctx) {
		const key = await ctx.getMasterKey();
		const id = crypto.randomUUID();
		const plaintext: Record<string, unknown> = {
			id,
			name: input.name,
			description: input.description,
			style: input.style,
			addPrompt: input.addPrompt,
			sourceFaceMediaId: input.sourceFaceMediaId,
			sourceBodyMediaId: input.sourceBodyMediaId,
			variantMediaIds: [],
			pinnedVariantId: null,
			tags: input.tags,
			isFavorite: false,
		};

		const encrypted = await encryptRecordFields(plaintext, CHARACTER_ENCRYPTED_FIELDS, key);

		await pushInsert(syncCfg(ctx), STORIES_APP_ID, {
			table: CHARACTERS_TABLE,
			id,
			spaceId: ctx.spaceId,
			data: encrypted,
		});

		ctx.logger.info('comic.createCharacter', {
			characterId: id,
			style: input.style,
			hasBodyRef: input.sourceBodyMediaId !== null,
		});

		return {
			character: {
				id,
				name: input.name,
				description: input.description,
				style: input.style,
				addPrompt: input.addPrompt,
				sourceFaceMediaId: input.sourceFaceMediaId,
				sourceBodyMediaId: input.sourceBodyMediaId,
				variantMediaIds: [],
				pinnedVariantId: null,
				variantCount: 0,
				tags: input.tags,
				isFavorite: false,
			},
		};
	},
};

// ─── comic.generateVariant ────────────────────────────────────────

const generateVariantInput = z.object({
	characterId: z.string(),
	count: z.number().int().min(1).max(4).default(4),
	quality: z.enum(['low', 'medium', 'high']).default('medium'),
	size: z.enum(['1024x1024', '1024x1536']).default('1024x1024'),
	model: z
		.enum([
			'openai/gpt-image-2',
			'google/gemini-3-pro-image-preview',
			'google/gemini-3.1-flash-image-preview',
		])
		.default('openai/gpt-image-2'),
});

const generateVariantOutput = z.object({
	characterId: z.string(),
	newVariantMediaIds: z.array(z.string()),
	imageUrls: z.array(z.string()),
	pinnedVariantId: z.string().nullable(),
});

export const comicGenerateVariant: ToolSpec<
	typeof generateVariantInput,
	typeof generateVariantOutput
> = {
	name: 'comic.generateVariant',
	module: 'comic',
	scope: 'user-space',
	policyHint: 'write',
	description:
		"Render N stylised portrait variants for an existing comic-character and append them to its variant pool. Wraps `/picture/generate-with-reference` with the character's source-face/body refs + style-prefix + identity-anchor instructions. Consumes credits at the standard picture-generate tarif × count (medium quality default = 10 credits per variant). Auto-pins the first variant if no variant was pinned before this call. Use `comic.pinVariant` afterwards if the user picks a different one.",
	input: generateVariantInput,
	output: generateVariantOutput,
	encryptedFields: { table: CHARACTERS_TABLE, fields: [...CHARACTER_ENCRYPTED_FIELDS] },
	async handler(input, ctx) {
		const key = await ctx.getMasterKey();

		// 1. Fetch + decrypt the target character.
		const charsRes = await pullAll<RawCharacterRow>(syncCfg(ctx), STORIES_APP_ID, CHARACTERS_TABLE);
		const raw = charsRes.changes
			.filter((c) => c.op !== 'delete' && c.data)
			.map((c) => c.data as RawCharacterRow)
			.find(
				(row) =>
					row.id === input.characterId &&
					!row.deletedAt &&
					!row.isArchived &&
					row.spaceId === ctx.spaceId
			);
		if (!raw) {
			throw new Error(`Comic-Character ${input.characterId} not found in the active space`);
		}
		const character = (await decryptRecordFields(
			raw as unknown as Record<string, unknown>,
			CHARACTER_ENCRYPTED_FIELDS,
			key
		)) as unknown as RawCharacterRow;

		const style = character.style as ComicStyleT | undefined;
		if (!style || !(style in STYLE_PREFIXES)) {
			throw new Error(`Character has invalid style "${character.style}"`);
		}
		if (!character.sourceFaceMediaId) {
			throw new Error('Character has no sourceFaceMediaId — cannot render variants');
		}

		// 2. Compose prompt + call the picture endpoint with n=count.
		const composed = composeCharacterPrompt(style, character.addPrompt);
		const referenceMediaIds: string[] = [character.sourceFaceMediaId];
		if (character.sourceBodyMediaId) {
			referenceMediaIds.push(character.sourceBodyMediaId);
		}

		const res = await fetch(`${PICTURE_API_URL()}/api/v1/picture/generate-with-reference`, {
			method: 'POST',
			headers: {
				'content-type': 'application/json',
				authorization: `Bearer ${ctx.jwt}`,
			},
			body: JSON.stringify({
				prompt: composed,
				referenceMediaIds,
				model: input.model,
				quality: input.quality,
				size: input.size,
				n: input.count,
			}),
		});

		if (!res.ok) {
			const text = await res.text().catch(() => '<unreadable body>');
			throw new Error(
				`picture.generate-with-reference failed: ${res.status} ${res.statusText} — ${text.slice(0, 500)}`
			);
		}

		const data = (await res.json()) as {
			images?: Array<{ imageUrl: string; mediaId?: string }>;
			imageUrl?: string;
			mediaId?: string;
			prompt: string;
			model: string;
		};
		const items =
			data.images && data.images.length > 0
				? data.images
				: data.imageUrl
					? [{ imageUrl: data.imageUrl, mediaId: data.mediaId }]
					: [];
		if (items.length === 0) {
			throw new Error('picture endpoint returned no images');
		}

		// 3. Persist each variant as a picture.images row + append to
		// the character's variant list. Field-level update on the
		// character: only variantMediaIds + pinnedVariantId (if it
		// flips from null to first new variant) + updatedAt.
		const newVariantMediaIds: string[] = [];
		const imageUrls: string[] = [];
		const sizeDims = input.size === '1024x1536' ? { w: 1024, h: 1536 } : { w: 1024, h: 1024 };
		const startIndex = (character.variantMediaIds ?? []).length;

		for (let i = 0; i < items.length; i++) {
			const item = items[i];
			if (!item.imageUrl || !item.mediaId) continue;
			const variantImageId = crypto.randomUUID();
			const nowIso = new Date().toISOString();

			await pushInsert(syncCfg(ctx), 'picture', {
				table: 'images',
				id: variantImageId,
				spaceId: ctx.spaceId,
				data: {
					id: variantImageId,
					prompt: data.prompt,
					negativePrompt: null,
					model: data.model,
					publicUrl: item.imageUrl,
					storagePath: item.mediaId,
					filename: `comic-character-${input.characterId}-${startIndex + i + 1}.png`,
					format: 'png',
					width: sizeDims.w,
					height: sizeDims.h,
					visibility: 'private',
					isFavorite: false,
					downloadCount: 0,
					generationMode: 'reference',
					referenceImageIds: referenceMediaIds,
					comicCharacterId: input.characterId,
					createdAt: nowIso,
					updatedAt: nowIso,
				},
			});

			newVariantMediaIds.push(variantImageId);
			imageUrls.push(item.imageUrl);
		}

		// 4. Update the character row: variantMediaIds appended, pin
		// the first new variant if no pin existed yet (web-side
		// appendVariant has the same auto-pin fallback).
		const nextIds = [...(character.variantMediaIds ?? []), ...newVariantMediaIds];
		const nextPinnedId = character.pinnedVariantId ?? newVariantMediaIds[0] ?? null;
		const nowIso = new Date().toISOString();

		await push(syncCfg(ctx), STORIES_APP_ID, [
			{
				table: CHARACTERS_TABLE,
				id: input.characterId,
				op: 'update',
				spaceId: ctx.spaceId,
				fields: {
					variantMediaIds: { value: nextIds, updatedAt: nowIso },
					pinnedVariantId: { value: nextPinnedId, updatedAt: nowIso },
					updatedAt: { value: nowIso, updatedAt: nowIso },
				},
			},
		]);

		ctx.logger.info('comic.generateVariant', {
			characterId: input.characterId,
			rendered: newVariantMediaIds.length,
			pinned: nextPinnedId === character.pinnedVariantId ? 'unchanged' : 'auto-pinned-first-new',
			quality: input.quality,
			model: input.model,
		});

		return {
			characterId: input.characterId,
			newVariantMediaIds,
			imageUrls,
			pinnedVariantId: nextPinnedId,
		};
	},
};

// ─── comic.pinVariant ─────────────────────────────────────────────

const pinVariantInput = z.object({
	characterId: z.string(),
	variantMediaId: z.string(),
});

const pinVariantOutput = z.object({
	characterId: z.string(),
	pinnedVariantId: z.string(),
});

export const comicPinVariant: ToolSpec<typeof pinVariantInput, typeof pinVariantOutput> = {
	name: 'comic.pinVariant',
	module: 'comic',
	scope: 'user-space',
	policyHint: 'write',
	description:
		"Pin a different variant as the comic-character's canonical look. Stories generated AFTER the re-pin snapshot the new variant; stories created BEFORE keep their old snapshot (fixes via story-level edit, not by character mutation). The chosen variant must already be in the character's variantMediaIds — call `comic.generateVariant` first if needed.",
	input: pinVariantInput,
	output: pinVariantOutput,
	async handler(input, ctx) {
		const charsRes = await pullAll<RawCharacterRow>(syncCfg(ctx), STORIES_APP_ID, CHARACTERS_TABLE);
		const raw = charsRes.changes
			.filter((c) => c.op !== 'delete' && c.data)
			.map((c) => c.data as RawCharacterRow)
			.find((row) => row.id === input.characterId && !row.deletedAt && row.spaceId === ctx.spaceId);
		if (!raw) {
			throw new Error(`Comic-Character ${input.characterId} not found in the active space`);
		}
		if (!(raw.variantMediaIds ?? []).includes(input.variantMediaId)) {
			throw new Error(`Variant ${input.variantMediaId} is not in this character's variantMediaIds`);
		}

		const nowIso = new Date().toISOString();
		await push(syncCfg(ctx), STORIES_APP_ID, [
			{
				table: CHARACTERS_TABLE,
				id: input.characterId,
				op: 'update',
				spaceId: ctx.spaceId,
				fields: {
					pinnedVariantId: { value: input.variantMediaId, updatedAt: nowIso },
					updatedAt: { value: nowIso, updatedAt: nowIso },
				},
			},
		]);

		ctx.logger.info('comic.pinVariant', {
			characterId: input.characterId,
			variantMediaId: input.variantMediaId,
		});

		return {
			characterId: input.characterId,
			pinnedVariantId: input.variantMediaId,
		};
	},
};

// ─── Registration barrel ──────────────────────────────────────────

export function registerComicTools(): void {
	registerTool(comicListStories);
	registerTool(comicCreateStory);
	registerTool(comicGeneratePanel);
	registerTool(comicReorderPanels);
	registerTool(comicListCharacters);
	registerTool(comicCreateCharacter);
	registerTool(comicGenerateVariant);
	registerTool(comicPinVariant);
}
