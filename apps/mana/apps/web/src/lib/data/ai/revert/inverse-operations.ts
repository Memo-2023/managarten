/**
 * Inverse-operations registry — the "undo" side of AI-written events.
 *
 * Each handler takes the original event's payload and reverses its
 * effect by calling the originating module's store. Keeping the
 * module-specific knowledge localized here (rather than in revert-
 * iteration.ts) means each module can register its own inverse without
 * touching the orchestrator.
 *
 * Not every event is reversible. `create_*` → delete, `*Completed` →
 * uncomplete. Non-reversible event types (e.g. one-shot projections
 * that already got consumed) simply have no entry; the orchestrator
 * reports them as `skippedUnsupported`.
 */

import { tasksStore } from '$lib/modules/todo/stores/tasks.svelte';
import { eventsStore } from '$lib/modules/calendar/stores/events.svelte';
import { drinkStore } from '$lib/modules/drink/stores/drink.svelte';

export type InverseResult = { readonly ok: true } | { readonly ok: false; readonly reason: string };

export type InverseOperation = (payload: Record<string, unknown>) => Promise<InverseResult>;

const inverses = new Map<string, InverseOperation>();

export function registerInverseOperation(eventType: string, op: InverseOperation): void {
	inverses.set(eventType, op);
}

export function getInverseOperation(eventType: string): InverseOperation | undefined {
	return inverses.get(eventType);
}

export function isReversibleEventType(eventType: string): boolean {
	return inverses.has(eventType);
}

// ── Built-in inverses for the tools the AI actually proposes ──

registerInverseOperation('TaskCreated', async (payload) => {
	const taskId = payload.taskId;
	if (typeof taskId !== 'string') return { ok: false, reason: 'missing taskId' };
	await tasksStore.deleteTask(taskId);
	return { ok: true };
});

registerInverseOperation('TaskCompleted', async (payload) => {
	const taskId = payload.taskId;
	if (typeof taskId !== 'string') return { ok: false, reason: 'missing taskId' };
	// `toggleComplete` flips; the AI's action was "complete" so toggling
	// brings it back to incomplete.
	await tasksStore.toggleComplete(taskId);
	return { ok: true };
});

registerInverseOperation('CalendarEventCreated', async (payload) => {
	const eventId = payload.eventId;
	if (typeof eventId !== 'string') return { ok: false, reason: 'missing eventId' };
	await eventsStore.deleteEvent(eventId);
	return { ok: true };
});

registerInverseOperation('DrinkLogged', async (payload) => {
	const drinkId = payload.drinkId;
	if (typeof drinkId !== 'string') return { ok: false, reason: 'missing drinkId' };
	await drinkStore.deleteEntry(drinkId);
	return { ok: true };
});
