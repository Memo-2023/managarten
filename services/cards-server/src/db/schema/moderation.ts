/**
 * Moderation — user-submitted reports + AI-first-pass log.
 *
 * Reports flow into a Mana-admin inbox; AI-mod-log is a record of every
 * automated check we ran on a version so we can audit / re-train if a
 * bad outcome shipped.
 */

import { boolean, index, pgEnum, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { cardsSchema } from './_schema';
import { publicDecks, publicDeckVersions } from './decks';

export const reportCategoryEnum = pgEnum('cards_report_category', [
	'spam',
	'copyright',
	'nsfw',
	'misinformation',
	'hate',
	'other',
]);

export const reportStatusEnum = pgEnum('cards_report_status', ['open', 'dismissed', 'actioned']);

export const deckReports = cardsSchema.table(
	'deck_reports',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		deckId: uuid('deck_id')
			.notNull()
			.references(() => publicDecks.id, { onDelete: 'cascade' }),
		versionId: uuid('version_id').references(() => publicDeckVersions.id, {
			onDelete: 'set null',
		}),
		// Optional: report scoped to one specific card by content-hash.
		cardContentHash: text('card_content_hash'),
		reporterUserId: text('reporter_user_id').notNull(),
		category: reportCategoryEnum('category').notNull(),
		body: text('body'),
		status: reportStatusEnum('status').notNull().default('open'),
		resolvedBy: text('resolved_by'),
		resolvedAt: timestamp('resolved_at', { withTimezone: true }),
		resolutionNotes: text('resolution_notes'),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(t) => ({
		deckIdx: index('deck_reports_deck_idx').on(t.deckId),
		statusIdx: index('deck_reports_status_idx').on(t.status),
	})
);

export const aiModerationVerdictEnum = pgEnum('cards_ai_mod_verdict', ['pass', 'flag', 'block']);

export const aiModerationLog = cardsSchema.table(
	'ai_moderation_log',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		versionId: uuid('version_id')
			.notNull()
			.references(() => publicDeckVersions.id, { onDelete: 'cascade' }),
		verdict: aiModerationVerdictEnum('verdict').notNull(),
		// Categories the model flagged — array because one verdict can hit
		// multiple categories (e.g. "spam" + "misinformation").
		categories: text('categories').array(),
		model: text('model'),
		rationale: text('rationale'),
		humanReviewed: boolean('human_reviewed').notNull().default(false),
		humanOverrode: boolean('human_overrode').notNull().default(false),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(t) => ({
		versionIdx: index('ai_moderation_log_version_idx').on(t.versionId),
		verdictIdx: index('ai_moderation_log_verdict_idx').on(t.verdict),
	})
);
