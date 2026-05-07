<script lang="ts">
	import { onMount } from 'svelte';
	import {
		cardsApi,
		CardsApiError,
		type BuyerPurchase,
		type AuthorPayout,
	} from '$lib/api/cards-api';

	let purchases = $state<BuyerPurchase[]>([]);
	let payouts = $state<AuthorPayout[]>([]);
	let loading = $state(true);
	let error = $state<string | null>(null);

	const totalSpent = $derived(
		purchases.filter((p) => !p.refundedAt).reduce((acc, p) => acc + p.priceCredits, 0)
	);
	const totalEarned = $derived(payouts.reduce((acc, p) => acc + p.creditsGranted, 0));

	onMount(async () => {
		try {
			const [p, py] = await Promise.all([
				cardsApi.purchases.listMine(),
				cardsApi.payouts.listMine().catch(() => [] as AuthorPayout[]),
			]);
			purchases = p;
			payouts = py;
		} catch (e) {
			error = e instanceof CardsApiError ? e.message : (e as Error).message;
		} finally {
			loading = false;
		}
	});
</script>

<svelte:head>
	<title>Meine Käufe — Cards</title>
</svelte:head>

<main class="mx-auto max-w-3xl px-6 py-8">
	<h1 class="mb-6 text-2xl font-semibold tracking-tight">Käufe & Auszahlungen</h1>

	{#if error}
		<p class="mb-4 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-400">
			{error}
		</p>
	{/if}

	<section class="mb-10">
		<header class="mb-3 flex items-baseline justify-between">
			<h2 class="text-sm font-semibold uppercase tracking-wide text-neutral-400">Käufe</h2>
			<span class="text-xs text-neutral-500">Ausgegeben: {totalSpent} 💎</span>
		</header>

		{#if loading}
			<p class="rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-sm text-neutral-500">
				Lädt…
			</p>
		{:else if purchases.length === 0}
			<p class="rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-sm text-neutral-500">
				Du hast noch keine Decks gekauft.
			</p>
		{:else}
			<ul class="space-y-2">
				{#each purchases as p (p.id)}
					<li
						class="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900 p-4"
					>
						<div class="min-w-0 flex-1">
							<a
								href="/d/{p.deckSlug}"
								class="truncate font-medium text-neutral-100 hover:text-indigo-300"
							>
								{p.deckTitle}
							</a>
							<p class="mt-1 text-xs text-neutral-500">
								v{p.versionSemver} · {new Date(p.purchasedAt).toLocaleDateString('de-DE')}
								{#if p.refundedAt}
									<span class="ml-2 rounded bg-amber-500/15 px-1.5 py-0.5 text-amber-300"
										>Erstattet</span
									>
								{/if}
							</p>
						</div>
						<span class="shrink-0 text-sm text-neutral-300">{p.priceCredits} 💎</span>
					</li>
				{/each}
			</ul>
		{/if}
	</section>

	{#if payouts.length > 0 || (!loading && payouts.length === 0)}
		<section>
			<header class="mb-3 flex items-baseline justify-between">
				<h2 class="text-sm font-semibold uppercase tracking-wide text-neutral-400">
					Author-Auszahlungen
				</h2>
				<span class="text-xs text-neutral-500">Erhalten: {totalEarned} 💎</span>
			</header>

			{#if payouts.length === 0}
				<p class="rounded-xl border border-neutral-800 bg-neutral-900 p-4 text-sm text-neutral-500">
					Noch keine Auszahlungen — sobald jemand eines deiner kostenpflichtigen Decks kauft, landet
					die Author-Beteiligung hier.
				</p>
			{:else}
				<ul class="space-y-2">
					{#each payouts as p (p.id)}
						<li
							class="flex items-center justify-between rounded-xl border border-neutral-800 bg-neutral-900 p-4"
						>
							<div class="min-w-0 flex-1">
								<a
									href="/d/{p.deckSlug}"
									class="truncate font-medium text-neutral-100 hover:text-indigo-300"
								>
									{p.deckTitle}
								</a>
								<p class="mt-1 text-xs text-neutral-500">
									Verkauf {p.priceCredits} 💎 · gutgeschrieben {new Date(
										p.grantedAt
									).toLocaleDateString('de-DE')}
								</p>
							</div>
							<span class="shrink-0 text-sm text-emerald-300">+{p.creditsGranted} 💎</span>
						</li>
					{/each}
				</ul>
			{/if}
		</section>
	{/if}
</main>
