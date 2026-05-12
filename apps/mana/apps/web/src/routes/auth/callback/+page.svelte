<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { session } from '$lib/auth/session.svelte';
	import { redirectToPortal } from '$lib/auth/portal-redirect';

	let error = $state<string | null>(null);

	onMount(async () => {
		// Token via SSO-Cookie holen — der Browser sendet `mana_session`
		// automatisch mit, weil das Cookie auf `.mana.how` lebt.
		const ok = await session.tryRefresh();

		if (!ok) {
			// Cookie weg oder Session expired → zurück aufs Portal mit
			// dem aktuellen Callback als Redirect-URL, damit der User
			// nach erneutem Login wieder hier landet.
			redirectToPortal({ next: page.url.searchParams.get('next') ?? '/' });
			return;
		}

		session.loadUserFromToken();

		// Vault-Unlock läuft automatisch im Root-Layout-$effect, sobald
		// `session.user.id` gesetzt ist (siehe routes/+layout.svelte).
		// Wir warten hier NICHT explizit — der User soll seine App so
		// schnell wie möglich sehen. Encrypted-Reads vor dem Unlock
		// rendern leere Liste; die liveQuery re-evaluiert sobald
		// `vaultClient.unlock()` durchgelaufen ist.

		const next = page.url.searchParams.get('next');
		const type = page.url.searchParams.get('type');

		// Email-Verification-Klick oder Signup-Welcome-Flow → Welcome-Page.
		if (type === 'signup' || type === 'email_verification') {
			goto('/welcome');
			return;
		}

		// Sonst: Deep-Link wiederherstellen oder Default.
		goto(next && next.startsWith('/') ? next : '/');
	});
</script>

<svelte:head>
	<title>Anmeldung wird abgeschlossen – Mana</title>
</svelte:head>

<div class="flex min-h-screen items-center justify-center">
	<div class="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg dark:bg-gray-800">
		{#if error}
			<div class="mb-4 text-6xl">⚠️</div>
			<h2 class="mb-2 text-2xl font-bold text-red-600 dark:text-red-400">
				Authentifizierungsfehler
			</h2>
			<p class="mb-4 text-gray-600 dark:text-gray-400">
				{error}
			</p>
			<p class="text-sm text-gray-500 dark:text-gray-400">
				Du wirst zurück zur Anmeldung geleitet…
			</p>
		{:else}
			<div
				class="mb-4 inline-block h-12 w-12 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"
			></div>
			<h2 class="mb-2 text-2xl font-bold">Anmeldung wird abgeschlossen…</h2>
			<p class="text-gray-600 dark:text-gray-400">Einen Moment bitte.</p>
		{/if}
	</div>
</div>
