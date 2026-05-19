/**
 * Cross-App Activity Collector
 *
 * Reads from the unified IndexedDB and produces
 * AppSnapshot objects for the Mana Spiral.
 */

import { MANA_APP_INDEX } from '@mana/spiral-db';
import { db } from '$lib/data/database';
import type { AppSnapshot } from './stores/mana-spiral.svelte';

/**
 * Safe wrapper for db.table().toArray() — returns empty array on error.
 */
async function safeGetAll(tableName: string): Promise<any[]> {
	try {
		return await db.table(tableName).toArray();
	} catch {
		return [];
	}
}

/**
 * Collect snapshots from all app tables in the unified DB.
 * Each table is read once and summarized into an AppSnapshot.
 */
export async function collectAppSnapshots(): Promise<AppSnapshot[]> {
	const snapshots: AppSnapshot[] = [];

	// Run all reads in parallel
	const [tasks, events, contacts, conversations, images, alarms, files, decks] = await Promise.all([
		safeGetAll('tasks'),
		safeGetAll('events'),
		safeGetAll('contacts'),
		safeGetAll('conversations'),
		safeGetAll('images'),
		safeGetAll('alarms'),
		safeGetAll('files'),
		safeGetAll('presiDecks'),
	]);

	// Todo
	if (tasks.length > 0) {
		const completed = tasks.filter((t: any) => t.isCompleted).length;
		snapshots.push({
			app: 'Todo',
			appIndex: MANA_APP_INDEX.todo,
			totalItems: tasks.length,
			completedItems: completed,
			favoriteItems: 0,
			label: `${tasks.length} Tasks (${completed} erledigt)`,
		});
	}

	// Calendar
	if (events.length > 0) {
		snapshots.push({
			app: 'Calendar',
			appIndex: MANA_APP_INDEX.calendar,
			totalItems: events.length,
			completedItems: 0,
			favoriteItems: 0,
			label: `${events.length} Events`,
		});
	}

	// Contacts
	if (contacts.length > 0) {
		const favs = contacts.filter((c: any) => c.isFavorite).length;
		snapshots.push({
			app: 'Contacts',
			appIndex: MANA_APP_INDEX.contacts,
			totalItems: contacts.length,
			completedItems: 0,
			favoriteItems: favs,
			label: `${contacts.length} Kontakte`,
		});
	}

	// Chat
	if (conversations.length > 0) {
		snapshots.push({
			app: 'Chat',
			appIndex: MANA_APP_INDEX.chat,
			totalItems: conversations.length,
			completedItems: 0,
			favoriteItems: 0,
			label: `${conversations.length} Gespräche`,
		});
	}

	// Picture
	if (images.length > 0) {
		const favs = images.filter((i: any) => i.isFavorite).length;
		snapshots.push({
			app: 'Picture',
			appIndex: MANA_APP_INDEX.picture,
			totalItems: images.length,
			completedItems: 0,
			favoriteItems: favs,
			label: `${images.length} Bilder`,
		});
	}

	// Clock
	if (alarms.length > 0) {
		snapshots.push({
			app: 'Clock',
			appIndex: MANA_APP_INDEX.clock,
			totalItems: alarms.length,
			completedItems: 0,
			favoriteItems: 0,
			label: `${alarms.length} Alarme`,
		});
	}

	// Storage
	if (files.length > 0) {
		snapshots.push({
			app: 'Storage',
			appIndex: MANA_APP_INDEX.storage,
			totalItems: files.length,
			completedItems: 0,
			favoriteItems: 0,
			label: `${files.length} Dateien`,
		});
	}

	// Presi
	if (decks.length > 0) {
		snapshots.push({
			app: 'Presi',
			appIndex: MANA_APP_INDEX.presi,
			totalItems: decks.length,
			completedItems: 0,
			favoriteItems: 0,
			label: `${decks.length} Präsentationen`,
		});
	}

	return snapshots;
}
