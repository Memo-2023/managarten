<script lang="ts">
	import { page } from '$app/state';
	import { _ } from 'svelte-i18n';
	import ResponsesView from '$lib/modules/forms/views/ResponsesView.svelte';
	import { useAllForms } from '$lib/modules/forms/queries';
	import { RoutePage } from '$lib/components/shell';

	const forms$ = useAllForms();
	const form = $derived(forms$.value.find((f) => f.id === page.params.id));
</script>

<svelte:head>
	<title>{$_('forms.responses.routeTitle', { default: 'Antworten' })} - Mana</title>
</svelte:head>

<RoutePage
	appId="forms"
	backHref={`/forms/${page.params.id}`}
	title={$_('forms.responses.routeTitle', { default: 'Antworten' })}
>
	{#if forms$.loading}
		<p class="state">{$_('forms.builder.loading', { default: 'Lade ...' })}</p>
	{:else if !form}
		<div class="state">
			<p>{$_('forms.builder.notFound', { default: 'Formular nicht gefunden.' })}</p>
			<a href="/forms">{$_('forms.builder.backLink', { default: '← Zurück zur Liste' })}</a>
		</div>
	{:else}
		<ResponsesView {form} />
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
