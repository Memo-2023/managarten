/**
 * Card discussions — lightweight inline threads keyed by
 * `card_content_hash` (not card-id) so a thread survives across
 * version bumps as long as the card content stays.
 *
 * Threads are flat-with-parent: every reply has `parent_id` →
 * something else in the same `card_content_hash` group. The UI
 * renders a one-level-deep tree (Reddit-style with a max depth) —
 * if we want full nesting later it's already there.
 */

import { and, asc, eq, sql } from 'drizzle-orm';
import type { Database } from '../db/connection';
import { cardDiscussions, publicDecks } from '../db/schema';
import { ForbiddenError, NotFoundError } from '../lib/errors';

export class DiscussionService {
	constructor(private readonly db: Database) {}

	async post(
		userId: string,
		deckSlug: string,
		cardContentHash: string,
		body: string,
		parentId?: string
	) {
		const deck = await this.db.query.publicDecks.findFirst({
			where: eq(publicDecks.slug, deckSlug),
		});
		if (!deck) throw new NotFoundError('Deck not found');

		if (parentId) {
			const parent = await this.db.query.cardDiscussions.findFirst({
				where: eq(cardDiscussions.id, parentId),
			});
			if (!parent) throw new NotFoundError('Parent comment not found');
			if (parent.cardContentHash !== cardContentHash) {
				throw new ForbiddenError('Parent comment is on a different card');
			}
		}

		const [row] = await this.db
			.insert(cardDiscussions)
			.values({
				cardContentHash,
				deckId: deck.id,
				authorUserId: userId,
				parentId: parentId ?? null,
				body,
			})
			.returning();
		return row;
	}

	/**
	 * Bulk count of (visible) comments per card-content-hash for one
	 * deck — powers the "Karten" overview on the public deck page so
	 * we don't fan out one request per card.
	 */
	async countsForDeck(deckSlug: string): Promise<Record<string, number>> {
		const deck = await this.db.query.publicDecks.findFirst({
			where: eq(publicDecks.slug, deckSlug),
		});
		if (!deck) throw new NotFoundError('Deck not found');

		const rows = await this.db
			.select({
				contentHash: cardDiscussions.cardContentHash,
				count: sql<number>`count(*)::int`.as('count'),
			})
			.from(cardDiscussions)
			.where(and(eq(cardDiscussions.deckId, deck.id), eq(cardDiscussions.hidden, false)))
			.groupBy(cardDiscussions.cardContentHash);

		const out: Record<string, number> = {};
		for (const r of rows) out[r.contentHash] = r.count;
		return out;
	}

	async listForCard(cardContentHash: string) {
		const rows = await this.db
			.select()
			.from(cardDiscussions)
			.where(
				and(eq(cardDiscussions.cardContentHash, cardContentHash), eq(cardDiscussions.hidden, false))
			)
			.orderBy(asc(cardDiscussions.createdAt));
		return rows;
	}

	async hide(actorUserId: string, discussionId: string) {
		const row = await this.db.query.cardDiscussions.findFirst({
			where: eq(cardDiscussions.id, discussionId),
		});
		if (!row) throw new NotFoundError('Discussion not found');
		const deck = await this.db.query.publicDecks.findFirst({
			where: eq(publicDecks.id, row.deckId),
		});
		if (!deck) throw new NotFoundError('Deck not found');
		// Author of the comment OR deck owner can hide.
		if (row.authorUserId !== actorUserId && deck.ownerUserId !== actorUserId) {
			throw new ForbiddenError('Not allowed to hide this comment');
		}
		await this.db
			.update(cardDiscussions)
			.set({ hidden: true })
			.where(eq(cardDiscussions.id, discussionId));
	}
}
