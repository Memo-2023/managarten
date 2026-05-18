/**
 * Streak Tracker tests — markActive logic, status computation.
 */

import 'fake-indexeddb/auto';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

vi.mock('$lib/stores/funnel-tracking', () => ({ trackFirstContent: vi.fn() }));
vi.mock('$lib/triggers/registry', () => ({ fire: vi.fn() }));
vi.mock('$lib/triggers/inline-suggest', () => ({
	checkInlineSuggestion: vi.fn().mockResolvedValue(null),
}));

import { db } from '../database';
import { eventBus } from '../events/event-bus';
import { USER_ACTOR } from '../events/actor';
import { startStreakTracker, stopStreakTracker, useStreaks } from './streaks';

const TABLE = '_streakState';
const flush = () => new Promise((r) => setTimeout(r, 50));

function todayStr(): string {
	return new Date().toISOString().split('T')[0];
}

beforeEach(async () => {
	await db.table(TABLE).clear();
});

afterEach(() => {
	stopStreakTracker();
});

describe('Streak Tracker', () => {
	it('seeds default streak states', async () => {
		// useStreaks triggers ensureSeeded internally
		// We can't easily call it outside Svelte, so test via DB directly
		// by checking after startStreakTracker + an event
		startStreakTracker();

		eventBus.emit({
			type: 'TaskCompleted',
			payload: { taskId: '1', title: 'Test', wasOverdue: false },
			meta: {
				id: '1',
				timestamp: new Date().toISOString(),
				appId: 'todo',
				collection: 'tasks',
				recordId: '1',
				userId: 'u1',
				actor: USER_ACTOR,
			},
		});
		await flush();

		const state = await db.table(TABLE).get('streak-tasks-completed');
		expect(state).toBeTruthy();
		expect(state.currentStreak).toBe(1);
		expect(state.lastActiveDate).toBe(todayStr());
	});

	it('does not double-count same day', async () => {
		startStreakTracker();

		// Two TaskCompleted events on the same day
		for (let i = 0; i < 3; i++) {
			eventBus.emit({
				type: 'TaskCompleted',
				payload: { taskId: `${i}`, title: 'Test', wasOverdue: false },
				meta: {
					id: `${i}`,
					timestamp: new Date().toISOString(),
					appId: 'todo',
					collection: 'tasks',
					recordId: `${i}`,
					userId: 'u1',
					actor: USER_ACTOR,
				},
			});
		}
		await flush();

		const state = await db.table(TABLE).get('streak-tasks-completed');
		expect(state.currentStreak).toBe(1); // Not 3
	});

	it('filters events correctly (water only for water streak)', async () => {
		startStreakTracker();

		// Coffee event — should not trigger water streak
		eventBus.emit({
			type: 'DrinkLogged',
			payload: { drinkType: 'coffee', quantityMl: 200, name: 'Coffee' },
			meta: {
				id: '1',
				timestamp: new Date().toISOString(),
				appId: 'drink',
				collection: 'drinkEntries',
				recordId: '1',
				userId: 'u1',
				actor: USER_ACTOR,
			},
		});
		await flush();

		const state = await db.table(TABLE).get('streak-water-goal');
		// Either null (not seeded yet because no water event) or currentStreak 0
		expect(state?.currentStreak ?? 0).toBe(0);
	});

	it('tracks water streak on water event', async () => {
		startStreakTracker();

		eventBus.emit({
			type: 'DrinkLogged',
			payload: { drinkType: 'water', quantityMl: 250, name: 'Wasser' },
			meta: {
				id: '1',
				timestamp: new Date().toISOString(),
				appId: 'drink',
				collection: 'drinkEntries',
				recordId: '1',
				userId: 'u1',
				actor: USER_ACTOR,
			},
		});
		await flush();

		const state = await db.table(TABLE).get('streak-water-goal');
		expect(state).toBeTruthy();
		expect(state.currentStreak).toBe(1);
	});

	it('tracks task streak on task completed event', async () => {
		startStreakTracker();

		eventBus.emit({
			type: 'TaskCompleted',
			payload: { taskId: '1', title: 'Test', wasOverdue: false },
			meta: {
				id: '1',
				timestamp: new Date().toISOString(),
				appId: 'todo',
				collection: 'tasks',
				recordId: '1',
				userId: 'u1',
				actor: USER_ACTOR,
			},
		});
		await flush();

		const tasks = await db.table(TABLE).get('streak-tasks-completed');
		expect(tasks?.currentStreak).toBe(1);
	});
});
