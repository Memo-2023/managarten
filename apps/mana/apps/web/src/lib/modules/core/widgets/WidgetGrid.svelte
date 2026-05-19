<script lang="ts">
	/**
	 * WidgetGrid — Responsive Grid aller Dashboard-Widgets.
	 *
	 * Rendert alle Cross-App-Widgets in einem CSS-Grid mit konsistentem
	 * Card-Container. Jedes Widget ist eigenständig und benötigt keine Props.
	 */

	import TasksTodayWidget from './TasksTodayWidget.svelte';
	import UpcomingEventsWidget from './UpcomingEventsWidget.svelte';
	import RecentContactsWidget from './RecentContactsWidget.svelte';
	import ActiveTimerWidget from './ActiveTimerWidget.svelte';
	import RecentChatsWidget from './RecentChatsWidget.svelte';
	import QuickActionsWidget from './QuickActionsWidget.svelte';

	const widgets = [
		{ id: 'tasks-today', component: TasksTodayWidget },
		{ id: 'upcoming-events', component: UpcomingEventsWidget },
		{ id: 'active-timer', component: ActiveTimerWidget },
		{ id: 'quick-actions', component: QuickActionsWidget },
		{ id: 'recent-chats', component: RecentChatsWidget },
		{ id: 'recent-contacts', component: RecentContactsWidget },
	];
</script>

<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
	{#each widgets as widget (widget.id)}
		{@const Widget = widget.component}
		<div class="rounded-xl border border-border bg-card p-4 shadow-sm">
			<svelte:boundary>
				<Widget />
				{#snippet failed(error, reset)}
					<div class="flex flex-col items-center justify-center py-6 text-center">
						<div class="mb-2 text-2xl">&#9888;&#65039;</div>
						<p class="mb-3 text-sm text-muted-foreground">
							{(error as Error)?.message || 'Widget-Fehler'}
						</p>
						<button
							type="button"
							onclick={reset}
							class="rounded-md bg-muted px-3 py-1 text-xs hover:bg-muted/80"
						>
							Erneut versuchen
						</button>
					</div>
				{/snippet}
			</svelte:boundary>
		</div>
	{/each}
</div>
