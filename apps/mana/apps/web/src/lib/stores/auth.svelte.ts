/**
 * Auth Store — re-export der neuen Session-Klasse.
 *
 * Bis 2026-05-12 war das ein Wrapper über `createManaAuthStore()` aus
 * `@mana/shared-auth-ui`, der 47 Methoden mitbrachte (Login, Register,
 * Reset, Passkey-CRUD, 2FA-Setup, Sessions, Audit). Mit dem Wechsel
 * auf den zentralen Auth-Portal sind die Login-/Register-/Reset-Flows
 * komplett rausgeflogen — sie leben jetzt auf `auth.mana.how`.
 *
 * Was bleibt:
 * - `authStore.user`, `authStore.isAuthenticated`, `authStore.initialized`,
 *   `authStore.loading` — der reaktive Session-State.
 * - `authStore.initialize()` — Boot-Pass.
 * - `authStore.signOut()` — Logout (kein Redirect; den macht der Caller).
 * - `authStore.getValidToken()`, `authStore.getAccessToken()` — Token-Access.
 *
 * Was wegfällt (Settings → `$lib/auth/settings-client.ts`):
 * - Passkey-CRUD → `import { passkeys } from '$lib/auth/settings-client'`
 * - 2FA-Setup → `import { twoFactor } from '$lib/auth/settings-client'`
 * - Sessions / Audit → `import { sessions, audit } from '$lib/auth/settings-client'`
 *
 * Was ganz wegfällt (passiert jetzt im Portal):
 * - `signIn`, `signUp`, `resetPassword`, `resetPasswordWithToken`,
 *   `resendVerificationEmail`, `verifyTwoFactor`, `verifyBackupCode`,
 *   `sendMagicLink`, `signInWithPasskey`.
 */

export { session as authStore } from '$lib/auth/session.svelte';
