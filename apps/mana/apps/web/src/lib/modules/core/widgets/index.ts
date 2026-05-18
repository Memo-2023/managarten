/**
 * Core Dashboard Widgets — Phase 4 Cross-App Widgets
 *
 * Self-contained Svelte 5 components that query the unified IndexedDB
 * database directly via Dexie liveQuery. No cross-origin hacks needed
 * since all apps share one database in the unified Mana app.
 */

export { default as TasksTodayWidget } from './TasksTodayWidget.svelte';
export { default as UpcomingEventsWidget } from './UpcomingEventsWidget.svelte';
export { default as RecentContactsWidget } from './RecentContactsWidget.svelte';
export { default as QuoteOfTheDayWidget } from './QuoteOfTheDayWidget.svelte';
export { default as ActiveTimerWidget } from './ActiveTimerWidget.svelte';
export { default as RecentChatsWidget } from './RecentChatsWidget.svelte';
export { default as QuickActionsWidget } from './QuickActionsWidget.svelte';
export { default as WidgetGrid } from './WidgetGrid.svelte';
