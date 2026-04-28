/**
 * Cross-App Reactive Queries
 *
 * Live queries on the unified IndexedDB. Auto-update when data changes
 * (local writes, sync, other tabs) via Dexie's liveQuery.
 */

import { useLiveQueryWithDefault } from '@mana/local-store/svelte';
import { db } from './database';
import { decryptRecords } from './crypto';

import type { LocalTask } from '$lib/modules/todo/types';
import type { LocalTimeBlock } from '$lib/data/time-blocks/types';
import type { LocalContact } from '$lib/modules/contacts/types';
import type { LocalConversation } from '$lib/modules/chat/types';
import type { LocalFavorite } from '$lib/modules/quotes/types';
import type { LocalImage } from '$lib/modules/picture/types';
import type { LocalAlarm, LocalCountdownTimer } from '$lib/modules/times/types';
import type { LocalFile } from '$lib/modules/storage/types';
import type { LocalSong, LocalPlaylist } from '$lib/modules/music/types';
import type { LocalDeck as LocalPresiDeck } from '$lib/modules/presi/types';
import type { LocalDeck as LocalCardDeck, LocalCard } from '$lib/modules/cards/types';

// ─── Todo Queries ───────────────────────────────────────────

/** All open (incomplete) tasks, sorted by order. */
export function useOpenTasks() {
	return useLiveQueryWithDefault(async () => {
		const all = await db.table<LocalTask>('tasks').orderBy('order').toArray();
		const visible = all.filter((t) => !t.isCompleted && !t.deletedAt);
		return decryptRecords('tasks', visible);
	}, [] as LocalTask[]);
}

/** Tasks due today or overdue. */
export function useTodayTasks() {
	return useLiveQueryWithDefault(async () => {
		// End of today in ISO; the schema indexes `dueDate` so this is a
		// bounded range scan instead of a full table read.
		const endOfToday = new Date();
		endOfToday.setHours(23, 59, 59, 999);

		const candidates = await db
			.table<LocalTask>('tasks')
			.where('dueDate')
			.belowOrEqual(endOfToday.toISOString())
			.toArray();
		const visible = candidates.filter((t) => !t.isCompleted && !t.deletedAt);
		return decryptRecords('tasks', visible);
	}, [] as LocalTask[]);
}

/** Tasks upcoming in the next N days. */
export function useUpcomingTasks(days = 7) {
	return useLiveQueryWithDefault(async () => {
		const startOfTomorrow = new Date();
		startOfTomorrow.setHours(0, 0, 0, 0);
		startOfTomorrow.setDate(startOfTomorrow.getDate() + 1);

		const endOfWindow = new Date(startOfTomorrow);
		endOfWindow.setDate(endOfWindow.getDate() + days - 1);
		endOfWindow.setHours(23, 59, 59, 999);

		// Bounded range scan on the indexed dueDate column instead of loading
		// every task in the database and filtering in JS.
		const candidates = await db
			.table<LocalTask>('tasks')
			.where('dueDate')
			.between(startOfTomorrow.toISOString(), endOfWindow.toISOString(), true, true)
			.toArray();
		const visible = candidates.filter((t) => !t.isCompleted && !t.deletedAt);
		return decryptRecords('tasks', visible);
	}, [] as LocalTask[]);
}

// ─── Calendar Queries ───────────────────────────────────────

/** TimeBlocks (all types) in the next N days. */
export function useUpcomingEvents(days = 7) {
	return useLiveQueryWithDefault(async () => {
		const now = new Date();
		const future = new Date(now);
		future.setDate(future.getDate() + days);

		// `startDate` is indexed → bounded range scan covers exactly the
		// requested window. Previously this loaded every TimeBlock ever
		// (including past meetings) and filtered them in JS.
		const candidates = await db
			.table<LocalTimeBlock>('timeBlocks')
			.where('startDate')
			.between(now.toISOString(), future.toISOString(), true, true)
			.toArray();
		const visible = candidates.filter((b) => !b.deletedAt);
		return decryptRecords('timeBlocks', visible);
	}, [] as LocalTimeBlock[]);
}

// ─── Contacts Queries ───────────────────────────────────────

/** Favorite contacts. */
export function useFavoriteContacts(limit = 5) {
	return useLiveQueryWithDefault(async () => {
		// Dexie indexes booleans as `true`/`false` keys — `.where().equals(true)`
		// hits the index instead of scanning every contact in the address book.
		const favorites = (
			await db
				.table<LocalContact>('contacts')
				.where('isFavorite')
				.equals(1)
				.or('isFavorite')
				.equals(true as unknown as string)
				.toArray()
		).filter((c) => !c.isArchived && !c.deletedAt);
		// Decrypt firstName/lastName before sorting — they're encrypted
		// in Phase 5 and the sort needs the plaintext to compare.
		const { decryptRecords } = await import('./crypto');
		const decrypted = await decryptRecords('contacts', favorites);
		return decrypted
			.sort((a, b) => (a.firstName ?? '').localeCompare(b.firstName ?? ''))
			.slice(0, limit);
	}, [] as LocalContact[]);
}

// ─── Chat Queries ───────────────────────────────────────────

/** Recent conversations, sorted by updatedAt desc. */
export function useRecentConversations(limit = 5) {
	return useLiveQueryWithDefault(async () => {
		// Walk the indexed updatedAt BTree in reverse, filtering archived /
		// soft-deleted entries on the fly. Dexie's `.limit()` short-circuits
		// the iterator as soon as that many matches accumulate, so the cost
		// is O(limit + filtered) instead of the O(table) toArray+sort the
		// query used to do.
		return db
			.table<LocalConversation>('conversations')
			.orderBy('updatedAt')
			.reverse()
			.filter((c) => !c.isArchived && !c.deletedAt)
			.limit(limit)
			.toArray();
	}, [] as LocalConversation[]);
}

// ─── Quotes Queries ─────────────────────────────────────────

/** A random favorite quote. */
export function useRandomFavorite() {
	return useLiveQueryWithDefault(
		async () => {
			const all = await db.table<LocalFavorite>('quotesFavorites').toArray();
			const active = all.filter((f) => !f.deletedAt);
			if (active.length === 0) return null;
			return active[Math.floor(Math.random() * active.length)];
		},
		null as LocalFavorite | null
	);
}

// ─── Picture Queries ────────────────────────────────────────

/** Recent generated images. */
export function useRecentImages(limit = 6) {
	return useLiveQueryWithDefault(async () => {
		// Reverse-walk the indexed updatedAt column. Generated images have
		// updatedAt stamped on creation and rarely move afterwards, so this
		// is effectively "newest first" for the dashboard widget's purpose.
		const recent = await db
			.table<LocalImage>('images')
			.orderBy('updatedAt')
			.reverse()
			.filter((i) => !i.isArchived && !i.deletedAt)
			.limit(limit)
			.toArray();
		// prompt is encrypted on disk; the dashboard widget renders it as
		// the alt text + caption, so decrypt the small slice we return.
		return decryptRecords('images', recent);
	}, [] as LocalImage[]);
}

// ─── Clock Queries ──────────────────────────────────────────

/** Enabled alarms. */
export function useEnabledAlarms() {
	return useLiveQueryWithDefault(async () => {
		const all = await db.table<LocalAlarm>('alarms').toArray();
		return all.filter((a) => a.enabled && !a.deletedAt);
	}, [] as LocalAlarm[]);
}

/** Active/running timers. */
export function useActiveTimers() {
	return useLiveQueryWithDefault(async () => {
		const all = await db.table<LocalCountdownTimer>('timers').toArray();
		return all.filter((t) => (t.status === 'running' || t.status === 'paused') && !t.deletedAt);
	}, [] as LocalCountdownTimer[]);
}

// ─── Storage Queries ────────────────────────────────────────

interface StorageStats {
	totalFiles: number;
	totalSize: number;
	recentFiles: LocalFile[];
}

/** Storage stats: total files and total size. */
export function useStorageStats() {
	return useLiveQueryWithDefault(
		async (): Promise<StorageStats> => {
			const files = await db.table<LocalFile>('files').toArray();
			const active = files.filter((f) => !f.isDeleted && !f.deletedAt);
			const totalSize = active.reduce((sum, f) => sum + (f.size || 0), 0);
			// The recent-files widget renders the file name, so decrypt
			// the small slice we return (not the whole table — totalSize
			// only needs the plaintext .size column).
			const recentRaw = active
				.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
				.slice(0, 5);
			const recent = await decryptRecords('files', recentRaw);
			return { totalFiles: active.length, totalSize, recentFiles: recent };
		},
		{ totalFiles: 0, totalSize: 0, recentFiles: [] as LocalFile[] }
	);
}

// ─── Music Queries ──────────────────────────────────────────

interface MusicStats {
	totalSongs: number;
	totalPlaylists: number;
	favoriteCount: number;
	recentSongs: LocalSong[];
}

/** Music library stats + recent songs. */
export function useMusicStats() {
	return useLiveQueryWithDefault(
		async (): Promise<MusicStats> => {
			const songs = await db.table<LocalSong>('songs').toArray();
			const playlists = await db.table<LocalPlaylist>('mukkePlaylists').toArray();
			const activeSongs = songs.filter((s) => !s.deletedAt);
			const activePlaylists = playlists.filter((p) => !p.deletedAt);
			// title is encrypted on disk; the dashboard widget renders it
			// for the recent-songs list, so decrypt the small slice we
			// surface (counts only need plaintext flags).
			const recentRaw = activeSongs
				.sort((a, b) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''))
				.slice(0, 5);
			const recent = await decryptRecords('songs', recentRaw);
			return {
				totalSongs: activeSongs.length,
				totalPlaylists: activePlaylists.length,
				favoriteCount: activeSongs.filter((s) => s.favorite).length,
				recentSongs: recent,
			};
		},
		{ totalSongs: 0, totalPlaylists: 0, favoriteCount: 0, recentSongs: [] as LocalSong[] }
	);
}

// ─── Presi Queries ──────────────────────────────────────────

/** Recent presentation decks. */
export function useRecentDecks(limit = 5) {
	return useLiveQueryWithDefault(async () => {
		const visible = await db
			.table<LocalPresiDeck>('presiDecks')
			.orderBy('updatedAt')
			.reverse()
			.filter((d) => !d.deletedAt)
			.limit(limit)
			.toArray();
		// Phase 6: presiDecks title/description encrypted — decrypt for the
		// dashboard widget so the user sees the deck name, not a blob.
		const { decryptRecords } = await import('./crypto');
		return decryptRecords('presiDecks', visible);
	}, [] as LocalPresiDeck[]);
}

// ─── Cards Queries ─────────────────────────────────────────

interface CardsProgress {
	totalDecks: number;
	totalCards: number;
	cardsLearned: number;
	dueForReview: number;
	decks: LocalCardDeck[];
}

/** Cards learning progress. */
export function useCardsProgress() {
	return useLiveQueryWithDefault(
		async (): Promise<CardsProgress> => {
			const decks = await db.table<LocalCardDeck>('cardDecks').toArray();
			const cards = await db.table<LocalCard>('cards').toArray();
			const activeDecks = decks.filter((d) => !d.deletedAt);
			const activeCards = cards.filter((c) => !c.deletedAt);
			const now = new Date().toISOString();
			const dueCards = activeCards.filter((c) => c.nextReview && c.nextReview <= now);
			// Phase 6: cardDecks.name is encrypted — the widget renders the
			// deck names so they need decryption. Counts work plaintext.
			const { decryptRecords } = await import('./crypto');
			const decryptedDecks = await decryptRecords('cardDecks', activeDecks);
			return {
				totalDecks: activeDecks.length,
				totalCards: activeCards.length,
				cardsLearned: activeCards.filter((c) => (c.reviewCount ?? 0) > 0).length,
				dueForReview: dueCards.length,
				decks: decryptedDecks,
			};
		},
		{
			totalDecks: 0,
			totalCards: 0,
			cardsLearned: 0,
			dueForReview: 0,
			decks: [] as LocalCardDeck[],
		}
	);
}
