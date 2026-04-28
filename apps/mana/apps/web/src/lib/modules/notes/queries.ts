import { formatDate } from '$lib/i18n/format';
import { deriveUpdatedAt } from '$lib/data/sync';
/**
 * Reactive Queries & Pure Helpers for Notes module.
 *
 * Phase 4 encryption pilot: notes are encrypted at rest. Reads decrypt
 * on the fly via decryptRecords() before mapping to the public Note
 * shape. Sort and filter operations all run against PLAINTEXT metadata
 * (`isPinned`, `isArchived`, `updatedAt`, `deletedAt`) so the indexes
 * still work without ever touching ciphertext.
 *
 * Search: keep the existing in-memory `searchNotes()` helper. It runs
 * AFTER decryption (against the public Note objects), so a free-text
 * search through ~hundreds of notes still works in the UI without
 * leaking anything to the server. Real searchable-encrypted index is
 * a future concern only if note volume per user grows past that.
 */

import { useScopedLiveQuery } from '$lib/data/scope/use-scoped-live-query.svelte';
import { db } from '$lib/data/database';
import { scopedForModule, scopedGet, applyVisibility } from '$lib/data/scope';
import { decryptRecords } from '$lib/data/crypto';
import { filterBySceneScopeBatch } from '$lib/stores/scene-scope.svelte';
import { noteTagOps } from './stores/tags.svelte';
import type { LocalNote, Note } from './types';

// ─── Type Converters ───────────────────────────────────────

export function toNote(local: LocalNote): Note {
	return {
		id: local.id,
		title: local.title,
		content: local.content,
		color: local.color,
		transcriptModel: local.transcriptModel ?? null,
		isPinned: local.isPinned,
		isArchived: local.isArchived,
		isSpaceContext: local.isSpaceContext ?? false,
		createdAt: local.createdAt ?? new Date().toISOString(),
		updatedAt: deriveUpdatedAt(local),
	};
}

// ─── Live Queries ──────────────────────────────────────────

export function useAllNotes() {
	return useScopedLiveQuery(async () => {
		// Filter on plaintext metadata first — none of these fields are
		// in the encryption registry, so they stay readable even with
		// the vault locked. Cuts the decrypt workload to only what the
		// view actually renders. Scope + visibility filters run before
		// decrypt for the same reason.
		const raw = await scopedForModule<LocalNote, string>('notes', 'notes').toArray();
		const visible = applyVisibility(raw).filter((n) => !n.deletedAt && !n.isArchived);
		// Locked vault returns the blobs untouched so the UI can render
		// a "🔒" placeholder where title/content would be.
		const decrypted = await decryptRecords('notes', visible);
		const tagMap = await noteTagOps.getTagIdsForMany(decrypted.map((n) => n.id));
		const scoped = filterBySceneScopeBatch(decrypted, (n) => n.id, tagMap);
		return scoped.map(toNote).sort((a, b) => {
			if (a.isPinned !== b.isPinned) return a.isPinned ? -1 : 1;
			return b.updatedAt.localeCompare(a.updatedAt);
		});
	}, [] as Note[]);
}

/**
 * The single note marked `isSpaceContext: true` in the active Space, or
 * null if no note holds that flag yet. Used by the AI Mission Runner to
 * auto-inject "what's this Space about" into every planner call. The
 * store guarantees mutex (max 1 per Space), so `find` is enough.
 */
export function useSpaceContextNote() {
	return useScopedLiveQuery(
		async () => {
			const raw = await scopedForModule<LocalNote, string>('notes', 'notes').toArray();
			const match = raw.find((n) => !n.deletedAt && n.isSpaceContext === true);
			if (!match) return null;
			const [decrypted] = await decryptRecords('notes', [match]);
			return decrypted ? toNote(decrypted) : null;
		},
		null as Note | null
	);
}

/** Single note by id, decrypted. Used by detail views. */
export function useNote(id: string) {
	return useScopedLiveQuery(
		async () => {
			// scopedGet returns undefined if the note belongs to another
			// space — protects against URL-manipulated deep links.
			const local = await scopedGet<LocalNote>('notes', id);
			if (!local || local.deletedAt) return null;
			const [decrypted] = await decryptRecords('notes', [local]);
			return decrypted ? toNote(decrypted) : null;
		},
		null as Note | null
	);
}

// ─── Pure Helpers ──────────────────────────────────────────

/** Search notes by title and content */
export function searchNotes(notes: Note[], query: string): Note[] {
	if (!query.trim()) return notes;
	const q = query.toLowerCase();
	return notes.filter(
		(n) => n.title.toLowerCase().includes(q) || n.content.toLowerCase().includes(q)
	);
}

/** Get content preview (first line or truncated) */
export function getPreview(content: string, maxLen = 80): string {
	const firstLine = content.split('\n').find((l) => l.trim()) ?? '';
	const clean = firstLine.replace(/[#*_~`>\-]/g, '').trim();
	return clean.length > maxLen ? clean.slice(0, maxLen) + '...' : clean;
}

/** Format relative time */
export function formatRelativeTime(iso: string): string {
	const diff = Date.now() - new Date(iso).getTime();
	const mins = Math.floor(diff / 60000);
	if (mins < 1) return 'gerade eben';
	if (mins < 60) return `vor ${mins}m`;
	const hours = Math.floor(mins / 60);
	if (hours < 24) return `vor ${hours}h`;
	const days = Math.floor(hours / 24);
	if (days < 7) return `vor ${days}d`;
	return formatDate(new Date(iso), { day: 'numeric', month: 'short' });
}
