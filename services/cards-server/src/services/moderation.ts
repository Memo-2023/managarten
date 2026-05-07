/**
 * Phase η.1 — User-submitted reports + admin actions.
 *
 * Anyone authed can file a report against a deck (optionally scoped
 * to one card via `cardContentHash`). Admins (`role === 'admin'`)
 * pull the open inbox, dismiss false positives, take a deck down, or
 * ban an author. The inbox auto-resolves all open reports for a deck
 * when a takedown lands so admins don't have to chase duplicates.
 */

import { and, desc, eq, isNull } from 'drizzle-orm';
import type { Database } from '../db/connection';
import {
	authors,
	deckPullRequests,
	deckReports,
	publicDecks,
	type reportCategoryEnum,
} from '../db/schema';
import { BadRequestError, ForbiddenError, NotFoundError } from '../lib/errors';
import type { NotifyClient } from '../lib/notify';

type ReportCategory = (typeof reportCategoryEnum.enumValues)[number];

export interface CreateReportInput {
	deckSlug: string;
	cardContentHash?: string;
	category: ReportCategory;
	body?: string;
}

export interface ResolveReportInput {
	action: 'dismiss' | 'takedown' | 'ban-author';
	notes?: string;
}

const VALID_CATEGORIES = new Set<ReportCategory>([
	'spam',
	'copyright',
	'nsfw',
	'misinformation',
	'hate',
	'other',
]);

export class ModerationService {
	constructor(
		private readonly db: Database,
		private readonly notify?: NotifyClient
	) {}

	async createReport(reporterUserId: string, input: CreateReportInput) {
		if (!VALID_CATEGORIES.has(input.category)) {
			throw new BadRequestError(`Unknown report category: ${input.category}`);
		}
		const deck = await this.db.query.publicDecks.findFirst({
			where: eq(publicDecks.slug, input.deckSlug),
		});
		if (!deck) throw new NotFoundError('Deck not found');

		const [row] = await this.db
			.insert(deckReports)
			.values({
				deckId: deck.id,
				versionId: deck.latestVersionId ?? null,
				cardContentHash: input.cardContentHash ?? null,
				reporterUserId,
				category: input.category,
				body: input.body ?? null,
			})
			.returning();
		return row;
	}

	async listOpen(limit = 50) {
		return this.db
			.select({
				id: deckReports.id,
				deckId: deckReports.deckId,
				deckSlug: publicDecks.slug,
				deckTitle: publicDecks.title,
				cardContentHash: deckReports.cardContentHash,
				reporterUserId: deckReports.reporterUserId,
				category: deckReports.category,
				body: deckReports.body,
				status: deckReports.status,
				createdAt: deckReports.createdAt,
			})
			.from(deckReports)
			.innerJoin(publicDecks, eq(deckReports.deckId, publicDecks.id))
			.where(eq(deckReports.status, 'open'))
			.orderBy(desc(deckReports.createdAt))
			.limit(limit);
	}

	async resolveReport(adminUserId: string, reportId: string, input: ResolveReportInput) {
		const report = await this.db.query.deckReports.findFirst({
			where: eq(deckReports.id, reportId),
		});
		if (!report) throw new NotFoundError('Report not found');
		if (report.status !== 'open') {
			throw new BadRequestError(`Report already ${report.status}`);
		}
		const deck = await this.db.query.publicDecks.findFirst({
			where: eq(publicDecks.id, report.deckId),
		});
		if (!deck) throw new NotFoundError('Deck disappeared');

		if (input.action === 'dismiss') {
			await this.markResolved(reportId, adminUserId, 'dismissed', input.notes);
			return { action: 'dismissed' as const };
		}

		if (input.action === 'takedown') {
			await this.takedownDeck(adminUserId, deck.slug, input.notes);
			await this.markResolved(reportId, adminUserId, 'actioned', input.notes);
			return { action: 'takedown' as const };
		}

		if (input.action === 'ban-author') {
			await this.banAuthor(adminUserId, deck.ownerUserId, input.notes);
			// A banned author's decks get taken down too — saves a click.
			await this.takedownDeck(adminUserId, deck.slug, input.notes ?? 'Author banned');
			await this.markResolved(reportId, adminUserId, 'actioned', input.notes);
			return { action: 'ban-author' as const };
		}

		throw new BadRequestError(`Unknown action: ${input.action as string}`);
	}

	private async markResolved(
		reportId: string,
		adminUserId: string,
		status: 'dismissed' | 'actioned',
		notes: string | undefined
	) {
		await this.db
			.update(deckReports)
			.set({
				status,
				resolvedBy: adminUserId,
				resolvedAt: new Date(),
				resolutionNotes: notes ?? null,
			})
			.where(eq(deckReports.id, reportId));
	}

	async takedownDeck(adminUserId: string, deckSlug: string, reason?: string) {
		const deck = await this.db.query.publicDecks.findFirst({
			where: eq(publicDecks.slug, deckSlug),
		});
		if (!deck) throw new NotFoundError('Deck not found');
		if (deck.isTakedown) return { alreadyDown: true };

		await this.db.transaction(async (tx) => {
			await tx
				.update(publicDecks)
				.set({
					isTakedown: true,
					takedownAt: new Date(),
					takedownReason: reason ?? 'Moderation action',
				})
				.where(eq(publicDecks.id, deck.id));

			// Auto-close any other open reports against the same deck.
			await tx
				.update(deckReports)
				.set({
					status: 'actioned',
					resolvedBy: adminUserId,
					resolvedAt: new Date(),
					resolutionNotes: 'Auto-closed by takedown',
				})
				.where(and(eq(deckReports.deckId, deck.id), eq(deckReports.status, 'open')));

			// Open PRs against the deck are no longer mergeable; mark them
			// closed so authors / contributors see clear state.
			await tx
				.update(deckPullRequests)
				.set({
					status: 'closed',
					resolvedAt: new Date(),
				})
				.where(and(eq(deckPullRequests.deckId, deck.id), eq(deckPullRequests.status, 'open')));
		});

		if (this.notify) {
			void this.notify.send({
				channel: 'email',
				userId: deck.ownerUserId,
				subject: `Dein Deck „${deck.title}" wurde entfernt`,
				body: `Dein Deck „${deck.title}" wurde von der Moderation entfernt.${
					reason ? `\n\nGrund: ${reason}` : ''
				}\n\nDu hast 30 Tage Zeit, gegen die Entscheidung Einspruch einzulegen.`,
				data: {
					type: 'cards.deck.takedown',
					deckSlug: deck.slug,
					reason: reason ?? null,
				},
				externalId: `cards.deck.takedown.${deck.id}`,
			});
		}

		return { alreadyDown: false };
	}

	async banAuthor(adminUserId: string, targetUserId: string, reason?: string) {
		const author = await this.db.query.authors.findFirst({
			where: eq(authors.userId, targetUserId),
		});
		if (!author) throw new NotFoundError('Author not found');
		if (author.bannedAt) return { alreadyBanned: true };

		await this.db
			.update(authors)
			.set({ bannedAt: new Date() })
			.where(eq(authors.userId, targetUserId));

		// Take down every deck owned by the banned author.
		const banned = await this.db
			.select({ slug: publicDecks.slug })
			.from(publicDecks)
			.where(and(eq(publicDecks.ownerUserId, targetUserId), eq(publicDecks.isTakedown, false)));
		for (const d of banned) {
			await this.takedownDeck(adminUserId, d.slug, reason ?? 'Author banned');
		}

		return { alreadyBanned: false };
	}

	async setVerifiedMana(adminUserId: string, authorSlug: string, verified: boolean) {
		void adminUserId;
		const author = await this.db.query.authors.findFirst({
			where: eq(authors.slug, authorSlug),
		});
		if (!author) throw new NotFoundError('Author not found');
		await this.db
			.update(authors)
			.set({ verifiedMana: verified })
			.where(eq(authors.userId, author.userId));

		if (this.notify) {
			void this.notify.send({
				channel: 'email',
				userId: author.userId,
				subject: verified ? '🛡️ Du bist jetzt Mana-Verifiziert' : 'Mana-Verifizierung entzogen',
				body: verified
					? 'Mana-e.V. hat dich als verifizierten Author bestätigt. Dein Author-Cut steigt von 80% auf 90%.'
					: 'Deine Mana-Verifizierung wurde entzogen. Bei Fragen: kontakt@mana.how.',
				data: {
					type: 'cards.author.verified',
					authorSlug,
					verified,
				},
				externalId: `cards.author.verified.${author.userId}.${verified ? '1' : '0'}.${Date.now()}`,
			});
		}

		return { authorSlug, verifiedMana: verified };
	}

	/**
	 * Lift a takedown — used during appeals. Reports stay closed.
	 */
	async restoreDeck(adminUserId: string, deckSlug: string) {
		void adminUserId;
		const deck = await this.db.query.publicDecks.findFirst({
			where: eq(publicDecks.slug, deckSlug),
		});
		if (!deck) throw new NotFoundError('Deck not found');
		if (!deck.isTakedown) throw new BadRequestError('Deck is not under takedown');

		await this.db
			.update(publicDecks)
			.set({ isTakedown: false, takedownAt: null, takedownReason: null })
			.where(eq(publicDecks.id, deck.id));
		void isNull;
		return { restored: true };
	}
}
