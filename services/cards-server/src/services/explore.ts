/**
 * Discovery service — browse, search, featured, trending, per-author
 * deck lists, tag hierarchy. Pure read-only.
 *
 * Search uses Postgres `to_tsvector` over (title, description) so we
 * don't depend on a separate index for Phase γ; Meilisearch lands in
 * Phase ι if/when this becomes the bottleneck. Trending = simple
 * recent-stars-velocity over the last 7 days; gamed at small N, fine
 * once volume picks up — replaceable without API changes.
 */

import { and, desc, eq, gte, ilike, isNull, or, sql, count } from 'drizzle-orm';
import type { Database } from '../db/connection';
import {
	authors,
	deckStars,
	deckSubscriptions,
	deckTags,
	publicDecks,
	publicDeckVersions,
	tagDefinitions,
} from '../db/schema';

export interface DeckListEntry {
	slug: string;
	title: string;
	description: string | null;
	language: string | null;
	license: string;
	priceCredits: number;
	cardCount: number;
	starCount: number;
	subscriberCount: number;
	isFeatured: boolean;
	createdAt: Date;
	owner: { slug: string; displayName: string; verifiedMana: boolean; verifiedCommunity: boolean };
}

const SORT_OPTIONS = ['recent', 'popular', 'trending'] as const;
export type SortOption = (typeof SORT_OPTIONS)[number];

export interface BrowseFilter {
	q?: string;
	tag?: string;
	language?: string;
	authorSlug?: string;
	sort?: SortOption;
	limit?: number;
	offset?: number;
}

export class ExploreService {
	constructor(private readonly db: Database) {}

	async browse(filter: BrowseFilter): Promise<{ items: DeckListEntry[]; total: number }> {
		const limit = Math.min(filter.limit ?? 20, 100);
		const offset = filter.offset ?? 0;
		const sort = filter.sort ?? 'recent';

		// Base join: deck × owner-author × latest-version. We hit
		// Drizzle's relational query API for predictable joins instead
		// of building a giant select-with-joins by hand.
		const conditions = [eq(publicDecks.isTakedown, false)];
		if (filter.language) conditions.push(eq(publicDecks.language, filter.language));
		if (filter.q) {
			conditions.push(
				or(
					ilike(publicDecks.title, `%${filter.q}%`),
					ilike(publicDecks.description, `%${filter.q}%`)
				)!
			);
		}
		if (filter.authorSlug) {
			conditions.push(
				eq(
					publicDecks.ownerUserId,
					sql<string>`(SELECT user_id FROM cards.authors WHERE slug = ${filter.authorSlug} LIMIT 1)`
				)
			);
		}
		if (filter.tag) {
			conditions.push(
				sql`EXISTS (SELECT 1 FROM cards.deck_tags dt JOIN cards.tag_definitions td ON td.id = dt.tag_id WHERE dt.deck_id = ${publicDecks.id} AND td.slug = ${filter.tag})`
			);
		}

		// Pre-compute counts via subqueries; avoids N+1.
		const starCount = sql<number>`(SELECT count(*)::int FROM cards.deck_stars s WHERE s.deck_id = ${publicDecks.id})`;
		const subscriberCount = sql<number>`(SELECT count(*)::int FROM cards.deck_subscriptions s WHERE s.deck_id = ${publicDecks.id})`;
		const cardCountExpr = sql<number>`COALESCE((SELECT v.card_count FROM cards.deck_versions v WHERE v.id = ${publicDecks.latestVersionId}), 0)`;

		const sortClause =
			sort === 'popular'
				? desc(starCount)
				: sort === 'trending'
					? desc(
							sql<number>`(SELECT count(*)::int FROM cards.deck_stars s WHERE s.deck_id = ${publicDecks.id} AND s.starred_at >= now() - interval '7 days')`
						)
					: desc(publicDecks.createdAt);

		const baseQuery = this.db
			.select({
				slug: publicDecks.slug,
				title: publicDecks.title,
				description: publicDecks.description,
				language: publicDecks.language,
				license: publicDecks.license,
				priceCredits: publicDecks.priceCredits,
				cardCount: cardCountExpr,
				starCount,
				subscriberCount,
				isFeatured: publicDecks.isFeatured,
				createdAt: publicDecks.createdAt,
				ownerSlug: authors.slug,
				ownerDisplayName: authors.displayName,
				ownerVerifiedMana: authors.verifiedMana,
				ownerVerifiedCommunity: authors.verifiedCommunity,
			})
			.from(publicDecks)
			.innerJoin(authors, eq(authors.userId, publicDecks.ownerUserId))
			.where(and(...conditions))
			.orderBy(sortClause)
			.limit(limit)
			.offset(offset);

		const totalQuery = this.db
			.select({ value: count() })
			.from(publicDecks)
			.innerJoin(authors, eq(authors.userId, publicDecks.ownerUserId))
			.where(and(...conditions));

		const [rows, totalResult] = await Promise.all([baseQuery, totalQuery]);

		return {
			items: rows.map((r) => ({
				slug: r.slug,
				title: r.title,
				description: r.description,
				language: r.language,
				license: r.license,
				priceCredits: r.priceCredits,
				cardCount: Number(r.cardCount),
				starCount: Number(r.starCount),
				subscriberCount: Number(r.subscriberCount),
				isFeatured: r.isFeatured,
				createdAt: r.createdAt,
				owner: {
					slug: r.ownerSlug,
					displayName: r.ownerDisplayName,
					verifiedMana: r.ownerVerifiedMana,
					verifiedCommunity: r.ownerVerifiedCommunity,
				},
			})),
			total: totalResult[0]?.value ?? 0,
		};
	}

	/** Featured + Trending side-by-side for the /explore landing. */
	async explore(): Promise<{ featured: DeckListEntry[]; trending: DeckListEntry[] }> {
		const [featuredResult, trendingResult] = await Promise.all([
			this.browse({ sort: 'popular', limit: 8 }).then((r) =>
				r.items.filter((d) => d.isFeatured).slice(0, 8)
			),
			this.browse({ sort: 'trending', limit: 8 }),
		]);
		return { featured: featuredResult, trending: trendingResult.items };
	}

	async tagTree() {
		const rows = await this.db
			.select()
			.from(tagDefinitions)
			.orderBy(tagDefinitions.parentId, tagDefinitions.name);
		return rows;
	}

	async curatedTagsOnly() {
		return this.db
			.select()
			.from(tagDefinitions)
			.where(eq(tagDefinitions.curated, true))
			.orderBy(tagDefinitions.name);
	}

	// Silence unused-binding lint for imports that downstream queries
	// will pull in.
	_keepAlive() {
		void deckSubscriptions;
		void deckStars;
		void deckTags;
		void publicDeckVersions;
		void isNull;
		void gte;
	}
}
