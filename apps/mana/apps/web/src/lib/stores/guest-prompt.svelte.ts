/**
 * Unified guest-mode prompt singleton.
 *
 * The (app) layout already renders a NotificationBar in the bottom stack
 * for the time-based guest nudge from `createGuestMode` (shared-stores).
 * This singleton lets the rest of the app push *event-driven* prompts
 * into the same visual slot — e.g. when an API call returns 401 or a
 * server-only feature is invoked while signed out.
 *
 * Why a separate store from `createGuestMode`?
 *   - The shared-stores GuestMode is cross-app and only knows about its
 *     own internal nudge timer. Adding a "push notification from anywhere"
 *     mutator there would force every host app to wire it up.
 *   - This file is mana-web-local and reads from authStore directly, so
 *     no cross-package surface change is needed.
 *
 * Dedup: each prompt is keyed by `featureKey`. Calling `requireAccount`
 * twice with the same key while the first prompt is still visible is a
 * no-op — we don't want a stack of "you need an account" toasts after
 * three failed LLM calls in a row.
 *
 * Auto-clear: when authStore flips to authenticated, all pending guest
 * prompts vanish. The (app) layout's auth effect calls `clear()` on
 * sign-in.
 */

import type { BottomNotification } from '@mana/shared-ui';
import { portalHref } from '$lib/auth/portal-redirect';

let prompts = $state<BottomNotification[]>([]);

/** Default action target — the central auth portal (auth.mana.how) handles
 *  both login and register flows in one UI. */
function defaultLoginHref(): string {
	return portalHref();
}

/** Navigates the browser. Kept as a small wrapper so unit tests can
 *  swap it out without pulling SvelteKit's `goto`. */
let navigate: (href: string) => void = (href) => {
	if (typeof window !== 'undefined') window.location.assign(href);
};

/** Test / boot hook: lets the layout swap in SvelteKit's `goto` so
 *  the prompt action does a client-side transition instead of a full
 *  page reload. */
export function setGuestPromptNavigator(fn: (href: string) => void): void {
	navigate = fn;
}

export const guestPrompt = {
	get notifications(): BottomNotification[] {
		return prompts;
	},

	/**
	 * Push a "this needs an account" notification into the bottom stack.
	 * Deduped by `featureKey` — repeat calls while the same prompt is
	 * still on screen are a no-op so the bar doesn't grow.
	 *
	 * @param featureKey  Stable id (`'llm'`, `'api:401'`, `'media-upload'`, …)
	 * @param message     User-facing copy. Defaults to a generic message
	 *                    — pass a specific one when you can ("KI-Antworten
	 *                    brauchen ein Konto.") for better UX.
	 * @param actionLabel Button label. Defaults to "Anmelden".
	 */
	requireAccount(
		featureKey: string,
		message: string = 'Diese Funktion braucht ein Konto. Melde dich an oder registriere dich, um sie zu nutzen.',
		actionLabel: string = 'Anmelden'
	): void {
		const id = `guest-prompt:${featureKey}`;
		if (prompts.some((p) => p.id === id)) return;

		prompts = [
			...prompts,
			{
				id,
				message,
				type: 'warning',
				dismissible: true,
				action: {
					label: actionLabel,
					onClick: () => {
						navigate(defaultLoginHref());
						guestPrompt.dismiss(id);
					},
				},
				onDismiss: () => guestPrompt.dismiss(id),
			},
		];
	},

	/** Drop a single prompt by id. Safe to call for unknown ids. */
	dismiss(id: string): void {
		prompts = prompts.filter((p) => p.id !== id);
	},

	/** Drop every prompt. Called by the (app) layout on sign-in so the
	 *  bar doesn't carry stale "you need an account" warnings into the
	 *  authenticated session. */
	clear(): void {
		prompts = [];
	},
};
