/**
 * Boot-time singleton bootstrap reconciliation.
 *
 * Calls `POST /api/v1/me/bootstrap-singletons` on every authenticated
 * boot. The server-side endpoint provisions any missing per-user
 * `userContext` singleton in `mana_sync.sync_changes`. Idempotent — a
 * second call is a no-op.
 *
 * Why call it on boot when the signup-time hooks already do this work:
 * the hooks are fire-and-forget and a transient mana_sync outage during
 * registration can leave the user with no singleton row. The boot-time
 * endpoint converges to the right state on every load, so a one-time
 * outage doesn't strand the user with `getOrCreateLocalDoc()` racing on
 * the first write.
 *
 * Best-effort: failures are swallowed and logged. The webapp's
 * fallback path (`getOrCreateLocalDoc()` in `userContextStore`) still
 * covers the rare race where a write happens before the bootstrap row
 * arrives.
 */

import { browser } from '$app/environment';
import { authStore } from '$lib/stores/auth.svelte';

function getAuthUrl(): string {
	if (browser && typeof window !== 'undefined') {
		const injected = (window as unknown as { __PUBLIC_MANA_AUTH_URL__?: string })
			.__PUBLIC_MANA_AUTH_URL__;
		if (injected) return injected;
	}
	return import.meta.env.DEV ? 'http://localhost:3001' : '';
}

interface BootstrapResponse {
	ok: true;
	bootstrapped: {
		userContext: boolean;
		spaces: Record<string, boolean>;
	};
}

export async function bootstrapSingletons(): Promise<void> {
	if (!browser) return;
	const token = await authStore.getValidToken();
	if (!token) return;
	try {
		const res = await fetch(`${getAuthUrl()}/api/v1/me/bootstrap-singletons`, {
			method: 'POST',
			headers: {
				Authorization: `Bearer ${token}`,
				'Content-Type': 'application/json',
			},
		});
		if (!res.ok) {
			console.warn('[bootstrap-singletons] endpoint returned', res.status);
			return;
		}
		const body = (await res.json()) as BootstrapResponse;
		if (import.meta.env.DEV) {
			const newUser = body.bootstrapped.userContext;
			const newSpaces = Object.values(body.bootstrapped.spaces).filter(Boolean).length;
			if (newUser || newSpaces > 0) {
				console.info(
					`[bootstrap-singletons] reconciled — userContext=${newUser ? 'inserted' : 'present'}, ` +
						`spaces inserted=${newSpaces}/${Object.keys(body.bootstrapped.spaces).length}`
				);
			}
		}
	} catch (err) {
		console.warn('[bootstrap-singletons] call failed:', err);
	}
}
