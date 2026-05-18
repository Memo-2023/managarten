/**
 * Cross-App-Share-via-uLoad — HTTP-Client (Federation-Mode).
 *
 * Bis 2026-05-18 schrieb diese Lib in eine eigene Dexie-DB mit
 * `appId: 'uload'` und liess `mana-sync` die Records in
 * `mana_sync.sync_changes` schieben. Seit der uLoad-Cutover-Migration
 * (Code/uload/ als eigenständiges Hono+Bun-Repo + eigene `mana_uload`-
 * Postgres) ist `mana_sync` kein Konsument mehr — wir schreiben jetzt
 * direkt über HTTP gegen die föderierte uload-API.
 *
 * **Init:** Caller muss `initSharedUload({ apiUrl, getAuthToken })`
 * aufrufen, **bevor** `createShortLink` benutzbar ist.
 *
 *   - `apiUrl`: Origin der uload-API (`https://uload-api.mana.how`
 *     in prod, `http://localhost:3107` lokal).
 *   - `getAuthToken`: Async-Getter, der einen aktuellen Bearer-Token
 *     liefert (in der mana-Web-App via `authStore.getValidToken()`).
 *
 * Backwards-Compat: das alte Init-Pattern (mit `linkCollection`-
 * Argument) ist **entfernt**. Wer noch die Dexie-Variante braucht,
 * muss eigenen Code schreiben — die uLoad-Plattform-Dexie existiert
 * nicht mehr.
 */

import type { CreateShortLinkOptions, CreatedLink } from './types';
import { getQrCodeUrl, getShortUrl } from './utils';

interface SharedUloadConfig {
	/** Origin der uload-API, z.B. `https://uload-api.mana.how`. */
	apiUrl: string;
	/** Bearer-Token-Getter; null/undefined → kein Authorization-Header gesetzt → 401. */
	getAuthToken: () => Promise<string | null> | string | null;
	/** Optional: Kurz-Domain für getShortUrl-Mapping, default `https://ulo.ad`. */
	shortUrlOrigin?: string;
}

let _config: SharedUloadConfig | null = null;

export function initSharedUload(config: SharedUloadConfig): void {
	_config = {
		...config,
		apiUrl: config.apiUrl.replace(/\/$/, ''),
		shortUrlOrigin: config.shortUrlOrigin ?? 'https://ulo.ad',
	};
}

export function isSharedUloadReady(): boolean {
	return _config !== null;
}

export function getBaseUrl(): string | undefined {
	return _config?.shortUrlOrigin;
}

/**
 * Erzeugt einen Kurzlink über die uload-API.
 *
 * Wirft, wenn `initSharedUload` nicht aufgerufen wurde, oder wenn die
 * API einen Fehler liefert (z.B. 401 ohne Token, 409 bei Slug-Kollision,
 * 400 bei invalidem Body).
 */
export async function createShortLink(options: CreateShortLinkOptions): Promise<CreatedLink> {
	if (!_config) {
		throw new Error(
			'@mana/shared-uload not initialized. Call initSharedUload({ apiUrl, getAuthToken }) in your app layout.'
		);
	}

	const token = await _config.getAuthToken();

	const body: Record<string, unknown> = {
		originalUrl: options.url,
	};
	if (options.title) body.title = options.title;
	if (options.description) body.description = options.description;
	if (options.customCode) body.customCode = options.customCode;
	if (options.expiresAt) body.expiresAt = options.expiresAt;
	if (options.password) body.password = options.password;
	if (options.source) body.source = options.source;

	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
	};
	if (token) headers.Authorization = `Bearer ${token}`;

	const res = await fetch(`${_config.apiUrl}/api/v1/links`, {
		method: 'POST',
		headers,
		body: JSON.stringify(body),
	});

	if (!res.ok) {
		let detail = '';
		try {
			const data = (await res.json()) as { error?: string; details?: unknown };
			detail = data.error
				? `${data.error}${data.details ? `: ${JSON.stringify(data.details)}` : ''}`
				: '';
		} catch {
			/* swallow */
		}
		if (res.status === 401) {
			throw new Error(detail || 'uload-api: nicht authentifiziert (Login abgelaufen?)');
		}
		if (res.status === 409) {
			throw new Error(detail || `uload-api: Short-Code „${options.customCode}" ist vergeben`);
		}
		throw new Error(detail || `uload-api: HTTP ${res.status}`);
	}

	const link = (await res.json()) as {
		id: string;
		shortCode: string;
		qrCodeUrl: string | null;
	};

	const shortUrl = getShortUrl(link.shortCode, _config.shortUrlOrigin);
	const qrCodeUrl = link.qrCodeUrl ?? getQrCodeUrl(shortUrl);

	return {
		id: link.id,
		shortCode: link.shortCode,
		shortUrl,
		qrCodeUrl,
	};
}
