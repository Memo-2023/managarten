/**
 * Thin client for cards-server (https://cards-api.mana.how / dev :3072).
 *
 * The auth-store provides the JWT; we never read tokens from storage
 * here directly so there's only one place that knows about token
 * lifecycle (refresh, expiry, vault).
 *
 * All endpoints under /v1 require auth; the wrapper just always
 * sends `Authorization: Bearer …`. Errors come back as Hono's
 * `{ statusCode, message, details? }` shape — we surface that to
 * callers via the typed `CardsApiError` so UIs can branch on it.
 */

import { authStore } from '$lib/stores/auth.svelte';

function baseUrl(): string {
	if (typeof window !== 'undefined') {
		const fromWindow = (window as unknown as { __PUBLIC_CARDS_API_URL__?: string })
			.__PUBLIC_CARDS_API_URL__;
		if (fromWindow) return fromWindow.replace(/\/$/, '');
	}
	return 'http://localhost:3072';
}

export class CardsApiError extends Error {
	constructor(
		public status: number,
		message: string,
		public details?: unknown
	) {
		super(message);
		this.name = 'CardsApiError';
	}
}

interface RequestOptions {
	method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
	body?: unknown;
	signal?: AbortSignal;
	/**
	 * - `true` (default): require an Authorization header — throws 401 if no token.
	 * - `'optional'`: include token if available, otherwise send anonymously.
	 * - `false`: never send a token.
	 */
	auth?: boolean | 'optional';
}

async function request<T>(path: string, opts: RequestOptions = {}): Promise<T> {
	const headers: Record<string, string> = {};
	if (opts.body !== undefined) headers['Content-Type'] = 'application/json';
	if (opts.auth === 'optional') {
		// Best-effort: include token if present, otherwise anonymous.
		const token = await authStore.getValidToken?.();
		if (token) headers['Authorization'] = `Bearer ${token}`;
	} else if (opts.auth !== false) {
		const token = await authStore.getValidToken?.();
		if (!token) throw new CardsApiError(401, 'Not signed in');
		headers['Authorization'] = `Bearer ${token}`;
	}

	const res = await fetch(`${baseUrl()}${path}`, {
		method: opts.method ?? 'GET',
		headers,
		body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
		signal: opts.signal,
	});

	if (res.status === 204) return undefined as T;

	const text = await res.text();
	const json: unknown = text ? safeJsonParse(text) : null;

	if (!res.ok) {
		const payload = (json ?? {}) as { message?: string; details?: unknown };
		throw new CardsApiError(res.status, payload.message ?? `HTTP ${res.status}`, payload.details);
	}
	return json as T;
}

function safeJsonParse(s: string): unknown {
	try {
		return JSON.parse(s);
	} catch {
		return s;
	}
}

// ─── Authors ────────────────────────────────────────────────

export interface Author {
	userId: string;
	slug: string;
	displayName: string;
	bio: string | null;
	avatarUrl: string | null;
	pseudonym: boolean;
	verifiedMana: boolean;
	verifiedCommunity: boolean;
	bannedAt: string | null;
}

export interface PublicAuthor {
	slug: string;
	displayName: string;
	bio: string | null;
	avatarUrl: string | null;
	joinedAt: string;
	pseudonym: boolean;
	verifiedMana: boolean;
	verifiedCommunity: boolean;
	banned: boolean;
}

export const cardsApi = {
	authors: {
		me: () => request<Author | null>('/v1/authors/me'),
		upsertMe: (input: {
			slug: string;
			displayName: string;
			bio?: string;
			avatarUrl?: string;
			pseudonym?: boolean;
		}) => request<Author>('/v1/authors/me', { method: 'POST', body: input }),
		bySlug: (slug: string) => request<PublicAuthor>(`/v1/authors/${encodeURIComponent(slug)}`),
	},
	decks: {
		init: (input: {
			slug: string;
			title: string;
			description?: string;
			language?: string;
			license?: string;
			priceCredits?: number;
		}) => request<PublicDeck>('/v1/decks', { method: 'POST', body: input }),
		bySlug: (slug: string) =>
			request<{ deck: PublicDeck; latestVersion: PublicDeckVersion | null }>(
				`/v1/decks/${encodeURIComponent(slug)}`,
				{ auth: 'optional' }
			),
		publish: (
			slug: string,
			input: {
				semver: string;
				changelog?: string;
				cards: { type: string; fields: Record<string, string> }[];
			}
		) =>
			request<PublishResult>(`/v1/decks/${encodeURIComponent(slug)}/publish`, {
				method: 'POST',
				body: input,
			}),
		star: (slug: string) =>
			request<{ ok: true }>(`/v1/decks/${encodeURIComponent(slug)}/star`, { method: 'POST' }),
		unstar: (slug: string) =>
			request<{ ok: true }>(`/v1/decks/${encodeURIComponent(slug)}/star`, { method: 'DELETE' }),
	},
	explore: {
		landing: () =>
			request<{ featured: DeckSummary[]; trending: DeckSummary[] }>('/v1/explore', {
				auth: 'optional',
			}),
		browse: (params: {
			q?: string;
			tag?: string;
			lang?: string;
			author?: string;
			sort?: 'recent' | 'popular' | 'trending';
			limit?: number;
			offset?: number;
		}) => {
			const qs = new URLSearchParams();
			for (const [k, v] of Object.entries(params)) {
				if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
			}
			const path = `/v1/decks${qs.toString() ? '?' + qs.toString() : ''}`;
			return request<{ items: DeckSummary[]; total: number }>(path, { auth: 'optional' });
		},
		tags: () => request<TagDefinition[]>('/v1/tags', { auth: 'optional' }),
	},
	follows: {
		follow: (authorSlug: string) =>
			request<{ ok: true }>(`/v1/authors/${encodeURIComponent(authorSlug)}/follow`, {
				method: 'POST',
			}),
		unfollow: (authorSlug: string) =>
			request<{ ok: true }>(`/v1/authors/${encodeURIComponent(authorSlug)}/follow`, {
				method: 'DELETE',
			}),
	},
	subscriptions: {
		list: () => request<SubscriptionInfo[]>('/v1/me/subscriptions'),
		subscribe: (deckSlug: string) =>
			request<{ deckSlug: string; latestVersionId: string }>(
				`/v1/decks/${encodeURIComponent(deckSlug)}/subscribe`,
				{ method: 'POST' }
			),
		unsubscribe: (deckSlug: string) =>
			request<{ ok: true }>(`/v1/decks/${encodeURIComponent(deckSlug)}/subscribe`, {
				method: 'DELETE',
			}),
		version: (deckSlug: string, semver: string) =>
			request<DeckVersionPayload>(
				`/v1/decks/${encodeURIComponent(deckSlug)}/versions/${encodeURIComponent(semver)}`,
				{ auth: 'optional' }
			),
		diff: (deckSlug: string, fromSemver: string) =>
			request<DiffPayload>(
				`/v1/decks/${encodeURIComponent(deckSlug)}/diff?from=${encodeURIComponent(fromSemver)}`,
				{ auth: 'optional' }
			),
	},
	pullRequests: {
		create: (
			deckSlug: string,
			input: {
				title: string;
				body?: string;
				diff: PullRequestDiffInput;
			}
		) =>
			request<PullRequest>(`/v1/decks/${encodeURIComponent(deckSlug)}/pull-requests`, {
				method: 'POST',
				body: input,
			}),
		list: (deckSlug: string, status?: 'open' | 'merged' | 'closed' | 'rejected') => {
			const qs = status ? `?status=${status}` : '';
			return request<PullRequest[]>(
				`/v1/decks/${encodeURIComponent(deckSlug)}/pull-requests${qs}`,
				{ auth: 'optional' }
			);
		},
		get: (id: string) => request<PullRequest>(`/v1/pull-requests/${id}`, { auth: 'optional' }),
		merge: (id: string, opts: { newSemver?: string; mergeNote?: string } = {}) =>
			request<{ pullRequest: PullRequest; version: PublicDeckVersion }>(
				`/v1/pull-requests/${id}/merge`,
				{ method: 'POST', body: opts }
			),
		close: (id: string) =>
			request<{ ok: true }>(`/v1/pull-requests/${id}/close`, { method: 'POST' }),
		reject: (id: string) =>
			request<{ ok: true }>(`/v1/pull-requests/${id}/reject`, { method: 'POST' }),
	},
	discussions: {
		listForCard: (contentHash: string) =>
			request<CardDiscussion[]>(`/v1/cards/${encodeURIComponent(contentHash)}/discussions`, {
				auth: 'optional',
			}),
		post: (contentHash: string, input: { deckSlug: string; body: string; parentId?: string }) =>
			request<CardDiscussion>(`/v1/cards/${encodeURIComponent(contentHash)}/discussions`, {
				method: 'POST',
				body: input,
			}),
		hide: (id: string) => request<{ ok: true }>(`/v1/discussions/${id}/hide`, { method: 'POST' }),
	},
};

// Override author lookup to send token opportunistically — public reads.
cardsApi.authors.bySlug = (slug: string) =>
	request<PublicAuthor>(`/v1/authors/${encodeURIComponent(slug)}`, { auth: 'optional' });

export interface DeckSummary {
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
	createdAt: string;
	owner: {
		slug: string;
		displayName: string;
		verifiedMana: boolean;
		verifiedCommunity: boolean;
	};
}

export interface TagDefinition {
	id: string;
	slug: string;
	name: string;
	parentId: string | null;
	description: string | null;
	curated: boolean;
	createdAt: string;
}

export interface PublicDeck {
	id: string;
	slug: string;
	title: string;
	description: string | null;
	language: string | null;
	license: string;
	priceCredits: number;
	ownerUserId: string;
	latestVersionId: string | null;
	isFeatured: boolean;
	isTakedown: boolean;
	createdAt: string;
}

export interface PublicDeckVersion {
	id: string;
	deckId: string;
	semver: string;
	changelog: string | null;
	contentHash: string;
	cardCount: number;
	publishedAt: string;
	deprecatedAt: string | null;
}

export interface PublishResult {
	deck: PublicDeck;
	version: PublicDeckVersion;
	moderation: { verdict: 'pass' | 'flag' | 'block'; categories: string[] };
}

export interface SubscriptionInfo {
	deckSlug: string;
	deckTitle: string;
	deckDescription: string | null;
	subscribedAt: string;
	notifyUpdates: boolean;
	currentVersionId: string | null;
	latestVersionId: string | null;
	updateAvailable: boolean;
}

export interface ServerCard {
	contentHash: string;
	type: string;
	fields: Record<string, string>;
	ord: number;
}

export interface DeckVersionPayload {
	id: string;
	semver: string;
	contentHash: string;
	publishedAt: string;
	changelog: string | null;
	cards: ServerCard[];
}

export interface DiffPayload {
	from: string;
	to: string;
	added: ServerCard[];
	changed: { previous: { contentHash: string }; next: ServerCard }[];
	unchanged: { contentHash: string; ord: number }[];
	removed: { contentHash: string }[];
}

export interface PullRequestDiffInput {
	add: { type: string; fields: Record<string, string> }[];
	modify: { previousContentHash: string; type: string; fields: Record<string, string> }[];
	remove: { contentHash: string }[];
}

export type PullRequestStatus = 'open' | 'merged' | 'closed' | 'rejected';

export interface PullRequest {
	id: string;
	deckId: string;
	authorUserId: string;
	status: PullRequestStatus;
	title: string;
	body: string | null;
	diff: {
		add: { type: string; fields: Record<string, string> }[];
		modify: { contentHash: string; fields: Record<string, string> }[];
		remove: { contentHash: string }[];
	};
	mergedIntoVersionId: string | null;
	createdAt: string;
	resolvedAt: string | null;
}

export interface CardDiscussion {
	id: string;
	cardContentHash: string;
	deckId: string;
	authorUserId: string;
	parentId: string | null;
	body: string;
	hidden: boolean;
	createdAt: string;
}
