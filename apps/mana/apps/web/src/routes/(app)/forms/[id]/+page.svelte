<script lang="ts">
	import { page } from '$app/state';
	import { _ } from 'svelte-i18n';
	import BuilderView from '$lib/modules/forms/views/BuilderView.svelte';
	import { useAllForms } from '$lib/modules/forms/queries';
	import { RoutePage } from '$lib/components/shell';

	const forms$ = useAllForms();
	const entry = $derived(forms$.value.find((f) => f.id === page.params.id));
</script>

<svelte:head>
	<title
		>{entry?.title ?? $_('forms.builder.routeTitle', { default: 'Formular bearbeiten' })} - Mana</title
	>
</svelte:head>

<RoutePage
	appId="forms"
	backHref="/forms"
	title={$_('forms.builder.routeTitle', { default: 'Formular bearbeiten' })}
>
	{#if forms$.loading}
		<p class="state">{$_('forms.builder.loading', { default: 'Lade ...' })}</p>
	{:else if !entry}
		<div class="state">
			<p>{$_('forms.builder.notFound', { default: 'Formular nicht gefunden.' })}</p>
			<a href="/forms">{$_('forms.builder.backLink', { default: '← Zurück zur Liste' })}</a>
		</div>
	{:else}
		<BuilderView {entry} />
	{/if}
</RoutePage>

<style>
	.state {
		text-align: center;
		padding: 3rem 1rem;
		color: rgb(255 255 255 / 0.5);
	}

	.state a {
		display: inline-block;
		margin-top: 0.5rem;
		color: rgb(94 234 212);
		text-decoration: none;
	}
</style>
