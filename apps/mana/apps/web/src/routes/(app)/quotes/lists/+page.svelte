<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { getContext } from 'svelte';
	import { authStore } from '$lib/stores/auth.svelte';
	import { redirectToPortal } from '$lib/auth/portal-redirect';
	import { toast } from '$lib/stores/toast.svelte';
	import { listsStore } from '$lib/modules/quotes/stores/lists.svelte';
	import { type QuoteList } from '$lib/modules/quotes/queries';
	import { QuotesEvents } from '@mana/shared-utils/analytics';
	import { Plus, Trash, X, User, Archive } from '@mana/shared-icons';
	import { RoutePage } from '$lib/components/shell';

	const allLists: { readonly value: QuoteList[] } = getContext('lists');

	let saving = $state(false);
	let deletingId = $state<string | null>(null);
	let showCreateModal = $state(false);
	let newListName = $state('');
	let newListDescription = $state('');

	async function createList() {
		if (!newListName.trim() || saving) return;

		saving = true;
		try {
			const created = await listsStore.createList(
				newListName.trim(),
				newListDescription.trim() || undefined
			);
			if (created) {
				QuotesEvents.listCreated();
				showCreateModal = false;
				newListName = '';
				newListDescription = '';
			} else {
				toast.error($_('common.error'));
			}
		} catch (error) {
			console.error('Failed to create list:', error);
			toast.error($_('common.error'));
		} finally {
			saving = false;
		}
	}

	async function deleteList(listId: string) {
		if (deletingId || !confirm($_('lists.confirmDelete'))) return;

		deletingId = listId;
		try {
			const success = await listsStore.deleteList(listId);
			if (success) {
				QuotesEvents.listDeleted();
			} else {
				toast.error($_('lists.detail.toast.deleteError'));
			}
		} catch (error) {
			console.error('Failed to delete list:', error);
			toast.error($_('lists.detail.toast.deleteError'));
		} finally {
			deletingId = null;
		}
	}
</script>

<svelte:head>
	<title>Quotes - {$_('lists.title')}</title>
</svelte:head>

<RoutePage appId="quotes" backHref="/quotes">
	<div class="max-w-3xl mx-auto">
		<div class="flex items-center justify-between mb-8">
			<h1 class="text-3xl font-bold text-foreground">{$_('lists.title')}</h1>
			{#if authStore.isAuthenticated}
				<button
					onclick={() => (showCreateModal = true)}
					class="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-full font-medium hover:bg-primary-hover transition-colors"
				>
					<Plus size={20} weight="bold" />
					{$_('lists.create')}
				</button>
			{/if}
		</div>

		{#if !authStore.isAuthenticated}
			<div class="text-center py-12 bg-surface-elevated rounded-2xl">
				<div class="w-16 h-16 mx-auto text-foreground-muted mb-4 flex items-center justify-center">
					<User size={64} />
				</div>
				<p class="text-foreground-secondary mb-4">{$_('lists.loginPrompt')}</p>
				<button
					onclick={() => redirectToPortal()}
					class="px-6 py-2 bg-primary text-white rounded-full font-medium hover:bg-primary-hover transition-colors"
				>
					{$_('auth.login')}
				</button>
			</div>
		{:else if allLists.value.length === 0}
			<div class="text-center py-12 bg-surface-elevated rounded-2xl">
				<div class="w-16 h-16 mx-auto text-foreground-muted mb-4 flex items-center justify-center">
					<Archive size={64} />
				</div>
				<p class="text-lg font-medium text-foreground mb-2">{$_('lists.empty')}</p>
				<p class="text-foreground-secondary">{$_('lists.emptyDescription')}</p>
			</div>
		{:else}
			<div class="grid gap-4">
				{#each allLists.value as list (list.id)}
					<a
						href="/quotes/lists/{list.id}"
						class="block p-6 bg-surface-elevated rounded-2xl hover:shadow-lg transition-colors group"
					>
						<div class="flex items-start justify-between">
							<div>
								<h3
									class="text-lg font-semibold text-foreground group-hover:text-primary transition-colors"
								>
									{list.name}
								</h3>
								{#if list.description}
									<p class="text-foreground-secondary mt-1">{list.description}</p>
								{/if}
								<p class="text-sm text-foreground-muted mt-2">
									{$_('lists.quoteCount', { values: { count: list.quoteIds.length } })}
								</p>
							</div>
							<button
								onclick={(e) => {
									e.preventDefault();
									e.stopPropagation();
									deleteList(list.id);
								}}
								disabled={deletingId === list.id}
								class="p-2 text-foreground-muted hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors disabled:opacity-50"
							>
								{#if deletingId === list.id}
									<div
										class="w-5 h-5 border-2 border-red-400 border-t-transparent rounded-full animate-spin"
									></div>
								{:else}
									<Trash size={20} />
								{/if}
							</button>
						</div>
					</a>
				{/each}
			</div>
		{/if}
	</div>

	<!-- Create Modal -->
	{#if showCreateModal}
		<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
			<div class="bg-surface-elevated rounded-2xl w-full max-w-md shadow-xl">
				<div class="flex items-center justify-between p-6 border-b border-border">
					<h3 class="text-xl font-semibold text-foreground">{$_('lists.createModal.title')}</h3>
					<button
						onclick={() => (showCreateModal = false)}
						class="p-2 text-foreground-secondary hover:text-foreground transition-colors"
					>
						<X size={20} />
					</button>
				</div>
				<div class="p-6 space-y-4">
					<div>
						<label for="quotes-list-name" class="block text-sm font-medium text-foreground mb-2"
							>{$_('lists.nameLabel')} *</label
						>
						<input
							id="quotes-list-name"
							type="text"
							bind:value={newListName}
							placeholder={$_('lists.createModal.namePlaceholder')}
							maxlength="50"
							class="w-full p-3 rounded-lg bg-surface border border-border text-foreground focus:outline-none focus:border-primary"
						/>
					</div>
					<div>
						<label
							for="quotes-list-description"
							class="block text-sm font-medium text-foreground mb-2"
							>{$_('lists.descriptionLabel')}</label
						>
						<textarea
							id="quotes-list-description"
							bind:value={newListDescription}
							placeholder={$_('lists.createModal.descriptionPlaceholder')}
							maxlength="200"
							rows="3"
							class="w-full p-3 rounded-lg bg-surface border border-border text-foreground focus:outline-none focus:border-primary resize-none"
						></textarea>
					</div>
				</div>
				<div class="flex justify-end gap-3 p-6 border-t border-border">
					<button
						onclick={() => (showCreateModal = false)}
						class="px-4 py-2 text-foreground-secondary hover:text-foreground transition-colors"
					>
						{$_('common.cancel')}
					</button>
					<button
						onclick={createList}
						disabled={!newListName.trim() || saving}
						class="px-6 py-2 bg-primary text-white rounded-lg font-medium hover:bg-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
					>
						{#if saving}
							<div
								class="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"
							></div>
						{/if}
						{$_('lists.createModal.submit')}
					</button>
				</div>
			</div>
		</div>
	{/if}
</RoutePage>
