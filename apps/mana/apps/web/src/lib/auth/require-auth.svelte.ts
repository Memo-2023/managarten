/**
 * `requireAuth()` — global guest gate for features that need an account.
 *
 * The unified Mana app runs most modules in a "guest mode": you can open
 * a module, look around, type a quick note, etc. without an account.
 * But anything that touches an *encrypted* table (dreams voice capture,
 * memoro recordings, notes, todo, calendar events, …) needs the user to
 * be logged in — the encryption vault only unlocks against a Mana Auth
 * session, and writing to those tables without it throws
 * `VaultLockedError` at the very last step of the action.
 *
 * Before this helper, every entry point into an encryption-required
 * action would silently let the guest go through the whole flow (record
 * audio, wait for transcription, …) and then explode at the database
 * write with a stack-trace error. The user lost work and didn't know
 * why.
 *
 * `requireAuth()` is the imperative gate the entry points wrap around.
 * It returns immediately if the user is already authenticated, otherwise
 * it pops a global modal (mounted once in the root layout) that asks
 * the guest to log in or cancel. The Promise resolves with `true` if
 * the user ended up logged in, `false` if they dismissed.
 *
 * ## Usage
 *
 * ```ts
 * async function handleMicClick() {
 *   const ok = await requireAuth({
 *     feature: 'voice-recording',
 *     reason: 'Sprach-Aufnahmen werden verschlüsselt in deinem persönlichen Tagebuch gespeichert.',
 *   });
 *   if (!ok) return;
 *
 *   // existing recording logic — guaranteed to have an unlocked vault now
 *   await dreamRecorder.start();
 * }
 * ```
 *
 * ## Why imperative, not a button wrapper?
 *
 * - Works in any code path: event handlers, store actions, async flows,
 *   keyboard shortcuts, drag-drop handlers — without forcing every
 *   call site to render through a wrapper component.
 * - Composable: callers can chain `requireAuth()` with other async
 *   pre-checks (mic permission, network state, …) in one async block.
 * - Promise-based: caller decides what to do with `false` (silently
 *   abort, restore previous state, show their own toast).
 *
 * ## Why `isAuthenticated` and not `isVaultUnlocked`?
 *
 * The user-facing concept is "I need an account", not "I need an
 * unlocked encryption vault". Vault unlocks happen automatically after
 * login via the root layout's `$effect`. A logged-in user with a
 * vault-unlock failure (network error, etc.) is a different bug class
 * handled by the existing `VaultLockedError` flow with its own
 * recovery UX. Mixing the two would muddy the message.
 */

import { page } from '$app/state';
import { authStore } from '$lib/stores/auth.svelte';
import { redirectToPortal } from '$lib/auth/portal-redirect';

/** What requireAuth() needs to render the modal. */
export interface RequireAuthOptions {
	/**
	 * Stable feature identifier for analytics / telemetry. Lowercase,
	 * hyphenated. Examples: `'voice-recording'`, `'create-task'`,
	 * `'send-message'`.
	 */
	feature: string;

	/**
	 * Human-readable reason shown in the modal body. Should explain
	 * *why* this specific action needs an account in 1–2 sentences.
	 * Avoid generic "log in to use this app" — name the concrete
	 * reason (encryption, sync, server-side processing) so the user
	 * understands the trade-off.
	 */
	reason: string;

	/** Optional override for the modal title. Defaults to "Konto erforderlich". */
	title?: string;

	/** Optional override for the primary button label. Defaults to "Anmelden". */
	loginLabel?: string;

	/** Optional override for the secondary button label. Defaults to "Abbrechen". */
	cancelLabel?: string;
}

/** Internal store shape — only the modal component reads this. */
interface PendingPrompt {
	options: RequireAuthOptions;
	resolve: (granted: boolean) => void;
}

class AuthGateState {
	pending = $state<PendingPrompt | null>(null);

	open(options: RequireAuthOptions): Promise<boolean> {
		// If a previous prompt is still open, dismiss it as cancelled.
		// Two simultaneous requireAuth() calls would be a bug in the
		// caller, but we want to never leak hanging promises.
		if (this.pending) {
			this.pending.resolve(false);
		}

		return new Promise<boolean>((resolve) => {
			this.pending = { options, resolve };
		});
	}

	resolve(granted: boolean): void {
		const p = this.pending;
		if (!p) return;
		this.pending = null;
		p.resolve(granted);
	}
}

/** Singleton state — the modal subscribes to `pending`, callers use the
 *  exported `requireAuth()` function. */
export const authGateState = new AuthGateState();

/**
 * Ensure the user is authenticated before running an action.
 *
 * - If already authenticated → returns `true` immediately, no UI.
 * - If guest → shows a modal and resolves to `true` if the user
 *   logs in (and returns to the page), `false` if they cancel.
 *
 * The modal navigates to `auth.mana.how/login?app=mana&redirect=<callback>`
 * so the user lands back on `/auth/callback?next=<current path>` after
 * the Portal-Login, where Token-Refresh + Vault-Unlock laufen, bevor
 * `goto(next)` ins App-Innere weiterleitet. Die Promise resolved beim
 * nächsten Mal, wenn `authStore.isAuthenticated` auf `true` flippt — der
 * Aufrufer muss seine Action NICHT manuell re-triggern.
 */
export async function requireAuth(options: RequireAuthOptions): Promise<boolean> {
	if (authStore.isAuthenticated) return true;
	return authGateState.open(options);
}

/**
 * Called by AuthRequiredModal when the user clicks "Anmelden". Hartes
 * Redirect zum Auth-Portal — der aktuelle Pfad geht als `next`-Hint mit,
 * damit der User nach Login + Vault-Unlock wieder hier landet.
 *
 * `authGateState.resolve(false)` läuft VOR dem `window.location.href`-
 * Wechsel, weil der Modal-Caller den Promise sonst nie auflöst — der
 * SvelteKit-Run-Loop wird durch das harte Redirect abgebrochen.
 */
export async function navigateToLogin(): Promise<void> {
	const here = page.url?.pathname ?? '/';
	authGateState.resolve(false);
	redirectToPortal({ next: here });
}
