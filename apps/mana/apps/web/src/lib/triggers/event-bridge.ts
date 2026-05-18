/**
 * Event Bridge — Connects Domain Events to the legacy Trigger system.
 *
 * Maps domain event types to the old (appId, collection, op) format
 * so existing user-created automations fire on semantic events (which
 * carry decrypted data) instead of only on raw Dexie hooks (which see
 * ciphertext for encrypted fields).
 *
 * This is a migration bridge. Long-term, automations should be
 * rewritten as Pulse Rules that subscribe to the Event Bus directly.
 */

import { eventBus } from '$lib/data/events/event-bus';
import { fire } from './registry';
import type { DomainEvent } from '$lib/data/events/types';

/** Map domain event type → legacy (appId, collection, op) */
const EVENT_MAP: Record<string, { appId: string; collection: string; op: string }> = {
	TaskCreated: { appId: 'todo', collection: 'tasks', op: 'insert' },
	TaskCompleted: { appId: 'todo', collection: 'tasks', op: 'update' },
	TaskDeleted: { appId: 'todo', collection: 'tasks', op: 'delete' },
	CalendarEventCreated: { appId: 'calendar', collection: 'events', op: 'insert' },
	CalendarEventDeleted: { appId: 'calendar', collection: 'events', op: 'delete' },
	DrinkLogged: { appId: 'drink', collection: 'drinkEntries', op: 'insert' },
	HabitLogged: { appId: 'habits', collection: 'habitLogs', op: 'insert' },
	HabitCreated: { appId: 'habits', collection: 'habits', op: 'insert' },
	JournalEntryCreated: { appId: 'journal', collection: 'journalEntries', op: 'insert' },
	NoteCreated: { appId: 'notes', collection: 'notes', op: 'insert' },
	ContactCreated: { appId: 'contacts', collection: 'contacts', op: 'insert' },
	PlaceVisited: { appId: 'places', collection: 'places', op: 'update' },
};

let unsubscribe: (() => void) | null = null;

/**
 * Start bridging domain events to the legacy trigger system.
 * Call once at app startup (after loadAutomations).
 */
export function startEventBridge(): void {
	if (unsubscribe) return;

	unsubscribe = eventBus.onAny((event: DomainEvent) => {
		const mapping = EVENT_MAP[event.type];
		if (!mapping) return;

		// Pass the domain event payload as the trigger data.
		// This is decrypted (unlike the Dexie hook data), so
		// condition matching on encrypted fields (title, etc.) works.
		fire(mapping.appId, mapping.collection, mapping.op, event.payload as Record<string, unknown>);
	});
}

export function stopEventBridge(): void {
	unsubscribe?.();
	unsubscribe = null;
}
