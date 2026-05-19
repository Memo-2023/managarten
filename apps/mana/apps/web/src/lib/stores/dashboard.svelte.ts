/**
 * Dashboard Store - Manages dashboard configuration using local-first IndexedDB
 *
 * Reads/writes to the dashboardConfigs collection in @mana/local-store.
 * Changes sync across devices via mana-sync.
 */

import { browser } from '$app/environment';
import type { DashboardConfig, WidgetConfig, WidgetSize, WidgetType } from '$lib/types/dashboard';
import { DEFAULT_DASHBOARD_CONFIG } from '$lib/config/default-dashboard';
import { getWidgetMeta } from '$lib/types/dashboard';
import { dashboardCollection, type LocalDashboardConfig } from '$lib/data/local-store';

// State
let config = $state<DashboardConfig>(structuredClone(DEFAULT_DASHBOARD_CONFIG));
let isEditing = $state(false);
let initialized = $state(false);

/** Write current config to IndexedDB. */
async function persist() {
	if (!browser) return;

	config.lastModified = new Date().toISOString();

	const record: Partial<LocalDashboardConfig> = {
		widgets: config.widgets,
		gridColumns: config.gridColumns,
		lastModified: config.lastModified,
	};

	try {
		const existing = await dashboardCollection.get('dashboard-default');
		if (existing) {
			await dashboardCollection.update('dashboard-default', record);
		} else {
			await dashboardCollection.insert({
				id: 'dashboard-default',
				...record,
			} as LocalDashboardConfig);
		}
	} catch (e) {
		console.error('Failed to save dashboard config:', e);
	}
}

/**
 * Dashboard store with Svelte 5 runes
 */
export const dashboardStore = {
	// Getters
	get config() {
		return config;
	},
	get widgets() {
		return config.widgets.filter((w) => w.visible);
	},
	get allWidgets() {
		return config.widgets;
	},
	get isEditing() {
		return isEditing;
	},
	get initialized() {
		return initialized;
	},

	/**
	 * Initialize dashboard from IndexedDB
	 */
	async initialize() {
		if (!browser || initialized) return;

		try {
			const stored = await dashboardCollection.get('dashboard-default');
			if (stored && stored.widgets && Array.isArray(stored.widgets)) {
				config = {
					widgets: stored.widgets,
					gridColumns: stored.gridColumns || 12,
					lastModified: stored.lastModified || new Date().toISOString(),
				};
			}
		} catch (e) {
			console.error('Failed to load dashboard config:', e);
		}

		initialized = true;
	},

	/**
	 * Persist current config to IndexedDB
	 */
	persist,

	/**
	 * Enter edit mode
	 */
	startEditing() {
		isEditing = true;
	},

	/**
	 * Exit edit mode and save changes
	 */
	stopEditing() {
		isEditing = false;
		persist();
	},

	/**
	 * Toggle edit mode
	 */
	toggleEditing() {
		if (isEditing) {
			this.stopEditing();
		} else {
			this.startEditing();
		}
	},

	/**
	 * Update widgets array (called during drag-and-drop)
	 */
	updateWidgets(widgets: WidgetConfig[]) {
		config.widgets = widgets;
	},

	/**
	 * Update a single widget's position
	 */
	updateWidgetPosition(widgetId: string, position: { x: number; y: number }) {
		const widget = config.widgets.find((w) => w.id === widgetId);
		if (widget) {
			widget.position = position;
		}
	},

	/**
	 * Update a widget's size
	 */
	updateWidgetSize(widgetId: string, size: WidgetSize) {
		const widget = config.widgets.find((w) => w.id === widgetId);
		if (widget) {
			widget.size = size;
			persist();
		}
	},

	/**
	 * Toggle widget visibility
	 */
	toggleWidgetVisibility(widgetId: string) {
		const widget = config.widgets.find((w) => w.id === widgetId);
		if (widget) {
			widget.visible = !widget.visible;
			persist();
		}
	},

	/**
	 * Add a new widget
	 */
	addWidget(type: WidgetType) {
		const meta = getWidgetMeta(type);
		if (!meta) return;

		// Check if multiple instances are allowed
		if (!meta.allowMultiple) {
			const existing = config.widgets.find((w) => w.type === type);
			if (existing) {
				// Just make it visible
				existing.visible = true;
				persist();
				return;
			}
		}

		// Generate unique ID
		const existingCount = config.widgets.filter((w) => w.type === type).length;
		const id = `${type}-${existingCount + 1}`;

		// Find the next available row
		const maxY = Math.max(...config.widgets.map((w) => w.position.y), -1);

		const newWidget: WidgetConfig = {
			id,
			type,
			title: meta.nameKey,
			size: meta.defaultSize,
			position: { x: 0, y: maxY + 1 },
			visible: true,
		};

		config.widgets = [...config.widgets, newWidget];
		persist();
	},

	/**
	 * Remove a widget
	 */
	removeWidget(widgetId: string) {
		config.widgets = config.widgets.filter((w) => w.id !== widgetId);
		persist();
	},

	/**
	 * Reset to default configuration
	 */
	resetToDefault() {
		config = structuredClone(DEFAULT_DASHBOARD_CONFIG);
		persist();
	},

	/**
	 * Check if a widget type is currently active (visible)
	 */
	isWidgetActive(type: WidgetType): boolean {
		return config.widgets.some((w) => w.type === type && w.visible);
	},

	/**
	 * Get available widgets that can be added
	 */
	getAvailableWidgets(): WidgetType[] {
		const activeTypes = new Set(config.widgets.filter((w) => w.visible).map((w) => w.type));
		return (
			[
				'credits',
				'quick-actions',
				'transactions',
				'tasks-today',
				'tasks-upcoming',
				'calendar-events',
				'chat-recent',
				'contacts-favorites',
				'presi-decks',
			] as WidgetType[]
		).filter((type) => {
			const meta = getWidgetMeta(type);
			// Allow if multiple instances allowed or not currently active
			return meta?.allowMultiple || !activeTypes.has(type);
		});
	},
};
