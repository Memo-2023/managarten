/**
 * Standalone Cards Dexie database.
 *
 * Phase-1 sync: every write to a sync-relevant table fires a Dexie hook
 * that records a row into `_pendingChanges`. The sync engine drains
 * that queue against `mana-sync` (POST /sync/cards). When server changes
 * come back, they're applied with `beginApplying(table)` set so the
 * hooks suppress queueing for those rows — otherwise client and server
 * would ping-pong forever.
 *
 * Encryption is intentionally NOT wired here. Phase-1 ships plaintext;
 * Etappe 3c.3 turns it on once the vault client is in place.
 */

import Dexie, { type Table } from 'dexie';
import type { LocalDeck, LocalCard, LocalCardReview, LocalCardStudyBlock } from '@mana/cards-core';

interface DeckTag {
	id: string;
	deckId: string;
	tagId: string;
	createdAt?: string;
	updatedAt?: string;
	deletedAt?: string | null;
}

/** Server protocol expects this shape on push. */
export interface FieldChange {
	value: unknown;
	at: string;
}

export type ChangeOp = 'insert' | 'update' | 'delete';

export interface PendingChange {
	/** Auto-increment PK (Dexie ++id). */
	pk?: number;
	table: string;
	id: string;
	op: ChangeOp;
	fields?: Record<string, FieldChange>;
	data?: Record<string, unknown>;
	deletedAt?: string;
	queuedAt: string;
}

/** Tables whose writes are mirrored to mana-sync. */
const SYNC_TABLES = ['cardDecks', 'cards', 'cardReviews', 'cardStudyBlocks', 'deckTags'] as const;

class CardsDatabase extends Dexie {
	cardDecks!: Table<LocalDeck, string>;
	cards!: Table<LocalCard, string>;
	cardReviews!: Table<LocalCardReview, string>;
	cardStudyBlocks!: Table<LocalCardStudyBlock, string>;
	deckTags!: Table<DeckTag, string>;
	_pendingChanges!: Table<PendingChange, number>;

	constructor() {
		super('cards');
		this.version(1).stores({
			cardDecks: 'id, lastStudied',
			cards: 'id, deckId, order, [deckId+order]',
			cardReviews: 'id, cardId, due, [cardId+subIndex], state',
			cardStudyBlocks: 'id, date',
			deckTags: 'id, deckId, tagId',
			_pendingChanges: '++pk, table, queuedAt',
		});
		// v2 — Phase δ.2: index `subscribedFromSlug` on cardDecks so the
		// subscribe service can lookup-by-slug to avoid duplicating
		// subscriptions on re-pull.
		this.version(2).stores({
			cardDecks: 'id, lastStudied, subscribedFromSlug',
		});
	}
}

export const db = new CardsDatabase();

export const cardDeckTable = db.cardDecks;
export const cardTable = db.cards;
export const cardReviewTable = db.cardReviews;
export const cardStudyBlockTable = db.cardStudyBlocks;
export const pendingChangesTable = db._pendingChanges;

// ─── Server-apply suppression ──────────────────────────────

const applying = new Set<string>();

/** Mark a table as "currently applying server changes" — hooks skip
 *  queueing for the duration. Caller must always pair with `endApplying`. */
export function beginApplying(tableName: string) {
	applying.add(tableName);
}
export function endApplying(tableName: string) {
	applying.delete(tableName);
}

// ─── Field-meta diff ───────────────────────────────────────

function diffToFields(
	previous: Record<string, unknown>,
	next: Record<string, unknown>
): Record<string, FieldChange> {
	const at = new Date().toISOString();
	const out: Record<string, FieldChange> = {};
	for (const key of Object.keys(next)) {
		if (key.startsWith('_') || key === 'updatedAt') continue;
		if (previous[key] === next[key]) continue;
		out[key] = { value: next[key], at };
	}
	return out;
}

function snapshotForInsert(row: Record<string, unknown>): Record<string, unknown> {
	const out: Record<string, unknown> = {};
	for (const key of Object.keys(row)) {
		if (key.startsWith('_')) continue;
		out[key] = row[key];
	}
	return out;
}

// ─── Hook installation ─────────────────────────────────────

function installSyncHooks(table: Table<any, any>, name: string) {
	table.hook('creating', (_pk, row) => {
		if (applying.has(name)) return;
		void db._pendingChanges.add({
			table: name,
			id: row.id,
			op: 'insert',
			data: snapshotForInsert(row),
			queuedAt: new Date().toISOString(),
		});
	});

	table.hook('updating', (mods, _pk, prev) => {
		if (applying.has(name)) return;
		const next = { ...prev, ...mods };
		const fields = diffToFields(prev, next);
		if (Object.keys(fields).length === 0 && !('deletedAt' in mods)) return;
		const isDelete = (mods as { deletedAt?: string }).deletedAt;
		void db._pendingChanges.add({
			table: name,
			id: prev.id,
			op: isDelete ? 'delete' : 'update',
			fields: Object.keys(fields).length > 0 ? fields : undefined,
			deletedAt: isDelete ?? undefined,
			queuedAt: new Date().toISOString(),
		});
	});
}

for (const name of SYNC_TABLES) {
	installSyncHooks(db.table(name), name);
}
