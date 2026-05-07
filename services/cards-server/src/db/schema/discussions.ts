/**
 * Pull-Requests + Card-Discussions.
 *
 * Pull-requests propose card-level changes to a deck; the author can
 * merge → cards-server creates a new version automatically. The diff
 * is stored as a JSON blob ({ add, modify, remove }) so we can render
 * a GitHub-style review UI without re-deriving from version diffs.
 *
 * Card discussions are bound to `card_content_hash` (not `card_id`)
 * so threads survive version bumps as long as the card itself stays
 * unchanged.
 */

import { index, jsonb, text, timestamp, uuid, boolean, pgEnum } from 'drizzle-orm/pg-core';
import { cardsSchema } from './_schema';
import { publicDecks, publicDeckVersions } from './decks';

export const pullRequestStatusEnum = pgEnum('cards_pr_status', [
	'open',
	'merged',
	'closed',
	'rejected',
]);

export interface PullRequestDiff {
	add: { type: string; fields: Record<string, string> }[];
	modify: { contentHash: string; fields: Record<string, string> }[];
	remove: { contentHash: string }[];
}

export const deckPullRequests = cardsSchema.table(
	'deck_pull_requests',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		deckId: uuid('deck_id')
			.notNull()
			.references(() => publicDecks.id, { onDelete: 'cascade' }),
		authorUserId: text('author_user_id').notNull(),
		status: pullRequestStatusEnum('status').notNull().default('open'),
		title: text('title').notNull(),
		body: text('body'),
		diff: jsonb('diff').$type<PullRequestDiff>().notNull(),
		mergedIntoVersionId: uuid('merged_into_version_id').references(() => publicDeckVersions.id, {
			onDelete: 'set null',
		}),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		resolvedAt: timestamp('resolved_at', { withTimezone: true }),
	},
	(t) => ({
		deckIdx: index('deck_pull_requests_deck_idx').on(t.deckId),
		statusIdx: index('deck_pull_requests_status_idx').on(t.deckId, t.status),
		authorIdx: index('deck_pull_requests_author_idx').on(t.authorUserId),
	})
);

export const cardDiscussions = cardsSchema.table(
	'card_discussions',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		// Bound to the card's content_hash, not its row id, so the thread
		// follows the card across version bumps as long as content stays.
		cardContentHash: text('card_content_hash').notNull(),
		deckId: uuid('deck_id')
			.notNull()
			.references(() => publicDecks.id, { onDelete: 'cascade' }),
		authorUserId: text('author_user_id').notNull(),
		// Threading: parent_id NULL = root post, NOT NULL = reply.
		parentId: uuid('parent_id'),
		body: text('body').notNull(),
		// Hidden by author or moderator. Not deleted — preserves audit trail.
		hidden: boolean('hidden').notNull().default(false),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(t) => ({
		hashIdx: index('card_discussions_hash_idx').on(t.cardContentHash),
		deckIdx: index('card_discussions_deck_idx').on(t.deckId),
		parentIdx: index('card_discussions_parent_idx').on(t.parentId),
	})
);
