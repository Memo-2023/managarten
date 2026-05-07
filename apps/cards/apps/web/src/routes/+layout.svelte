<script lang="ts">
	import '../app.css';
	import type { Snippet } from 'svelte';
	import { onDestroy } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { AuthGate } from '@mana/shared-auth-ui';
	import { authStore } from '$lib/stores/auth.svelte';
	import { startSync, stopSync } from '$lib/data/sync';
	import { useStreak } from '$lib/queries';
	import { pwaInfo } from 'virtual:pwa-info';

	let { children }: { children: Snippet } = $props();

	// Auth/marketing pages render outside the gate so first-time visitors
	// can actually reach them. Everything else is gated.
	const PUBLIC_PATHS = ['/login', '/register', '/forgot-password'];
	const isPublic = $derived(PUBLIC_PATHS.some((p) => page.url.pathname.startsWith(p)));

	function handleAuthReady() {
		// AuthGate guarantees authStore.isAuthenticated by the time this fires.
		startSync(authStore);
	}

	// Live streak — recomputed whenever cardStudyBlocks changes. Lives at
	// the layout level so the count is visible from every gated page.
	const streakQuery = $derived(useStreak());
	const streak = $derived(($streakQuery as number | undefined) ?? 0);

	// vite-plugin-pwa exposes the hashed manifest filename via this
	// virtual module. Without inlining its <link> Chrome can't read the
	// manifest → no install icon, no A2HS on mobile.
	const webManifestLink = $derived(pwaInfo?.webManifest.linkTag ?? '');

	onDestroy(() => stopSync());
</script>

<svelte:head>
	{@html webManifestLink}
</svelte:head>

{#if isPublic}
	{@render children()}
{:else}
	<AuthGate {authStore} {goto} onReady={handleAuthReady}>
		<header class="border-b border-neutral-900">
			<div class="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
				<a href="/" class="flex items-center gap-2 text-sm font-semibold tracking-tight">
					<span class="text-base">🃏</span> Cards
				</a>
				<nav class="flex items-center gap-4 text-xs text-neutral-400">
					<a href="/" class="hover:text-neutral-100">Meine Decks</a>
					<a href="/explore" class="hover:text-neutral-100">Entdecken</a>
				</nav>
				<div class="flex items-center gap-3 text-xs text-neutral-500">
					{#if streak > 0}
						<span
							class="inline-flex items-center gap-1 rounded-full bg-orange-500/15 px-2 py-0.5 text-orange-300"
							title="{streak} {streak === 1 ? 'Tag' : 'Tage'} in Folge gelernt"
						>
							🔥 {streak}
						</span>
					{/if}
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
