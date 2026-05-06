/**
 * Unlisted module — DB schema (Drizzle / pgSchema 'unlisted')
 *
 * Server-side store for unlisted-share snapshots. One row per
 * (user + collection + record) at any given time — a re-publish after
 * revoke creates a fresh row with a new token.
 *
 * See docs/plans/unlisted-sharing.md §1.
 *
 * All id fields are `text` because both Mana user ids (Better-Auth
 * nanoid) and space ids (Better-Auth organization nanoid) are
 * strings, not UUIDs. See feedback/api-hand-authored-migrations for
 * the regression where this rule was learned.
 */

import { drizzle } from 'drizzle-orm/postgres-js';
import { pgSchema, uuid, text, timestamp, jsonb, index } from 'drizzle-orm/pg-core';
import { getConnection } from '../../lib/db';

export const unlistedSchema = pgSchema('unlisted');

export const snapshots = unlistedSchema.table(
	'snapshots',
	{
		/** 32-char base64url token — also the URL path segment. */
		token: text('token').primaryKey(),
		/** Owner. Better-Auth nanoid, not UUID. */
		userId: text('user_id').notNull(),
		/** Where the original record lives. Better-Auth organization nanoid. */
		spaceId: text('space_id').notNull(),
		/** Dexie collection name: 'events' | 'libraryEntries' | 'places' | … */
		collection: text('collection').notNull(),
		/** Original record id from Dexie. Untethered UUID (no FK across stores). */
		recordId: uuid('record_id').notNull(),
		/** Whitelist-filtered plaintext blob built by the client resolver. */
		blob: jsonb('blob').notNull(),
		/**
		 * Owner-private metadata that the public GET endpoint MUST strip
		 * before returning. Used today by the M10d forms wave-cron to
		 * carry recipient-emails + sender-details for headless sends —
		 * those would leak via `blob` (anyone with the link could
		 * enumerate the contact list), so they live here in a separate
		 * column that the unlisted public-routes never serialises.
		 *
		 * Shape per consumer:
		 *   forms recurrence → {
		 *     recurrence: { frequency, recipientEmails[], lastSentAt },
		 *     sender: { fromEmail, fromName, replyTo?, legalAddress }
		 *   }
		 */
		internalMeta: jsonb('internal_meta'),
		createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
		updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
		/** Optional expiry. `null` = never expires. */
		expiresAt: timestamp('expires_at', { withTimezone: true }),
		/** Soft-delete timestamp. Revoked rows stay for audit + 410-Gone responses. */
		revokedAt: timestamp('revoked_at', { withTimezone: true }),
	},
	(table) => [
		index('snapshots_record_idx').on(table.userId, table.collection, table.recordId),
		index('snapshots_expiry_idx').on(table.expiresAt),
	]
	// The partial unique index on (user_id, collection, record_id)
	// WHERE revoked_at IS NULL lives in the SQL migration — drizzle-orm
	// doesn't express partial-index predicates cleanly. See 0000_init.sql.
);

export const db = drizzle(getConnection(), {
	schema: { snapshots },
});

export type SnapshotRow = typeof snapshots.$inferSelect;
export type NewSnapshot = typeof snapshots.$inferInsert;
