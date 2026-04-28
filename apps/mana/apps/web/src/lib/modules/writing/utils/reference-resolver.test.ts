/**
 * Tests for the writing reference-resolver.
 *
 * The pure helpers (truncation cap + aggregate budget enforcement) are
 * directly testable. The per-kind resolvers depend on Dexie + decryption
 * + module type-converters; we mock those so the tests exercise the
 * shaping logic without needing a real IndexedDB.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock dependencies before importing the resolver ──────────────────

vi.mock('$lib/data/scope', () => ({
	scopedGet: vi.fn(),
	scopedForModule: vi.fn(),
}));

vi.mock('$lib/data/crypto', () => ({
	decryptRecords: vi.fn(),
}));

vi.mock('$lib/data/database', () => ({
	db: {
		table: vi.fn(),
	},
}));

vi.mock('$lib/modules/articles/queries', () => ({
	toArticle: vi.fn((local) => ({ ...local })),
}));
vi.mock('$lib/modules/notes/queries', () => ({
	toNote: vi.fn((local) => ({ ...local })),
}));
vi.mock('$lib/modules/library/queries', () => ({
	toLibraryEntry: vi.fn((local) => ({
		creators: [],
		year: null,
		rating: null,
		review: null,
		...local,
	})),
}));
import { scopedGet, scopedForModule } from '$lib/data/scope';
import { decryptRecords } from '$lib/data/crypto';
import { db } from '$lib/data/database';
import {
	resolveReference,
	resolveReferences,
	MAX_TOTAL_REFERENCE_CHARS,
} from './reference-resolver';
import type { DraftReference } from '../types';

const mockScopedGet = scopedGet as ReturnType<typeof vi.fn>;
const mockScopedForModule = scopedForModule as ReturnType<typeof vi.fn>;
const mockDecryptRecords = decryptRecords as ReturnType<typeof vi.fn>;
const mockDbTable = db.table as ReturnType<typeof vi.fn>;

beforeEach(() => {
	vi.clearAllMocks();
});

// ── Per-kind resolver tests ──────────────────────────────────────────

describe('resolveReference - article', () => {
	it('returns sourceLabel + truncated content from a valid article', async () => {
		mockScopedGet.mockResolvedValue({
			id: 'a1',
			title: 'Headline',
			content: 'Body of the article.',
			siteName: 'NYT',
		});
		mockDecryptRecords.mockResolvedValue([
			{ id: 'a1', title: 'Headline', content: 'Body of the article.', siteName: 'NYT' },
		]);

		const ref: DraftReference = { kind: 'article', targetId: 'a1', note: null };
		const result = await resolveReference(ref);
		expect(result).not.toBeNull();
		expect(result?.kind).toBe('article');
		expect(result?.sourceLabel).toBe('Artikel: NYT — Headline');
		expect(result?.content).toBe('Body of the article.');
	});

	it('returns null when the article is deleted', async () => {
		mockScopedGet.mockResolvedValue({ id: 'a1', deletedAt: '2026-01-01T00:00:00Z' });
		const result = await resolveReference({ kind: 'article', targetId: 'a1', note: null });
		expect(result).toBeNull();
	});

	it('returns null when targetId is missing', async () => {
		const result = await resolveReference({ kind: 'article', note: null });
		expect(result).toBeNull();
	});

	it('returns null when scopedGet returns undefined', async () => {
		mockScopedGet.mockResolvedValue(undefined);
		const result = await resolveReference({ kind: 'article', targetId: 'a1', note: null });
		expect(result).toBeNull();
	});

	it('truncates content over the per-ref char cap', async () => {
		const longBody = 'x'.repeat(2000);
		mockScopedGet.mockResolvedValue({ id: 'a1', title: 'Long', content: longBody });
		mockDecryptRecords.mockResolvedValue([
			{ id: 'a1', title: 'Long', content: longBody, siteName: null },
		]);

		const result = await resolveReference({ kind: 'article', targetId: 'a1', note: null });
		expect(result?.content.length).toBeLessThan(2000);
		expect(result?.content).toContain('[… gekürzt …]');
	});

	it('falls back to excerpt when content is empty', async () => {
		mockScopedGet.mockResolvedValue({
			id: 'a1',
			title: 'X',
			content: '',
			excerpt: 'Just a teaser.',
		});
		mockDecryptRecords.mockResolvedValue([
			{ id: 'a1', title: 'X', content: '', excerpt: 'Just a teaser.', siteName: null },
		]);
		const result = await resolveReference({ kind: 'article', targetId: 'a1', note: null });
		expect(result?.content).toBe('Just a teaser.');
	});

	it('omits the siteName prefix when missing', async () => {
		mockScopedGet.mockResolvedValue({ id: 'a1', title: 'X', content: 'body' });
		mockDecryptRecords.mockResolvedValue([
			{ id: 'a1', title: 'X', content: 'body', siteName: null },
		]);
		const result = await resolveReference({ kind: 'article', targetId: 'a1', note: null });
		expect(result?.sourceLabel).toBe('Artikel: X');
	});

	it('preserves the user note', async () => {
		mockScopedGet.mockResolvedValue({ id: 'a1', title: 'X', content: 'body' });
		mockDecryptRecords.mockResolvedValue([
			{ id: 'a1', title: 'X', content: 'body', siteName: null },
		]);
		const result = await resolveReference({
			kind: 'article',
			targetId: 'a1',
			note: 'wichtig fürs Argument',
		});
		expect(result?.note).toBe('wichtig fürs Argument');
	});
});

describe('resolveReference - note', () => {
	it('returns title + content for a valid note', async () => {
		mockScopedGet.mockResolvedValue({ id: 'n1', title: 'My Note', content: 'note body' });
		mockDecryptRecords.mockResolvedValue([{ id: 'n1', title: 'My Note', content: 'note body' }]);
		const result = await resolveReference({ kind: 'note', targetId: 'n1', note: null });
		expect(result?.sourceLabel).toBe('Notiz: My Note');
		expect(result?.content).toBe('note body');
	});

	it('handles untitled notes', async () => {
		mockScopedGet.mockResolvedValue({ id: 'n1', title: '', content: 'body' });
		mockDecryptRecords.mockResolvedValue([{ id: 'n1', title: '', content: 'body' }]);
		const result = await resolveReference({ kind: 'note', targetId: 'n1', note: null });
		expect(result?.sourceLabel).toBe('Notiz: Ohne Titel');
	});
});

describe('resolveReference - library', () => {
	it('shapes a book entry with creators + year + rating into the label', async () => {
		mockScopedGet.mockResolvedValue({
			id: 'l1',
			kind: 'book',
			title: 'Dune',
			creators: ['Frank Herbert'],
			year: 1965,
			rating: 5,
			review: 'Lebensbuch.',
		});
		mockDecryptRecords.mockResolvedValue([
			{
				id: 'l1',
				kind: 'book',
				title: 'Dune',
				creators: ['Frank Herbert'],
				year: 1965,
				rating: 5,
				review: 'Lebensbuch.',
			},
		]);
		const result = await resolveReference({ kind: 'library', targetId: 'l1', note: null });
		expect(result?.sourceLabel).toBe('Buch: Dune (von Frank Herbert, 1965, Rating: 5/5)');
		expect(result?.content).toContain('Lebensbuch');
	});

	it('uses the empty body when there is no review', async () => {
		mockScopedGet.mockResolvedValue({
			id: 'l1',
			kind: 'movie',
			title: 'Arrival',
			creators: [],
			year: null,
			rating: null,
			review: null,
		});
		mockDecryptRecords.mockResolvedValue([
			{
				id: 'l1',
				kind: 'movie',
				title: 'Arrival',
				creators: [],
				year: null,
				rating: null,
				review: null,
			},
		]);
		const result = await resolveReference({ kind: 'library', targetId: 'l1', note: null });
		expect(result?.sourceLabel).toBe('Film: Arrival');
		expect(result?.content).toBe('');
	});
});

describe('resolveReference - url', () => {
	it('returns the url as label without fetching', async () => {
		const result = await resolveReference({
			kind: 'url',
			url: 'https://example.com/post',
			note: 'sehr gutes argument',
		});
		expect(result?.kind).toBe('url');
		expect(result?.sourceLabel).toBe('Link: https://example.com/post');
		expect(result?.content).toBe('');
		expect(result?.note).toBe('sehr gutes argument');
	});

	it('returns null when url is missing', async () => {
		const result = await resolveReference({ kind: 'url', note: null });
		expect(result).toBeNull();
	});
});

describe('resolveReference - kontext (Space-Kontext Note)', () => {
	it('reads the isSpaceContext-flagged Note via scopedForModule and ignores the targetId', async () => {
		const toArrayMock = vi.fn().mockResolvedValue([
			{ id: 'note-1', title: 'Random', content: 'no flag', isSpaceContext: false },
			{
				id: 'note-2',
				title: 'Brand-Profil',
				content: 'mein laufender kontext',
				isSpaceContext: true,
			},
		]);
		mockScopedForModule.mockReturnValue({ toArray: toArrayMock });
		mockDecryptRecords.mockResolvedValue([
			{
				id: 'note-2',
				title: 'Brand-Profil',
				content: 'mein laufender kontext',
				isSpaceContext: true,
			},
		]);

		const result = await resolveReference({
			kind: 'kontext',
			targetId: 'irrelevant',
			note: null,
		});
		expect(result?.sourceLabel).toBe('Space-Kontext (Notiz)');
		expect(result?.title).toBe('Brand-Profil');
		expect(result?.content).toBe('mein laufender kontext');
	});

	it('returns null when no Note is flagged as Space-Kontext', async () => {
		const toArrayMock = vi
			.fn()
			.mockResolvedValue([{ id: 'note-1', title: 'Random', content: 'no flag' }]);
		mockScopedForModule.mockReturnValue({ toArray: toArrayMock });
		const result = await resolveReference({ kind: 'kontext', targetId: 'x', note: null });
		expect(result).toBeNull();
	});

	it('skips deleted Space-Kontext Notes', async () => {
		const toArrayMock = vi.fn().mockResolvedValue([
			{
				id: 'note-1',
				title: 'old context',
				content: 'old',
				isSpaceContext: true,
				deletedAt: '2026-01-01T00:00:00Z',
			},
		]);
		mockScopedForModule.mockReturnValue({ toArray: toArrayMock });
		const result = await resolveReference({ kind: 'kontext', targetId: 'x', note: null });
		expect(result).toBeNull();
	});
});

describe('resolveReference - goal (plaintext)', () => {
	it('returns title + status + progress without decryption', async () => {
		mockDbTable.mockReturnValue({
			get: vi.fn().mockResolvedValue({
				id: 'g1',
				title: '20 Bücher 2026',
				description: 'Lesen ist Leben',
				status: 'active',
				currentValue: 7,
				target: { value: 20, period: 'year', comparison: 'gte' },
			}),
		});
		const result = await resolveReference({ kind: 'goal', targetId: 'g1', note: null });
		expect(result?.sourceLabel).toBe('Ziel: 20 Bücher 2026');
		expect(result?.content).toContain('Lesen ist Leben');
		expect(result?.content).toContain('Status: active');
		expect(result?.content).toContain('Ziel: 20');
		// Verify decryptRecords was NOT called for goals.
		expect(mockDecryptRecords).not.toHaveBeenCalled();
	});

	it('returns null when goal is deleted', async () => {
		mockDbTable.mockReturnValue({
			get: vi.fn().mockResolvedValue({
				id: 'g1',
				title: 'X',
				deletedAt: '2026-01-01T00:00:00Z',
			}),
		});
		const result = await resolveReference({ kind: 'goal', targetId: 'g1', note: null });
		expect(result).toBeNull();
	});
});

describe('resolveReference - me-image', () => {
	it('builds a textual descriptor from kind + label + tags', async () => {
		mockScopedGet.mockResolvedValue({
			id: 'm1',
			kind: 'face',
			label: 'Portrait Juni',
			tags: ['ohne-brille', 'studio'],
		});
		mockDecryptRecords.mockResolvedValue([
			{
				id: 'm1',
				kind: 'face',
				label: 'Portrait Juni',
				tags: ['ohne-brille', 'studio'],
			},
		]);
		const result = await resolveReference({ kind: 'me-image', targetId: 'm1', note: null });
		expect(result?.sourceLabel).toBe('Bild (face): Portrait Juni');
		expect(result?.content).toBe('Portrait Juni — ohne-brille, studio');
	});

	it('falls back to "<kind>-Referenzbild" when no label/tags', async () => {
		mockScopedGet.mockResolvedValue({ id: 'm1', kind: 'fullbody', label: null, tags: [] });
		mockDecryptRecords.mockResolvedValue([{ id: 'm1', kind: 'fullbody', label: null, tags: [] }]);
		const result = await resolveReference({ kind: 'me-image', targetId: 'm1', note: null });
		expect(result?.content).toBe('fullbody-Referenzbild');
	});
});

describe('resolveReference - unsupported kinds', () => {
	it('returns null for unknown kinds', async () => {
		// `goal` is supported; `wishes` is not — but our type system doesn't
		// allow arbitrary strings, so simulate via cast.
		const result = await resolveReference({
			// @ts-expect-error testing fallback path
			kind: 'unsupported',
			targetId: 'x',
			note: null,
		});
		expect(result).toBeNull();
	});
});

// ── Aggregate budget tests ──────────────────────────────────────────

describe('resolveReferences', () => {
	it('drops nulls (unresolvable refs) silently', async () => {
		mockScopedGet.mockImplementation(async (_table: string, id: string) => {
			if (id === 'a1') return { id: 'a1', title: 'X', content: 'body' };
			return undefined;
		});
		mockDecryptRecords.mockImplementation(async (_t: string, rows: unknown[]) => rows);

		const refs: DraftReference[] = [
			{ kind: 'article', targetId: 'a1', note: null },
			{ kind: 'article', targetId: 'missing', note: null },
		];
		const out = await resolveReferences(refs);
		expect(out).toHaveLength(1);
		expect(out[0].title).toBe('X');
	});

	it('keeps everything below the aggregate cap', async () => {
		mockScopedGet.mockResolvedValue({ id: 'a', title: 'short', content: 'small' });
		mockDecryptRecords.mockImplementation(async (_t: string, rows: unknown[]) => rows);

		const refs: DraftReference[] = [
			{ kind: 'article', targetId: 'a1', note: null },
			{ kind: 'article', targetId: 'a2', note: null },
			{ kind: 'article', targetId: 'a3', note: null },
		];
		const out = await resolveReferences(refs);
		expect(out).toHaveLength(3);
	});

	it('stops adding extras once aggregate cap is exceeded', async () => {
		// Each ref is ~1500 chars (truncated) — 6 of those is 9000+, over the
		// 8000-char total cap.
		const big = 'x'.repeat(2000);
		mockScopedGet.mockResolvedValue({ id: 'a', title: 'big', content: big });
		mockDecryptRecords.mockImplementation(async (_t: string, rows: unknown[]) => rows);

		const refs: DraftReference[] = Array.from({ length: 8 }, (_, i) => ({
			kind: 'article' as const,
			targetId: `a${i}`,
			note: null,
		}));
		const out = await resolveReferences(refs);
		expect(out.length).toBeLessThan(8);
		const totalChars = out.reduce(
			(sum, r) => sum + r.sourceLabel.length + r.content.length + (r.note?.length ?? 0),
			0
		);
		// The last accepted ref pushed the total over the cap; everything after
		// is dropped. The first ref always passes regardless.
		expect(totalChars).toBeGreaterThan(0);
		expect(out.length).toBeGreaterThanOrEqual(1);
	});

	it('always keeps at least the first ref even if it alone exceeds the cap', async () => {
		// A single 10000-char article — beyond the aggregate cap — should
		// still be kept as the first one (otherwise the user gets nothing
		// when they attached one large reference).
		const huge = 'x'.repeat(MAX_TOTAL_REFERENCE_CHARS + 5000);
		mockScopedGet.mockResolvedValue({ id: 'a', title: 'huge', content: huge });
		mockDecryptRecords.mockImplementation(async (_t: string, rows: unknown[]) => rows);

		const out = await resolveReferences([{ kind: 'article', targetId: 'a1', note: null }]);
		expect(out).toHaveLength(1);
	});
});
