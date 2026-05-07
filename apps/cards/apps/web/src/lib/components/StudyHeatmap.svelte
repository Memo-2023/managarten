<script lang="ts">
	/**
	 * GitHub-style activity grid: 7 rows (weekdays) × N columns (weeks).
	 * Each cell encodes one day's review count via 5 color steps.
	 * Tooltips on hover show the date + count.
	 *
	 * Week-start convention: we group by ISO week starting Monday so the
	 * top row is always Mondays — matches the European calendar convention.
	 */

	import { useStudyHeatmap } from '$lib/queries';

	interface Props {
		weeks?: number;
	}
	let { weeks = 12 }: Props = $props();

	const dataQuery = $derived(useStudyHeatmap(weeks));
	const rawDays = $derived(($dataQuery as { date: string; count: number }[] | undefined) ?? []);

	// Pad to align the first day to a Monday so columns are full weeks.
	const grid = $derived.by(() => {
		if (rawDays.length === 0) return [] as { date: string | null; count: number }[];
		const first = new Date(rawDays[0].date);
		const dow = (first.getDay() + 6) % 7; // 0=Mon, 6=Sun
		const padded: { date: string | null; count: number }[] = [];
		for (let i = 0; i < dow; i++) padded.push({ date: null, count: 0 });
		padded.push(...rawDays);
		return padded;
	});

	const columns = $derived.by(() => {
		const cols: { date: string | null; count: number }[][] = [];
		for (let i = 0; i < grid.length; i += 7) cols.push(grid.slice(i, i + 7));
		return cols;
	});

	const max = $derived(rawDays.reduce((m, d) => Math.max(m, d.count), 0));

	function bucket(count: number): string {
		if (count === 0) return 'bg-muted';
		if (count <= Math.max(1, max * 0.25)) return 'bg-emerald-900';
		if (count <= max * 0.5) return 'bg-emerald-700';
		if (count <= max * 0.75) return 'bg-emerald-500';
		return 'bg-emerald-300';
	}

	function fmt(date: string): string {
		const d = new Date(date);
		return d.toLocaleDateString('de-DE', {
			weekday: 'short',
			day: '2-digit',
			month: '2-digit',
		});
	}

	const total = $derived(rawDays.reduce((sum, d) => sum + d.count, 0));
	const activeDays = $derived(rawDays.filter((d) => d.count > 0).length);
</script>

<div class="rounded-xl border border-border bg-card p-4">
	<div class="mb-3 flex items-center justify-between text-sm">
		<span class="font-medium">Lernaktivität</span>
		<span class="text-xs text-muted-foreground/80">
			{total} Karten · {activeDays} aktive {activeDays === 1 ? 'Tag' : 'Tage'} · letzte {weeks} Wochen
		</span>
	</div>
	<div class="flex gap-1 overflow-x-auto">
		{#each columns as col, ci (ci)}
			<div class="flex flex-col gap-1">
				{#each col as cell, ri (ri)}
					{#if cell.date === null}
						<div class="h-3 w-3"></div>
					{:else}
						<div
							class="h-3 w-3 rounded-sm {bucket(cell.count)}"
							title="{fmt(cell.date)}: {cell.count} {cell.count === 1 ? 'Karte' : 'Karten'}"
						></div>
					{/if}
				{/each}
			</div>
		{/each}
	</div>
	<div class="mt-3 flex items-center gap-1 text-xs text-muted-foreground/80">
		<span>weniger</span>
		<span class="ml-1 h-3 w-3 rounded-sm bg-muted"></span>
		<span class="h-3 w-3 rounded-sm bg-emerald-900"></span>
		<span class="h-3 w-3 rounded-sm bg-emerald-700"></span>
		<span class="h-3 w-3 rounded-sm bg-emerald-500"></span>
		<span class="h-3 w-3 rounded-sm bg-emerald-300"></span>
		<span class="ml-1">mehr</span>
	</div>
</div>
