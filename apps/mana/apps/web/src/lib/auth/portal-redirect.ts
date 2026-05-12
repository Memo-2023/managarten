/**
 * Portal-Redirect-Helper.
 *
 * Statt einer eigenen Login-Seite leitet managarten unauthenticated User
 * an `auth.mana.how/login` weiter. Nach erfolgreichem Login landet der
 * User auf `/auth/callback?next=…`, wo der Token via SSO-Cookie geholt
 * und der Encryption-Vault entsperrt wird.
 *
 * In Dev: `PUBLIC_AUTH_WEB_URL=http://localhost:3002`.
 * In Prod: `PUBLIC_AUTH_WEB_URL=https://auth.mana.how`.
 *
 * Diese Funktion macht einen harten `window.location.href` — keinen
 * SvelteKit-`goto` — weil das Portal eine eigene Origin ist.
 */

import { env as publicEnv } from '$env/dynamic/public';

const FALLBACK_PORTAL = 'https://auth.mana.how';
const APP_ID = 'mana';

function portalUrl(): string {
	return publicEnv.PUBLIC_AUTH_WEB_URL ?? FALLBACK_PORTAL;
}

function appOrigin(): string {
	if (typeof window === 'undefined') return 'https://mana.how';
	return window.location.origin;
}

/** Baut die `/auth/callback?next=<path>`-URL für die aktuelle App. */
function callbackUrl(next: string | null | undefined): string {
	const base = appOrigin();
	const nextParam = next && next.startsWith('/') ? `?next=${encodeURIComponent(next)}` : '';
	return `${base}/auth/callback${nextParam}`;
}

export interface RedirectToPortalOptions {
	/**
	 * Pfad innerhalb der App, zu dem der User nach Login zurückgeführt
	 * werden soll. Default: der aktuelle `window.location.pathname`.
	 * Pfade ohne führenden `/` werden ignoriert.
	 */
	next?: string;
	/** Welche Portal-Page direkt öffnen — login (default) oder register. */
	target?: 'login' | 'register';
}

/** Hartes Redirect zum Auth-Portal. */
export function redirectToPortal(options: RedirectToPortalOptions = {}): void {
	if (typeof window === 'undefined') return;
	const target = options.target ?? 'login';
	const next = options.next ?? window.location.pathname + window.location.search;
	const url = new URL(`${portalUrl()}/${target}`);
	url.searchParams.set('app', APP_ID);
	url.searchParams.set('redirect', callbackUrl(next));
	window.location.href = url.toString();
}

/**
 * Liefert die Portal-URL als String (z.B. für `<a href>` in
 * server-rendered Content). Vorsicht: Bei Klick erfolgt ein voller
 * Navigation-Refresh (App-Bundle wird neu geladen).
 */
export function portalHref(options: RedirectToPortalOptions = {}): string {
	const target = options.target ?? 'login';
	const next = options.next ?? (typeof window !== 'undefined' ? window.location.pathname : '/');
	const url = new URL(`${portalUrl()}/${target}`);
	url.searchParams.set('app', APP_ID);
	url.searchParams.set('redirect', callbackUrl(next));
	return url.toString();
}
