/**
 * Star + Follow primitives. Both are idempotent and safe to retry.
 */

import { and, eq } from 'drizzle-orm';
import type { Database } from '../db/connection';
import { authorFollows, authors, deckStars, publicDecks } from '../db/schema';
import { ConflictError, NotFoundError } from '../lib/errors';

export class EngagementService {
	constructor(private readonly db: Database) {}

	async starDeck(userId: string, deckSlug: string) {
		const deck = await this.db.query.publicDecks.findFirst({
			where: eq(publicDecks.slug, deckSlug),
		});
		if (!deck) throw new NotFoundError('Deck not found');
		await this.db.insert(deckStars).values({ userId, deckId: deck.id }).onConflictDoNothing();
	}

	async unstarDeck(userId: string, deckSlug: string) {
		const deck = await this.db.query.publicDecks.findFirst({
			where: eq(publicDecks.slug, deckSlug),
		});
		if (!deck) throw new NotFoundError('Deck not found');
		await this.db
			.delete(deckStars)
			.where(and(eq(deckStars.userId, userId), eq(deckStars.deckId, deck.id)));
	}

	async isDeckStarred(userId: string, deckSlug: string): Promise<boolean> {
		const row = await this.db
			.select({ id: deckStars.deckId })
			.from(deckStars)
			.innerJoin(publicDecks, eq(publicDecks.id, deckStars.deckId))
			.where(and(eq(deckStars.userId, userId), eq(publicDecks.slug, deckSlug)))
			.limit(1);
		return row.length > 0;
	}

	async followAuthor(followerUserId: string, authorSlug: string) {
		const author = await this.db.query.authors.findFirst({
			where: eq(authors.slug, authorSlug),
		});
		if (!author) throw new NotFoundError('Author not found');
		if (author.userId === followerUserId) {
			throw new ConflictError('You cannot follow yourself');
		}
		await this.db
			.insert(authorFollows)
			.values({ followerUserId, authorUserId: author.userId })
			.onConflictDoNothing();
	}

	async unfollowAuthor(followerUserId: string, authorSlug: string) {
		const author = await this.db.query.authors.findFirst({
			where: eq(authors.slug, authorSlug),
		});
		if (!author) throw new NotFoundError('Author not found');
		await this.db
			.delete(authorFollows)
			.where(
				and(
					eq(authorFollows.followerUserId, followerUserId),
					eq(authorFollows.authorUserId, author.userId)
				)
			);
	}

	async isFollowing(followerUserId: string, authorSlug: string): Promise<boolean> {
		const row = await this.db
			.select({ id: authorFollows.authorUserId })
			.from(authorFollows)
			.innerJoin(authors, eq(authors.userId, authorFollows.authorUserId))
			.where(and(eq(authorFollows.followerUserId, followerUserId), eq(authors.slug, authorSlug)))
			.limit(1);
		return row.length > 0;
	}
}
