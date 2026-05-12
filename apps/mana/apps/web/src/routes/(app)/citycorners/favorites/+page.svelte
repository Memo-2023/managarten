<script lang="ts">
	import { Heart } from '@mana/shared-icons';
	import { _ } from 'svelte-i18n';
	import { authStore } from '$lib/stores/auth.svelte';
	import { portalHref } from '$lib/auth/portal-redirect';
	import { RoutePage } from '$lib/components/shell';
	import {
		favoritesStore,
		useAllFavorites,
		useAllLocations,
		getFavoriteIds,
	} from '$lib/modules/citycorners';

	// Live query for favorites — auto-updates on IndexedDB changes
	const allFavorites = useAllFavorites();
	const allLocations = useAllLocations();
	let favoriteIds = $derived(getFavoriteIds(allFavorites.value));

	let favoriteLocations = $derived(allLocations.value.filter((l) => favoriteIds.has(l.id)));

	function handleRemove(e: MouseEvent, locationId: string) {
		e.preventDefault();
		e.stopPropagation();
		favoritesStore.toggle(locationId);
	}
</script>

<svelte:head>
	<title>{$_('favorites.title')} - CityCorners</title>
</svelte:head>

<RoutePage appId="citycorners" backHref="/citycorners">
	<header class="mb-6">
		<h1 class="text-2xl font-bold text-foreground">{$_('favorites.title')}</h1>
		<p class="text-foreground-secondary">{$_('favorites.subtitle')}</p>
	</header>

	{#if !authStore.isAuthenticated}
		<div class="rounded-xl border border-border bg-background-card p-8 text-center">
			<p class="mb-4 text-foreground-secondary">{$_('favorites.loginRequired')}</p>
			<a
				href={portalHref()}
				class="inline-block rounded-lg bg-primary px-6 py-2 text-sm font-medium text-white transition-colors hover:bg-primary/90"
			>
				{$_('settings.login')}
			</a>
		</div>
	{:else if favoriteLocations.length === 0}
		<div class="rounded-xl border border-border bg-background-card p-8 text-center">
			<span class="mb-2 block text-4xl">&#x1F499;</span>
			<p class="text-foreground-secondary">{$_('favorites.empty')}</p>
		</div>
	{:else}
		<div class="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each favoriteLocations as location}
				<a
					href="/citycorners/locations/{location.id}"
					class="group relative flex items-center gap-4 overflow-hidden rounded-xl border border-border bg-background-card p-4 transition-shadow hover:shadow-lg"
				>
					{#if location.imageUrl}
						<img
							src={location.imageUrl}
							alt={location.name}
							class="h-16 w-16 flex-shrink-0 rounded-lg object-cover"
						/>
					{:else}
						<div
							class="flex h-16 w-16 flex-shrink-0 items-center justify-center rounded-lg bg-background-card-hover"
						>
							<span class="text-2xl">&#x1F4CD;</span>
						</div>
					{/if}
					<div class="min-w-0 flex-1">
						<span class="text-xs text-primary">{$_(`category.${location.category}`)}</span>
						<h3 class="truncate font-semibold text-foreground group-hover:text-primary">
							{location.name}
						</h3>
					</div>
					<button
						class="flex-shrink-0 p-1 text-red-500 transition-colors hover:text-red-600"
						onclick={(e) => handleRemove(e, location.id)}
						title={$_('favorites.remove')}
					>
						<Heart size={20} weight="fill" />
					</button>
				</a>
			{/each}
		</div>
	{/if}
</RoutePage>
