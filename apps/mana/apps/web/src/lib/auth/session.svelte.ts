/**
 * Mana Session — schlanker Auth-Client für die App-Seite.
 *
 * **Was diese Klasse macht:** Token-Lifecycle managen (Refresh via
 * SSO-Cookie, lokale Persistierung im localStorage, proaktive
 * Auffrischung vor Ablauf, Logout). Sie macht KEINE Login/Register-
 * Flows — die laufen exklusiv über das zentrale Auth-Portal
 * (`auth.mana.how`).
 *
 * **Wie der Flow läuft:**
 * 1. Unauthenticated User landet auf `/` → `+page.svelte` redirected
 *    zum Portal mit `?app=mana&redirect=<callback>`.
 * 2. User loggt sich auf dem Portal ein. Better-Auth setzt
 *    `mana_session` Cookie auf `.mana.how`.
 * 3. Browser wird zurück zur App geleitet (`/auth/callback`).
 * 4. `auth/callback/+page.svelte` ruft `session.tryRefresh()`.
 *    Der POST geht mit `credentials: 'include'` an
 *    `${MANA_AUTH_URL}/api/v1/auth/refresh` — der Browser sendet das
 *    SSO-Cookie automatisch mit. mana-auth liest das Cookie,
 *    validiert die Session, mintet einen frischen JWT und gibt ihn
 *    als JSON zurück.
 * 5. Token landet im `localStorage` (`mana.auth.accessToken`), das
 *    User-Profil (aus den JWT-Claims) in `mana.auth.user`.
 * 6. Vor jedem API-Call ruft der Caller `session.ensureFresh()` auf
 *    — wenn weniger als 60s Restlaufzeit, wird automatisch refreshed.
 *
 * **Was diese Klasse NICHT macht:** Settings-Methoden (Passkey-CRUD,
 * 2FA-Setup, Sessions-Liste, Audit-Log). Die leben in
 * `lib/auth/settings-client.ts` und nutzen den Token, den die
 * Session vorhält.
 */

import { authBaseUrl as resolveAuthBaseUrl } from '$lib/data/scope/auth-fetch';

const TOKEN_KEY = 'mana.auth.accessToken';
const USER_KEY = 'mana.auth.user';

/**
 * Mana-Auth-API-URL.
 *
 * Resolution-Order (siehe `auth-fetch.authBaseUrl`):
 *   1. `window.__PUBLIC_MANA_AUTH_URL__` (SSR-injected, prod: `https://auth.mana.how`)
 *   2. `process.env.PUBLIC_MANA_AUTH_URL` (SSR)
 *   3. `http://localhost:3001` (dev fallback)
 *
 * KEIN `$env/dynamic/public` direkt — die Build-Time-Env in Production
 * ist `http://mana-auth:3001` (Docker-internal, vom Browser unerreichbar).
 */
function authBaseUrl(): string {
	return resolveAuthBaseUrl();
}

export interface SessionUser {
	id: string;
	email: string;
	name: string | null;
	role: string;
	tier: string;
	twoFactorEnabled?: boolean;
}

interface JwtClaims {
	sub: string;
	email?: string;
	name?: string;
	role?: string;
	tier?: string;
	twoFactorEnabled?: boolean;
	exp?: number;
}

function decodeJwt(token: string): JwtClaims | null {
	try {
		const [, payload] = token.split('.');
		if (!payload) return null;
		const base64 = payload.replace(/-/g, '+').replace(/_/g, '/');
		const padded = base64 + '='.repeat((4 - (base64.length % 4)) % 4);
		const json =
			typeof atob === 'function' ? atob(padded) : Buffer.from(padded, 'base64').toString('utf8');
		return JSON.parse(json) as JwtClaims;
	} catch {
		return null;
	}
}

function isExpired(claims: JwtClaims | null): boolean {
	if (!claims?.exp) return false;
	return claims.exp * 1000 <= Date.now();
}

function userFromClaims(claims: JwtClaims): SessionUser {
	return {
		id: claims.sub,
		email: claims.email ?? '',
		name: claims.name ?? null,
		role: claims.role ?? 'user',
		tier: claims.tier ?? 'public',
		twoFactorEnabled: claims.twoFactorEnabled,
	};
}

class Session {
	token = $state<string | null>(null);
	user = $state<SessionUser | null>(null);
	initialized = $state(false);
	loading = $state(false);

	private refreshing: Promise<boolean> | null = null;

	get isAuthenticated(): boolean {
		return !!this.user && !!this.token;
	}

	/**
	 * Einmaliger Boot-Pass: lädt persistierte Tokens, validiert sie,
	 * versucht stillschweigend eine SSO-Refresh wenn der lokale Token
	 * abgelaufen ist (Cookie könnte noch leben).
	 */
	async initialize(): Promise<void> {
		if (this.initialized) return;
		this.initialized = true;
		if (typeof window === 'undefined') return;

		const stored = window.localStorage.getItem(TOKEN_KEY);
		const userJson = window.localStorage.getItem(USER_KEY);

		if (stored && userJson) {
			const claims = decodeJwt(stored);
			if (claims && !isExpired(claims)) {
				this.token = stored;
				try {
					this.user = JSON.parse(userJson) as SessionUser;
				} catch {
					this.user = userFromClaims(claims);
				}
				return;
			}
			if (claims) {
				// JWT abgelaufen — versuche stillschweigend zu refreshen
				// (SSO-Cookie kann noch leben).
				try {
					this.user = JSON.parse(userJson) as SessionUser;
				} catch {
					this.user = userFromClaims(claims);
				}
				const ok = await this.tryRefresh();
				if (!ok) this.clearLocal();
				return;
			}
		}

		// Kein Token lokal — letzter Versuch: vielleicht haben wir
		// trotzdem ein SSO-Cookie (z.B. anderer Tab hat eingeloggt).
		await this.tryRefresh();
	}

	/**
	 * Holt einen frischen JWT vom Server. Benötigt das SSO-Cookie
	 * (wird vom Browser automatisch mitgesendet).
	 *
	 * Returns `true` wenn der Refresh erfolgreich war, sonst `false`.
	 * Bei `false` ist die Session geleert worden.
	 */
	async tryRefresh(): Promise<boolean> {
		if (this.refreshing) return this.refreshing;
		this.refreshing = (async () => {
			try {
				const res = await fetch(`${authBaseUrl()}/api/v1/auth/refresh`, {
					method: 'POST',
					credentials: 'include',
				});
				if (!res.ok) return false;
				const data = (await res.json()) as { accessToken?: string };
				if (!data.accessToken) return false;
				this.token = data.accessToken;
				const claims = decodeJwt(data.accessToken);
				if (claims) {
					this.user = userFromClaims(claims);
				}
				this.persist();
				return true;
			} catch {
				return false;
			} finally {
				this.refreshing = null;
			}
		})();
		return this.refreshing;
	}

	/**
	 * Lädt das User-Profil aus dem aktuell gehaltenen Token. Aufrufen
	 * direkt nach `tryRefresh()` im Callback-Handler, damit `user` synchron
	 * gesetzt ist bevor das Layout rendert.
	 */
	loadUserFromToken(): void {
		if (!this.token) return;
		const claims = decodeJwt(this.token);
		if (!claims) return;
		this.user = userFromClaims(claims);
		this.persist();
	}

	/** Liefert den aktuellen Token. Refresht silently bei nahem Ablauf. */
	async getValidToken(): Promise<string | null> {
		await this.ensureFresh();
		return this.token;
	}

	/** Synchroner Getter — kein Refresh. Nutzt das, was lokal liegt. */
	getAccessToken(): string | null {
		return this.token;
	}

	/** Wenn der Token <60s Restlaufzeit hat: refreshen. */
	async ensureFresh(): Promise<void> {
		if (!this.token) return;
		const claims = decodeJwt(this.token);
		if (!claims?.exp) return;
		const remainingMs = claims.exp * 1000 - Date.now();
		if (remainingMs < 60_000) {
			await this.tryRefresh();
		}
	}

	/**
	 * Logout. Ruft den Portal-Endpoint zum Cookie-Invalidieren auf
	 * (best-effort), löscht lokale Tokens.
	 *
	 * Der Caller ist verantwortlich, danach den Redirect zum Portal
	 * zu machen (`redirectToPortal()`) — die Session selbst macht keine
	 * Navigation.
	 */
	async signOut(): Promise<void> {
		const had = !!this.token;
		this.token = null;
		this.user = null;
		this.clearLocal();
		if (had && typeof window !== 'undefined') {
			try {
				await fetch(`${authBaseUrl()}/api/v1/auth/logout`, {
					method: 'POST',
					credentials: 'include',
				});
			} catch {
				// Best-effort — auch ohne Server-Logout ist der lokale
				// Token weg und der Caller leitet eh zum Portal weiter.
			}
		}
	}

	/** Komplett-Reset ohne Server-Call (z.B. bei API-401). */
	clear(): void {
		this.token = null;
		this.user = null;
		this.clearLocal();
	}

	private persist(): void {
		if (typeof window === 'undefined') return;
		if (this.token) window.localStorage.setItem(TOKEN_KEY, this.token);
		else window.localStorage.removeItem(TOKEN_KEY);
		if (this.user) window.localStorage.setItem(USER_KEY, JSON.stringify(this.user));
		else window.localStorage.removeItem(USER_KEY);
	}

	private clearLocal(): void {
		if (typeof window === 'undefined') return;
		window.localStorage.removeItem(TOKEN_KEY);
		window.localStorage.removeItem(USER_KEY);
	}
}

/** Singleton — die ganze App nutzt diese Instanz. */
export const session = new Session();

/** Internal helper für andere Auth-Module (settings-client, vault-unlock). */
export function _authBaseUrl(): string {
	return authBaseUrl();
}
