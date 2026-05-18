/**
 * Reminder Scheduler
 *
 * Central polling service that checks all registered reminder sources
 * and fires browser notifications for due reminders.
 *
 * @example
 * ```typescript
 * import { createReminderScheduler } from '@mana/shared-stores';
 * import { todoReminderSource } from '$lib/modules/todo/reminder-source';
 *
 * const scheduler = createReminderScheduler({
 *   sources: [todoReminderSource],
 * });
 *
 * // Start polling (typically in +layout.svelte onMount)
 * scheduler.start();
 *
 * // Stop on destroy
 * scheduler.stop();
 * ```
 */

import { notificationService } from './notifications';

export interface DueReminder {
	/** Unique reminder ID */
	id: string;
	/** Notification title */
	title: string;
	/** Notification body */
	body?: string;
	/** Tag for deduplication (same tag replaces previous) */
	tag: string;
}

export interface ReminderSource {
	/** Source identifier (e.g. 'todo', 'calendar') */
	id: string;
	/** Returns reminders that are currently due */
	checkDue: () => Promise<DueReminder[]>;
	/** Mark a reminder as sent (so it won't fire again) */
	markSent: (reminderId: string) => Promise<void>;
}

export interface ReminderSchedulerConfig {
	/** Check interval in ms (default: 30000 = 30s) */
	intervalMs?: number;
	/** Registered reminder sources */
	sources: ReminderSource[];
	/** Override notification service (for testing) */
	notifier?: {
		hasPermission(): boolean;
		send(title: string, options?: { body?: string; tag?: string }): void;
	};
}

export interface ReminderScheduler {
	/** Start the polling loop */
	start(): void;
	/** Stop the polling loop */
	stop(): void;
	/** Manually check all sources now */
	checkNow(): Promise<void>;
	/** Add a source at runtime */
	addSource(source: ReminderSource): void;
}

export function createReminderScheduler(config: ReminderSchedulerConfig): ReminderScheduler {
	const intervalMs = config.intervalMs ?? 30_000;
	const sources = [...config.sources];
	const notifier = config.notifier ?? notificationService;
	let timer: ReturnType<typeof setInterval> | null = null;

	async function check() {
		if (!notifier.hasPermission()) return;

		for (const source of sources) {
			try {
				const due = await source.checkDue();
				for (const reminder of due) {
					notifier.send(reminder.title, {
						body: reminder.body,
						tag: reminder.tag,
					});
					await source.markSent(reminder.id);
				}
			} catch (e) {
				console.error(`[ReminderScheduler] Error checking source "${source.id}":`, e);
			}
		}
	}

	return {
		start() {
			if (timer) return;
			// Initial check after short delay (let app settle)
			setTimeout(() => check(), 2000);
			timer = setInterval(check, intervalMs);
		},

		stop() {
			if (timer) {
				clearInterval(timer);
				timer = null;
			}
		},

		async checkNow() {
			await check();
		},

		addSource(source: ReminderSource) {
			sources.push(source);
		},
	};
}
