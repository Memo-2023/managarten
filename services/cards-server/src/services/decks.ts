/**
 * Deck service — init + publish.
 *
 * `init` claims a slug and creates a `cards.decks` row with no
 * version yet (so authors can fiddle with metadata before their first
 * publish). `publish` runs the AI-mod first-pass, computes per-card
 * + per-version content hashes, writes a new immutable version + its
 * cards, and atomically updates `latest_version_id` on the deck.
 *
 * Per MARKETPLACE_PLAN: a `block` verdict from AI mod refuses the
 * publish outright. A `flag` verdict still publishes (so the deck
 * isn't blocked on slow human review) but writes a row into
 * `ai_moderation_log` so the moderation inbox surfaces it.
 */

import { and, eq, sql } from 'drizzle-orm';
import type { Database } from '../db/connection';
import { publicDecks, publicDeckVersions, publicDeckCards, aiModerationLog } from '../db/schema';
import { validateSlug } from '../lib/slug';
import { hashCard, hashVersionCards } from '../lib/hash';
import { moderateDeckContent } from '../lib/ai-moderation';
import { BadRequestError, ConflictError, ForbiddenError, NotFoundError } from '../lib/errors';

export interface InitDeckInput {
	slug: string;
	title: string;
	description?: string;
	language?: string;
	license?: string;
	priceCredits?: number;
}

export interface PublishInput {
	semver: string;
	changelog?: string;
	cards: {
		type:
			| 'basic'
			| 'basic-reverse'
			| 'cloze'
			| 'type-in'
			| 'image-occlusion'
			| 'audio'
			| 'multiple-choice';
		fields: Record<string, string>;
	}[];
}

export interface PublishResult {
	deck: typeof publicDecks.$inferSelect;
	version: typeof publicDeckVersions.$inferSelect;
	moderation: { verdict: 'pass' | 'flag' | 'block'; categories: string[] };
}

const SEMVER_RE = /^(\d+)\.(\d+)\.(\d+)$/;

function validatePrice(price: number, license: string) {
	if (price < 0) throw new BadRequestError('priceCredits cannot be negative');
	if (price > 0 && license !== 'Cards-Pro-Only-1.0') {
		throw new BadRequestError('Paid decks must use the Cards-Pro-Only-1.0 license');
	}
}

export class DeckService {
	constructor(
		private readonly db: Database,
		private readonly llmUrl: string
	) {}

	async init(ownerUserId: string, input: InitDeckInput) {
		const validation = validateSlug(input.slug);
		if (!validation.ok) throw new BadRequestError(`Slug invalid: ${validation.reason}`);

		const license = input.license ?? 'Cards-Personal-Use-1.0';
		const priceCredits = input.priceCredits ?? 0;
		validatePrice(priceCredits, license);

		const existing = await this.db.query.publicDecks.findFirst({
			where: eq(publicDecks.slug, input.slug),
		});
		if (existing) throw new ConflictError('Slug already taken');

		const [created] = await this.db
			.insert(publicDecks)
			.values({
				slug: input.slug,
				title: input.title,
				description: input.description,
				language: input.language,
				license,
				priceCredits,
				ownerUserId,
			})
			.returning();
		return created;
	}

	async getBySlug(slug: string) {
		const deck = await this.db.query.publicDecks.findFirst({
			where: eq(publicDecks.slug, slug),
		});
		if (!deck) throw new NotFoundError('Deck not found');

		const version = deck.latestVersionId
			? await this.db.query.publicDeckVersions.findFirst({
					where: eq(publicDeckVersions.id, deck.latestVersionId),
				})
			: null;

		return { deck, latestVersion: version };
	}

	async publish(ownerUserId: string, slug: string, input: PublishInput): Promise<PublishResult> {
		if (!SEMVER_RE.test(input.semver)) {
			throw new BadRequestError('semver must look like 1.0.0');
		}
		if (input.cards.length === 0) {
			throw new BadRequestError('A version needs at least one card');
		}

		const deck = await this.db.query.publicDecks.findFirst({
			where: eq(publicDecks.slug, slug),
		});
		if (!deck) throw new NotFoundError('Deck not found');
		if (deck.ownerUserId !== ownerUserId) {
			throw new ForbiddenError('Only the deck owner can publish');
		}
		if (deck.isTakedown) throw new ForbiddenError('Deck is under takedown');

		// semver must be strictly greater than the latest published
		// version so version history stays linear.
		if (deck.latestVersionId) {
			const latest = await this.db.query.publicDeckVersions.findFirst({
				where: eq(publicDeckVersions.id, deck.latestVersionId),
			});
			if (latest && !semverGreater(input.semver, latest.semver)) {
				throw new ConflictError(`semver ${input.semver} must be > ${latest.semver}`);
			}
		}

		// 1) AI moderation first-pass.
		const moderation = await moderateDeckContent(
			{
				title: deck.title,
				description: deck.description ?? undefined,
				cards: input.cards.map((c) => ({ fields: c.fields })),
			},
			this.llmUrl
		);
		if (moderation.verdict === 'block') {
			throw new ForbiddenError(
				`Refused by content moderation: ${moderation.rationale || 'no rationale'}`
			);
		}

		// 2) Compute hashes.
		const cardsWithOrd = input.cards.map((c, i) => ({ ...c, ord: i }));
		const versionContentHash = hashVersionCards(cardsWithOrd);

		// 3) Insert version + cards + flip latest_version_id atomically.
		const result = await this.db.transaction(async (tx) => {
			const [version] = await tx
				.insert(publicDeckVersions)
				.values({
					deckId: deck.id,
					semver: input.semver,
					changelog: input.changelog,
					contentHash: versionContentHash,
					cardCount: cardsWithOrd.length,
				})
				.returning();

			await tx.insert(publicDeckCards).values(
				cardsWithOrd.map((c) => ({
					versionId: version.id,
					type: c.type,
					fields: c.fields,
					ord: c.ord,
					contentHash: hashCard(c),
				}))
			);

			await tx.insert(aiModerationLog).values({
				versionId: version.id,
				verdict: moderation.verdict,
				categories: moderation.categories,
				model: moderation.model,
				rationale: moderation.rationale,
			});

			const [updatedDeck] = await tx
				.update(publicDecks)
				.set({ latestVersionId: version.id })
				.where(and(eq(publicDecks.id, deck.id)))
				.returning();

			return { deck: updatedDeck, version };
		});

		return {
			deck: result.deck,
			version: result.version,
			moderation: { verdict: moderation.verdict, categories: moderation.categories },
		};
	}
}

function semverGreater(a: string, b: string): boolean {
	const matchA = a.match(SEMVER_RE);
	const matchB = b.match(SEMVER_RE);
	if (!matchA || !matchB) return false;
	for (let i = 1; i <= 3; i++) {
		const da = Number.parseInt(matchA[i], 10);
		const db = Number.parseInt(matchB[i], 10);
		if (da > db) return true;
		if (da < db) return false;
	}
	return false;
}

// Silence unused-binding lint for `sql` import — we keep it ready for
// upcoming routes (server-side orderings / counts).
void sql;
