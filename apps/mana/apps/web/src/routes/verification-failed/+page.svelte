<script lang="ts">
	import { page } from '$app/stores';
	import { X } from '@mana/shared-icons';
	import { redirectToPortal } from '$lib/auth/portal-redirect';

	// Get error from URL query params
	const error = $derived($page.url.searchParams.get('error') || 'unknown_error');

	// Map error codes to user-friendly messages
	const errorMessages: Record<string, string> = {
		missing_token: 'Der Bestätigungslink ist ungültig. Bitte fordere einen neuen Link an.',
		invalid_or_expired_token:
			'Der Bestätigungslink ist abgelaufen oder ungültig. Bitte fordere einen neuen Link an.',
		verification_failed:
			'Die E-Mail-Bestätigung ist fehlgeschlagen. Bitte versuche es später erneut.',
		unknown_error: 'Ein unbekannter Fehler ist aufgetreten. Bitte versuche es später erneut.',
	};

	const errorMessage = $derived(errorMessages[error] || errorMessages.unknown_error);
</script>

<svelte:head>
	<title>Bestätigung fehlgeschlagen - Mana</title>
</svelte:head>

<div
	class="flex min-h-screen flex-col items-center justify-center bg-gray-100 px-4 dark:bg-neutral-900"
>
	<div class="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-lg dark:bg-neutral-800">
		<!-- Error Icon -->
		<div
			class="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30"
		>
			<X size={20} class="text-red-600 dark:text-red-400" />
		</div>

		<h1 class="mb-4 text-2xl font-bold text-gray-900 dark:text-white">
			Bestätigung fehlgeschlagen
		</h1>

		<p class="mb-8 text-gray-600 dark:text-gray-400">
			{errorMessage}
		</p>

		<div class="space-y-3">
			<button
				onclick={() => redirectToPortal({ next: '/' })}
				class="w-full rounded-lg bg-indigo-600 px-6 py-3 font-medium text-white transition-colors hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:focus:ring-offset-neutral-800"
			>
				Zur Anmeldung
			</button>

			<button
				onclick={() => redirectToPortal({ next: '/', target: 'register' })}
				class="w-full rounded-lg border border-gray-300 bg-white px-6 py-3 font-medium text-gray-700 transition-colors hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 dark:border-neutral-600 dark:bg-neutral-700 dark:text-gray-200 dark:hover:bg-neutral-600 dark:focus:ring-offset-neutral-800"
			>
				Neues Konto erstellen
			</button>
		</div>
	</div>

	<p class="mt-8 text-sm text-gray-500 dark:text-gray-400">Mana - Dein digitales Ökosystem</p>
</div>
