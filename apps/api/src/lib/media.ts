/**
 * Shared media helper — routes image uploads through mana-media
 * for CAS deduplication, thumbnail generation, and Photos gallery visibility.
 */

import { MediaClient, type MediaResult } from '@mana/media-client';

const MEDIA_URL = process.env.MANA_MEDIA_URL || 'http://localhost:3015';
let client: MediaClient | null = null;

function getMediaClient(): MediaClient {
	if (!client) client = new MediaClient(MEDIA_URL);
	return client;
}

export async function uploadImageToMedia(
	buffer: ArrayBuffer,
	filename: string,
	options: { app: string; userId: string }
): Promise<MediaResult> {
	return getMediaClient().upload(buffer, {
		app: options.app,
		userId: options.userId,
		filename,
	});
}

export function getMediaUrls(mediaId: string) {
	const c = getMediaClient();
	return {
		original: c.getOriginalUrl(mediaId),
		thumbnail: c.getThumbnailUrl(mediaId),
		medium: c.getMediumUrl(mediaId),
		large: c.getLargeUrl(mediaId),
	};
}

export function isImageMimeType(mimeType: string): boolean {
	return mimeType.startsWith('image/') && mimeType !== 'image/svg+xml';
}

/**
 * Download a media file by id. The mana-media `/file` route is CDN-style
 * public — no auth on the URL itself — so this is a plain fetch. Callers
 * that need to gate on ownership MUST call `verifyMediaOwnership` first.
 */
export async function getMediaBuffer(
	mediaId: string
): Promise<{ buffer: ArrayBuffer; mimeType: string }> {
	const url = getMediaClient().getOriginalUrl(mediaId);
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`mana-media fetch failed for ${mediaId}: HTTP ${res.status}`);
	}
	const mimeType = res.headers.get('content-type') ?? 'application/octet-stream';
	const buffer = await res.arrayBuffer();
	return { buffer, mimeType };
}

/**
 * Download a media file normalized to plain RGB PNG, max `longestSide`
 * pixels on its longer edge (default 1024). Uses mana-media's `/transform`
 * endpoint, which pipes the original through `sharp` server-side — that
 * handles HEIC from iPhones, palette-mode PNGs, CMYK JPEGs, weird color
 * profiles, and other formats OpenAI's gpt-image-1 rejects with
 * `invalid_image_file` or `Invalid image file or mode`.
 *
 * `fit=inside` preserves aspect ratio (no distortion on portrait/landscape
 * refs) and only caps the longer side, which keeps payloads comfortably
 * under OpenAI's 4 MB/image limit without losing reference fidelity.
 */
export async function getMediaBufferAsPng(
	mediaId: string,
	longestSide = 1024
): Promise<{ buffer: ArrayBuffer; mimeType: 'image/png' }> {
	const base = getMediaClient()
		.getOriginalUrl(mediaId)
		.replace(/\/file$/, '/transform');
	const url = `${base}?format=png&w=${longestSide}&h=${longestSide}&fit=inside`;
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(`mana-media transform failed for ${mediaId}: HTTP ${res.status}`);
	}
	const buffer = await res.arrayBuffer();
	return { buffer, mimeType: 'image/png' };
}

/**
 * Verify that every id in `mediaIds` is owned by `userId` under one of
 * the given app scopes. Throws `{ status: 404, missing }` when any id
 * doesn't land in the owned set — the caller turns that into an HTTP
 * response.
 *
 * Accepts a single app string or an array. `['me']` covers the
 * portrait flow; future apps may extend the list with their own
 * upload tags.
 *
 * One `list()` round-trip per app. For N apps this is N calls, each
 * capped at 500 rows — far beyond the product's intended per-app shape
 * but the cap is the sanity fence.
 */
export async function verifyMediaOwnership(
	userId: string,
	mediaIds: readonly string[],
	apps: string | readonly string[]
): Promise<void> {
	if (mediaIds.length === 0) return;
	const appList = typeof apps === 'string' ? [apps] : apps;
	const ownedSet = new Set<string>();
	for (const app of appList) {
		const list = await getMediaClient().list({ userId, app, limit: 500 });
		for (const m of list) ownedSet.add(m.id);
	}
	const missing = mediaIds.filter((id) => !ownedSet.has(id));
	if (missing.length > 0) {
		const err = new Error(`Reference media not owned: ${missing.join(', ')}`) as Error & {
			status?: number;
			missing?: string[];
		};
		err.status = 404;
		err.missing = missing;
		throw err;
	}
}
