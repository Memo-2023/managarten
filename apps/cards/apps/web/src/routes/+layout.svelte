<script lang="ts">
	import '../app.css';
	import type { Snippet } from 'svelte';
	import { onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { AuthGate } from '@mana/shared-auth-ui';
	import { authStore } from '$lib/stores/auth.svelte';
	import { startSync, stopSync } from '$lib/data/sync';

	let { children }: { children: Snippet } = $props();

	// Auth/marketing pages render outside the gate so first-time visitors
	// can actually reach them. Everything else is gated.
	const PUBLIC_PATHS = ['/login', '/register', '/forgot-password'];
	const isPublic = $derived(PUBLIC_PATHS.some((p) => page.url.pathname.startsWith(p)));

	function handleAuthReady() {
		// AuthGate guarantees authStore.isAuthenticated by the time this fires.
		startSync(authStore);
	}

	onDestroy(() => stopSync());
</script>

{#if isPublic}
	{@render children()}
{:else}
	<AuthGate {authStore} {goto} onReady={handleAuthReady}>
		<header class="border-b border-neutral-900">
			<div class="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
				<a href="/" class="flex items-center gap-2 text-sm font-semibold tracking-tight">
					<span class="text-base">🃏</span> Cards
				</a>
				<div class="flex items-center gap-3 text-xs text-neutral-500">
					{#if authStore.user?.email}
						<span class="hidden sm:inline">{authStore.user.email}</span>
					{/if}
					<button
						onclick={async () => {
							stopSync();
							await authStore.signOut();
							goto('/login');
						}}
						class="rounded-md border border-neutral-800 px-2 py-1 hover:border-neutral-700 hover:text-neutral-100"
					>
						Abmelden
					</button>
				</div>
			</div>
		</header>

		{@render children()}
	</AuthGate>
{/if}
