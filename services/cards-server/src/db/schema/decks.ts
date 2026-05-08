/**
 * Decks, Versions, Cards.
 *
 * A deck is the long-lived thing the user identifies with ("Spanish
 * A2 Vocab"). It always points at a `latest_version_id`. Versions are
 * immutable snapshots — once published, they never change. Cards are
 * scoped to a version and carry a per-card content-hash so subscriber
 * smart-merge can preserve FSRS state for unchanged cards across
 * version bumps.
 *
 * `price_credits` of 0 means free. Anything > 0 forces the
 * Cardecky-Pro-Only-1.0 license (CHECK constraint enforced at DB level).
 */

import {
	boolean,
	check,
	index,
	integer,
	jsonb,
	pgEnum,
	text,
	timestamp,
	uniqueIndex,
	uuid,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { cardsSchema } from './_schema';
import { authors } from './authors';

/** Mirrors `CardType` in @mana/cards-core. Phase-1 ships basic / basic-reverse / cloze / type-in. */
export const cardTypeEnum = pgEnum('cards_card_type', [
	'basic',
	'basic-reverse',
	'cloze',
	'type-in',
	'image-occlusion',
	'audio',
	'multiple-choice',
]);

export const publicDecks = cardsSchema.table(
	'decks',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		slug: text('slug').notNull(),
		title: text('title').notNull(),
		description: text('description'),
		// ISO-639-1 (e.g. 'de', 'en', 'es'). Nullable for mixed-language decks.
		language: text('language'),
		// SPDX-style ID. CC0-1.0, CC-BY-4.0, CC-BY-SA-4.0,
		// Cardecky-Personal-Use-1.0 (default for free), Cardecky-Pro-Only-1.0 (paid).
		license: text('license').notNull().default('Cardecky-Personal-Use-1.0'),
		priceCredits: integer('price_credits').notNull().default(0),
		ownerUserId: text('owner_user_id')
			.notNull()
			.references(() => authors.userId, { onDelete: 'restrict' }),
		// Updated each time a new version is published.
		latestVersionId: uuid('latest_version_id'),
		isFeatured: boolean('is_featured').notNull().default(false),
		isTakedown: boolean('is_takedown').notNull().default(false),
		takedownAt: timestamp('takedown_at', { withTimezone: true }),
		takedownReason: text('takedown_reason'),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(t) => ({
		slugIdx: uniqueIndex('decks_slug_idx').on(t.slug),
		ownerIdx: index('decks_owner_idx').on(t.ownerUserId),
		featuredIdx: index('decks_featured_idx').on(t.isFeatured),
		// Paid decks must carry the Pro-Only license.
		priceLicense: check(
			'decks_price_requires_license',
			sql`price_credits = 0 OR license = 'Cardecky-Pro-Only-1.0'`
		),
	})
);

export const publicDeckVersions = cardsSchema.table(
	'deck_versions',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		deckId: uuid('deck_id')
			.notNull()
			.references(() => publicDecks.id, { onDelete: 'cascade' }),
		// SemVer string — ordering done in app code, not DB.
		semver: text('semver').notNull(),
		changelog: text('changelog'),
		// SHA-256 over the canonicalized card list — clients use this to
		// detect "did anything change" without diffing payloads.
		contentHash: text('content_hash').notNull(),
		cardCount: integer('card_count').notNull(),
		publishedAt: timestamp('published_at', { withTimezone: true }).defaultNow().notNull(),
		// Older versions stay readable but new subscribers go to latest.
		deprecatedAt: timestamp('deprecated_at', { withTimezone: true }),
	},
	(t) => ({
		uniqueSemver: uniqueIndex('deck_versions_deck_semver_idx').on(t.deckId, t.semver),
		deckIdx: index('deck_versions_deck_idx').on(t.deckId),
		hashIdx: index('deck_versions_hash_idx').on(t.contentHash),
	})
);

export const publicDeckCards = cardsSchema.table(
	'deck_cards',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		versionId: uuid('version_id')
			.notNull()
			.references(() => publicDeckVersions.id, { onDelete: 'cascade' }),
		// Mirrors @mana/cards-core CardType.
		type: cardTypeEnum('type').notNull(),
		// Free-form key/value bag of user content.
		// basic / basic-reverse / type-in: { front, back }
		// cloze: { text, extra? }
		fields: jsonb('fields').$type<Record<string, string>>().notNull(),
		ord: integer('ord').notNull(),
		// SHA-256 over canonical(type, fields). Subscribers use this to
		// detect per-card changes during smart-merge — unchanged cards
		// keep their FSRS state across version pulls.
		contentHash: text('content_hash').notNull(),
	},
	(t) => ({
		uniqueOrd: uniqueIndex('deck_cards_version_ord_idx').on(t.versionId, t.ord),
		hashIdx: index('deck_cards_hash_idx').on(t.contentHash),
	})
);
