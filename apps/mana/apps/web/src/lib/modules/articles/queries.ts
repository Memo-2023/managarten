/**
 * Reactive queries + type converters for the Articles module.
 *
 * Reads always flow through `scopedForModule` so the current space /
 * scene-scope filter applies transparently — module code never needs
 * to know which space it's in.
 */

import { useScopedLiveQuery } from '$lib/data/scope/use-scoped-live-query.svelte';
import { deriveUpdatedAt } from '$lib/data/sync';
import { decryptRecords } from '$lib/data/crypto';
import { scopedForModule, scopedGet } from '$lib/data/scope';
import { articleTagOps } from './stores/tags.svelte';
import type {
	Article,
	ArticleImportItem,
	ArticleImportJob,
	ArticleStatus,
	Highlight,
	LocalArticle,
	LocalArticleImportItem,
	LocalArticleImportJob,
	LocalHighlight,
} from './types';

// ─── Type Converters ─────────────────────────────────────

export function toArticle(local: LocalArticle): Article {
	const now = new Date().toISOString();
	return {
		id: local.id,
		originalUrl: local.originalUrl,
		title: local.title,
		excerpt: local.excerpt ?? null,
		content: local.content,
		htmlContent: local.htmlContent ?? null,
		author: local.author ?? null,
		siteName: local.siteName ?? null,
		imageUrl: local.imageUrl ?? null,
		wordCount: local.wordCount ?? null,
		readingTimeMinutes: local.readingTimeMinutes ?? null,
		publishedAt: local.publishedAt ?? null,
		status: local.status,
		readingProgress: local.readingProgress ?? 0,
		isFavorite: local.isFavorite ?? false,
		savedAt: local.savedAt,
		readAt: local.readAt ?? null,
		userNote: local.userNote ?? null,
		extractedVersion: local.extractedVersion ?? 1,
		createdAt: local.createdAt ?? now,
		updatedAt: deriveUpdatedAt(local),
	};
}

export function toHighlight(local: LocalHighlight): Highlight {
	const now = new Date().toISOString();
	return {
		id: local.id,
		articleId: local.articleId,
		text: local.text,
		note: local.note ?? null,
		color: local.color,
		startOffset: local.startOffset,
		endOffset: local.endOffset,
		contextBefore: local.contextBefore ?? null,
		contextAfter: local.contextAfter ?? null,
		createdAt: local.createdAt ?? now,
		updatedAt: deriveUpdatedAt(local),
	};
}

// ─── Live Queries ─────────────────────────────────────────

export function useAllArticles() {
	return useScopedLiveQuery(async () => {
		const locals = await scopedForModule<LocalArticle, string>('articles', 'articles').toArray();
		const visible = locals.filter((a) => !a.deletedAt);
		const decrypted = await decryptRecords('articles', visible);
		return decrypted
			.map(toArticle)
			.sort((a, b) => (b.savedAt ?? '').localeCompare(a.savedAt ?? ''));
	}, [] as Article[]);
}

export function useArticle(id: string) {
	return useScopedLiveQuery(
		async () => {
			// scopedGet returns undefined if the article belongs to another
			// space — protects against URL-manipulated deep links.
			const local = await scopedGet<LocalArticle>('articles', id);
			if (!local || local.deletedAt) return null;
			const [decrypted] = await decryptRecords('articles', [local]);
			return decrypted ? toArticle(decrypted) : null;
		},
		null as Article | null
	);
}

/**
 * Tag IDs currently linked to this article. Live — reacts to both
 * `articleTags` junction writes and tag CRUD on the global `tags`
 * table, so the DetailView's TagField stays in sync with both sides.
 */
export function useArticleTagIds(articleId: string) {
	return useScopedLiveQuery(async () => articleTagOps.getTagIds(articleId), [] as string[]);
}

/**
 * Batched tag-id lookup for the ListView. Returns a Map keyed by
 * articleId; entries with no tags are absent from the map. Single
 * Dexie query regardless of how many articles are shown.
 */
export function useArticleTagMap(articleIds: string[]) {
	return useScopedLiveQuery(
		async () => articleTagOps.getTagIdsForMany(articleIds),
		new Map<string, string[]>()
	);
}

export interface SiteCount {
	siteName: string;
	count: number;
}

export interface ArticlesStats {
	total: number;
	unread: number;
	reading: number;
	finished: number;
	archived: number;
	favorites: number;
	savedThisWeek: number;
	finishedThisWeek: number;
	topSites: SiteCount[];
	totalHighlights: number;
}

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Aggregate stats for the dashboard widget + stats section. One live
 * query over scope-filtered articles + highlights; decrypts only the
 * articles (needed for title-based top-sites grouping).
 */
export function useStats() {
	return useScopedLiveQuery(
		async () => {
			const [articleRows, highlightRows] = await Promise.all([
				scopedForModule<LocalArticle, string>('articles', 'articles').toArray(),
				scopedForModule<LocalHighlight, string>('articles', 'articleHighlights').toArray(),
			]);
			const visible = articleRows.filter((a) => !a.deletedAt);
			const decrypted = await decryptRecords('articles', visible);

			const now = Date.now();
			const weekAgo = now - WEEK_MS;

			const byStatus: Record<ArticleStatus, number> = {
				unread: 0,
				reading: 0,
				finished: 0,
				archived: 0,
			};
			let favorites = 0;
			let savedThisWeek = 0;
			let finishedThisWeek = 0;
			const siteCounts = new Map<string, number>();

			for (const a of decrypted) {
				byStatus[a.status] = (byStatus[a.status] ?? 0) + 1;
				if (a.isFavorite) favorites++;
				const savedTs = a.savedAt ? Date.parse(a.savedAt) : NaN;
				if (Number.isFinite(savedTs) && savedTs >= weekAgo) savedThisWeek++;
				const readTs = a.readAt ? Date.parse(a.readAt) : NaN;
				if (Number.isFinite(readTs) && readTs >= weekAgo) finishedThisWeek++;
				if (a.siteName) {
					siteCounts.set(a.siteName, (siteCounts.get(a.siteName) ?? 0) + 1);
				}
			}

			const topSites: SiteCount[] = [...siteCounts.entries()]
				.map(([siteName, count]) => ({ siteName, count }))
				.sort((a, b) => b.count - a.count)
				.slice(0, 5);

			const totalHighlights = highlightRows.filter((h) => !h.deletedAt).length;

			return {
				total: decrypted.length,
				unread: byStatus.unread,
				reading: byStatus.reading,
				finished: byStatus.finished,
				archived: byStatus.archived,
				favorites,
				savedThisWeek,
				finishedThisWeek,
				topSites,
				totalHighlights,
			} satisfies ArticlesStats;
		},
		{
			total: 0,
			unread: 0,
			reading: 0,
			finished: 0,
			archived: 0,
			favorites: 0,
			savedThisWeek: 0,
			finishedThisWeek: 0,
			topSites: [],
			totalHighlights: 0,
		} as ArticlesStats
	);
}

/**
 * Cross-article highlights query for `/articles/highlights`. Fetches
 * all articles + all highlights in the active scope, pairs them up,
 * and returns rows shaped for rendering as a chronological collection.
 * Articles without highlights are excluded.
 */
export interface HighlightWithArticle {
	highlight: Highlight;
	article: Pick<Article, 'id' | 'title' | 'siteName' | 'originalUrl'>;
}

export function useAllHighlights() {
	return useScopedLiveQuery(async () => {
		const [articleRows, highlightRows] = await Promise.all([
			scopedForModule<LocalArticle, string>('articles', 'articles').toArray(),
			scopedForModule<LocalHighlight, string>('articles', 'articleHighlights').toArray(),
		]);
		const liveArticles = articleRows.filter((a) => !a.deletedAt);
		const liveHighlights = highlightRows.filter((h) => !h.deletedAt);
		if (liveHighlights.length === 0) return [] as HighlightWithArticle[];

		const [decArticles, decHighlights] = await Promise.all([
			decryptRecords('articles', liveArticles),
			decryptRecords('articleHighlights', liveHighlights),
		]);

		const byId = new Map(decArticles.map((a) => [a.id, toArticle(a)]));

		return decHighlights
			.map((h) => {
				const art = byId.get(h.articleId);
				if (!art) return null;
				return {
					highlight: toHighlight(h),
					article: {
						id: art.id,
						title: art.title,
						siteName: art.siteName,
						originalUrl: art.originalUrl,
					},
				} satisfies HighlightWithArticle;
			})
			.filter((r): r is HighlightWithArticle => r !== null)
			.sort((a, b) => (b.highlight.createdAt ?? '').localeCompare(a.highlight.createdAt ?? ''));
	}, [] as HighlightWithArticle[]);
}

export function useArticleHighlights(articleId: string) {
	return useScopedLiveQuery(async () => {
		// scopedForModule returns the scope-filtered Collection; we narrow
		// to this article in a post-filter (O(highlights per space), tiny).
		// Using scopedForModule instead of a direct indexed where() keeps the
		// scope check centralised — same pattern other modules use for
		// per-parent lookups (e.g. notes tag subsets).
		const locals = await scopedForModule<LocalHighlight, string>(
			'articles',
			'articleHighlights'
		).toArray();
		const forArticle = locals.filter((h) => h.articleId === articleId && !h.deletedAt);
		const decrypted = await decryptRecords('articleHighlights', forArticle);
		return decrypted.map(toHighlight).sort((a, b) => a.startOffset - b.startOffset);
	}, [] as Highlight[]);
}

// ─── Bulk-Import (docs/plans/articles-bulk-import.md) ────

export function toImportJob(local: LocalArticleImportJob): ArticleImportJob {
	const now = new Date().toISOString();
	return {
		id: local.id,
		totalUrls: local.totalUrls,
		status: local.status,
		startedAt: local.startedAt ?? null,
		finishedAt: local.finishedAt ?? null,
		savedCount: local.savedCount ?? 0,
		duplicateCount: local.duplicateCount ?? 0,
		errorCount: local.errorCount ?? 0,
		warningCount: local.warningCount ?? 0,
		createdAt: local.createdAt ?? now,
		updatedAt: deriveUpdatedAt(local) ?? local.createdAt ?? now,
	};
}

export function toImportItem(local: LocalArticleImportItem): ArticleImportItem {
	const now = new Date().toISOString();
	return {
		id: local.id,
		jobId: local.jobId,
		idx: local.idx,
		url: local.url,
		state: local.state,
		articleId: local.articleId ?? null,
		warning: local.warning ?? null,
		error: local.error ?? null,
		attempts: local.attempts ?? 0,
		lastAttemptAt: local.lastAttemptAt ?? null,
		createdAt: local.createdAt ?? now,
		updatedAt: deriveUpdatedAt(local) ?? local.createdAt ?? now,
	};
}

/** All bulk-import jobs in the active space, newest first. Drives the
 *  `/articles/import` index. */
export function useImportJobs() {
	return useScopedLiveQuery(async () => {
		const locals = await scopedForModule<LocalArticleImportJob, string>(
			'articles',
			'articleImportJobs'
		).toArray();
		const visible = locals.filter((j) => !j.deletedAt);
		visible.sort((a, b) => (deriveUpdatedAt(b) ?? '').localeCompare(deriveUpdatedAt(a) ?? ''));
		return visible.map(toImportJob);
	}, [] as ArticleImportJob[]);
}

/** Single job — drives the `/articles/import/[jobId]` detail header. */
export function useImportJob(jobId: string) {
	return useScopedLiveQuery(
		async () => {
			const local = await scopedGet<LocalArticleImportJob>('articleImportJobs', jobId);
			if (!local || local.deletedAt) return null;
			return toImportJob(local);
		},
		null as ArticleImportJob | null
	);
}

/** Items for one job, in the original input order. Drives the per-row
 *  list on the detail view. */
export function useImportItems(jobId: string) {
	return useScopedLiveQuery(async () => {
		const locals = await scopedForModule<LocalArticleImportItem, string>(
			'articles',
			'articleImportItems'
		).toArray();
		const forJob = locals.filter((i) => i.jobId === jobId && !i.deletedAt);
		forJob.sort((a, b) => a.idx - b.idx);
		return forJob.map(toImportItem);
	}, [] as ArticleImportItem[]);
}

// ─── Pure Helpers ─────────────────────────────────────────

export function filterByStatus(articles: Article[], status: ArticleStatus): Article[] {
	return articles.filter((a) => a.status === status);
}

export function searchArticles(articles: Article[], query: string): Article[] {
	const lower = query.toLowerCase();
	return articles.filter(
		(a) =>
			a.title.toLowerCase().includes(lower) ||
			(a.author?.toLowerCase().includes(lower) ?? false) ||
			(a.siteName?.toLowerCase().includes(lower) ?? false)
	);
}
