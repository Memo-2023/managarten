<!--
  Places — DetailView (inline editable overlay)
  All fields are always editable. Changes auto-save on blur.
-->
<script lang="ts">
	import { db } from '$lib/data/database';
	import { useLiveQueryWithDefault } from '@mana/local-store/svelte';
	import { useDetailEntity } from '$lib/data/detail-entity.svelte';
	import DetailViewShell from '$lib/components/DetailViewShell.svelte';
	import { placesStore } from '../stores/places.svelte';
	import {
		reverseGeocode,
		formatAddress,
		searchAddress,
		type GeocodingResult,
	} from '$lib/geocoding';
	import { Star, MapPin, X, MagnifyingGlass, ArrowsClockwise } from '@mana/shared-icons';
	import {
		VisibilityPicker,
		SharedLinkControls,
		buildShareUrl,
		type VisibilityLevel,
	} from '@mana/shared-privacy';
	import type { ViewProps } from '$lib/app-registry';
	import type { LocalPlace, PlaceCategory, LocalLocationLog } from '../types';
	import { useAllTags, getTagsByIds } from '@mana/shared-stores';
	import LinkedItems from '$lib/components/links/LinkedItems.svelte';
	import { removeTagIdWithUndo } from '$lib/data/tag-mutations';
	import { _, locale } from 'svelte-i18n';
	import { get } from 'svelte/store';

	let { navigate, params, goBack }: ViewProps = $props();
	let placeId = $derived(params.placeId as string);

	let editName = $state('');
	let editDescription = $state('');
	let editAddress = $state('');
	let editCategory = $state<PlaceCategory>('other');
	let editLatitude = $state('');
	let editLongitude = $state('');

	const tagsQuery = useAllTags();
	let allTags = $derived(tagsQuery.value ?? []);

	const detail = useDetailEntity<LocalPlace>({
		id: () => placeId,
		table: 'places',
		onLoad: (p) => {
			editName = p.name ?? '';
			editDescription = p.description ?? '';
			editAddress = p.address ?? '';
			editCategory = p.category ?? 'other';
			editLatitude = p.latitude?.toString() ?? '';
			editLongitude = p.longitude?.toString() ?? '';
		},
	});

	const logsQuery = useLiveQueryWithDefault(async () => {
		const all = await db
			.table<LocalLocationLog>('locationLogs')
			.where('placeId')
			.equals(placeId)
			.reverse()
			.sortBy('timestamp');
		return all.slice(0, 20);
	}, [] as LocalLocationLog[]);
	const logs = $derived(logsQuery.value);

	let placeTags = $derived(getTagsByIds(allTags, detail.entity?.tagIds ?? []));

	const CATEGORY_VALUES: PlaceCategory[] = [
		'home',
		'work',
		'shopping',
		'transit',
		'leisure',
		'other',
	];

	// --- Reverse geocoding (coords → address) ---
	let isResolving = $state(false);

	async function resolveAddress() {
		const lat = parseFloat(editLatitude);
		const lng = parseFloat(editLongitude);
		if (isNaN(lat) || isNaN(lng) || (lat === 0 && lng === 0)) return;

		isResolving = true;
		const result = await reverseGeocode(lat, lng);
		isResolving = false;

		if (result) {
			editAddress = formatAddress(result.address);
			if (editCategory === 'other' && result.category !== 'other') {
				editCategory = result.category;
			}
			await saveField();
		}
	}

	// --- Address search in detail view ---
	let addressSearch = $state('');
	let addressSuggestions = $state<GeocodingResult[]>([]);
	let showAddressSuggestions = $state(false);
	let addressDebounce: ReturnType<typeof setTimeout> | undefined;

	function onAddressSearchInput() {
		clearTimeout(addressDebounce);
		if (addressSearch.trim().length < 2) {
			addressSuggestions = [];
			showAddressSuggestions = false;
			return;
		}
		addressDebounce = setTimeout(async () => {
			addressSuggestions = await searchAddress(addressSearch, { limit: 5 });
			showAddressSuggestions = addressSuggestions.length > 0;
		}, 300);
	}

	async function applyAddressResult(result: GeocodingResult) {
		showAddressSuggestions = false;
		addressSearch = '';
		editAddress = formatAddress(result.address);
		editLatitude = String(result.latitude);
		editLongitude = String(result.longitude);
		if (result.category !== 'other') {
			editCategory = result.category;
		}
		await saveField();
	}

	function onAddressSearchBlur() {
		setTimeout(() => {
			showAddressSuggestions = false;
		}, 200);
	}

	async function removeTag(tagId: string) {
		await removeTagIdWithUndo(detail.entity?.tagIds ?? [], tagId, (next) =>
			placesStore.updateTagIds(placeId, next)
		);
	}

	async function saveField() {
		detail.blur();
		const lat = parseFloat(editLatitude);
		const lng = parseFloat(editLongitude);
		await placesStore.updatePlace(placeId, {
			name: editName.trim() || $_('places.detail_view.untitled'),
			description: editDescription.trim() || null,
			address: editAddress.trim() || null,
			category: editCategory,
			latitude: isNaN(lat) ? 0 : lat,
			longitude: isNaN(lng) ? 0 : lng,
		} as Record<string, unknown>);
	}

	async function onCategoryChange(e: Event) {
		editCategory = (e.target as HTMLSelectElement).value as PlaceCategory;
		await saveField();
	}

	async function handleVisibilityChange(next: VisibilityLevel) {
		await placesStore.setVisibility(placeId, next);
	}

	async function handleRegenerate() {
		await placesStore.regenerateUnlistedToken(placeId);
	}

	async function handleRevoke() {
		await placesStore.setVisibility(placeId, 'space');
	}

	async function handleExpiryChange(expiresAt: Date | null) {
		await placesStore.setUnlistedExpiry(placeId, expiresAt);
	}

	const shareUrl = $derived.by(() => {
		const token = detail.entity?.unlistedToken;
		if (!token) return '';
		const origin = typeof window === 'undefined' ? 'https://mana.how' : window.location.origin;
		return buildShareUrl(origin, token);
	});

	async function toggleFavorite() {
		await placesStore.toggleFavorite(placeId);
	}

	async function deletePlace() {
		await placesStore.deletePlace(placeId);
		goBack();
	}

	function formatDate(iso: string): string {
		return new Date(iso).toLocaleDateString(get(locale) ?? 'de', {
			day: '2-digit',
			month: '2-digit',
			year: '2-digit',
			hour: '2-digit',
			minute: '2-digit',
		});
	}

	let mapUrl = $derived.by(() => {
		const place = detail.entity;
		if (!place || !place.latitude || !place.longitude) return '';
		const lat = place.latitude;
		const lng = place.longitude;
		const bbox = `${lng - 0.005},${lat - 0.003},${lng + 0.005},${lat + 0.003}`;
		return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
	});
</script>

<DetailViewShell
	entity={detail.entity}
	loading={detail.loading}
	notFoundLabel={$_('places.detail_view.not_found')}
	confirmDelete={detail.confirmDelete}
	onAskDelete={detail.askDelete}
	onCancelDelete={detail.cancelDelete}
	confirmDeleteLabel={$_('places.detail_view.confirm_delete')}
	onConfirmDelete={deletePlace}
>
	{#snippet body(place)}
		<div class="profile-header">
			<div class="place-avatar">
				<MapPin size={20} />
			</div>
			<div class="name-fields">
				<input
					class="name-input"
					bind:value={editName}
					onfocus={detail.focus}
					onblur={saveField}
					placeholder={$_('places.detail_view.name_placeholder')}
				/>
			</div>
			<button class="fav-btn" class:active={place.isFavorite} onclick={toggleFavorite}>
				<Star size={18} weight={place.isFavorite ? 'fill' : 'regular'} />
			</button>
		</div>

		{#if mapUrl}
			<div class="map-container">
				<iframe
					title={$_('places.detail_view.map_title')}
					src={mapUrl}
					width="100%"
					height="160"
					frameborder="0"
					loading="lazy"
				></iframe>
			</div>
		{/if}

		<div class="fields">
			<div class="field-row">
				<span class="field-label">{$_('places.detail_view.label_visibility')}</span>
				<VisibilityPicker level={place.visibility ?? 'private'} onChange={handleVisibilityChange} />
			</div>

			{#if place.visibility === 'unlisted' && place.unlistedToken && shareUrl}
				<div class="field-row field-row--share">
					<span class="field-label">{$_('places.detail_view.label_share_link')}</span>
					<SharedLinkControls
						token={place.unlistedToken}
						url={shareUrl}
						expiresAt={place.unlistedExpiresAt}
						onRegenerate={handleRegenerate}
						onRevoke={handleRevoke}
						onExpiryChange={handleExpiryChange}
					/>
				</div>
			{/if}

			<div class="field-row">
				<span class="field-label">{$_('places.detail_view.label_category')}</span>
				<select class="field-select" value={editCategory} onchange={onCategoryChange}>
					{#each CATEGORY_VALUES as v}
						<option value={v}>{$_('places.categories.' + v)}</option>
					{/each}
				</select>
			</div>

			<div class="field-row">
				<span class="field-label">{$_('places.detail_view.label_address')}</span>
				<input
					class="field-input"
					bind:value={editAddress}
					onfocus={detail.focus}
					onblur={saveField}
					placeholder={$_('places.detail_view.placeholder_address')}
				/>
			</div>

			<!-- Address Search -->
			<div class="field-row address-search-row">
				<span class="field-label"></span>
				<div class="address-search-wrapper">
					<div class="address-search-input-row">
						<MagnifyingGlass size={12} />
						<input
							class="address-search-input"
							type="text"
							placeholder={$_('places.detail_view.placeholder_address_search')}
							bind:value={addressSearch}
							oninput={onAddressSearchInput}
							onblur={onAddressSearchBlur}
							onfocus={() => {
								if (addressSuggestions.length > 0) showAddressSuggestions = true;
							}}
						/>
					</div>
					{#if showAddressSuggestions}
						<div class="address-suggestions">
							{#each addressSuggestions as result}
								<button class="address-suggestion" onclick={() => applyAddressResult(result)}>
									<span class="address-suggestion-name">{result.name || result.label}</span>
									<span class="address-suggestion-detail">{formatAddress(result.address)}</span>
								</button>
							{/each}
						</div>
					{/if}
				</div>
			</div>

			<div class="field-row">
				<span class="field-label">{$_('places.detail_view.label_coordinates')}</span>
				<div class="coords-row">
					<input
						class="field-input small"
						bind:value={editLatitude}
						onfocus={detail.focus}
						onblur={saveField}
						placeholder={$_('places.detail_view.placeholder_lat')}
						type="number"
						step="any"
					/>
					<input
						class="field-input small"
						bind:value={editLongitude}
						onfocus={detail.focus}
						onblur={saveField}
						placeholder={$_('places.detail_view.placeholder_lng')}
						type="number"
						step="any"
					/>
					<button
						class="resolve-btn"
						onclick={resolveAddress}
						disabled={isResolving}
						title={$_('places.detail_view.resolve_address_title')}
					>
						<ArrowsClockwise size={14} class={isResolving ? 'spinning' : ''} />
					</button>
				</div>
			</div>

			<div class="field-row">
				<span class="field-label">{$_('places.detail_view.label_description')}</span>
				<textarea
					class="description-input"
					bind:value={editDescription}
					onfocus={detail.focus}
					onblur={saveField}
					placeholder={$_('places.detail_view.placeholder_description')}
					rows={2}
				></textarea>
			</div>
		</div>

		{#if placeTags.length > 0}
			<div class="section">
				<span class="section-label">{$_('places.detail_view.section_tags')}</span>
				<div class="tags-list">
					{#each placeTags as tag (tag.id)}
						<button
							class="tag-pill"
							style="--tag-color: {tag.color}"
							onclick={() => removeTag(tag.id)}
						>
							<span class="tag-dot" style="background: {tag.color}"></span>
							{tag.name}
							<X size={10} />
						</button>
					{/each}
				</div>
			</div>
		{/if}

		<LinkedItems recordRef={{ app: 'places', collection: 'places', id: placeId }} {navigate} />

		{#if logs.length > 0}
			<div class="section">
				<span class="section-label">{$_('places.detail_view.section_recent_visits')}</span>
				<div class="log-list">
					{#each logs as log (log.id)}
						<div class="log-row">
							<span class="log-time">{formatDate(log.timestamp)}</span>
							{#if log.accuracy}
								<span class="log-accuracy">±{Math.round(log.accuracy)}m</span>
							{/if}
						</div>
					{/each}
				</div>
			</div>
		{/if}

		<div class="meta">
			{#if (place.visitCount ?? 0) > 0}
				<span>{$_('places.detail_view.meta_visits', { values: { n: place.visitCount } })}</span>
			{/if}
			{#if place.lastVisitedAt}
				<span
					>{$_('places.detail_view.meta_last_visit', {
						values: { date: formatDate(place.lastVisitedAt) },
					})}</span
				>
			{/if}
			{#if place.createdAt}
				<span
					>{$_('places.detail_view.meta_created', {
						values: { date: new Date(place.createdAt).toLocaleDateString(get(locale) ?? 'de') },
					})}</span
				>
			{/if}
			{#if place.updatedAt}
				<span
					>{$_('places.detail_view.meta_updated', {
						values: { date: new Date(place.updatedAt).toLocaleDateString(get(locale) ?? 'de') },
					})}</span
				>
			{/if}
		</div>
	{/snippet}
</DetailViewShell>

<style>
	.profile-header {
		display: flex;
		align-items: center;
		gap: 0.75rem;
	}
	.place-avatar {
		width: 48px;
		height: 48px;
		border-radius: 9999px;
		background: hsl(var(--color-muted));
		color: hsl(var(--color-muted-foreground));
		display: flex;
		align-items: center;
		justify-content: center;
		flex-shrink: 0;
	}
	.name-fields {
		flex: 1;
		min-width: 0;
	}
	.name-input {
		width: 100%;
		font-size: 1rem;
		font-weight: 600;
		border: 1px solid transparent;
		background: transparent;
		outline: none;
		color: hsl(var(--color-foreground));
		padding: 0.125rem 0.25rem;
		border-radius: 0.25rem;
		transition: border-color 0.15s;
	}
	.name-input:hover,
	.name-input:focus {
		border-color: hsl(var(--color-border));
	}
	.map-container {
		border-radius: 0.5rem;
		overflow: hidden;
		border: 1px solid hsl(var(--color-border));
	}
	.fields {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
	.field-row {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.field-label {
		font-size: 0.75rem;
		color: hsl(var(--color-muted-foreground));
		min-width: 5.5rem;
		padding-top: 0.375rem;
	}
	.field-input,
	.field-select {
		flex: 1;
		min-width: 0;
		font-size: 0.8125rem;
		padding: 0.25rem 0.375rem;
		border-radius: 0.25rem;
		border: 1px solid transparent;
		background: transparent;
		color: hsl(var(--color-foreground));
		outline: none;
		text-align: right;
		transition: border-color 0.15s;
	}
	.field-input:hover,
	.field-input:focus,
	.field-select:hover,
	.field-select:focus {
		border-color: hsl(var(--color-border));
	}
	.field-input.small {
		max-width: 6rem;
	}
	.coords-row {
		display: flex;
		gap: 0.25rem;
		flex: 1;
		justify-content: flex-end;
		align-items: center;
	}

	.resolve-btn {
		padding: 0.25rem;
		border-radius: 0.25rem;
		border: 1px solid transparent;
		background: transparent;
		color: hsl(var(--color-muted-foreground));
		cursor: pointer;
		display: flex;
		align-items: center;
		transition: all 0.15s;
		flex-shrink: 0;
	}

	.resolve-btn:hover:not(:disabled) {
		color: #0ea5e9;
		border-color: hsl(var(--color-border));
	}

	.resolve-btn:disabled {
		opacity: 0.4;
		cursor: not-allowed;
	}

	.resolve-btn :global(.spinning) {
		animation: spin 0.8s linear infinite;
	}

	@keyframes spin {
		from {
			transform: rotate(0deg);
		}
		to {
			transform: rotate(360deg);
		}
	}

	/* ── Address Search (Detail) ─────────────── */
	.address-search-row {
		align-items: flex-start;
	}

	.address-search-wrapper {
		flex: 1;
		position: relative;
		min-width: 0;
	}

	.address-search-input-row {
		display: flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.1875rem 0.375rem;
		border-radius: 0.25rem;
		border: 1px solid transparent;
		color: hsl(var(--color-muted-foreground));
		transition: border-color 0.15s;
	}

	.address-search-input-row:focus-within {
		border-color: hsl(var(--color-border));
	}

	.address-search-input {
		flex: 1;
		border: none;
		background: transparent;
		color: hsl(var(--color-foreground));
		font-size: 0.75rem;
		outline: none;
		text-align: right;
	}

	.address-search-input::placeholder {
		color: hsl(var(--color-muted-foreground));
	}

	.address-suggestions {
		position: absolute;
		top: 100%;
		left: 0;
		right: 0;
		margin-top: 0.125rem;
		background: hsl(var(--color-background));
		border: 1px solid hsl(var(--color-border));
		border-radius: 0.375rem;
		box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
		z-index: 50;
		overflow: hidden;
	}

	.address-suggestion {
		display: flex;
		flex-direction: column;
		gap: 0.0625rem;
		padding: 0.375rem 0.5rem;
		width: 100%;
		border: none;
		background: transparent;
		color: hsl(var(--color-foreground));
		cursor: pointer;
		text-align: left;
		font-size: 0.75rem;
	}

	.address-suggestion:hover {
		background: hsl(var(--color-muted));
	}

	.address-suggestion + .address-suggestion {
		border-top: 1px solid hsl(var(--color-border) / 0.5);
	}

	.address-suggestion-name {
		font-weight: 500;
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.address-suggestion-detail {
		font-size: 0.6875rem;
		color: hsl(var(--color-muted-foreground));
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.tags-list {
		display: flex;
		flex-wrap: wrap;
		gap: 0.375rem;
	}
	.tag-pill {
		display: inline-flex;
		align-items: center;
		gap: 0.25rem;
		padding: 0.125rem 0.5rem;
		border-radius: 9999px;
		background: color-mix(in srgb, var(--tag-color) 12%, transparent);
		border: none;
		font-size: 0.6875rem;
		color: hsl(var(--color-muted-foreground));
		cursor: pointer;
	}
	.tag-pill:hover {
		opacity: 0.8;
	}
	.tag-dot {
		width: 6px;
		height: 6px;
		border-radius: 9999px;
	}
	.log-list {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.75rem;
	}
	.log-row {
		display: flex;
		justify-content: space-between;
		color: hsl(var(--color-muted-foreground));
	}
	.log-accuracy {
		color: hsl(var(--color-muted-foreground));
	}
</style>
