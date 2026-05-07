<script lang="ts">
	import { cardsApi, CardsApiError, type PullRequest } from '$lib/api/cards-api';
	import { authStore } from '$lib/stores/auth.svelte';

	interface Props {
		deckSlug: string;
		ownerUserId: string;
		onMerged?: () => void;
	}

	let { deckSlug, ownerUserId, onMerged }: Props = $props();

	let prs = $state<PullRequest[]>([]);
	let loading = $state(false);
	let error = $state<string | null>(null);
	let actionBusy = $state<string | null>(null);
	let expanded = $state<Record<string, boolean>>({});

	const viewerIsOwner = $derived(authStore.user?.id === ownerUserId);

	$effect(() => {
		void deckSlug;
		load();
	});

	async function load() {
		loading = true;
		error = null;
		try {
			prs = await cardsApi.pullRequests.list(deckSlug);
		} catch (e) {
			error = e instanceof CardsApiError ? e.message : (e as Error).message;
		} finally {
			loading = false;
		}
	}

	async function merge(pr: PullRequest) {
		if (!confirm(`PR „${pr.title}" mergen? Erstellt eine neue Version.`)) return;
		actionBusy = pr.id;
		error = null;
		try {
			await cardsApi.pullRequests.merge(pr.id);
			await load();
			onMerged?.();
		} catch (e) {
			error = e instanceof CardsApiError ? e.message : (e as Error).message;
		} finally {
			actionBusy = null;
		}
	}

	async function close(pr: PullRequest) {
		actionBusy = pr.id;
		error = null;
		try {
			await cardsApi.pullRequests.close(pr.id);
			await load();
		} catch (e) {
			error = e instanceof CardsApiError ? e.message : (e as Error).message;
		} finally {
			actionBusy = null;
		}
	}

	async function reject(pr: PullRequest) {
		actionBusy = pr.id;
		error = null;
		try {
			await cardsApi.pullRequests.reject(pr.id);
			await load();
		} catch (e) {
			error = e instanceof CardsApiError ? e.message : (e as Error).message;
		} finally {
			actionBusy = null;
		}
	}

	function statusBadgeClass(s: PullRequest['status']) {
		if (s === 'open') return 'bg-success/15 text-success';
		if (s === 'merged') return 'bg-violet-500/15 text-violet-300';
		if (s === 'rejected') return 'bg-error/15 text-error';
		return 'bg-muted text-muted-foreground';
	}

	function diffSummary(pr: PullRequest) {
		return `+${pr.diff.add.length} · ~${pr.diff.modify.length} · −${pr.diff.remove.length}`;
	}
</script>

<section class="mt-10">
	<header class="mb-3 flex items-center justify-between">
		<h2 class="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
			Pull Requests {prs.length > 0 ? `(${prs.length})` : ''}
		</h2>
		<button
			class="text-xs text-muted-foreground/80 hover:text-foreground/80"
			onclick={load}
			disabled={loading}
		>
			{loading ? 'Lädt…' : 'Aktualisieren'}
		</button>
	</header>

	{#if error}
		<p class="mb-3 rounded-lg border border-error/30 bg-error/10 p-3 text-sm text-error">
			{error}
		</p>
	{/if}

	{#if loading && prs.length === 0}
		<p class="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground/80">
			Lädt…
		</p>
	{:else if prs.length === 0}
		<p class="rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground/80">
			Noch keine Pull Requests. Abonnenten können Verbesserungen vorschlagen.
		</p>
	{:else}
		<ul class="space-y-2">
			{#each prs as pr (pr.id)}
				<li class="rounded-xl border border-border bg-card p-4">
					<div class="flex items-start justify-between gap-3">
						<div class="min-w-0">
							<div class="flex items-center gap-2">
								<span class="rounded-full px-2 py-0.5 text-xs {statusBadgeClass(pr.status)}">
									{pr.status}
								</span>
								<h3 class="truncate font-medium text-foreground">{pr.title}</h3>
							</div>
							<p class="mt-1 text-xs text-muted-foreground/80">
								{diffSummary(pr)} · {new Date(pr.createdAt).toLocaleDateString('de-DE')}
							</p>
						</div>
						<button
							class="shrink-0 text-xs text-muted-foreground/80 hover:text-foreground/80"
							onclick={() => (expanded[pr.id] = !expanded[pr.id])}
						>
							{expanded[pr.id] ? 'Einklappen' : 'Details'}
						</button>
					</div>

					{#if expanded[pr.id]}
						{#if pr.body}
							<p class="mt-3 whitespace-pre-line text-sm text-foreground/80">{pr.body}</p>
						{/if}

						{#if pr.diff.modify.length > 0}
							<div class="mt-3">
								<div class="mb-1 text-xs uppercase text-muted-foreground/80">Geändert</div>
								<ul class="space-y-2">
									{#each pr.diff.modify as m (m.contentHash)}
										<li class="rounded-lg border border-border bg-background p-2 text-xs">
											<div class="text-muted-foreground/80">
												← {m.contentHash.slice(0, 12)}…
											</div>
											{#each Object.entries(m.fields) as [k, v]}
												<div class="mt-1">
													<span class="text-muted-foreground/80">{k}:</span>
													<span class="text-foreground/90">{v}</span>
												</div>
											{/each}
										</li>
									{/each}
								</ul>
							</div>
						{/if}

						{#if pr.diff.add.length > 0}
							<div class="mt-3">
								<div class="mb-1 text-xs uppercase text-muted-foreground/80">
									Neu (+{pr.diff.add.length})
								</div>
								<ul class="space-y-2">
									{#each pr.diff.add as a, i (i)}
										<li class="rounded-lg border border-border bg-background p-2 text-xs">
											<div class="text-muted-foreground/80">{a.type}</div>
											{#each Object.entries(a.fields) as [k, v]}
												<div class="mt-1">
													<span class="text-muted-foreground/80">{k}:</span>
													<span class="text-foreground/90">{v}</span>
												</div>
											{/each}
										</li>
									{/each}
								</ul>
							</div>
						{/if}

						{#if pr.diff.remove.length > 0}
							<div class="mt-3">
								<div class="mb-1 text-xs uppercase text-muted-foreground/80">
									Entfernt (−{pr.diff.remove.length})
								</div>
								<ul class="space-y-1 text-xs text-muted-foreground">
									{#each pr.diff.remove as r (r.contentHash)}
										<li>· {r.contentHash.slice(0, 12)}…</li>
									{/each}
								</ul>
							</div>
						{/if}

						{#if pr.status === 'open' && viewerIsOwner}
							<div class="mt-4 flex gap-2">
								<button
									class="rounded-lg bg-violet-500 px-3 py-1.5 text-xs text-white hover:bg-violet-400 disabled:opacity-50"
									onclick={() => merge(pr)}
									disabled={actionBusy === pr.id}
								>
									{actionBusy === pr.id ? 'Mergt…' : 'Mergen'}
								</button>
								<button
									class="rounded-lg border border-error/40 px-3 py-1.5 text-xs text-error hover:bg-error/10 disabled:opacity-50"
									onclick={() => reject(pr)}
									disabled={actionBusy === pr.id}
								>
									Ablehnen
								</button>
								<button
									class="rounded-lg border border-border-strong px-3 py-1.5 text-xs hover:bg-muted disabled:opacity-50"
									onclick={() => close(pr)}
									disabled={actionBusy === pr.id}
								>
									Schließen
								</button>
							</div>
						{/if}
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</section>
