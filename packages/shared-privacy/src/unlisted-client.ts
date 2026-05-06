/**
 * Thin client for the mana-api unlisted-snapshot endpoints.
 *
 * Wraps the three HTTP calls the module stores make when a record's
 * visibility changes to/from 'unlisted' or its whitelisted fields get
 * edited.
 *
 * Contract:
 *   - Publish is idempotent per (user+collection+recordId). Re-calling
 *     returns the same token; the blob is updated in place.
 *   - Revoke is idempotent. Calling on a never-published record returns
 *     { revoked: 0 } cleanly.
 *   - The server's 400/410/404 responses surface as `UnlistedApiError`
 *     so callers can disambiguate "link already dead" vs. "server
 *     refused the payload".
 *
 * See docs/plans/unlisted-sharing.md §3.
 */

export interface PublishUnlistedOptions {
	/** Base URL of mana-api (e.g. http://localhost:3060). */
	apiUrl: string;
	/** Bearer token for the authenticated owner. */
	jwt: string;
	/** Dexie collection name. Must match the server's ALLOWED_COLLECTIONS. */
	collection: string;
	/** Original record id (UUID from Dexie). */
	recordId: string;
	/** Active space id — server stores this for future admin-revoke-per-space. */
	spaceId: string;
	/** Plaintext, whitelist-filtered payload. Built by the module's resolver. */
	blob: Record<string, unknown>;
	/** Optional expiry. `null` or `undefined` = never expires. */
	expiresAt?: Date | null;
	/**
	 * Owner-private metadata for headless server-side jobs (M10d forms
	 * wave-cron). The server stores it on a separate column that the
	 * public GET endpoint MUST NOT serialise — recipients + sender
	 * details belong here so they don't leak via the share-link.
	 */
	internalMeta?: Record<string, unknown> | null;
}

export interface PublishUnlistedResult {
	token: string;
	/** Full share URL the server computed from Origin/Referer/env. */
	url: string;
}

export interface RevokeUnlistedOptions {
	apiUrl: string;
	jwt: string;
	collection: string;
	recordId: string;
}

export class UnlistedApiError extends Error {
	readonly status: number;
	readonly code: string;

	constructor(message: string, status: number, code: string) {
		super(message);
		this.name = 'UnlistedApiError';
		this.status = status;
		this.code = code;
	}
}

/**
 * Publish a snapshot. Re-calling with the same (collection, recordId)
 * updates the existing row and returns the same token — so store
 * code can unconditionally call this on every edit of an unlisted
 * record without caring whether it's the first publish or a refresh.
 */
export async function publishUnlistedSnapshot(
	opts: PublishUnlistedOptions
): Promise<PublishUnlistedResult> {
	const url = `${trimSlash(opts.apiUrl)}/api/v1/unlisted/${encodeURIComponent(
		opts.collection
	)}/${encodeURIComponent(opts.recordId)}`;

	const res = await fetch(url, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: `Bearer ${opts.jwt}`,
		},
		body: JSON.stringify({
			spaceId: opts.spaceId,
			blob: opts.blob,
			expiresAt: opts.expiresAt ? opts.expiresAt.toISOString() : undefined,
			...(opts.internalMeta !== undefined ? { internalMeta: opts.internalMeta } : {}),
		}),
	});

	if (!res.ok) throw await toApiError(res, 'publish');
	const data = (await res.json()) as PublishUnlistedResult;
	return data;
}

/**
 * Revoke a snapshot. Idempotent — returns silently even if there was
 * no active snapshot to revoke. The server returns { revoked: 0|1 };
 * we don't surface that to callers (they don't need to care).
 */
export async function revokeUnlistedSnapshot(opts: RevokeUnlistedOptions): Promise<void> {
	const url = `${trimSlash(opts.apiUrl)}/api/v1/unlisted/${encodeURIComponent(
		opts.collection
	)}/${encodeURIComponent(opts.recordId)}`;

	const res = await fetch(url, {
		method: 'DELETE',
		headers: { authorization: `Bearer ${opts.jwt}` },
	});

	if (!res.ok) throw await toApiError(res, 'revoke');
}

/**
 * Build the public share URL for a token given the webapp's origin.
 * The server also returns this in the publish response — this helper
 * exists so UIs that already know the token can render the URL
 * without a round-trip.
 */
export function buildShareUrl(origin: string, token: string): string {
	return `${trimSlash(origin)}/share/${token}`;
}

// ─── Internal helpers ───────────────────────────────────

function trimSlash(s: string): string {
	return s.endsWith('/') ? s.slice(0, -1) : s;
}

async function toApiError(res: Response, op: 'publish' | 'revoke'): Promise<UnlistedApiError> {
	let payload: { error?: string; code?: string } = {};
	try {
		payload = (await res.json()) as { error?: string; code?: string };
	} catch {
		// Body not JSON — fall through with defaults.
	}
	const message = payload.error ?? `Unlisted ${op} failed (${res.status})`;
	const code = payload.code ?? 'UNKNOWN';
	return new UnlistedApiError(message, res.status, code);
}
