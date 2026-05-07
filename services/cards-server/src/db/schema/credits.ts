/**
 * Two-sided marketplace bookkeeping. The actual money lives in
 * mana-credits — we just record the deck-purchase event and the
 * derived author payout so we can show buyer history, author
 * dashboards, and reconcile against the mana-credits ledger.
 */

import { index, integer, text, timestamp, uniqueIndex, uuid } from 'drizzle-orm/pg-core';
import { cardsSchema } from './_schema';
import { authors } from './authors';
import { publicDecks, publicDeckVersions } from './decks';

export const deckPurchases = cardsSchema.table(
	'deck_purchases',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		buyerUserId: text('buyer_user_id').notNull(),
		deckId: uuid('deck_id')
			.notNull()
			.references(() => publicDecks.id, { onDelete: 'restrict' }),
		// Snapshot the version at time of purchase — buyer keeps lifetime
		// access to all subsequent versions.
		versionId: uuid('version_id')
			.notNull()
			.references(() => publicDeckVersions.id, { onDelete: 'restrict' }),
		// Snapshot of the price at the time of purchase.
		priceCredits: integer('price_credits').notNull(),
		// Pre-computed split (sum equals priceCredits modulo rounding).
		authorShare: integer('author_share').notNull(),
		manaShare: integer('mana_share').notNull(),
		// Reference into mana-credits ledger.
		creditsTransaction: text('credits_transaction'),
		purchasedAt: timestamp('purchased_at', { withTimezone: true }).defaultNow().notNull(),
		refundedAt: timestamp('refunded_at', { withTimezone: true }),
	},
	(t) => ({
		// One purchase per buyer per deck — covers lifetime access.
		uniqueBuyerDeck: uniqueIndex('deck_purchases_buyer_deck_idx').on(t.buyerUserId, t.deckId),
		buyerIdx: index('deck_purchases_buyer_idx').on(t.buyerUserId),
		deckIdx: index('deck_purchases_deck_idx').on(t.deckId),
	})
);

export const authorPayouts = cardsSchema.table(
	'author_payouts',
	{
		id: uuid('id').primaryKey().defaultRandom(),
		authorUserId: text('author_user_id')
			.notNull()
			.references(() => authors.userId, { onDelete: 'restrict' }),
		sourcePurchaseId: uuid('source_purchase_id')
			.notNull()
			.references(() => deckPurchases.id, { onDelete: 'restrict' }),
		creditsGranted: integer('credits_granted').notNull(),
		// Reference into mana-credits grant ledger.
		creditsGrantId: text('credits_grant_id'),
		grantedAt: timestamp('granted_at', { withTimezone: true }).defaultNow().notNull(),
	},
	(t) => ({
		authorIdx: index('author_payouts_author_idx').on(t.authorUserId),
		purchaseIdx: index('author_payouts_purchase_idx').on(t.sourcePurchaseId),
	})
);
