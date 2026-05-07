/**
 * Subscriptions + version reads for Phase δ.
 *
 * `subscribe` records the user's intent and stamps the version they
 * pulled at — so the client can compute a per-card diff against
 * whatever the deck's `latest_version_id` is now. We don't push the
 * cards back: that's the client's job (it owns the local Dexie).
 *
 * `versionWithCards` returns a version's cards in stable `ord` order
 * so the client can replay them deterministically into its own DB.
 *
 * `diffSince` computes the smart-merge payload server-side: based on
 * per-card `content_hash`, classify each card in the latest version
 * as `unchanged | changed | added`, and list the hashes the latest
 * version no longer has (`removed`). Saves the client from holding
 * both versions at once.
 */

import { and, asc, eq } from 'drizzle-orm';
import type { Database } from '../db/connection';
import { deckSubscriptions, publicDeckCards, publicDeckVersions, publicDecks } from '../db/schema';
import { ConflictError, ForbiddenError, NotFoundError } from '../lib/errors';

export interface VersionPayload {
	id: string;
	semver: string;
	contentHash: string;
	publishedAt: Date;
	changelog: string | null;
	cards: VersionCardPayload[];
}

export interface VersionCardPayload {
	contentHash: string;
	type: string;
	fields: Record<string, string>;
	ord: number;
}

export interface DiffPayload {
	from: string;
	to: string;
	added: VersionCardPayload[];
	changed: { previous: { contentHash: string }; next: VersionCardPayload }[];
	unchanged: { contentHash: string; ord: number }[];
	removed: { contentHash: string }[];
}

export class SubscriptionService {
	constructor(private readonly db: Database) {}

	async subscribe(userId: string, deckSlug: string) {
		const deck = await this.db.query.publicDecks.findFirst({
			where: eq(publicDecks.slug, deckSlug),
		});
		if (!deck) throw new NotFoundError('Deck not found');
		if (deck.isTakedown) throw new ForbiddenError('Deck under takedown');
		if (!deck.latestVersionId) throw new ConflictError('Deck has no published version yet');
		// Paid decks need a purchase first — Phase ζ. For now: refuse.
		if (deck.priceCredits > 0) {
			throw new ForbiddenError('Paid decks require a purchase before subscribing (Phase ζ)');
		}

		await this.db
			.insert(deckSubscriptions)
			.values({
				userId,
				deckId: deck.id,
				currentVersionId: deck.latestVersionId,
			})
			.onConflictDoUpdate({
				target: [deckSubscriptions.userId, deckSubscriptions.deckId],
				set: { currentVersionId: deck.latestVersionId },
			});

		return { deckSlug, latestVersionId: deck.latestVersionId };
	}

	async unsubscribe(userId: string, deckSlug: string) {
		const deck = await this.db.query.publicDecks.findFirst({
			where: eq(publicDecks.slug, deckSlug),
		});
		if (!deck) throw new NotFoundError('Deck not found');
		await this.db
			.delete(deckSubscriptions)
			.where(and(eq(deckSubscriptions.userId, userId), eq(deckSubscriptions.deckId, deck.id)));
	}

	async listForUser(userId: string) {
		const rows = await this.db
			.select({
				deckSlug: publicDecks.slug,
				deckTitle: publicDecks.title,
				deckDescription: publicDecks.description,
				deckLatestVersionId: publicDecks.latestVersionId,
				subscribedAt: deckSubscriptions.subscribedAt,
				notifyUpdates: deckSubscriptions.notifyUpdates,
				currentVersionId: deckSubscriptions.currentVersionId,
			})
			.from(deckSubscriptions)
			.innerJoin(publicDecks, eq(publicDecks.id, deckSubscriptions.deckId))
			.where(eq(deckSubscriptions.userId, userId))
			.orderBy(deckSubscriptions.subscribedAt);

		return rows.map((r) => ({
			deckSlug: r.deckSlug,
			deckTitle: r.deckTitle,
			deckDescription: r.deckDescription,
			subscribedAt: r.subscribedAt,
			notifyUpdates: r.notifyUpdates,
			currentVersionId: r.currentVersionId,
			latestVersionId: r.deckLatestVersionId,
			updateAvailable:
				r.deckLatestVersionId !== null && r.currentVersionId !== r.deckLatestVersionId,
		}));
	}

	async versionWithCards(deckSlug: string, semver: string): Promise<VersionPayload> {
		const deck = await this.db.query.publicDecks.findFirst({
			where: eq(publicDecks.slug, deckSlug),
		});
		if (!deck) throw new NotFoundError('Deck not found');
		const version = await this.db.query.publicDeckVersions.findFirst({
			where: and(eq(publicDeckVersions.deckId, deck.id), eq(publicDeckVersions.semver, semver)),
		});
		if (!version) throw new NotFoundError(`Version ${semver} not found`);

		const cards = await this.db
			.select()
			.from(publicDeckCards)
			.where(eq(publicDeckCards.versionId, version.id))
			.orderBy(asc(publicDeckCards.ord));

		return {
			id: version.id,
			semver: version.semver,
			contentHash: version.contentHash,
			publishedAt: version.publishedAt,
			changelog: version.changelog,
			cards: cards.map((c) => ({
				contentHash: c.contentHash,
				type: c.type,
				fields: c.fields as Record<string, string>,
				ord: c.ord,
			})),
		};
	}

	/** Smart-merge diff: tell the client what changed since `fromSemver`. */
	async diffSince(deckSlug: string, fromSemver: string): Promise<DiffPayload> {
		const deck = await this.db.query.publicDecks.findFirst({
			where: eq(publicDecks.slug, deckSlug),
		});
		if (!deck) throw new NotFoundError('Deck not found');
		if (!deck.latestVersionId) throw new NotFoundError('Deck has no published version');

		const latestVersion = await this.db.query.publicDeckVersions.findFirst({
			where: eq(publicDeckVersions.id, deck.latestVersionId),
		});
		if (!latestVersion) throw new NotFoundError('Latest version row missing');

		const fromVersion = await this.db.query.publicDeckVersions.findFirst({
			where: and(eq(publicDeckVersions.deckId, deck.id), eq(publicDeckVersions.semver, fromSemver)),
		});
		if (!fromVersion) throw new NotFoundError(`Version ${fromSemver} not found`);

		// Empty diff if already on latest.
		if (fromVersion.id === latestVersion.id) {
			return {
				from: fromSemver,
				to: latestVersion.semver,
				added: [],
				changed: [],
				unchanged: [],
				removed: [],
			};
		}

		const [fromCards, toCards] = await Promise.all([
			this.db
				.select({ contentHash: publicDeckCards.contentHash, ord: publicDeckCards.ord })
				.from(publicDeckCards)
				.where(eq(publicDeckCards.versionId, fromVersion.id)),
			this.db
				.select()
				.from(publicDeckCards)
				.where(eq(publicDeckCards.versionId, latestVersion.id))
				.orderBy(asc(publicDeckCards.ord)),
		]);

		const fromHashes = new Set(fromCards.map((c) => c.contentHash));
		const toHashes = new Set(toCards.map((c) => c.contentHash));

		// Cards that are still here verbatim.
		const unchanged: { contentHash: string; ord: number }[] = [];
		// Brand-new cards (hash not in `from`).
		const added: VersionCardPayload[] = [];
		// Cards in `from` that vanished completely.
		const removed: { contentHash: string }[] = fromCards
			.filter((c) => !toHashes.has(c.contentHash))
			.map((c) => ({ contentHash: c.contentHash }));

		// `changed` is hard to detect without a stable card-id across
		// versions. We approximate by treating ord-position pairs that
		// neither match nor are in the unchanged set: an "added" at the
		// same ord as a "removed" → changed. Phase ε's pull-request
		// pipeline gives us a real card-lineage; until then this
		// heuristic is good enough.
		const changed: { previous: { contentHash: string }; next: VersionCardPayload }[] = [];
		const removedByOrd = new Map<number, string>();
		for (const c of fromCards) {
			if (!toHashes.has(c.contentHash)) removedByOrd.set(c.ord, c.contentHash);
		}

		for (const c of toCards) {
			if (fromHashes.has(c.contentHash)) {
				unchanged.push({ contentHash: c.contentHash, ord: c.ord });
			} else if (removedByOrd.has(c.ord)) {
				const prevHash = removedByOrd.get(c.ord)!;
				removedByOrd.delete(c.ord);
				changed.push({
					previous: { contentHash: prevHash },
					next: {
						contentHash: c.contentHash,
						type: c.type,
						fields: c.fields as Record<string, string>,
						ord: c.ord,
					},
				});
			} else {
				added.push({
					contentHash: c.contentHash,
					type: c.type,
					fields: c.fields as Record<string, string>,
					ord: c.ord,
				});
			}
		}

		// Anything left in removedByOrd is a real removal (not paired up
		// with a `changed`).
		const trueRemoved = removed.filter((r) => [...removedByOrd.values()].includes(r.contentHash));

		return {
			from: fromSemver,
			to: latestVersion.semver,
			added,
			changed,
			unchanged,
			removed: trueRemoved,
		};
	}
}
