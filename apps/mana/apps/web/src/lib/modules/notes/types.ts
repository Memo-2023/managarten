/**
 * Notes module types.
 *
 * Lightweight markdown notes — flat structure, no folders.
 */

import type { BaseRecord } from '@mana/local-store';

// ─── Local Record Types (Dexie) ───────────────────────────

export interface LocalNote extends BaseRecord {
	title: string;
	content: string;
	color: string | null;
	/** STT backend/model identifier. Set when note created via voice. */
	transcriptModel?: string | null;
	isPinned: boolean;
	isArchived: boolean;
	/**
	 * Marks this note as the active Space's standing-context for AI Mission
	 * Runner auto-injection. Mutually exclusive within a Space — the store's
	 * markAsSpaceContext() unsets the flag on every other note in the same
	 * Space before setting it here, so the index can assume at most one
	 * `true` row per `spaceId`. Optional on the type because legacy rows
	 * predate the field; absent === false.
	 */
	isSpaceContext?: boolean;
}

// ─── Domain Types ─────────────────────────────────────────

export interface Note {
	id: string;
	title: string;
	content: string;
	color: string | null;
	transcriptModel: string | null;
	isPinned: boolean;
	isArchived: boolean;
	isSpaceContext: boolean;
	createdAt: string;
	updatedAt: string;
}

// ─── Constants ────────────────────────────────────────────

export const NOTE_COLORS: (string | null)[] = [
	null,
	'#ef4444',
	'#f97316',
	'#f59e0b',
	'#84cc16',
	'#22c55e',
	'#06b6d4',
	'#3b82f6',
	'#6366f1',
	'#8b5cf6',
	'#ec4899',
];
