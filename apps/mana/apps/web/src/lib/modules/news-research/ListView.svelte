<!--
  News Research — Workbench ListView.

  Compact inline variant of /news-research. One card, scrolled; the user
  runs discovery, picks feeds, searches articles, pins/saves/exports
  without leaving the workbench.

  Stateful session is shared with the /news-research route via
  `researchSessionStore` (sessionStorage-backed), so moving between
  workbench card and full page keeps results.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import type { ViewProps } from '$lib/app-registry';
	import { researchSessionStore } from '$lib/modules/news-research/stores/session.svelte';
	import { articlesStore } from '$lib/modules/articles/stores/articles.svelte';

	const {}: ViewProps = $props();

	const store = researchSessionStore;

	let mode = $state<'query' | 'site'>('query');
	let query = $state('');
	let siteUrl = $state('');
	let searchQuery = $state('');
	let savingUrl = $state<string | null>(null);
	let saveError = $state<string | null>(null);
	let copyLabel = $state('Kopieren');
	let feedsOpen = $state(true);

	function isUrl(s: string): boolean {
		try {
			const u = new URL(s.trim());
			return u.protocol === 'http:' || u.protocol === 'https:';
		} catch {
			return false;
		}
	}

	async function onDiscover(e: Event) {
		e.preventDefault();
		if (mode === 'query' && query.trim().length > 2) {
			await store.discoverByQuery(query.trim());
			if (!searchQuery) searchQuery = query.trim();
		} else if (mode === 'site' && isUrl(siteUrl)) {
			await store.discoverBySite(siteUrl.trim());
		}
	}

	async function onSearch(e: Event) {
		e.preventDefault();
		if (!searchQuery.trim()) return;
		await store.runSearch(searchQuery.trim());
		feedsOpen = false;
	}

	async function onSave(articleUrl: string) {
		savingUrl = articleUrl;
		saveError = null;
		try {
			const { article } = await articlesStore.saveFromUrl(articleUrl);
			goto(`/articles/${article.id}`);
		} catch (err) {
			saveError = err instanceof Error ? err.message : 'Speichern fehlgeschlagen';
			savingUrl = null;
		}
	}

	async function onCopy() {
		try {
			await navigator.clipboard.writeText(store.buildAiContext());
			copyLabel = '✓';
			setTimeout(() => (copyLabel = 'Kopieren'), 1200);
		} catch {
			copyLabel = 'Fehler';
		}
	}

	function formatDate(iso: string | null): string {
		if (!iso) return '';
		try {
			return new Date(iso).toLocaleDateString('de-DE', { month: 'short', day: 'numeric' });
		} catch {
			return '';
		}
	}
</script>

<div class="wrap">
	<section class="slot">
		<div class="mode-switch">
			<button type="button" class:active={mode === 'query'} onclick={() => (mode = 'query')}
				>Thema</button
			>
			<button type="button" class:active={mode === 'site'} onclick={() => (mode = 'site')}
				>Website</button
			>
			<a class="open-full" href="/news-research" title="Als volle Seite öffnen">↗</a>
		</div>

		<form onsubmit={onDiscover} class="row">
			{#if mode === 'query'}
				<input
					type="text"
					placeholder="z.B. KI-Regulierung, Klimawandel"
					bind:value={query}
					disabled={store.discovering}
				/>
				<button type="submit" disabled={store.discovering || query.trim().length < 3}>
					{store.discovering ? '…' : 'Finden'}
				</button>
			{:else}
				<input
					type="url"
					placeholder="https://…"
					bind:value={siteUrl}
					disabled={store.discovering}
				/>
				<button type="submit" disabled={store.discovering || !isUrl(siteUrl)}>
					{store.discovering ? '…' : 'Entdecken'}
				</button>
			{/if}
		</form>
		{#if store.error}<div class="error">{store.error}</div>{/if}
	</section>

	{#if store.session.discoveredFeeds.length > 0}
		<section class="slot">
			<button type="button" class="collapse" onclick={() => (feedsOpen = !feedsOpen)}>
				<span
					>Feeds ({store.session.selectedFeeds.length}/{store.session.discoveredFeeds.length})</span
				>
				<span>{feedsOpen ? '▾' : '▸'}</span>
			</button>
			{#if feedsOpen}
				<ul class="feeds">
					{#each store.session.discoveredFeeds as feed (feed.url)}
						<li>
							<label>
								<input
									type="checkbox"
									checked={store.session.selectedFeeds.includes(feed.url)}
									onchange={() => store.toggleFeed(feed.url)}
								/>
								<span class="ft">{feed.title ?? feed.url}</span>
							</label>
						</li>
					{/each}
				</ul>
			{/if}

			<form onsubmit={onSearch} class="row">
				<input
					type="text"
					placeholder="Artikel filtern"
					bind:value={searchQuery}
					disabled={store.searching}
				/>
				<button
					type="submit"
					disabled={store.searching ||
						!searchQuery.trim() ||
						store.session.selectedFeeds.length === 0}
				>
					{store.searching ? '…' : 'Suchen'}
				</button>
			</form>
		</section>
	{/if}

	{#if store.session.results.length > 0}
		<section class="slot">
			<div class="results-head">
				<span>Treffer ({store.session.results.length})</span>
				<button type="button" class="ctx" onclick={onCopy}>KI-Kontext: {copyLabel}</button>
			</div>
			{#if saveError}<div class="error">{saveError}</div>{/if}
			<ul class="results">
				{#each store.session.results as a (a.url)}
					<li>
						<a href={a.url} target="_blank" rel="noreferrer" class="rt">{a.title}</a>
						<div class="rm">
							<span>{formatDate(a.publishedAt)}</span>
							<span>·</span>
							<span>Score {a.score}</span>
							<button
								type="button"
								class="save"
								disabled={savingUrl === a.url}
								onclick={() => onSave(a.url)}
							>
								{savingUrl === a.url ? '…' : 'Speichern'}
							</button>
						</div>
					</li>
				{/each}
			</ul>
		</section>
	{/if}

	{#if store.session.discoveredFeeds.length === 0 && !store.discovering}
		<section class="empty">
			{#if store.session.hasDiscovered && !store.error}
				Keine passenden Feeds gefunden. Versuche andere Stichworte oder den „Website"-Modus.
			{:else if !store.session.hasDiscovered}
				Entdecke zum Thema passende RSS-Feeds, filtere Artikel und übergib sie deiner KI als
				Kontext.
			{/if}
		</section>
	{/if}
</div>

<style>
	.wrap {
		display: flex;
		flex-direction: column;
		gap: 0.65rem;
		padding: 0.65rem;
		height: 100%;
		overflow-y: auto;
		color: hsl(var(--color-foreground));
	}
	.slot {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 0.55rem;
		border: 1px solid hsl(var(--color-border));
		border-radius: 0.5rem;
		background: hsl(var(--color-background));
	}
	.empty {
		color: hsl(var(--color-muted-foreground));
		font-size: 0.85rem;
		padding: 0.75rem;
		text-align: center;
	}
	.mode-switch {
		display: flex;
		gap: 0.2rem;
		align-items: center;
		background: hsl(var(--color-muted));
		padding: 0.2rem;
		border-radius: 0.4rem;
	}
	.mode-switch button {
		flex: 1;
		background: transparent;
		border: none;
		padding: 0.3rem 0.5rem;
		border-radius: 0.3rem;
		cursor: pointer;
		font-size: 0.8rem;
		color: hsl(var(--color-muted-foreground));
	}
	.mode-switch button.active {
		background: hsl(var(--color-background));
		color: hsl(var(--color-foreground));
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
	}
	.open-full {
		padding: 0 0.4rem;
		text-decoration: none;
		color: hsl(var(--color-muted-foreground));
		font-size: 0.9rem;
	}
	.row {
		display: flex;
		gap: 0.35rem;
	}
	.row input {
		flex: 1;
		min-width: 0;
		padding: 0.35rem 0.5rem;
		border: 1px solid hsl(var(--color-border));
		border-radius: 0.35rem;
		background: hsl(var(--color-background));
		color: hsl(var(--color-foreground));
		font-size: 0.85rem;
	}
	.row button {
		padding: 0.35rem 0.7rem;
		border: none;
		border-radius: 0.35rem;
		background: hsl(var(--color-primary));
		color: hsl(var(--color-primary-foreground, 0 0% 100%));
		cursor: pointer;
		font-size: 0.8rem;
		white-space: nowrap;
	}
	.row button:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.collapse {
		display: flex;
		justify-content: space-between;
		background: transparent;
		border: none;
		padding: 0.2rem 0;
		cursor: pointer;
		font-size: 0.85rem;
		color: hsl(var(--color-foreground));
		font-weight: 500;
	}
	.feeds,
	.results {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.3rem;
		max-height: 180px;
		overflow-y: auto;
	}
	.feeds li {
		display: flex;
		gap: 0.35rem;
		align-items: center;
	}
	.feeds li label {
		display: flex;
		align-items: center;
		gap: 0.35rem;
		flex: 1;
		min-width: 0;
		cursor: pointer;
		font-size: 0.8rem;
		color: hsl(var(--color-foreground));
	}
	.ft {
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}
	.results-head {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 0.85rem;
		font-weight: 500;
		color: hsl(var(--color-foreground));
	}
	.ctx {
		background: hsl(var(--color-muted));
		border: 1px solid hsl(var(--color-border));
		border-radius: 0.3rem;
		padding: 0.2rem 0.5rem;
		font-size: 0.75rem;
		cursor: pointer;
		color: hsl(var(--color-foreground));
	}
	.results li {
		display: flex;
		flex-direction: column;
		gap: 0.2rem;
		padding: 0.35rem;
		border: 1px solid hsl(var(--color-border));
		border-radius: 0.35rem;
	}
	.rt {
		font-size: 0.85rem;
		font-weight: 600;
		color: hsl(var(--color-foreground));
		text-decoration: none;
		line-height: 1.25;
	}
	.rt:hover {
		text-decoration: underline;
	}
	.rm {
		display: flex;
		gap: 0.3rem;
		align-items: center;
		font-size: 0.7rem;
		color: hsl(var(--color-muted-foreground));
	}
	.save {
		margin-left: auto;
		background: transparent;
		border: 1px solid hsl(var(--color-border));
		border-radius: 0.25rem;
		padding: 0.1rem 0.4rem;
		font-size: 0.7rem;
		cursor: pointer;
		color: hsl(var(--color-foreground));
	}
	.save:disabled {
		opacity: 0.5;
	}
	.error {
		background: hsl(var(--color-destructive) / 0.1);
		border: 1px solid hsl(var(--color-destructive) / 0.4);
		color: hsl(var(--color-destructive));
		padding: 0.35rem 0.5rem;
		border-radius: 0.35rem;
		font-size: 0.8rem;
	}
</style>
