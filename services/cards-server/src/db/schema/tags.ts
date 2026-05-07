/**
 * Tag taxonomy. Hierarchical (parent_id), curated by the Mana-Verein
 * for the canonical tree (medizin > anatomie > kardiologie). Authors
 * pick from existing tags and can suggest new ones via a moderated
 * flow (`curated = false` → admin reviews before promoting).
 */

import { boolean, index, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { cardsSchema } from './_schema';
import { publicDecks } from './decks';

export const tagDefinitions = cardsSchema.table(
	'tag_definitions',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		slug: text('slug').notNull(),
		name: text('name').notNull(),
		parentId: uuid('parent_id'),
		description: text('description'),
		curated: boolean('curated').notNull().default(false),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(t) => ({
		slugIdx: uniqueIndex('tag_definitions_slug_idx').on(t.slug),
		parentIdx: index('tag_definitions_parent_idx').on(t.parentId),
	})
);

export const deckTags = cardsSchema.table(
	'deck_tags',
	{
		deckId: uuid('deck_id')
			.notNull()
			.references(() => publicDecks.id, { onDelete: 'cascade' }),
		tagId: uuid('tag_id')
			.notNull()
			.references(() => tagDefinitions.id, { onDelete: 'cascade' }),
	},
	(t) => ({
		pk: uniqueIndex('deck_tags_pk').on(t.deckId, t.tagId),
		tagIdx: index('deck_tags_tag_idx').on(t.tagId),
	})
);
