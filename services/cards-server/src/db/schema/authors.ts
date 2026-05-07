/**
 * Authors — public-facing identity layer for users who publish decks.
 *
 * One author row per user that has ever opted into being an author.
 * `userId` is a plain text reference to `auth.users.id` (cross-DB,
 * no FK at the DB level — the consumer service validates JWTs from
 * mana-auth and uses the `sub` claim verbatim).
 *
 * Verification has two orthogonal axes:
 *   - `verified_mana`: manually granted by Mana-Verein (teachers,
 *     professional educators, doctors, etc.). Not earnable.
 *   - `verified_community`: automatically calculated from engagement
 *     (≥ X stars across decks, ≥ Y featured decks, ≥ Z subscribers).
 *     Periodically re-evaluated.
 *
 * Both axes can be true at once → the UI shows both badges.
 */

import { boolean, index, text, timestamp, uniqueIndex } from 'drizzle-orm/pg-core';
import { cardsSchema } from './_schema';

export const authors = cardsSchema.table(
	'authors',
	{
		userId: text('user_id').primaryKey(),
		slug: text('slug').notNull(),
		displayName: text('display_name').notNull(),
		bio: text('bio'),
		avatarUrl: text('avatar_url'),
		joinedAt: timestamp('joined_at', { withTimezone: true }).defaultNow().notNull(),
		// Pseudonym mode: legal name stays hidden, only displayName visible.
		pseudonym: boolean('pseudonym').default(false).notNull(),
		// Verification flags (see header).
		verifiedMana: boolean('verified_mana').default(false).notNull(),
		verifiedCommunity: boolean('verified_community').default(false).notNull(),
		// Soft-ban: blocked author can no longer publish, existing decks
		// stay readable but get a "deactivated" badge.
		bannedAt: timestamp('banned_at', { withTimezone: true }),
		bannedReason: text('banned_reason'),
	},
	(t) => ({
		slugIdx: uniqueIndex('authors_slug_idx').on(t.slug),
		verifiedIdx: index('authors_verified_idx').on(t.verifiedMana, t.verifiedCommunity),
	})
);

/**
 * Following relationship between users (followers) and authors.
 * Drives the personal activity feed.
 */
export const authorFollows = cardsSchema.table(
	'author_follows',
	{
		followerUserId: text('follower_user_id').notNull(),
		authorUserId: text('author_user_id')
			.notNull()
			.references(() => authors.userId, { onDelete: 'cascade' }),
		since: timestamp('since', { withTimezone: true }).defaultNow().notNull(),
	},
	(t) => ({
		// Composite primary key (user, author).
		pk: uniqueIndex('author_follows_pk').on(t.followerUserId, t.authorUserId),
		authorIdx: index('author_follows_author_idx').on(t.authorUserId),
		followerIdx: index('author_follows_follower_idx').on(t.followerUserId),
	})
);
