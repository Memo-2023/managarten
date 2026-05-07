/**
 * Engagement primitives — Stars (bookmarks), Subscriptions (live
 * updates), Forks (own copy with lineage).
 *
 * All keyed by `user_id` text — a plain reference to auth.users.id
 * with no cross-DB FK.
 */

import { boolean, index, timestamp, uniqueIndex, uuid, text } from 'drizzle-orm/pg-core';
import { cardsSchema } from './_schema';
import { publicDecks, publicDeckVersions } from './decks';

export const deckStars = cardsSchema.table(
	'deck_stars',
	{
		userId: text('user_id').notNull(),
		deckId: uuid('deck_id')
			.notNull()
			.references(() => publicDecks.id, { onDelete: 'cascade' }),
		starredAt: timestamp('starred_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(t) => ({
		pk: uniqueIndex('deck_stars_pk').on(t.userId, t.deckId),
		deckIdx: index('deck_stars_deck_idx').on(t.deckId),
	})
);

export const deckSubscriptions = cardsSchema.table(
	'deck_subscriptions',
	{
		userId: text('user_id').notNull(),
		deckId: uuid('deck_id')
			.notNull()
			.references(() => publicDecks.id, { onDelete: 'cascade' }),
		// Latest version the user has pulled. Smart-merge compares this to
		// the deck's `latest_version_id` to compute the diff.
		currentVersionId: uuid('current_version_id').references(() => publicDeckVersions.id, {
			onDelete: 'set null',
		}),
		subscribedAt: timestamp('subscribed_at', { withTimezone: true }).defaultNow().notNull(),
		notifyUpdates: boolean('notify_updates').notNull().default(true),
	},
	(t) => ({
		pk: uniqueIndex('deck_subscriptions_pk').on(t.userId, t.deckId),
		deckIdx: index('deck_subscriptions_deck_idx').on(t.deckId),
		userIdx: index('deck_subscriptions_user_idx').on(t.userId),
	})
);

export const deckForks = cardsSchema.table(
	'deck_forks',
	{
		userId: text('user_id').notNull(),
		sourceDeckId: uuid('source_deck_id')
			.notNull()
			.references(() => publicDecks.id, { onDelete: 'cascade' }),
		sourceVersionId: uuid('source_version_id')
			.notNull()
			.references(() => publicDeckVersions.id, { onDelete: 'cascade' }),
		forkedAt: timestamp('forked_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(t) => ({
		pk: uniqueIndex('deck_forks_pk').on(t.userId, t.sourceDeckId, t.sourceVersionId),
		sourceIdx: index('deck_forks_source_idx').on(t.sourceDeckId),
	})
);
