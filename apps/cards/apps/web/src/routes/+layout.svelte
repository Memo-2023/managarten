<script lang="ts">
	import '../app.css';
	import type { Snippet } from 'svelte';
	import { onDestroy, onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import { AuthGate } from '@mana/shared-auth-ui';
	import ThemeToggle from '@mana/shared-theme-ui/ThemeToggle.svelte';
	import { authStore } from '$lib/stores/auth.svelte';
	import { theme, applyCardsAccent } from '$lib/stores/theme';
	import { startSync, stopSync } from '$lib/data/sync';
	import { useStreak } from '$lib/queries';
	import { pwaInfo } from 'virtual:pwa-info';

	let { children }: { children: Snippet } = $props();

	// Auth/marketing pages render outside the gate so first-time visitors
	// can actually reach them. Everything else is gated.
	// Public marketplace surface — anyone can browse decks/profiles/explore
	// without signing in. AuthGate kicks in once the user opens their own
	// decks/learn pages.
	const PUBLIC_PATHS = ['/login', '/register', '/forgot-password', '/explore', '/u/', '/d/'];
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

	onMount(() => {
		// Apply the Cards brand accent once at boot. The shared theme
		// store handles light/dark + variant via createThemeStore above
		// (ran during module init); this just sets --color-app-accent
		// so `bg-app-accent` etc. resolve to Cards' violet.
		applyCardsAccent();
	});

	onDestroy(() => stopSync());
</script>

<svelte:head>
	{@html webManifestLink}
</svelte:head>

{#if isPublic}
	{@render children()}
{:else}
	<AuthGate {authStore} {goto} onReady={handleAuthReady}>
		<header class="border-b border-border">
			<div class="mx-auto flex max-w-3xl items-center justify-between px-6 py-3">
				<a href="/" class="flex items-center gap-2 text-sm font-semibold tracking-tight">
					<span class="text-base">🃏</span> Cards
				</a>
				<nav class="flex items-center gap-4 text-xs text-muted-foreground">
					<a href="/" class="hover:text-foreground">Meine Decks</a>
					<a href="/explore" class="hover:text-foreground">Entdecken</a>
					<a href="/me/purchases" class="hover:text-foreground">Käufe</a>
				</nav>
				<div class="flex items-center gap-3 text-xs text-muted-foreground">
					{#if streak > 0}
						<span
							class="inline-flex items-center gap-1 rounded-full bg-warning/15 px-2 py-0.5 text-warning"
							title="{streak} {streak === 1 ? 'Tag' : 'Tage'} in Folge gelernt"
						>
							🔥 {streak}
						</span>
					{/if}
					<ThemeToggle {theme} size={16} />
					{#if authStore.user?.email}
						<span class="hidden sm:inline">{authStore.user.email}</span>
					{/if}
					<button
						onclick={async () => {
							stopSync();
							await authStore.signOut();
							goto('/login');
						}}
						class="rounded-md border border-border px-2 py-1 hover:border-border-strong hover:text-foreground"
					>
						Abmelden
					</button>
				</div>
			</div>
		</header>

		{@render children()}
	</AuthGate>
{/if}
