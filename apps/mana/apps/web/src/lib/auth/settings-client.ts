/**
 * Settings-Client — Account-Settings-Operationen (Passkey-CRUD,
 * 2FA-Setup, Sessions-Liste, Audit-Log).
 *
 * Diese Methoden brauchen einen authentisierten User. Sie ziehen
 * den Token aus dem `session`-Singleton (`session.svelte.ts`).
 *
 * Alle Calls gehen gegen `mana-auth` (BASE_URL aus
 * `PUBLIC_MANA_AUTH_URL`). Cookies werden mitgesendet (Better-Auth
 * verwaltet zusätzlich zur JWT-Auth den Session-State auch im
 * Cookie für CSRF / Re-Auth-Flows).
 */

import { _authBaseUrl, session } from './session.svelte';

async function authHeaders(): Promise<HeadersInit> {
	const token = await session.getValidToken();
	if (!token) throw new Error('Not authenticated');
	return {
		Authorization: `Bearer ${token}`,
		'Content-Type': 'application/json',
	};
}

async function expectOk(res: Response, op: string): Promise<unknown> {
	if (!res.ok) {
		const body = await res.json().catch(() => ({}));
		throw new Error(
			typeof body === 'object' && body && 'message' in body
				? String((body as { message: unknown }).message)
				: `${op} failed (HTTP ${res.status})`
		);
	}
	const text = await res.text();
	return text ? JSON.parse(text) : null;
}

// ─── Passkeys ────────────────────────────────────────────────

/** Shape, der von der UI (`PasskeyManager` aus `@mana/shared-auth-ui`) erwartet wird. */
export interface PasskeyEntry {
	id: string;
	credentialId: string;
	deviceType: string;
	backedUp: boolean;
	friendlyName: string | null;
	lastUsedAt: string | null;
	createdAt: string;
}

export interface PasskeyCapability {
	browser: boolean;
	conditionalUI: boolean;
	server: boolean;
	available: boolean;
	rpId: string | null;
}

export const passkeys = {
	async list(): Promise<PasskeyEntry[]> {
		const res = await fetch(`${_authBaseUrl()}/api/v1/auth/passkeys`, {
			credentials: 'include',
			headers: await authHeaders(),
		});
		const data = (await expectOk(res, 'passkeys.list')) as { passkeys?: PasskeyEntry[] };
		return data?.passkeys ?? [];
	},

	async capability(): Promise<PasskeyCapability> {
		const base = _authBaseUrl();
		const res = await fetch(`${base}/api/v1/auth/passkeys/capability`);
		if (!res.ok) {
			return { browser: false, conditionalUI: false, server: false, available: false, rpId: null };
		}
		const data = (await res.json()) as { enabled?: boolean; rpId?: string | null };
		const browser = typeof window !== 'undefined' && 'PublicKeyCredential' in window;
		let conditionalUI = false;
		if (browser) {
			try {
				const PKC = (window as unknown as { PublicKeyCredential: typeof PublicKeyCredential })
					.PublicKeyCredential;
				if (typeof PKC.isConditionalMediationAvailable === 'function') {
					conditionalUI = await PKC.isConditionalMediationAvailable();
				}
			} catch {
				/* ignore */
			}
		}
		const server = !!data.enabled;
		return {
			browser,
			conditionalUI,
			server,
			available: browser && server,
			rpId: data.rpId ?? null,
		};
	},

	async register(friendlyName?: string): Promise<void> {
		const { startRegistration } = await import('@simplewebauthn/browser');
		const headers = await authHeaders();

		const optionsRes = await fetch(`${_authBaseUrl()}/api/v1/auth/passkeys/register/options`, {
			method: 'POST',
			credentials: 'include',
			headers,
		});
		const webauthnOptions = (await expectOk(optionsRes, 'passkeys.register.options')) as Parameters<
			typeof startRegistration
		>[0]['optionsJSON'];

		const credential = await startRegistration({ optionsJSON: webauthnOptions });

		const verifyRes = await fetch(`${_authBaseUrl()}/api/v1/auth/passkeys/register/verify`, {
			method: 'POST',
			credentials: 'include',
			headers,
			body: JSON.stringify({ response: credential, name: friendlyName }),
		});
		await expectOk(verifyRes, 'passkeys.register.verify');
	},

	async delete(passkeyId: string): Promise<void> {
		const res = await fetch(`${_authBaseUrl()}/api/v1/auth/passkeys/${passkeyId}`, {
			method: 'DELETE',
			credentials: 'include',
			headers: await authHeaders(),
		});
		await expectOk(res, 'passkeys.delete');
	},

	async rename(passkeyId: string, friendlyName: string): Promise<void> {
		const res = await fetch(`${_authBaseUrl()}/api/v1/auth/passkeys/${passkeyId}`, {
			method: 'PATCH',
			credentials: 'include',
			headers: await authHeaders(),
			body: JSON.stringify({ name: friendlyName }),
		});
		await expectOk(res, 'passkeys.rename');
	},
};

// ─── 2FA (TOTP + Backup Codes) ───────────────────────────────

export interface TwoFactorEnableResponse {
	secret: string;
	uri: string;
	backupCodes: string[];
}

export interface BackupCodesResponse {
	backupCodes: string[];
}

export const twoFactor = {
	async enable(password: string): Promise<TwoFactorEnableResponse> {
		const res = await fetch(`${_authBaseUrl()}/api/auth/two-factor/enable`, {
			method: 'POST',
			credentials: 'include',
			headers: await authHeaders(),
			body: JSON.stringify({ password }),
		});
		const data = (await expectOk(res, 'twoFactor.enable')) as TwoFactorEnableResponse;
		// Refresh Token so der JWT den neuen `twoFactorEnabled`-Claim trägt.
		await session.tryRefresh();
		return data;
	},

	async disable(password: string): Promise<void> {
		const res = await fetch(`${_authBaseUrl()}/api/auth/two-factor/disable`, {
			method: 'POST',
			credentials: 'include',
			headers: await authHeaders(),
			body: JSON.stringify({ password }),
		});
		await expectOk(res, 'twoFactor.disable');
		await session.tryRefresh();
	},

	async generateBackupCodes(password: string): Promise<BackupCodesResponse> {
		const res = await fetch(`${_authBaseUrl()}/api/auth/two-factor/generate-backup-codes`, {
			method: 'POST',
			credentials: 'include',
			headers: await authHeaders(),
			body: JSON.stringify({ password }),
		});
		return (await expectOk(res, 'twoFactor.generateBackupCodes')) as BackupCodesResponse;
	},
};

// ─── Sessions ────────────────────────────────────────────────

/** Shape, der von der UI (`SessionManager` aus `@mana/shared-auth-ui`) erwartet wird. */
export interface SessionEntry {
	id: string;
	ipAddress: string | null;
	userAgent: string | null;
	deviceId: string | null;
	deviceName: string | null;
	lastActivityAt: string | null;
	createdAt: string;
	expiresAt: string;
}

export const sessions = {
	async list(): Promise<SessionEntry[]> {
		const res = await fetch(`${_authBaseUrl()}/api/v1/auth/sessions`, {
			credentials: 'include',
			headers: await authHeaders(),
		});
		const data = (await expectOk(res, 'sessions.list')) as { sessions?: SessionEntry[] };
		return data?.sessions ?? [];
	},

	async revoke(sessionId: string): Promise<void> {
		const res = await fetch(`${_authBaseUrl()}/api/v1/auth/sessions/${sessionId}`, {
			method: 'DELETE',
			credentials: 'include',
			headers: await authHeaders(),
		});
		await expectOk(res, 'sessions.revoke');
	},
};

// ─── Audit / Security Events ─────────────────────────────────

/** Shape, der von der UI (`AuditLog` aus `@mana/shared-auth-ui`) erwartet wird. */
export interface SecurityEvent {
	id: string;
	eventType: string;
	ipAddress: string | null;
	userAgent: string | null;
	metadata: unknown;
	createdAt: string;
}

export const audit = {
	async getSecurityEvents(limit = 50): Promise<SecurityEvent[]> {
		const res = await fetch(`${_authBaseUrl()}/api/v1/auth/security-events?limit=${limit}`, {
			credentials: 'include',
			headers: await authHeaders(),
		});
		const data = (await expectOk(res, 'audit.getSecurityEvents')) as {
			events?: SecurityEvent[];
		};
		return data?.events ?? [];
	},
};
