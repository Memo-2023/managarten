<script lang="ts">
	/**
	 * FormsWidget — Heimstart-Karte für das Forms-Modul.
	 *
	 * Zeigt: Stats (drafts / published / total responses), die zwei zuletzt
	 * aktualisierten Forms mit Response-Count, Quick-Action zu /forms.
	 * Live aus Dexie — keine Server-Roundtrips.
	 */

	import { liveQuery } from 'dexie';
	import { formTable, formResponseTable } from '$lib/modules/forms/collections';
	import { decryptRecords } from '$lib/data/crypto';
	import { toForm } from '$lib/modules/forms/queries';
	import type { Form, LocalForm, LocalFormResponse } from '$lib/modules/forms/types';

	let forms = $state<Form[]>([]);
	let totalResponses = $state(0);
	let recentResponseCount = $state(0);
	let loading = $state(true);

	$effect(() => {
		const formsSub = liveQuery(async () => {
			const rows = await formTable.toArray();
			const visible = rows.filter((r) => !r.deletedAt);
			const decrypted = (await decryptRecords('forms', visible)) as LocalForm[];
			return decrypted.map(toForm);
		}).subscribe({
			next: (result) => {
				forms = result;
				loading = false;
			},
			error: () => {
				loading = false;
			},
		});

		const responsesSub = liveQuery(async () => {
			const rows = await formResponseTable.toArray();
			return rows.filter((r) => !r.deletedAt);
		}).subscribe({
			next: (rows: LocalFormResponse[]) => {
				totalResponses = rows.length;
				const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
				recentResponseCount = rows.filter((r) => r.submittedAt >= sevenDaysAgo).length;
			},
		});

		return () => {
			formsSub.unsubscribe();
			responsesSub.unsubscribe();
		};
	});

	const stats = $derived({
		total: forms.length,
		drafts: forms.filter((f) => f.status === 'draft').length,
		published: forms.filter((f) => f.status === 'published').length,
		closed: forms.filter((f) => f.status === 'closed').length,
	});

	const recentForms = $derived(
		forms
			.slice()
			.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
			.slice(0, 2)
	);

	function relativeTime(iso: string): string {
		const diffMs = Date.now() - new Date(iso).getTime();
		const minutes = Math.round(diffMs / 60000);
		if (minutes < 1) return 'gerade';
		if (minutes < 60) return `vor ${minutes} min`;
		const hours = Math.round(minutes / 60);
		if (hours < 24) return `vor ${hours} h`;
		const days = Math.round(hours / 24);
		return `vor ${days} ${days === 1 ? 'Tag' : 'Tagen'}`;
	}
</script>

<div>
	<div class="mb-3 flex items-center justify-between">
		<h3 class="flex items-center gap-2 text-lg font-semibold">
			<span aria-hidden="true">📋</span>
			Formulare
		</h3>
		<a href="/forms" class="text-xs text-muted-foreground hover:text-foreground">Alle →</a>
	</div>

	{#if loading}
		<div class="space-y-2">
			{#each Array(2) as _}
				<div class="h-10 animate-pulse rounded bg-surface-hover"></div>
			{/each}
		</div>
	{:else if forms.length === 0}
		<div class="py-4 text-center">
			<p class="text-sm text-muted-foreground">Noch keine Formulare.</p>
			<a
				href="/forms"
				class="mt-3 inline-block rounded-lg bg-primary/10 px-4 py-2 text-sm font-medium text-primary hover:bg-primary/20"
			>
				+ Erstes Formular bauen
			</a>
		</div>
	{:else}
		<div class="mb-3 grid grid-cols-3 gap-2 text-center">
			<div class="rounded-lg bg-surface-hover/50 p-2">
				<div class="text-xl font-semibold tabular-nums">{stats.published}</div>
				<div class="text-xs text-muted-foreground">veröffentlicht</div>
			</div>
			<div class="rounded-lg bg-surface-hover/50 p-2">
				<div class="text-xl font-semibold tabular-nums">{stats.drafts}</div>
				<div class="text-xs text-muted-foreground">Entwurf</div>
			</div>
			<div class="rounded-lg bg-surface-hover/50 p-2">
				<div class="text-xl font-semibold tabular-nums">{totalResponses}</div>
				<div class="text-xs text-muted-foreground">
					Antworten
					{#if recentResponseCount > 0}
						<span class="ml-1 text-emerald-500">+{recentResponseCount}/7T</span>
					{/if}
				</div>
			</div>
		</div>

		<ul class="space-y-1.5">
			{#each recentForms as form (form.id)}
				<li>
					<a
						href="/forms/{form.id}"
						class="flex items-center justify-between rounded-lg bg-surface-hover/30 px-3 py-2 text-sm hover:bg-surface-hover/60"
					>
						<span class="flex items-center gap-2 overflow-hidden">
							<span
								class="inline-block h-1.5 w-1.5 flex-shrink-0 rounded-full"
								class:bg-emerald-500={form.status === 'published'}
								class:bg-muted={form.status !== 'published'}
								aria-hidden="true"
							></span>
							<span class="truncate">{form.title}</span>
						</span>
						<span class="ml-2 flex flex-shrink-0 items-center gap-2 text-xs text-muted-foreground">
							{#if form.responseCount > 0}
								<span
									>{form.responseCount} {form.responseCount === 1 ? 'Antwort' : 'Antworten'}</span
								>
							{/if}
							<span>{relativeTime(form.updatedAt)}</span>
						</span>
					</a>
				</li>
			{/each}
		</ul>

		{#if stats.total > recentForms.length}
			<a
				href="/forms"
				class="mt-2 block text-center text-xs text-muted-foreground hover:text-foreground"
			>
				+ {stats.total - recentForms.length} weitere
			</a>
		{/if}
	{/if}
</div>
