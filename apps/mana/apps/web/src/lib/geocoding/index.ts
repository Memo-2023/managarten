/**
 * Shared geocoding client for all modules in the unified Mana app.
 *
 * Talks to mana-geocoding (port 3018), which fronts a provider chain
 * (photon-self → public photon → public nominatim) with sensitive-query
 * blocking and coord quantization. Sensitive + happy-path queries stay
 * on our infrastructure via photon-self; only last-resort fallbacks
 * leave the network.
 *
 * Used by: places, events, contacts, photos, …
 *
 * The `PlaceCategory` type is defined here (rather than imported from the
 * places module) because geocoding is the source of truth for categories —
 * places just happens to be the first consumer.
 */

export type PlaceCategory = 'home' | 'work' | 'shopping' | 'transit' | 'leisure' | 'other';

/**
 * Where to send geocoding requests:
 * - **Browser**: same-origin proxy at `/api/v1/geocode/*` (handled by the
 *   SvelteKit `+server.ts` under `routes/api/v1/geocode/[...path]`). This
 *   keeps geocoding off the public internet — it's explicitly NOT exposed
 *   via Cloudflare — and saves us an auth round-trip.
 * - **Node / SSR**: direct hit on the wrapper via `PUBLIC_MANA_GEOCODING_URL`
 *   or `MANA_GEOCODING_INTERNAL_URL`, with a localhost fallback for dev.
 *
 * Because `PlacesListView` is client-only (reads `navigator.geolocation`),
 * browser → same-origin is by far the common path.
 */
const GEOCODING_URL = () => {
	if (typeof window !== 'undefined') {
		// Same-origin proxy — nothing to configure, nothing to leak.
		return '';
	}
	return (
		process.env.MANA_GEOCODING_INTERNAL_URL ??
		process.env.PUBLIC_MANA_GEOCODING_URL ??
		'http://localhost:3018'
	);
};

/** Build a request URL that works in both the browser (relative) and Node (absolute). */
function geocodeUrl(path: string, params: URLSearchParams): string {
	const base = GEOCODING_URL();
	const query = params.toString();
	if (base) {
		// Node / SSR path — absolute
		return `${base}/api/v1/geocode/${path}${query ? '?' + query : ''}`;
	}
	// Browser path — same-origin proxy
	return `/api/v1/geocode/${path}${query ? '?' + query : ''}`;
}

export interface GeocodingAddress {
	street?: string;
	houseNumber?: string;
	postalCode?: string;
	city?: string;
	state?: string;
	country?: string;
}

export interface GeocodingResult {
	label: string;
	name: string;
	latitude: number;
	longitude: number;
	address: GeocodingAddress;
	category: PlaceCategory;
	confidence: number;
	/** Which backend served this result. `photon-self` is our self-hosted
	 *  Photon (privacy: 'local'); `photon` and `nominatim` are public APIs
	 *  (the wrapper applies sensitive-query blocking + coord quantization
	 *  before forwarding to those). */
	provider?: 'photon-self' | 'photon' | 'nominatim';
}

/**
 * Out-of-band information returned alongside results — the wrapper uses
 * this to signal *why* a query had unusual behavior:
 *
 *  - `'fallback_used'`: photon-self was unreachable, so a public-API
 *    provider served the request. Results are still valid but may be
 *    less precise. UI should show a subtle "approximate" badge.
 *  - `'sensitive_local_unavailable'`: the query matched the wrapper's
 *    sensitive-keyword list (medical / mental-health / crisis service)
 *    AND no local provider was reachable. The wrapper deliberately did
 *    NOT forward the query to public APIs. Results are empty by design.
 *    UI should explain this to the user.
 */
export type GeocodingNotice = 'fallback_used' | 'sensitive_local_unavailable';

interface GeocodingResponse {
	results: GeocodingResult[];
	cached?: boolean;
	error?: string;
	provider?: 'photon-self' | 'photon' | 'nominatim';
	notice?: GeocodingNotice;
}

/**
 * Detailed search outcome — includes provider + notice metadata.
 *
 * Most call sites use the simpler `searchAddress` (returns just the
 * results array). The detailed variant is for places where the UI needs
 * to surface a notice — typically the address-autocomplete input where
 * a "search blocked for privacy" message has to be shown.
 */
export interface SearchOutcome {
	results: GeocodingResult[];
	provider?: 'photon-self' | 'photon' | 'nominatim';
	notice?: GeocodingNotice;
}

/**
 * Forward geocoding / autocomplete.
 * Returns places matching the search query, biased towards the focus point.
 *
 * For UI that needs to display privacy-related notices (e.g. "this
 * search stays local"), use {@link searchAddressDetailed} instead.
 */
export async function searchAddress(
	query: string,
	options?: {
		limit?: number;
		focusLat?: number;
		focusLon?: number;
		lang?: string;
	}
): Promise<GeocodingResult[]> {
	const outcome = await searchAddressDetailed(query, options);
	return outcome.results;
}

/**
 * Detailed forward-search variant that surfaces the wrapper's `provider`
 * and `notice` fields. Use this in the address-autocomplete UI so we can:
 *   - Show a subtle "≈ ungefähr" badge when a public-API fallback served
 *     the result (`notice: 'fallback_used'`).
 *   - Explain to the user why a sensitive query (Hausarzt, Klinikum,
 *     etc.) returned 0 results without leaking it to a public API
 *     (`notice: 'sensitive_local_unavailable'`).
 */
export async function searchAddressDetailed(
	query: string,
	options?: {
		limit?: number;
		focusLat?: number;
		focusLon?: number;
		lang?: string;
	}
): Promise<SearchOutcome> {
	if (!query || query.trim().length < 2) return { results: [] };

	const params = new URLSearchParams({ q: query.trim() });
	if (options?.limit) params.set('limit', String(options.limit));
	if (options?.lang) params.set('lang', options.lang);
	if (options?.focusLat != null) params.set('focus.lat', String(options.focusLat));
	if (options?.focusLon != null) params.set('focus.lon', String(options.focusLon));

	try {
		const res = await fetch(geocodeUrl('search', params));
		if (!res.ok) return { results: [] };
		const data: GeocodingResponse = await res.json();
		return { results: data.results, provider: data.provider, notice: data.notice };
	} catch {
		console.warn('Geocoding search failed — service may be offline');
		return { results: [] };
	}
}

/**
 * Reverse geocoding — resolve coordinates to an address and place type.
 *
 * For UI that needs to surface the privacy notice (e.g. "approximate match"
 * badge on a coordinate-derived address), use {@link reverseGeocodeDetailed}.
 */
export async function reverseGeocode(
	lat: number,
	lon: number,
	lang = 'de'
): Promise<GeocodingResult | null> {
	const outcome = await reverseGeocodeDetailed(lat, lon, lang);
	return outcome.results[0] ?? null;
}

/** Detailed reverse-geocode variant — see {@link searchAddressDetailed}. */
export async function reverseGeocodeDetailed(
	lat: number,
	lon: number,
	lang = 'de'
): Promise<SearchOutcome> {
	try {
		const params = new URLSearchParams({
			lat: String(lat),
			lon: String(lon),
			lang,
		});
		const res = await fetch(geocodeUrl('reverse', params));
		if (!res.ok) return { results: [] };
		const data: GeocodingResponse = await res.json();
		return { results: data.results, provider: data.provider, notice: data.notice };
	} catch {
		console.warn('Reverse geocoding failed — service may be offline');
		return { results: [] };
	}
}

/**
 * Format a structured address into a single-line string.
 */
export function formatAddress(address: GeocodingAddress): string {
	const parts: string[] = [];

	if (address.street) {
		parts.push(address.houseNumber ? `${address.street} ${address.houseNumber}` : address.street);
	}
	if (address.postalCode && address.city) {
		parts.push(`${address.postalCode} ${address.city}`);
	} else if (address.city) {
		parts.push(address.city);
	}

	return parts.join(', ');
}

/**
 * Build a short locality label ("Konstanz", "Konstanz, Germany") from a result.
 * Useful for photos / journal / memoro where you just want to know the rough
 * place, not the full street address.
 */
export function formatLocality(result: GeocodingResult): string {
	const a = result.address;
	// Prefer the name for venues (e.g. "Konzil Restaurant")
	if (result.name && result.name !== a.city) return result.name;
	if (a.city && a.country) return `${a.city}, ${a.country}`;
	return a.city ?? a.country ?? result.label ?? '';
}

/** Map OSM country names to 2-letter codes (DE/AT/CH focus). */
const COUNTRY_CODE: Record<string, string> = {
	Germany: 'DE',
	Deutschland: 'DE',
	Austria: 'AT',
	Österreich: 'AT',
	Switzerland: 'CH',
	Schweiz: 'CH',
};

/**
 * Compact address label with street, house number, postal code and 2-letter
 * country. Used by the places tracking overlay where horizontal space is
 * tight.
 *
 * Examples:
 *   "Hafenstraße 2, 78462 Konstanz, DE"
 *   "Marienplatz 26, 80331 München, DE"
 *   "78462 Konstanz, DE"  (when no street is available)
 */
export function formatFullAddress(result: GeocodingResult): string {
	const a = result.address;
	const countryCode = a.country ? (COUNTRY_CODE[a.country] ?? a.country) : undefined;

	const streetLine = a.street ? (a.houseNumber ? `${a.street} ${a.houseNumber}` : a.street) : '';

	const cityLine = a.postalCode && a.city ? `${a.postalCode} ${a.city}` : (a.city ?? '');

	const parts: string[] = [];
	if (streetLine) parts.push(streetLine);
	if (cityLine) parts.push(cityLine);
	if (countryCode) parts.push(countryCode);

	return parts.join(', ') || result.label || '';
}
