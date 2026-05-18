import { z } from 'zod';

/**
 * Resolved item shape — every embed provider returns items in this
 * normalized form so the renderer doesn't care about the source.
 */
export const EmbedItemSchema = z.object({
	title: z.string(),
	subtitle: z.string().optional(),
	imageUrl: z.string().optional(),
	/** External link — for library entries, a page URL. */
	href: z.string().optional(),
});

export type EmbedItem = z.infer<typeof EmbedItemSchema>;

export const EmbedResolvedSchema = z.object({
	items: z.array(EmbedItemSchema),
	/** If resolution failed, the error message surfaces in public mode. */
	error: z.string().optional(),
	/** ISO timestamp of when resolution happened. */
	resolvedAt: z.string().optional(),
});

/**
 * Supported embed sources. Add new sources here + a matching provider
 * in the editor's publish resolver.
 */
export const EmbedSourceSchema = z.enum([
	'picture.board',
	'library.entries',
	'calendar.events',
	'todo.tasks',
	'goals.goals',
	'places.places',
	'recipes.recipes',
	'habits.habits',
	'quiz.quizzes',
	'events.socialEvents',
	'cards.decks',
	'presi.decks',
	'augur.entries',
]);
export type EmbedSource = z.infer<typeof EmbedSourceSchema>;

export const ModuleEmbedSchema = z.object({
	source: EmbedSourceSchema.default('picture.board'),
	/** Target id — board id for picture, empty for "all entries" in library. */
	sourceId: z.string().max(64).default(''),
	/** Display title. Optional; renderer falls back to source default. */
	title: z.string().max(160).default(''),
	layout: z.enum(['grid', 'list']).default('grid'),
	maxItems: z.number().int().min(1).max(48).default(12),
	/**
	 * Optional filters depending on source.
	 *   library.entries: { isFavorite?, status?, kind? }
	 *   picture.board:   ignored (board is the source)
	 *   calendar.events: { upcomingDays?, tagIds? } — omit upcomingDays
	 *                    to include past events; tagIds OR-filter on
	 *                    event tag assignments
	 *   todo.tasks:      { status?, tagIds? } — typical public-roadmap
	 *                    shape: status='completed' filters to shipped
	 *                    items; tagIds restricts to a "public" label
	 *   goals.goals:     { status? } — 'active' | 'completed' filter;
	 *                    useful for "currently working on" vs "things
	 *                    I've hit" progress sections
	 *   places.places:   { kind? (mapped to PlaceCategory),
	 *                      isFavorite?, tagIds? } — "my favourite cafes",
	 *                      "rehearsal rooms I use", etc.
	 */
	filter: z
		.object({
			isFavorite: z.boolean().optional(),
			status: z.string().max(32).optional(),
			kind: z.string().max(32).optional(),
			upcomingDays: z.number().int().min(1).max(365).optional(),
			tagIds: z.array(z.string().max(64)).max(16).optional(),
		})
		.default({}),
	/**
	 * Filled at publish time. The public renderer reads this directly —
	 * no Dexie, no API round-trip. The editor shows a "nicht aufgelöst"
	 * placeholder when missing.
	 */
	resolved: EmbedResolvedSchema.optional(),
});

export type ModuleEmbedProps = z.infer<typeof ModuleEmbedSchema>;

export const MODULE_EMBED_DEFAULTS: ModuleEmbedProps = {
	source: 'picture.board',
	sourceId: '',
	title: '',
	layout: 'grid',
	maxItems: 12,
	filter: {},
};
