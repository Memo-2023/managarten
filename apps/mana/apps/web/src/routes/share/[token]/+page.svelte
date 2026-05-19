<!--
  Share-Link dispatcher. Picks the per-collection render component.
  All data lives on `data.blob` — whatever the resolver put there is
  what the view consumes, no Dexie roundtrips.
-->
<script lang="ts">
	import SharedEventView from '$lib/modules/calendar/SharedEventView.svelte';
	import SharedLibraryEntryView from '$lib/modules/library/SharedLibraryEntryView.svelte';
	import SharedAugurEntryView from '$lib/modules/augur/SharedAugurEntryView.svelte';
	import SharedLastView from '$lib/modules/lasts/SharedLastView.svelte';
	import SharedFormView from '$lib/modules/forms/SharedFormView.svelte';
	import ConversationFormView from '$lib/modules/forms/ConversationFormView.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// M9 — pick the form-render variant from the snapshot's experience
	// flag. Default 'classic' so existing forms keep their look.
	const formExperience = $derived(
		data.collection === 'forms'
			? (((data.blob as Record<string, unknown> | undefined)?.experience as
					| 'classic'
					| 'conversation'
					| undefined) ?? 'classic')
			: 'classic'
	);
</script>

{#if data.collection === 'events'}
	<SharedEventView blob={data.blob} token={data.token} expiresAt={data.expiresAt} />
{:else if data.collection === 'libraryEntries'}
	<SharedLibraryEntryView blob={data.blob} token={data.token} expiresAt={data.expiresAt} />
{:else if data.collection === 'augurEntries'}
	<SharedAugurEntryView blob={data.blob} token={data.token} expiresAt={data.expiresAt} />
{:else if data.collection === 'lasts'}
	<SharedLastView blob={data.blob} token={data.token} expiresAt={data.expiresAt} />
{:else if data.collection === 'forms'}
	{#if formExperience === 'conversation'}
		<ConversationFormView blob={data.blob} token={data.token} expiresAt={data.expiresAt} />
	{:else}
		<SharedFormView blob={data.blob} token={data.token} expiresAt={data.expiresAt} />
	{/if}
{:else}
	<div class="unknown">
		<h1>Unbekannter Link-Typ</h1>
		<p>Diese Art von geteiltem Inhalt wird von dieser Mana-Version nicht unterstützt.</p>
	</div>
{/if}

<style>
	.unknown {
		text-align: center;
		padding: 3rem 1rem;
	}
	.unknown h1 {
		font-size: 1.25rem;
		margin: 0 0 0.5rem;
	}
	.unknown p {
		margin: 0;
		color: #6b7280;
	}
</style>
