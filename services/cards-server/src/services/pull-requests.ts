/**
 * Pull-requests on decks. The differentiator vs. Anki/Quizlet/etc.:
 * subscribers can submit a card-level patch, the deck author reviews
 * + merges, and the merge auto-creates a new version that ripples
 * through every other subscriber's smart-merge.
 *
 * The diff payload mirrors GitHub's three-way model in the small:
 *   - add:    cards to insert (server picks the next ord)
 *   - modify: replace existing cards by previous-content-hash
 *   - remove: drop cards by content-hash
 *
 * Status lifecycle:
 *   open ──merge──► merged   (creates a new deck_version)
 *   open ──close──► closed   (author OR PR-author can close)
 *   open ──reject─► rejected (author-only — distinct from "closed"
 *                             so the PR-author sees clear feedback)
 *
 * Merging bumps the deck's semver minor by default (1.2.0 → 1.3.0)
 * unless the request specifies otherwise. Author can override at
 * merge-time.
 */

import { and, desc, eq } from 'drizzle-orm';
import type { Database } from '../db/connection';
import { deckPullRequests, publicDeckCards, publicDeckVersions, publicDecks } from '../db/schema';
import { hashCard, hashVersionCards } from '../lib/hash';
import { BadRequestError, ForbiddenError, NotFoundError } from '../lib/errors';

export interface PullRequestDiffInput {
	add: { type: string; fields: Record<string, string> }[];
	modify: { previousContentHash: string; type: string; fields: Record<string, string> }[];
	remove: { contentHash: string }[];
}

export interface CreatePullRequestInput {
	title: string;
	body?: string;
	diff: PullRequestDiffInput;
}

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)$/;

function bumpMinor(semver: string): string {
	const m = semver.match(SEMVER_RE);
	if (!m) return '1.0.0';
	return `${m[1]}.${Number(m[2]) + 1}.0`;
}

export class PullRequestService {
	constructor(private readonly db: Database) {}

	async create(authorUserId: string, deckSlug: string, input: CreatePullRequestInput) {
		const deck = await this.db.query.publicDecks.findFirst({
			where: eq(publicDecks.slug, deckSlug),
		});
		if (!deck) throw new NotFoundError('Deck not found');
		if (deck.isTakedown) throw new ForbiddenError('Deck under takedown');

		const total = input.diff.add.length + input.diff.modify.length + input.diff.remove.length;
		if (total === 0) throw new BadRequestError('Diff is empty');

		const [pr] = await this.db
			.insert(deckPullRequests)
			.values({
				deckId: deck.id,
				authorUserId,
				title: input.title,
				body: input.body,
				status: 'open',
				diff: {
					add: input.diff.add,
					modify: input.diff.modify.map((m) => ({
						contentHash: m.previousContentHash,
						fields: m.fields,
					})),
					remove: input.diff.remove,
				},
			})
			.returning();
		return pr;
	}

	async list(deckSlug: string, status?: 'open' | 'merged' | 'closed' | 'rejected') {
		const deck = await this.db.query.publicDecks.findFirst({
			where: eq(publicDecks.slug, deckSlug),
		});
		if (!deck) throw new NotFoundError('Deck not found');

		const where = status
			? and(eq(deckPullRequests.deckId, deck.id), eq(deckPullRequests.status, status))
			: eq(deckPullRequests.deckId, deck.id);
		return this.db
			.select()
			.from(deckPullRequests)
			.where(where)
			.orderBy(desc(deckPullRequests.createdAt));
	}

	async get(prId: string) {
		const pr = await this.db.query.deckPullRequests.findFirst({
			where: eq(deckPullRequests.id, prId),
		});
		if (!pr) throw new NotFoundError('Pull request not found');
		return pr;
	}

	async close(actorUserId: string, prId: string): Promise<void> {
		const pr = await this.get(prId);
		const deck = await this.db.query.publicDecks.findFirst({
			where: eq(publicDecks.id, pr.deckId),
		});
		if (!deck) throw new NotFoundError('Deck not found');
		// Either the deck owner or the PR author can close.
		if (pr.authorUserId !== actorUserId && deck.ownerUserId !== actorUserId) {
			throw new ForbiddenError('Only PR author or deck owner can close');
		}
		if (pr.status !== 'open') throw new BadRequestError(`PR already ${pr.status}`);
		await this.db
			.update(deckPullRequests)
			.set({ status: 'closed', resolvedAt: new Date() })
			.where(eq(deckPullRequests.id, prId));
	}

	async reject(actorUserId: string, prId: string): Promise<void> {
		const pr = await this.get(prId);
		const deck = await this.db.query.publicDecks.findFirst({
			where: eq(publicDecks.id, pr.deckId),
		});
		if (!deck) throw new NotFoundError('Deck not found');
		if (deck.ownerUserId !== actorUserId) {
			throw new ForbiddenError('Only the deck owner can reject');
		}
		if (pr.status !== 'open') throw new BadRequestError(`PR already ${pr.status}`);
		await this.db
			.update(deckPullRequests)
			.set({ status: 'rejected', resolvedAt: new Date() })
			.where(eq(deckPullRequests.id, prId));
	}

	/**
	 * Merge a PR. Builds a brand-new version's card list by applying
	 * the PR's diff to the deck's latest version, then writes the
	 * usual version + cards rows and bumps `latest_version_id`.
	 *
	 * The merge happens in a single transaction so a partial failure
	 * doesn't leave the deck pointing at an empty version.
	 */
	async merge(
		actorUserId: string,
		prId: string,
		opts: { newSemver?: string; mergeNote?: string } = {}
	) {
		const pr = await this.get(prId);
		if (pr.status !== 'open') throw new BadRequestError(`PR already ${pr.status}`);

		const deck = await this.db.query.publicDecks.findFirst({
			where: eq(publicDecks.id, pr.deckId),
		});
		if (!deck) throw new NotFoundError('Deck not found');
		if (deck.ownerUserId !== actorUserId) {
			throw new ForbiddenError('Only the deck owner can merge');
		}
		if (!deck.latestVersionId) {
			throw new BadRequestError('Deck has no published version yet — publish first');
		}
		const latest = await this.db.query.publicDeckVersions.findFirst({
			where: eq(publicDeckVersions.id, deck.latestVersionId),
		});
		if (!latest) throw new NotFoundError('Latest version row missing');

		const newSemver = opts.newSemver ?? bumpMinor(latest.semver);
		if (!SEMVER_RE.test(newSemver)) {
			throw new BadRequestError(`Invalid semver: ${newSemver}`);
		}

		// Pull current cards as the base for the merge.
		const currentCards = await this.db
			.select()
			.from(publicDeckCards)
			.where(eq(publicDeckCards.versionId, latest.id))
			.orderBy(publicDeckCards.ord);

		const diff = pr.diff as {
			add: { type: string; fields: Record<string, string> }[];
			modify: { contentHash: string; fields: Record<string, string> }[];
			remove: { contentHash: string }[];
		};

		const removedHashes = new Set(diff.remove.map((r) => r.contentHash));
		const modifyByHash = new Map(diff.modify.map((m) => [m.contentHash, m.fields]));

		const merged: { type: string; fields: Record<string, string>; ord: number }[] = [];
		let nextOrd = 0;
		for (const c of currentCards) {
			if (removedHashes.has(c.contentHash)) continue;
			const replaced = modifyByHash.get(c.contentHash);
			merged.push({
				type: c.type,
				fields: replaced ?? (c.fields as Record<string, string>),
				ord: nextOrd++,
			});
		}
		for (const a of diff.add) {
			merged.push({ type: a.type, fields: a.fields, ord: nextOrd++ });
		}

		if (merged.length === 0) {
			throw new BadRequestError('Merge would result in an empty deck — refusing');
		}

		const versionContentHash = hashVersionCards(merged);

		const result = await this.db.transaction(async (tx) => {
			const [version] = await tx
				.insert(publicDeckVersions)
				.values({
					deckId: deck.id,
					semver: newSemver,
					changelog:
						opts.mergeNote ??
						`Merged PR: ${pr.title} (+${diff.add.length} added, ~${diff.modify.length} modified, −${diff.remove.length} removed)`,
					contentHash: versionContentHash,
					cardCount: merged.length,
				})
				.returning();

			await tx.insert(publicDeckCards).values(
				merged.map((c) => ({
					versionId: version.id,
					type: c.type as
						| 'basic'
						| 'basic-reverse'
						| 'cloze'
						| 'type-in'
						| 'image-occlusion'
						| 'audio'
						| 'multiple-choice',
					fields: c.fields,
					ord: c.ord,
					contentHash: hashCard({ type: c.type, fields: c.fields }),
				}))
			);

			await tx
				.update(publicDecks)
				.set({ latestVersionId: version.id })
				.where(eq(publicDecks.id, deck.id));

			await tx
				.update(deckPullRequests)
				.set({
					status: 'merged',
					mergedIntoVersionId: version.id,
					resolvedAt: new Date(),
				})
				.where(eq(deckPullRequests.id, prId));

			return { version };
		});

		return { pullRequest: { ...pr, status: 'merged' as const }, version: result.version };
	}
}
