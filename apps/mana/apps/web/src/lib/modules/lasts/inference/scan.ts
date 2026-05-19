/**
 * Inference orchestrator.
 *
 * Runs every registered source-scanner, then filters candidates against:
 *   1. Cooldown table — dismissed candidates are silenced for COOLDOWN_DAYS.
 *   2. Existing lasts — if a non-deleted last already references this
 *      (refTable, refId), skip re-suggesting (whether suspected, confirmed,
 *      or reclaimed — user has already engaged with this candidate).
 *
 * Surviving candidates are written as new `suspected` lasts with the
 * `inferredFrom` provenance set, ready for the Inbox view.
 *
 * 2026-05-19: `places`-Source mit dem places-Modul dekommissioniert
 * (viadocu trägt jetzt allein, hat aber keine Visit-Counter pro Place).
 * `SOURCES` ist absichtlich leer — die Inbox bleibt leer bis eine neue
 * Source registriert wird. Manuelles `create_last`/`confirm_last` via
 * Tool oder UI funktioniert unverändert.
 *
 * Nächste-Schritte-Kandidaten: habits (HabitLog-Timestamps → "Habit
 * lange nicht mehr geloggt"), contacts (Contact.lastInteractionAt →
 * "Person lange nicht mehr getroffen"). Plan in
 * mana/docs/playbooks/MANAGARTEN_LIFTS_FOLLOWUPS.md.
 */

import { db } from '$lib/data/database';
import { scopedForModule } from '$lib/data/scope';
import { decryptRecords } from '$lib/data/crypto';
import { lastsCooldownTable } from '../collections';
import type { LocalLast, LocalLastsCooldown } from '../types';
import { INFERENCE_DEFAULTS, type InferenceCandidate, type InferenceSource } from './types';

// `places` inference source dekommissioniert 2026-05-19 mit places-Modul.
// habits/contacts-Sources sind in M3.b geplant — kein aktiver Scanner aktuell.
const SOURCES: InferenceSource[] = [];

/** Read all lasts in the active Space (decrypted). */
async function loadExistingLasts(): Promise<LocalLast[]> {
	const visible = (await scopedForModule<LocalLast, string>('lasts', 'lasts').toArray()).filter(
		(l) => !l.deletedAt
	);
	// We only need inferredFrom (plaintext) for dedup — no decrypt strictly
	// necessary, but decryptRecords no-ops cleanly on already-plaintext fields.
	return visible;
}

async function loadCooldownEntries(): Promise<LocalLastsCooldown[]> {
	return (
		await scopedForModule<LocalLastsCooldown, string>('lasts', 'lastsCooldown').toArray()
	).filter((c) => !c.deletedAt);
}

function isCoolingDown(
	now: Date,
	candidate: InferenceCandidate,
	cooldown: LocalLastsCooldown[]
): boolean {
	const match = cooldown.find(
		(c) => c.refTable === candidate.refTable && c.refId === candidate.refId
	);
	if (!match) return false;
	const dismissedAt = new Date(match.dismissedAt);
	if (Number.isNaN(dismissedAt.getTime())) return false;
	const ageDays = Math.floor((now.getTime() - dismissedAt.getTime()) / (1000 * 60 * 60 * 24));
	return ageDays < INFERENCE_DEFAULTS.COOLDOWN_DAYS;
}

function alreadyHasLast(candidate: InferenceCandidate, existing: LocalLast[]): boolean {
	return existing.some(
		(l) =>
			l.inferredFrom?.refTable === candidate.refTable && l.inferredFrom?.refId === candidate.refId
	);
}

export interface ScanResult {
	candidatesProduced: number; // total raw candidates from all sources
	cooldownFiltered: number;
	existingFiltered: number;
	finalCandidates: InferenceCandidate[];
}

/**
 * Pure scan — runs all sources and applies filters, but does NOT write to
 * the lasts table. The caller (store) decides what to do with the result.
 *
 * Decoupling write-from-scan lets us:
 *   - unit-test the pipeline without polluting the active Space
 *   - run a "dry-run" preview in dev tooling
 *   - let server-side scanners (mana-ai mission, M5+) reuse the same logic
 */
export async function runInferenceScan(now: Date = new Date()): Promise<ScanResult> {
	const [existing, cooldown] = await Promise.all([loadExistingLasts(), loadCooldownEntries()]);

	let candidatesProduced = 0;
	let cooldownFiltered = 0;
	let existingFiltered = 0;
	const survivors: InferenceCandidate[] = [];

	for (const source of SOURCES) {
		const candidates = await source.scan(now);
		candidatesProduced += candidates.length;

		for (const c of candidates) {
			if (isCoolingDown(now, c, cooldown)) {
				cooldownFiltered += 1;
				continue;
			}
			if (alreadyHasLast(c, existing)) {
				existingFiltered += 1;
				continue;
			}
			survivors.push(c);
		}
	}

	return {
		candidatesProduced,
		cooldownFiltered,
		existingFiltered,
		finalCandidates: survivors,
	};
}

/** Deterministic id for a cooldown row — `${refTable}:${refId}`. */
export function cooldownIdFor(refTable: string, refId: string): string {
	return `${refTable}:${refId}`;
}

/**
 * Mark a (refTable, refId) pair as dismissed. Idempotent via deterministic
 * id — re-dismissing just refreshes the dismissedAt stamp.
 */
export async function recordDismissal(refTable: string, refId: string): Promise<void> {
	const id = cooldownIdFor(refTable, refId);
	const now = new Date().toISOString();
	await lastsCooldownTable.put({ id, refTable, refId, dismissedAt: now });
}
