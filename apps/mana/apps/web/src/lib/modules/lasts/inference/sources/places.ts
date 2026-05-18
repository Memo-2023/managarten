/**
 * Places inference source.
 *
 * Heuristic: a Place with `visitCount >= MIN_PRIOR_OCCURRENCES` whose
 * `lastVisitedAt` is older than `MIN_SILENCE_DAYS` is a candidate. We
 * don't have direct access to per-visit history (would need to scan
 * `locationLogs`), so the visit-count + last-visit pair is the proxy
 * for "was a regular thing, has stopped".
 *
 * Category mapping: Place.category → LastCategory by best-effort. Most
 * places land in `other` if their PlaceCategory has no clean milestone
 * equivalent.
 */

import { decryptRecords } from '$lib/data/crypto';
import { scopedForModule } from '$lib/data/scope';
import type { LocalPlace, PlaceCategory } from '$lib/modules/places/types';
import { INFERENCE_DEFAULTS, type InferenceCandidate, type InferenceSource } from '../types';
import type { LastCategory } from '../../types';

const PLACE_CATEGORY_MAP: Record<PlaceCategory, LastCategory> = {
	home: 'other',
	work: 'career',
	shopping: 'other',
	transit: 'travel',
	leisure: 'culture',
	other: 'other',
};

function daysBetween(a: Date, b: Date): number {
	return Math.floor((a.getTime() - b.getTime()) / (1000 * 60 * 60 * 24));
}

function silenceLabel(days: number): string {
	if (days >= 730) return `${Math.floor(days / 365)} Jahren`;
	if (days >= 365) return '1 Jahr';
	const months = Math.floor(days / 30);
	return `${months} Monaten`;
}

export const placesSource: InferenceSource = {
	id: 'places',

	async scan(now) {
		const visible = (
			await scopedForModule<LocalPlace, string>('places', 'places').toArray()
		).filter((p) => !p.deletedAt && !p.isArchived);
		// Place names are encrypted in the registry — decrypt before use.
		const decrypted = await decryptRecords<LocalPlace>('places', visible);

		const candidates: InferenceCandidate[] = [];

		for (const place of decrypted) {
			const visitCount = place.visitCount ?? 0;
			if (visitCount < INFERENCE_DEFAULTS.MIN_PRIOR_OCCURRENCES) continue;
			if (!place.lastVisitedAt) continue;

			const lastVisit = new Date(place.lastVisitedAt);
			if (Number.isNaN(lastVisit.getTime())) continue;

			const silenceDays = daysBetween(now, lastVisit);
			if (silenceDays < INFERENCE_DEFAULTS.MIN_SILENCE_DAYS) continue;

			// Span check: createdAt → lastVisitedAt should cover at least
			// MIN_PRIOR_SPAN_DAYS so we know it was a sustained habit, not a
			// short burst (e.g. a one-week conference visited 5 days running).
			if (place.createdAt) {
				const created = new Date(place.createdAt);
				const spanDays = daysBetween(lastVisit, created);
				if (spanDays < INFERENCE_DEFAULTS.MIN_PRIOR_SPAN_DAYS) continue;
			}

			const category = PLACE_CATEGORY_MAP[place.category ?? 'other'];

			candidates.push({
				refTable: 'places',
				refId: place.id,
				title: `Letztes Mal ${place.name}`,
				category,
				frequencyHint: `${visitCount}× besucht — seit ${silenceLabel(silenceDays)} nicht mehr`,
				suggestedDate: place.lastVisitedAt.slice(0, 10),
			});
		}

		// Sort by silence desc (longest gap = oldest lastVisitedAt first) and cap.
		candidates.sort((a, b) => (a.suggestedDate ?? '').localeCompare(b.suggestedDate ?? ''));
		return candidates.slice(0, INFERENCE_DEFAULTS.MAX_CANDIDATES_PER_SOURCE);
	},
};
