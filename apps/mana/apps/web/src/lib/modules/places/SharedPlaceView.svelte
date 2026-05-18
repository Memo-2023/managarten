<!--
  Shared-Place view — public render of a place behind an unlisted
  share link.

  Whitelist (set by buildPlaceBlob): name, address, category. Lat/lng
  intentionally NOT inlined — the v1 share page renders no map.
  v1.1 may add an opt-in toggle.
-->
<script lang="ts">
	type PlaceCategory = 'home' | 'work' | 'shopping' | 'transit' | 'leisure' | 'other';

	interface PlaceBlob {
		name: string;
		address: string | null;
		category: PlaceCategory;
	}

	let {
		blob,
	}: {
		blob: Record<string, unknown>;
		token: string;
		expiresAt: string | null;
	} = $props();

	const place = $derived(blob as unknown as PlaceBlob);

	const CATEGORY_LABELS: Record<PlaceCategory, string> = {
		home: 'Zuhause',
		work: 'Arbeit',
		shopping: 'Einkaufen',
		transit: 'Transit',
		leisure: 'Freizeit',
		other: 'Ort',
	};

	const CATEGORY_EMOJI: Record<PlaceCategory, string> = {
		home: '🏠',
		work: '🏢',
		shopping: '🛍️',
		transit: '🚆',
		leisure: '🎨',
		other: '📍',
	};

	const ogDescription = $derived(place.address ?? CATEGORY_LABELS[place.category]);

	// Map-search link — generic geo-URL, browser opens whatever map app
	// the user has set as default. Falls back to OpenStreetMap search.
	const mapUrl = $derived.by(() => {
		const q = encodeURIComponent(`${place.name}${place.address ? ` ${place.address}` : ''}`);
		return `https://www.openstreetmap.org/search?query=${q}`;
	});
</script>

<svelte:head>
	<title>{place.name} · Mana</title>
	<meta name="robots" content="noindex, nofollow" />
	<meta property="og:title" content={place.name} />
	<meta property="og:description" content={ogDescription} />
	<meta property="og:type" content="website" />
	<meta name="twitter:card" content="summary" />
</svelte:head>

<article class="place">
	<span class="place__kind">
		{CATEGORY_EMOJI[place.category]}
		{CATEGORY_LABELS[place.category]}
	</span>
	<h1 class="place__title">{place.name}</h1>

	{#if place.address}
		<p class="place__address">{place.address}</p>
	{/if}

	<a class="place__map" href={mapUrl} target="_blank" rel="noopener noreferrer">
		🗺️ Auf OpenStreetMap suchen
	</a>
</article>

<style>
	.place {
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.place__kind {
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.08em;
		color: #6b7280;
		font-weight: 600;
	}
	.place__title {
		margin: 0;
		font-size: 2rem;
		line-height: 1.15;
		font-weight: 700;
	}
	.place__address {
		margin: 0;
		font-size: 1.0625rem;
		color: #374151;
		white-space: pre-line;
	}
	.place__map {
		display: inline-flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.65rem 1rem;
		background: #4f46e5;
		color: white;
		border-radius: 0.5rem;
		text-decoration: none;
		font-weight: 600;
		font-size: 0.9375rem;
		align-self: flex-start;
	}
	.place__map:hover {
		background: #4338ca;
	}

	@media (prefers-color-scheme: dark) {
		.place__kind {
			color: #9ca3af;
		}
		.place__address {
			color: #d1d5db;
		}
		.place__map {
			background: #818cf8;
		}
		.place__map:hover {
			background: #6366f1;
		}
	}
</style>
