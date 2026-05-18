<!--
  /news-research — discover RSS feeds by query or site, select them,
  search their articles by keyword, and export the top results as an
  AI context block or save any to the reading list.

  Ephemeral session — lives in sessionStorage, never touches Dexie.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { researchSessionStore } from '$lib/modules/news-research/stores/session.svelte';
	import { articlesStore } from '$lib/modules/articles/stores/articles.svelte';
	import { RoutePage } from '$lib/components/shell';

	let mode = $state<'query' | 'site'>('query');
	let query = $state('');
	let siteUrl = $state('');
	let searchQuery = $state('');
	let copyLabel = $state('Als KI-Kontext kopieren');
	let savingUrl = $state<string | null>(null);
	let saveError = $state<string | null>(null);

	const store = researchSessionStore;

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
	}

	async function onCopy() {
		try {
			await navigator.clipboard.writeText(store.buildAiContext());
			copyLabel = 'Kopiert ✓';
			setTimeout(() => (copyLabel = 'Als KI-Kontext kopieren'), 1500);
		} catch {
			copyLabel = 'Kopieren fehlgeschlagen';
		}
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

	function formatDate(iso: string | null): string {
		if (!iso) return '';
		try {
			return new Date(iso).toLocaleDateString('de-DE', {
				year: 'numeric',
				month: 'short',
				day: 'numeric',
			});
		} catch {
			return '';
		}
	}
</script>

<svelte:head>
	<title>News Research — Mana</title>
</svelte:head>

<RoutePage appId="news-research">
	<div class="page">
		<header class="header">
			<h1>News Research</h1>
			<p class="hint">
				Finde RSS-Feeds zu deinem Thema, filtere Artikel und übergib das Ergebnis deiner KI als
				Kontext.
			</p>
		</header>

		<section class="block">
			<div class="mode-switch">
				<button type="button" class:active={mode === 'query'} onclick={() => (mode = 'query')}
					>Thema-Suche</button
				>
				<button type="button" class:active={mode === 'site'} onclick={() => (mode = 'site')}
					>Von Website</button
				>
			</div>

			<form onsubmit={onDiscover} class="discover-form">
				{#if mode === 'query'}
					<input
						type="text"
						placeholder="z.B. Klimawandel, KI-Regulierung, Mars-Missionen"
						bind:value={query}
						disabled={store.discovering}
					/>
					<button type="submit" disabled={store.discovering || query.trim().length < 3}>
						{store.discovering ? 'Suche…' : 'Feeds finden'}
					</button>
				{:else}
					<input
						type="url"
						placeholder="https://example.com"
						bind:value={siteUrl}
						disabled={store.discovering}
					/>
					<button type="submit" disabled={store.discovering || !isUrl(siteUrl)}>
						{store.discovering ? 'Suche…' : 'Feeds entdecken'}
					</button>
				{/if}
			</form>

			{#if store.error}
				<div class="error">{store.error}</div>
			{/if}

			{#if store.session.hasDiscovered && store.session.discoveredFeeds.length === 0 && !store.discovering && !store.error}
				<div class="empty-hint">
					Keine passenden Feeds gefunden. Versuche andere Stichworte oder den „Von Website"-Modus.
				</div>
			{/if}
		</section>

		{#if store.session.discoveredFeeds.length > 0}
			<section class="block">
				<div class="block-head">
					<h2>Gefundene Feeds ({store.session.discoveredFeeds.length})</h2>
					<span class="sub">{store.session.selectedFeeds.length} ausgewählt</span>
				</div>
				<ul class="feed-list">
					{#each store.session.discoveredFeeds as feed (feed.url)}
						<li>
							<label>
								<input
									type="checkbox"
									checked={store.session.selectedFeeds.includes(feed.url)}
									onchange={() => store.toggleFeed(feed.url)}
								/>
								<span class="feed-title">{feed.title ?? feed.url}</span>
								<span class="feed-type">{feed.type}</span>
								{#if feed.sourceHit}<span class="feed-src">{feed.sourceHit}</span>{/if}
							</label>
						</li>
					{/each}
				</ul>

				<form onsubmit={onSearch} class="search-form">
					<input
						type="text"
						placeholder="Artikel nach Stichworten filtern"
						bind:value={searchQuery}
						disabled={store.searching}
					/>
					<button
						type="submit"
						disabled={store.searching ||
							!searchQuery.trim() ||
							store.session.selectedFeeds.length === 0}
					>
						{store.searching ? 'Suche…' : 'Artikel suchen'}
					</button>
				</form>
			</section>
		{/if}

		{#if store.session.results.length > 0}
			<section class="block">
				<div class="block-head">
					<h2>Ergebnisse ({store.session.results.length})</h2>
					<button type="button" class="secondary" onclick={onCopy}>{copyLabel}</button>
				</div>
				{#if saveError}
					<div class="error">{saveError}</div>
				{/if}
				<ul class="result-list">
					{#each store.session.results as article (article.url)}
						<li class="result">
							<a href={article.url} target="_blank" rel="noreferrer" class="r-title"
								>{article.title}</a
							>
							<div class="r-meta">
								<span>{formatDate(article.publishedAt)}</span>
								<span>·</span>
								<span class="r-score">Score {article.score}</span>
								<span>·</span>
								<span class="r-feed">{article.feedUrl}</span>
							</div>
							{#if article.excerpt}
								<p class="r-excerpt">{article.excerpt}</p>
							{/if}
							<button
								type="button"
								class="save"
								disabled={savingUrl === article.url}
								onclick={() => onSave(article.url)}
							>
								{savingUrl === article.url ? 'Speichere…' : 'In Leseliste speichern'}
							</button>
						</li>
					{/each}
				</ul>
			</section>
		{/if}
	</div>
</RoutePage>

<style>
	.page {
		max-width: 840px;
		margin: 0 auto;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 1.25rem;
		color: hsl(var(--color-foreground));
	}
	.header h1 {
		margin: 0 0 0.25rem;
		font-size: 1.5rem;
	}
	.hint {
		color: hsl(var(--color-muted-foreground));
		margin: 0;
	}
	.block {
		background: hsl(var(--color-background));
		border: 1px solid hsl(var(--color-border));
		border-radius: 0.75rem;
		padding: 1rem;
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
	}
	.block-head {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
	}
	.block-head h2 {
		margin: 0;
		font-size: 1.1rem;
	}
	.sub {
		color: hsl(var(--color-muted-foreground));
		font-size: 0.85rem;
	}
	.mode-switch {
		display: inline-flex;
		gap: 0.25rem;
		background: hsl(var(--color-muted));
		padding: 0.25rem;
		border-radius: 0.5rem;
		width: fit-content;
	}
	.mode-switch button {
		background: transparent;
		border: none;
		padding: 0.35rem 0.75rem;
		border-radius: 0.35rem;
		cursor: pointer;
		color: hsl(var(--color-muted-foreground));
	}
	.mode-switch button.active {
		background: hsl(var(--color-background));
		color: hsl(var(--color-foreground));
		box-shadow: 0 1px 2px rgba(0, 0, 0, 0.08);
	}
	.discover-form,
	.search-form {
		display: flex;
		gap: 0.5rem;
	}
	.discover-form input,
	.search-form input {
		flex: 1;
		padding: 0.5rem 0.75rem;
		border: 1px solid hsl(var(--color-border));
		border-radius: 0.5rem;
		background: hsl(var(--color-background));
		color: hsl(var(--color-foreground));
	}
	button[type='submit'] {
		padding: 0.5rem 1rem;
		border: none;
		border-radius: 0.5rem;
		background: hsl(var(--color-primary));
		color: hsl(var(--color-primary-foreground, 0 0% 100%));
		cursor: pointer;
	}
	button[type='submit']:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.secondary {
		background: hsl(var(--color-muted));
		color: hsl(var(--color-foreground));
		border: 1px solid hsl(var(--color-border));
		border-radius: 0.5rem;
		padding: 0.35rem 0.75rem;
		cursor: pointer;
	}
	.feed-list,
	.result-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.feed-list li label {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		cursor: pointer;
		color: hsl(var(--color-foreground));
	}
	.feed-title {
		font-weight: 500;
	}
	.feed-type,
	.feed-src {
		font-size: 0.75rem;
		color: hsl(var(--color-muted-foreground));
	}
	.result {
		padding: 0.75rem;
		border: 1px solid hsl(var(--color-border));
		border-radius: 0.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.r-title {
		font-weight: 600;
		color: hsl(var(--color-foreground));
		text-decoration: none;
	}
	.r-title:hover {
		text-decoration: underline;
	}
	.r-meta {
		display: flex;
		gap: 0.4rem;
		font-size: 0.8rem;
		color: hsl(var(--color-muted-foreground));
		flex-wrap: wrap;
	}
	.r-excerpt {
		margin: 0.25rem 0 0;
		color: hsl(var(--color-foreground));
		font-size: 0.9rem;
	}
	.save {
		align-self: flex-start;
		background: transparent;
		border: 1px solid hsl(var(--color-border));
		border-radius: 0.35rem;
		padding: 0.25rem 0.65rem;
		font-size: 0.8rem;
		cursor: pointer;
		color: hsl(var(--color-foreground));
	}
	.save:disabled {
		opacity: 0.5;
		cursor: not-allowed;
	}
	.error {
		background: hsl(var(--color-destructive) / 0.1);
		border: 1px solid hsl(var(--color-destructive) / 0.4);
		color: hsl(var(--color-destructive));
		padding: 0.5rem 0.75rem;
		border-radius: 0.5rem;
		font-size: 0.9rem;
	}
	.empty-hint {
		color: hsl(var(--color-muted-foreground));
		font-size: 0.9rem;
		padding: 0.5rem 0;
	}
</style>
