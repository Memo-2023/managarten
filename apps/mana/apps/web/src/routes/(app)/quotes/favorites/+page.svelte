<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { getContext } from 'svelte';
	import { authStore } from '$lib/stores/auth.svelte';
	import { redirectToPortal } from '$lib/auth/portal-redirect';
	import { favoritesStore } from '$lib/modules/quotes/stores/favorites.svelte';
	import { type Favorite } from '$lib/modules/quotes/queries';
	import { getQuoteById, getQuoteText, type Quote } from '@quotes/content';
	import { quotesSettings } from '$lib/modules/quotes/stores/settings.svelte';
	import QuoteCard from '$lib/modules/quotes/components/QuoteCard.svelte';
	import { ContextMenu, type ContextMenuItem } from '@mana/shared-ui';
	import { Heart, User } from '@mana/shared-icons';
	import { RoutePage } from '$lib/components/shell';

	const allFavorites: { readonly value: Favorite[] } = getContext('favorites');

	// Get favorite quotes
	let favoriteQuotes = $derived(
		allFavorites.value
			.map((f) => getQuoteById(f.quoteId))
			.filter((q): q is NonNullable<typeof q> => q !== undefined)
	);

	// Context menu state
	let contextMenuVisible = $state(false);
	let contextMenuX = $state(0);
	let contextMenuY = $state(0);
	let contextMenuQuote = $state<Quote | null>(null);

	function handleContextMenu(e: MouseEvent, quote: Quote) {
		e.preventDefault();
		e.stopPropagation();
		contextMenuX = e.clientX;
		contextMenuY = e.clientY;
		contextMenuQuote = quote;
		contextMenuVisible = true;
	}

	function getContextMenuItems(): ContextMenuItem[] {
		if (!contextMenuQuote) return [];
		const quote = contextMenuQuote;

		return [
			{
				id: 'remove-favorite',
				label: $_('favorites.removeFromFavorites'),
				variant: 'danger',
				action: () => favoritesStore.toggle(quote.id, allFavorites.value),
			},
			{ id: 'divider-1', label: '', type: 'divider' },
			{
				id: 'copy',
				label: $_('favorites.copyQuote'),
				action: () => {
					const text = getQuoteText(quote);
					navigator.clipboard.writeText(`"${text}" — ${quote.author}`);
				},
			},
			{
				id: 'share',
				label: $_('favorites.share'),
				action: async () => {
					const text = `"${getQuoteText(quote)}" — ${quote.author}`;
					if (navigator.share) {
						try {
							await navigator.share({ text });
						} catch {
							// User cancelled or share failed, ignore
						}
					} else {
						await navigator.clipboard.writeText(text);
					}
				},
			},
		];
	}
</script>

<svelte:head>
	<title>Quotes - {$_('favorites.title')}</title>
</svelte:head>

<RoutePage appId="quotes" backHref="/quotes">
	<div class="max-w-3xl mx-auto">
		<div class="flex items-center gap-3 mb-8">
			<h1 class="text-3xl font-bold text-foreground">{$_('favorites.title')}</h1>
			{#if authStore.isAuthenticated && favoriteQuotes.length > 0}
				<span class="px-2.5 py-0.5 rounded-full text-sm font-medium bg-primary/10 text-primary">
					{favoriteQuotes.length}
				</span>
			{/if}
		</div>

		{#if !authStore.isAuthenticated}
			<!-- Not logged in -->
			<div class="text-center py-12 bg-surface-elevated rounded-2xl">
				<User size={20} class="mx-auto text-foreground-muted mb-4" />
				<p class="text-foreground-secondary mb-4">{$_('favorites.loginPrompt')}</p>
				<button
					onclick={() => redirectToPortal()}
					class="px-6 py-2 bg-primary text-white rounded-full font-medium hover:bg-primary-hover transition-colors"
				>
					{$_('auth.login')}
				</button>
			</div>
		{:else if favoriteQuotes.length === 0}
			<!-- Empty state -->
			<div class="text-center py-12 bg-surface-elevated rounded-2xl">
				<Heart size={20} class="mx-auto text-foreground-muted mb-4" />
				<p class="text-lg font-medium text-foreground mb-2">{$_('favorites.empty')}</p>
				<p class="text-foreground-secondary">{$_('favorites.emptyDescription')}</p>
			</div>
		{:else}
			<!-- Favorites list -->
			<div class="space-y-6">
				{#each favoriteQuotes as quote (quote.id)}
					<div oncontextmenu={(e) => handleContextMenu(e, quote)} role="listitem">
						<QuoteCard
							{quote}
							showCategory={quotesSettings.showCategory}
							showSource={quotesSettings.showSource}
						/>
					</div>
				{/each}
			</div>
		{/if}
	</div>

	<ContextMenu
		visible={contextMenuVisible}
		x={contextMenuX}
		y={contextMenuY}
		items={getContextMenuItems()}
		onClose={() => {
			contextMenuVisible = false;
			contextMenuQuote = null;
		}}
	/>
</RoutePage>
