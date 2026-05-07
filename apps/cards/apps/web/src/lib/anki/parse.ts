/**
 * Parse an Anki .apkg / .colpkg file in the browser.
 *
 * .apkg = ZIP archive containing a SQLite collection (`collection.anki2`
 * or `collection.anki21`) plus media files. We open the SQLite blob with
 * sql.js (WASM-backed in-browser SQLite) and walk Anki's three core
 * tables: `col` (collection meta with JSON-encoded models + decks),
 * `notes` (the user-typed content), and `cards` (one row per learnable
 * unit — basic = 1, basic-reverse = 2, cloze = N).
 *
 * MVP scope: basic + basic-reverse + cloze. Image/audio media is
 * skipped (Phase 2). Review history is skipped — FSRS state will be
 * regenerated on first sight.
 */

import JSZip, { type JSZipObject } from 'jszip';
import initSqlJs, { type Database } from 'sql.js';
import type { CardType } from '@mana/cards-core';

export interface ParsedDeck {
	ankiId: string; // Anki's numeric deck id, stringified
	name: string; // "Studies::Spanish" — Anki uses :: as separator
}

export interface ParsedCard {
	ankiDeckId: string;
	type: CardType;
	fields: Record<string, string>;
}

export interface ParsedAnki {
	decks: ParsedDeck[];
	cards: ParsedCard[];
	skipped: number;
	warnings: string[];
	/**
	 * Mapping from the original media filename (as referenced in card
	 * fields, e.g. `paris.jpg` or `audio_001.mp3`) to its ZIP entry. Anki
	 * stores files numerically (`0`, `1`, …) and the JSON manifest
	 * (`media`) maps numbers → original names; we flip that here so the
	 * importer can look up by the name it sees in the field text.
	 */
	mediaByFilename: Map<string, JSZipObject>;
}

interface AnkiModel {
	id: number;
	name: string;
	type: number; // 0 = standard, 1 = cloze
	flds: { name: string }[];
	tmpls: { name: string }[];
}

interface AnkiDeckJson {
	id: number;
	name: string;
}

let SQL: Awaited<ReturnType<typeof initSqlJs>> | null = null;
async function getSql() {
	if (SQL) return SQL;
	SQL = await initSqlJs({ locateFile: (file) => `/${file}` });
	return SQL;
}

export async function parseApkg(file: File | Blob): Promise<ParsedAnki> {
	const zip = await JSZip.loadAsync(await file.arrayBuffer());

	const collectionEntry = zip.file('collection.anki21') ?? zip.file('collection.anki2');
	if (!collectionEntry) {
		throw new Error(
			'Keine Anki-Collection-Datei in der .apkg gefunden (erwartet: collection.anki21 oder collection.anki2).'
		);
	}

	const sqliteBytes = await collectionEntry.async('uint8array');
	const sql = await getSql();
	const db: Database = new sql.Database(sqliteBytes);

	const mediaByFilename = await extractMediaManifest(zip);

	try {
		const result = extract(db);
		return { ...result, mediaByFilename };
	} finally {
		db.close();
	}
}

async function extractMediaManifest(zip: JSZip): Promise<Map<string, JSZipObject>> {
	const out = new Map<string, JSZipObject>();
	const manifestEntry = zip.file('media');
	if (!manifestEntry) return out;
	let manifest: Record<string, string>;
	try {
		manifest = JSON.parse(await manifestEntry.async('string'));
	} catch {
		return out;
	}
	for (const [numericKey, originalName] of Object.entries(manifest)) {
		const entry = zip.file(numericKey);
		if (entry) out.set(originalName, entry);
	}
	return out;
}

// Internal extract returns everything except media — that's plumbed in
// at the parseApkg layer so the SQLite-only path stays focused.
type ExtractResult = Omit<ParsedAnki, 'mediaByFilename'>;
function extract(db: Database): ExtractResult {
	const colRow = db.exec('SELECT models, decks FROM col LIMIT 1');
	if (colRow.length === 0 || colRow[0].values.length === 0) {
		throw new Error('Anki-Collection ist leer.');
	}
	const [modelsJson, decksJson] = colRow[0].values[0] as [string, string];
	const models: Record<string, AnkiModel> = JSON.parse(modelsJson);
	const decksMap: Record<string, AnkiDeckJson> = JSON.parse(decksJson);

	const decks: ParsedDeck[] = Object.values(decksMap)
		.filter((d) => d.id !== 1) // Anki's "Default" deck has id 1; skip if empty later
		.map((d) => ({ ankiId: String(d.id), name: d.name }));

	// Pre-load notes into a Map so we don't hit SQLite per card.
	type NoteRow = { id: string; mid: string; flds: string };
	const notesById = new Map<string, NoteRow>();
	const notesRes = db.exec('SELECT id, mid, flds FROM notes');
	if (notesRes.length > 0) {
		for (const row of notesRes[0].values) {
			const [id, mid, flds] = row as [number, number, string];
			notesById.set(String(id), { id: String(id), mid: String(mid), flds });
		}
	}

	const warnings: string[] = [];
	const cards: ParsedCard[] = [];
	let skipped = 0;

	const cardsRes = db.exec('SELECT nid, did, ord FROM cards');
	if (cardsRes.length === 0)
		return { decks, cards: [], skipped: 0, warnings: ['Keine Karten gefunden.'] };

	// We dedupe at the note level — Anki stores one DB-row per generated
	// card (basic-reverse = 2 rows, cloze cluster c1+c2 = 2 rows). Our
	// model regenerates these from `type` + `fields` automatically, so
	// pulling each note once is enough.
	const seenNotes = new Set<string>();
	for (const row of cardsRes[0].values) {
		const [nid, did] = row as [number, number, number];
		const noteKey = String(nid);
		if (seenNotes.has(noteKey)) continue;
		seenNotes.add(noteKey);

		const note = notesById.get(noteKey);
		if (!note) {
			skipped++;
			continue;
		}
		const model = models[note.mid];
		if (!model) {
			skipped++;
			warnings.push(`Note ${nid}: unknown model ${note.mid}`);
			continue;
		}

		const fieldValues = note.flds.split('\x1f');
		const result = mapNoteToCard(model, fieldValues);
		if (!result) {
			skipped++;
			continue;
		}
		cards.push({ ankiDeckId: String(did), ...result });
	}

	if (skipped > 0) warnings.unshift(`${skipped} Karten übersprungen (unbekannter Typ).`);
	return { decks, cards, skipped, warnings };
}

function mapNoteToCard(
	model: AnkiModel,
	fields: string[]
): { type: CardType; fields: Record<string, string> } | null {
	// Cloze: exactly one input field with {{cN::...}} markup.
	if (model.type === 1) {
		const text = fields[0] ?? '';
		return { type: 'cloze', fields: { text, ...(fields[1] ? { extra: fields[1] } : {}) } };
	}

	// Standard: one or two templates → basic / basic-reverse.
	if (model.type === 0) {
		const front = fields[0] ?? '';
		const back = fields[1] ?? '';
		if (model.tmpls.length === 2) {
			return { type: 'basic-reverse', fields: { front, back } };
		}
		// 1 (or unusual N) → treat as basic. Custom multi-card templates
		// lose their extra surfaces; the user-typed content survives.
		return { type: 'basic', fields: { front, back } };
	}

	return null;
}

/**
 * Convert Anki's HTML / image / sound markup to plain text + Markdown.
 *
 * `mediaUrlByFilename` maps the filename Anki references in the field
 * (e.g. `paris.jpg` for `<img src="paris.jpg">` or `audio.mp3` for
 * `[sound:audio.mp3]`) to its post-upload URL on mana-media. Anything
 * not in the map is dropped silently — same as the no-media path.
 */
export function sanitizeAnkiHtml(
	html: string,
	mediaUrlByFilename: Map<string, string> = new Map()
): string {
	const imgReplaced = html.replace(
		/<img\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi,
		(_, src: string) => {
			const url = mediaUrlByFilename.get(src);
			return url ? `<img src="${url}" alt="" />` : '';
		}
	);
	const soundReplaced = imgReplaced.replace(/\[sound:([^\]]+)\]/g, (_, name: string) => {
		const url = mediaUrlByFilename.get(name);
		return url ? `<audio controls preload="metadata" src="${url}"></audio>` : '';
	});

	return (
		soundReplaced
			.replace(/<br\s*\/?>/gi, '\n')
			.replace(/<\/?(?:b|strong)>/gi, '**')
			.replace(/<\/?(?:i|em)>/gi, '*')
			.replace(/<\/?p>/gi, '\n')
			.replace(/<\/?div>/gi, '\n')
			// Drop remaining HTML tags except the ones we just emitted
			// (img/audio/video/source) — those need to survive into the
			// rendered card. Negative lookahead does that in one pass.
			.replace(/<(?!\/?(?:img|audio|video|source)\b)[^>]+>/gi, '')
			.replace(/&nbsp;/g, ' ')
			.replace(/&amp;/g, '&')
			.replace(/&lt;/g, '<')
			.replace(/&gt;/g, '>')
			.replace(/&quot;/g, '"')
			.replace(/&#39;/g, "'")
			.replace(/\n{3,}/g, '\n\n')
			.trim()
	);
}
