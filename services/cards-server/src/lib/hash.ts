/**
 * Content hashing — SHA-256 over canonicalized payloads. Drives:
 *   - per-card `content_hash` (smart-merge across version bumps)
 *   - per-version `content_hash` (cache + dedup detection)
 *
 * Canonicalization sorts object keys recursively so `{a:1,b:2}` and
 * `{b:2,a:1}` produce identical hashes. Without that, equivalent
 * payloads from different clients would diverge. Numbers/booleans
 * stringify naturally; strings are passed through verbatim.
 */

import { createHash } from 'node:crypto';

function canonical(value: unknown): unknown {
	if (value === null || typeof value !== 'object') return value;
	if (Array.isArray(value)) return value.map(canonical);
	const sorted: Record<string, unknown> = {};
	for (const key of Object.keys(value as Record<string, unknown>).sort()) {
		sorted[key] = canonical((value as Record<string, unknown>)[key]);
	}
	return sorted;
}

function sha256(input: string): string {
	return createHash('sha256').update(input).digest('hex');
}

/** Hash for a single card — based on (type, fields). */
export function hashCard(card: { type: string; fields: Record<string, string> }): string {
	return sha256(JSON.stringify(canonical({ type: card.type, fields: card.fields })));
}

/**
 * Hash for an ordered list of cards — version content hash. Order
 * matters because re-ordering is a meaningful change for the learner.
 */
export function hashVersionCards(
	cards: { type: string; fields: Record<string, string>; ord: number }[]
): string {
	const ordered = [...cards].sort((a, b) => a.ord - b.ord);
	return sha256(
		JSON.stringify(ordered.map((c) => canonical({ type: c.type, fields: c.fields, ord: c.ord })))
	);
}
