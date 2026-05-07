/**
 * Author service — CRUD on `cards.authors` plus the lookups the
 * routes need (by-slug, by-userId).
 *
 * Slug is unique per author. We don't auto-suggest slugs server-side;
 * the client picks one and we validate. If a user changes their slug,
 * the old slug isn't preserved (no redirects yet — Phase η maybe).
 */

import { eq } from 'drizzle-orm';
import type { Database } from '../db/connection';
import { authors } from '../db/schema';
import { validateSlug } from '../lib/slug';
import { BadRequestError, ConflictError, NotFoundError } from '../lib/errors';

export interface AuthorInput {
	slug: string;
	displayName: string;
	bio?: string;
	avatarUrl?: string;
	pseudonym?: boolean;
}

export class AuthorService {
	constructor(private readonly db: Database) {}

	async upsertMe(userId: string, input: AuthorInput) {
		const validation = validateSlug(input.slug);
		if (!validation.ok) {
			throw new BadRequestError(`Slug invalid: ${validation.reason}`);
		}

		// Slug must be free or already owned by us.
		const existingBySlug = await this.db.query.authors.findFirst({
			where: eq(authors.slug, input.slug),
		});
		if (existingBySlug && existingBySlug.userId !== userId) {
			throw new ConflictError('Slug already taken');
		}

		const existing = await this.db.query.authors.findFirst({
			where: eq(authors.userId, userId),
		});

		if (existing) {
			const [updated] = await this.db
				.update(authors)
				.set({
					slug: input.slug,
					displayName: input.displayName,
					bio: input.bio,
					avatarUrl: input.avatarUrl,
					pseudonym: input.pseudonym ?? existing.pseudonym,
				})
				.where(eq(authors.userId, userId))
				.returning();
			return updated;
		}

		const [created] = await this.db
			.insert(authors)
			.values({
				userId,
				slug: input.slug,
				displayName: input.displayName,
				bio: input.bio,
				avatarUrl: input.avatarUrl,
				pseudonym: input.pseudonym ?? false,
			})
			.returning();
		return created;
	}

	async getByUserId(userId: string) {
		const row = await this.db.query.authors.findFirst({ where: eq(authors.userId, userId) });
		return row ?? null;
	}

	/** Public profile lookup — strips bannedReason etc. */
	async getPublicBySlug(slug: string) {
		const row = await this.db.query.authors.findFirst({ where: eq(authors.slug, slug) });
		if (!row) throw new NotFoundError('Author not found');
		return {
			slug: row.slug,
			displayName: row.displayName,
			bio: row.bio,
			avatarUrl: row.avatarUrl,
			joinedAt: row.joinedAt,
			pseudonym: row.pseudonym,
			verifiedMana: row.verifiedMana,
			verifiedCommunity: row.verifiedCommunity,
			banned: row.bannedAt !== null,
		};
	}

	async assertNotBanned(userId: string) {
		const row = await this.getByUserId(userId);
		if (!row) throw new BadRequestError('You need an author profile first (POST /v1/authors/me).');
		if (row.bannedAt) {
			throw new BadRequestError(`Author banned: ${row.bannedReason ?? 'no reason given'}`);
		}
		return row;
	}
}
