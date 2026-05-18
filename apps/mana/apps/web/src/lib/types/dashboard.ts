/**
 * Dashboard Widget System Types
 *
 * Defines the type system for the configurable cross-app dashboard.
 */

/**
 * Available widget types - each represents a different data source
 */
export type WidgetType =
	| 'credits' // Credits balance from mana-auth
	| 'quick-actions' // Quick action links
	| 'transactions' // Recent credit transactions
	| 'tasks-today' // Todo API: today's tasks
	| 'tasks-upcoming' // Todo API: upcoming 7 days
	| 'calendar-events' // Calendar API: upcoming events
	| 'chat-recent' // Chat API: recent conversations
	| 'contacts-favorites' // Contacts API: favorite contacts
	| 'contacts-recent' // Contacts: recently updated
	| 'quotes-quote' // Quotes API: daily inspiration quote
	| 'picture-recent' // Picture API: recent generations
	| 'clock-timers' // Clock: active timers and alarms
	| 'storage-usage' // Storage: file storage stats
	| 'music-library' // Music: music library stats
	| 'presi-decks' // Presi: recent presentations
	| 'active-timer' // Times: running timer
	| 'plant-watering' // Plants: plants due for watering
	| 'day-timeline' // TimeBlocks: chronological day timeline
	| 'activity-feed' // TimeBlocks: recent activity across modules
	| 'period' // Period: current phase + days until next period
	| 'news-unread' // News: latest unread curated articles
	| 'articles-unread' // Articles: saved read-it-later articles
	| 'body-stats' // Body: latest weight + active workout summary
	| 'invoices-open' // Invoices: open/overdue totals + oldest overdue
	| 'broadcasts' // Broadcast: YTD counts + last sent + next scheduled
	| 'forms'; // Forms: status counts + last forms + recent response count

/**
 * Widget size - maps to CSS Grid columns
 * - small: 4 cols (1/3 width on desktop)
 * - medium: 6 cols (1/2 width on desktop)
 * - large: 8 cols (2/3 width on desktop)
 * - full: 12 cols (full width)
 */
export type WidgetSize = 'small' | 'medium' | 'large' | 'full';

/**
 * Individual widget instance configuration
 */
export interface WidgetConfig {
	/** Unique instance ID (e.g., "tasks-today-1") */
	id: string;
	/** Widget type */
	type: WidgetType;
	/** i18n key for title (e.g., "dashboard.widgets.credits.title") */
	title: string;
	/** Grid size */
	size: WidgetSize;
	/** Grid position */
	position: {
		/** Column (0-11 for 12-col grid) */
		x: number;
		/** Row index */
		y: number;
	};
	/** Show/hide toggle */
	visible: boolean;
	/** Widget-specific settings */
	settings?: Record<string, unknown>;
}

/**
 * Complete dashboard state
 */
export interface DashboardConfig {
	/** List of widget configurations */
	widgets: WidgetConfig[];
	/** Number of grid columns (default: 12) */
	gridColumns: number;
	/** ISO timestamp of last modification */
	lastModified: string;
}

/**
 * Widget loading state
 */
export type WidgetLoadState = 'idle' | 'loading' | 'success' | 'error';

/**
 * Generic widget data state wrapper
 */
export interface WidgetDataState<T> {
	/** Current loading state */
	state: WidgetLoadState;
	/** Fetched data (null if not loaded or error) */
	data: T | null;
	/** Error message (null if no error) */
	error: string | null;
	/** Number of retry attempts made */
	retryCount: number;
	/** ISO timestamp of last fetch attempt */
	lastFetch: string | null;
}

/**
 * Widget metadata for the widget picker
 */
export interface WidgetMeta {
	type: WidgetType;
	/** i18n key for display name */
	nameKey: string;
	/** i18n key for description */
	descriptionKey: string;
	/** Icon identifier */
	icon: string;
	/** Default size for new instances */
	defaultSize: WidgetSize;
	/** Whether multiple instances are allowed */
	allowMultiple: boolean;
	/** Required backend (for status display) */
	requiredBackend?:
		| 'todo'
		| 'calendar'
		| 'chat'
		| 'contacts'
		| 'quotes'
		| 'picture'
		| 'cards'
		| 'storage'
		| 'music'
		| 'presi'
		| 'times'
		| 'plants'
		| 'period'
		| 'body'
		| 'mana-auth';
}

/**
 * Widget registry - metadata for all available widgets
 */
export const WIDGET_REGISTRY: WidgetMeta[] = [
	{
		type: 'credits',
		nameKey: 'dashboard.widgets.credits.title',
		descriptionKey: 'dashboard.widgets.credits.description',
		icon: '💰',
		defaultSize: 'medium',
		allowMultiple: false,
		requiredBackend: 'mana-auth',
	},
	{
		type: 'quick-actions',
		nameKey: 'dashboard.widgets.quick_actions.title',
		descriptionKey: 'dashboard.widgets.quick_actions.description',
		icon: '⚡',
		defaultSize: 'medium',
		allowMultiple: false,
	},
	{
		type: 'transactions',
		nameKey: 'dashboard.widgets.transactions.title',
		descriptionKey: 'dashboard.widgets.transactions.description',
		icon: '📊',
		defaultSize: 'medium',
		allowMultiple: false,
		requiredBackend: 'mana-auth',
	},
	{
		type: 'tasks-today',
		nameKey: 'dashboard.widgets.tasks_today.title',
		descriptionKey: 'dashboard.widgets.tasks_today.description',
		icon: '✅',
		defaultSize: 'medium',
		allowMultiple: false,
		requiredBackend: 'todo',
	},
	{
		type: 'tasks-upcoming',
		nameKey: 'dashboard.widgets.tasks_upcoming.title',
		descriptionKey: 'dashboard.widgets.tasks_upcoming.description',
		icon: '📅',
		defaultSize: 'medium',
		allowMultiple: false,
		requiredBackend: 'todo',
	},
	{
		type: 'calendar-events',
		nameKey: 'dashboard.widgets.calendar.title',
		descriptionKey: 'dashboard.widgets.calendar.description',
		icon: '🗓️',
		defaultSize: 'medium',
		allowMultiple: false,
		requiredBackend: 'calendar',
	},
	{
		type: 'chat-recent',
		nameKey: 'dashboard.widgets.chat.title',
		descriptionKey: 'dashboard.widgets.chat.description',
		icon: '💬',
		defaultSize: 'medium',
		allowMultiple: false,
		requiredBackend: 'chat',
	},
	{
		type: 'contacts-favorites',
		nameKey: 'dashboard.widgets.contacts.title',
		descriptionKey: 'dashboard.widgets.contacts.description',
		icon: '👥',
		defaultSize: 'medium',
		allowMultiple: false,
		requiredBackend: 'contacts',
	},
	{
		type: 'quotes-quote',
		nameKey: 'dashboard.widgets.quotes.title',
		descriptionKey: 'dashboard.widgets.quotes.description',
		icon: '💡',
		defaultSize: 'medium',
		allowMultiple: false,
		requiredBackend: 'quotes',
	},
	{
		type: 'picture-recent',
		nameKey: 'dashboard.widgets.picture.title',
		descriptionKey: 'dashboard.widgets.picture.description',
		icon: '🎨',
		defaultSize: 'medium',
		allowMultiple: false,
		requiredBackend: 'picture',
	},
	{
		type: 'clock-timers',
		nameKey: 'dashboard.widgets.clock.title',
		descriptionKey: 'dashboard.widgets.clock.description',
		icon: '⏰',
		defaultSize: 'small',
		allowMultiple: false,
		requiredBackend: 'times',
	},
	{
		type: 'storage-usage',
		nameKey: 'dashboard.widgets.storage.title',
		descriptionKey: 'dashboard.widgets.storage.description',
		icon: '💾',
		defaultSize: 'medium',
		allowMultiple: false,
		requiredBackend: 'storage',
	},
	{
		type: 'music-library',
		nameKey: 'dashboard.widgets.music.title',
		descriptionKey: 'dashboard.widgets.music.description',
		icon: '🎵',
		defaultSize: 'medium',
		allowMultiple: false,
		requiredBackend: 'music',
	},
	{
		type: 'presi-decks',
		nameKey: 'dashboard.widgets.presi.title',
		descriptionKey: 'dashboard.widgets.presi.description',
		icon: '📊',
		defaultSize: 'medium',
		allowMultiple: false,
		requiredBackend: 'presi',
	},
	{
		type: 'contacts-recent',
		nameKey: 'dashboard.widgets.contacts_recent.title',
		descriptionKey: 'dashboard.widgets.contacts_recent.description',
		icon: '👤',
		defaultSize: 'medium',
		allowMultiple: false,
		requiredBackend: 'contacts',
	},
	{
		type: 'active-timer',
		nameKey: 'dashboard.widgets.active_timer.title',
		descriptionKey: 'dashboard.widgets.active_timer.description',
		icon: '⏱️',
		defaultSize: 'small',
		allowMultiple: false,
		requiredBackend: 'times',
	},
	{
		type: 'plant-watering',
		nameKey: 'dashboard.widgets.plant_watering.title',
		descriptionKey: 'dashboard.widgets.plant_watering.description',
		icon: '🌱',
		defaultSize: 'small',
		allowMultiple: false,
		requiredBackend: 'plants',
	},
	{
		type: 'day-timeline',
		nameKey: 'dashboard.widgets.day_timeline.title',
		descriptionKey: 'dashboard.widgets.day_timeline.description',
		icon: '⏱️',
		defaultSize: 'medium',
		allowMultiple: false,
	},
	{
		type: 'activity-feed',
		nameKey: 'dashboard.widgets.activity_feed.title',
		descriptionKey: 'dashboard.widgets.activity_feed.description',
		icon: '📊',
		defaultSize: 'medium',
		allowMultiple: false,
	},
	{
		type: 'period',
		nameKey: 'dashboard.widgets.period.title',
		descriptionKey: 'dashboard.widgets.period.description',
		icon: '🌸',
		defaultSize: 'small',
		allowMultiple: false,
		requiredBackend: 'period',
	},
	{
		type: 'news-unread',
		nameKey: 'dashboard.widgets.news_unread.title',
		descriptionKey: 'dashboard.widgets.news_unread.description',
		icon: '📰',
		defaultSize: 'small',
		allowMultiple: false,
	},
	{
		type: 'articles-unread',
		nameKey: 'dashboard.widgets.articles_unread.title',
		descriptionKey: 'dashboard.widgets.articles_unread.description',
		icon: '📚',
		defaultSize: 'small',
		allowMultiple: false,
	},
	{
		type: 'body-stats',
		nameKey: 'dashboard.widgets.body_stats.title',
		descriptionKey: 'dashboard.widgets.body_stats.description',
		icon: '💪',
		defaultSize: 'small',
		allowMultiple: false,
		requiredBackend: 'body',
	},
	{
		type: 'invoices-open',
		nameKey: 'dashboard.widgets.invoices_open.title',
		descriptionKey: 'dashboard.widgets.invoices_open.description',
		icon: '📄',
		defaultSize: 'medium',
		allowMultiple: false,
	},
	{
		type: 'broadcasts',
		nameKey: 'dashboard.widgets.broadcasts.title',
		descriptionKey: 'dashboard.widgets.broadcasts.description',
		icon: '📣',
		defaultSize: 'medium',
		allowMultiple: false,
	},
	{
		type: 'forms',
		nameKey: 'dashboard.widgets.forms.title',
		descriptionKey: 'dashboard.widgets.forms.description',
		icon: '📋',
		defaultSize: 'medium',
		allowMultiple: false,
	},
];

/**
 * Get widget metadata by type
 */
export function getWidgetMeta(type: WidgetType): WidgetMeta | undefined {
	return WIDGET_REGISTRY.find((w) => w.type === type);
}

/**
 * Size to Tailwind class mapping
 */
export const WIDGET_SIZE_CLASSES: Record<WidgetSize, string> = {
	small: 'col-span-12 sm:col-span-6 lg:col-span-4',
	medium: 'col-span-12 lg:col-span-6',
	large: 'col-span-12 lg:col-span-8',
	full: 'col-span-12',
};
