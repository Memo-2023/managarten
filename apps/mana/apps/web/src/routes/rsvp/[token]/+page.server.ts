/**
 * Public RSVP page — server-side load.
 *
 * Fetches the published event snapshot from mana-events. No auth required.
 */

import { error } from '@sveltejs/kit';
import type { PageServerLoad } from './$types';

const EVENTS_URL =
	process.env.PUBLIC_MANA_EVENTS_URL_CLIENT ||
	process.env.PUBLIC_MANA_EVENTS_URL ||
	'http://localhost:3115';

type Lang = 'de' | 'en' | 'it' | 'fr' | 'es';

const SUPPORTED: ReadonlySet<Lang> = new Set(['de', 'en', 'it', 'fr', 'es']);

/** Pick the best supported language from an Accept-Language header. */
function pickLang(header: string | null): Lang {
	if (!header) return 'de';
	// Header looks like "de-DE,de;q=0.9,en-US;q=0.8,en;q=0.7"
	const parts = header.split(',').map((p) => p.trim().split(';')[0].toLowerCase().slice(0, 2));
	for (const p of parts) {
		if (SUPPORTED.has(p as Lang)) return p as Lang;
	}
	return 'de';
}

interface EventSnapshot {
	token: string;
	title: string;
	description: string | null;
	location: string | null;
	locationUrl: string | null;
	startAt: string;
	endAt: string | null;
	allDay: boolean;
	coverImageUrl: string | null;
	color: string | null;
	capacity: number | null;
}

interface RsvpSummary {
	yes: number;
	no: number;
	maybe: number;
	totalAttending: number;
}

interface BringItem {
	id: string;
	label: string;
	quantity: number | null;
	sortOrder: number;
	done: boolean;
	claimedByName: string | null;
}

export const load: PageServerLoad = async ({ params, fetch, request }) => {
	const token = params.token;
	if (!token) throw error(404, 'Not found');

	const lang = pickLang(request.headers.get('accept-language'));
	const NOT_FOUND_MESSAGES: Record<Lang, string> = {
		de: 'Event nicht gefunden',
		en: 'Event not found',
		it: 'Evento non trovato',
		fr: 'Événement introuvable',
		es: 'Evento no encontrado',
	};
	const ERROR_MESSAGES: Record<Lang, string> = {
		de: 'Konnte Event nicht laden',
		en: 'Could not load event',
		it: 'Impossibile caricare l’evento',
		fr: 'Impossible de charger l’événement',
		es: 'No se pudo cargar el evento',
	};
	const notFoundMsg = NOT_FOUND_MESSAGES[lang];
	const errorMsg = ERROR_MESSAGES[lang];

	try {
		const res = await fetch(`${EVENTS_URL}/api/v1/rsvp/${encodeURIComponent(token)}`);
		if (res.status === 404) throw error(404, notFoundMsg);
		if (!res.ok) throw error(500, errorMsg);
		const data = (await res.json()) as {
			event: EventSnapshot;
			summary: RsvpSummary | null;
			cancelled?: boolean;
			items?: BringItem[];
		};
		return { token, ...data, items: data.items ?? [], eventsUrl: EVENTS_URL, lang };
	} catch (e) {
		if (e && typeof e === 'object' && 'status' in e) throw e;
		throw error(500, errorMsg);
	}
};
