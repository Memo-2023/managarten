/**
 * Widget Component Registry
 *
 * Maps widget types to their Svelte components.
 * Shared between WidgetContainer (grid layout) and TilePanel (tiling layout).
 */

import type { WidgetType } from '$lib/types/dashboard';
import type { Component } from 'svelte';

import CreditsWidget from './widgets/CreditsWidget.svelte';
import QuickActionsWidget from './widgets/QuickActionsWidget.svelte';
import TransactionsWidget from './widgets/TransactionsWidget.svelte';
import TasksTodayWidget from './widgets/TasksTodayWidget.svelte';
import TasksUpcomingWidget from './widgets/TasksUpcomingWidget.svelte';
import CalendarEventsWidget from './widgets/CalendarEventsWidget.svelte';
import ChatRecentWidget from './widgets/ChatRecentWidget.svelte';
import ContactsFavoritesWidget from './widgets/ContactsFavoritesWidget.svelte';
import QuoteWidget from './widgets/QuoteWidget.svelte';
import PictureRecentWidget from './widgets/PictureRecentWidget.svelte';
import ClockTimersWidget from './widgets/ClockTimersWidget.svelte';
import StorageUsageWidget from './widgets/StorageUsageWidget.svelte';
import PresiDecksWidget from './widgets/PresiDecksWidget.svelte';

// Phase 4: Unified app widgets (direct Dexie queries, internal routing)
import RecentContactsWidget from '$lib/modules/core/widgets/RecentContactsWidget.svelte';
import ActiveTimerWidget from '$lib/modules/core/widgets/ActiveTimerWidget.svelte';
import PeriodWidget from '$lib/modules/core/widgets/PeriodWidget.svelte';
import ArticlesUnreadWidget from '$lib/modules/articles/widgets/ArticlesUnreadWidget.svelte';
import BodyStatsWidget from '$lib/modules/body/widgets/BodyStatsWidget.svelte';
import InvoicesOpenWidget from '$lib/modules/invoices/widgets/InvoicesOpenWidget.svelte';
import BroadcastsWidget from '$lib/modules/broadcasts/widgets/BroadcastsWidget.svelte';
import FormsWidget from '$lib/modules/forms/widgets/FormsWidget.svelte';
import DayTimelineWidget from './widgets/DayTimelineWidget.svelte';
import ActivityFeedWidget from './widgets/ActivityFeedWidget.svelte';

export const widgetComponents: Record<WidgetType, Component> = {
	credits: CreditsWidget,
	'quick-actions': QuickActionsWidget,
	transactions: TransactionsWidget,
	'tasks-today': TasksTodayWidget,
	'tasks-upcoming': TasksUpcomingWidget,
	'calendar-events': CalendarEventsWidget,
	'chat-recent': ChatRecentWidget,
	'contacts-favorites': ContactsFavoritesWidget,
	'contacts-recent': RecentContactsWidget,
	'quotes-quote': QuoteWidget,
	'picture-recent': PictureRecentWidget,
	'clock-timers': ClockTimersWidget,
	'storage-usage': StorageUsageWidget,
	'presi-decks': PresiDecksWidget,
	'active-timer': ActiveTimerWidget,
	'day-timeline': DayTimelineWidget,
	'activity-feed': ActivityFeedWidget,
	period: PeriodWidget,
	'articles-unread': ArticlesUnreadWidget,
	'body-stats': BodyStatsWidget,
	'invoices-open': InvoicesOpenWidget,
	broadcasts: BroadcastsWidget,
	forms: FormsWidget,
};
