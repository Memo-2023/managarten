/**
 * Paid-deck purchase pipeline. Phase ζ.1 — buyer pays, author gets
 * the configured share, Mana keeps the rest. Lifetime access per
 * (buyer, deck) — same row covers all future versions of the deck.
 *
 * The flow is two-phase against mana-credits:
 *
 *   1. reserve(buyer, price)        — atomic balance check + hold
 *   2. INSERT deck_purchases row
 *   3. commit(reservationId)        — finalise the buyer-side debit
 *   4. grant(author, authorShare)   — author payout
 *   5. INSERT author_payouts row
 *
 * If step 3 or 4 fails after the purchase row exists, we leave the
 * row alone (idempotency relies on the unique (buyer, deck) index).
 * A future reconciler can sweep purchase rows whose
 * `creditsTransaction` is null and either commit-retry or roll back
 * via a manual refund.
 */

import { and, desc, eq } from 'drizzle-orm';
import type { Database } from '../db/connection';
import {
	authorPayouts,
	authors,
	deckPurchases,
	publicDecks,
	publicDeckVersions,
} from '../db/schema';
import { BadRequestError, ForbiddenError, NotFoundError } from '../lib/errors';
import type { CreditsClient } from '../lib/credits';
import { InsufficientCreditsError } from '../lib/credits';
import type { NotifyClient } from '../lib/notify';

interface PurchaseConfig {
	standardAuthorBps: number;
	verifiedAuthorBps: number;
}

export class PurchaseService {
	constructor(
		private readonly db: Database,
		private readonly credits: CreditsClient,
		private readonly config: PurchaseConfig,
		private readonly notify?: NotifyClient
	) {}

	/**
	 * Idempotent: if the buyer already owns the deck, returns the
	 * existing purchase row without touching mana-credits.
	 */
	async purchase(buyerUserId: string, deckSlug: string) {
		const deck = await this.db.query.publicDecks.findFirst({
			where: eq(publicDecks.slug, deckSlug),
		});
		if (!deck) throw new NotFoundError('Deck not found');
		if (deck.isTakedown) throw new ForbiddenError('Deck under takedown');
		if (deck.priceCredits <= 0) {
			throw new BadRequestError('Deck is free — no purchase required');
		}
		if (deck.ownerUserId === buyerUserId) {
			throw new BadRequestError('Cannot purchase your own deck');
		}
		if (!deck.latestVersionId) {
			throw new BadRequestError('Deck has no published version');
		}

		// Idempotency.
		const existing = await this.db.query.deckPurchases.findFirst({
			where: and(eq(deckPurchases.buyerUserId, buyerUserId), eq(deckPurchases.deckId, deck.id)),
		});
		if (existing) {
			if (existing.refundedAt) {
				throw new BadRequestError('Purchase was previously refunded');
			}
			return { purchase: existing, alreadyOwned: true };
		}

		const author = await this.db.query.authors.findFirst({
			where: eq(authors.userId, deck.ownerUserId),
		});
		if (!author) throw new NotFoundError('Author profile missing');

		// Author share split — verified-mana authors get a higher cut.
		const authorBps = author.verifiedMana
			? this.config.verifiedAuthorBps
			: this.config.standardAuthorBps;
		const authorShare = Math.floor((deck.priceCredits * authorBps) / 10_000);
		const manaShare = deck.priceCredits - authorShare;

		// Step 1 — reserve.
		let reservationId: string;
		try {
			const reservation = await this.credits.reserve({
				userId: buyerUserId,
				amount: deck.priceCredits,
				reason: `cards.deck-purchase:${deck.slug}`,
			});
			reservationId = reservation.reservationId;
		} catch (e) {
			if (e instanceof InsufficientCreditsError) throw e;
			throw e;
		}

		// Step 2 — write the purchase row.
		let purchase: typeof deckPurchases.$inferSelect;
		try {
			[purchase] = await this.db
				.insert(deckPurchases)
				.values({
					buyerUserId,
					deckId: deck.id,
					versionId: deck.latestVersionId,
					priceCredits: deck.priceCredits,
					authorShare,
					manaShare,
				})
				.returning();
		} catch (insertErr) {
			// Rollback the reservation so the buyer's credits aren't held.
			await this.credits
				.refundReservation({ reservationId })
				.catch((refundErr) =>
					console.warn('[purchases] reservation refund after insert-fail failed', refundErr)
				);
			throw insertErr;
		}

		// Step 3 — commit the buyer-side debit.
		try {
			await this.credits.commit({
				reservationId,
				description: `Cards: ${deck.title} (${deck.slug})`,
			});
		} catch (commitErr) {
			console.warn('[purchases] commit failed — purchase row remains for reconciler', commitErr);
			throw commitErr;
		}

		// Step 4 — grant the author share. Failures here don't affect
		// the buyer's access (they already paid + got the row); we log
		// and rely on the reconciler to retry the grant.
		let payoutRow: typeof authorPayouts.$inferSelect | null = null;
		if (authorShare > 0) {
			try {
				const granted = (await this.credits.grant({
					userId: deck.ownerUserId,
					amount: authorShare,
					reason: 'cards.author-payout',
					referenceId: purchase.id,
					description: `Cards-Verkauf: ${deck.title}`,
				})) as { transactionId?: string };

				[payoutRow] = await this.db
					.insert(authorPayouts)
					.values({
						authorUserId: deck.ownerUserId,
						sourcePurchaseId: purchase.id,
						creditsGranted: authorShare,
						creditsGrantId: granted?.transactionId ?? null,
					})
					.returning();
			} catch (grantErr) {
				console.warn('[purchases] author grant failed — will retry via reconciler', grantErr);
			}
		}

		if (this.notify) {
			void this.notify.send({
				channel: 'email',
				userId: deck.ownerUserId,
				subject: `Verkauf: „${deck.title}"`,
				body: `Ein neuer Käufer hat dein Deck „${deck.title}" gekauft. Du hast ${authorShare} Credits gutgeschrieben bekommen.`,
				data: {
					type: 'cards.deck.purchased',
					deckSlug: deck.slug,
					purchaseId: purchase.id,
					authorShare,
				},
				externalId: `cards.deck.purchased.${purchase.id}`,
			});
		}

		return { purchase, payout: payoutRow, alreadyOwned: false };
	}

	async hasPurchased(buyerUserId: string, deckId: string): Promise<boolean> {
		const row = await this.db.query.deckPurchases.findFirst({
			where: and(eq(deckPurchases.buyerUserId, buyerUserId), eq(deckPurchases.deckId, deckId)),
		});
		return !!row && !row.refundedAt;
	}

	async listForBuyer(buyerUserId: string) {
		const rows = await this.db
			.select({
				id: deckPurchases.id,
				deckId: deckPurchases.deckId,
				deckSlug: publicDecks.slug,
				deckTitle: publicDecks.title,
				priceCredits: deckPurchases.priceCredits,
				purchasedAt: deckPurchases.purchasedAt,
				refundedAt: deckPurchases.refundedAt,
				versionId: deckPurchases.versionId,
				versionSemver: publicDeckVersions.semver,
			})
			.from(deckPurchases)
			.innerJoin(publicDecks, eq(deckPurchases.deckId, publicDecks.id))
			.innerJoin(publicDeckVersions, eq(deckPurchases.versionId, publicDeckVersions.id))
			.where(eq(deckPurchases.buyerUserId, buyerUserId))
			.orderBy(desc(deckPurchases.purchasedAt));
		return rows;
	}

	async listPayoutsForAuthor(authorUserId: string) {
		const rows = await this.db
			.select({
				id: authorPayouts.id,
				purchaseId: authorPayouts.sourcePurchaseId,
				creditsGranted: authorPayouts.creditsGranted,
				grantedAt: authorPayouts.grantedAt,
				deckSlug: publicDecks.slug,
				deckTitle: publicDecks.title,
				priceCredits: deckPurchases.priceCredits,
			})
			.from(authorPayouts)
			.innerJoin(deckPurchases, eq(authorPayouts.sourcePurchaseId, deckPurchases.id))
			.innerJoin(publicDecks, eq(deckPurchases.deckId, publicDecks.id))
			.where(eq(authorPayouts.authorUserId, authorUserId))
			.orderBy(desc(authorPayouts.grantedAt));
		return rows;
	}
}
