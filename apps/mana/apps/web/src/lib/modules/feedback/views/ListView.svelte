<!--
  Community ListView — main feed of public, anonymous feedback.
  Default sort: by score (weighted reactions) descending.
  Filters: category + module-context. Click an item to navigate to
  the detail page; click a reaction to toggle (auth-only).
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { FEEDBACK_CATEGORY_LABELS, type FeedbackCategory } from '@mana/feedback';
	import { useCommunityFeed, toggleReactionOnItem } from '../queries.svelte';
	import ItemCard from '../components/ItemCard.svelte';
	import { authStore } from '$lib/stores/auth.svelte';
	import { portalHref } from '$lib/auth/portal-redirect';

	interface Props {
		/** Optional initial moduleContext filter — passed by the
		 *  workbench-card variant to scope to a single module. */
		moduleContext?: string;
	}

	let props: Props = $props();

	let categoryFilter = $state<FeedbackCategory | ''>('');
	// svelte-ignore state_referenced_locally
	let modulePill = $state(props.moduleContext ?? '');

	// svelte-ignore state_referenced_locally
	let feed = useCommunityFeed({ moduleContext: props.moduleContext, limit: 50 });

	function applyFilters() {
		feed.reload({
			category: categoryFilter || undefined,
			moduleContext: modulePill || undefined,
			limit: 50,
		});
	}

	$effect(() => {
		void [categoryFilter, modulePill];
		applyFilters();
	});

	const CATEGORY_OPTIONS: { value: FeedbackCategory | ''; label: string }[] = [
		{ value: '', label: 'Alle Kategorien' },
		{ value: 'feature', label: FEEDBACK_CATEGORY_LABELS.feature },
		{ value: 'improvement', label: FEEDBACK_CATEGORY_LABELS.improvement },
		{ value: 'bug', label: FEEDBACK_CATEGORY_LABELS.bug },
		{ value: 'praise', label: FEEDBACK_CATEGORY_LABELS.praise },
		{ value: 'question', label: FEEDBACK_CATEGORY_LABELS.question },
		{ value: 'onboarding-wish', label: FEEDBACK_CATEGORY_LABELS['onboarding-wish'] },
	];

	let openItemId = $state<string | null>(null);

	function handleClickItem(id: string) {
		openItemId = id;
		void goto(`/feedback/${id}`);
	}
</script>

<div class="community-list">
	<header class="filter-row">
		<select bind:value={categoryFilter} aria-label="Nach Kategorie filtern">
			{#each CATEGORY_OPTIONS as opt (opt.value)}
				<option value={opt.value}>{opt.label}</option>
			{/each}
		</select>

		<input
			type="text"
			placeholder="Modul (z. B. todo)"
			bind:value={modulePill}
			aria-label="Nach Modul filtern"
		/>
	</header>

	{#if feed.loading && feed.items.length === 0}
		<div class="state">Lade…</div>
	{:else if feed.error}
		<div class="state error">{feed.error}</div>
	{:else if feed.items.length === 0}
		<div class="state">
			Noch keine Stimmen — sei der erste, der was reinwirft.
			{#if !authStore.user}
				<br />
				<a href={portalHref()} class="link">Login</a>, um mitzumachen.
			{/if}
		</div>
	{:else}
		<div class="grid">
			{#each feed.items as item (item.id)}
				<ItemCard
					{item}
					readOnly={!authStore.user}
					onReact={(id, emoji) => toggleReactionOnItem(feed, id, emoji)}
					onClick={handleClickItem}
				/>
			{/each}
		</div>
	{/if}
</div>

<style>
	.community-list {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 0.75rem;
	}

	.filter-row {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.5rem;
	}

	.filter-row select,
	.filter-row input {
		padding: 0.375rem 0.625rem;
		border: 1px solid hsl(var(--color-border));
		border-radius: 0.5rem;
		background: hsl(var(--color-surface, var(--color-background)));
		color: hsl(var(--color-foreground));
		font-size: 0.8125rem;
	}

	.filter-row select:focus,
	.filter-row input:focus {
		outline: none;
		border-color: hsl(var(--color-primary));
		box-shadow: 0 0 0 3px hsl(var(--color-primary) / 0.15);
	}

	.grid {
		display: grid;
		grid-template-columns: 1fr;
		gap: 0.625rem;
	}

	.state {
		padding: 2rem 1rem;
		text-align: center;
		color: hsl(var(--color-muted-foreground));
		font-size: 0.875rem;
	}

	.state.error {
		color: hsl(var(--color-error, 0 84% 60%));
	}

	.link {
		color: hsl(var(--color-primary));
		text-decoration: underline;
	}
</style>
