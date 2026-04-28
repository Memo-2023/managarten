<!--
  Forms — Workbench ListView (M1 skeleton)

  Renders the active Space's forms with an empty-state for new Spaces
  and a Quick-Create input. Builder + responses views land in M2/M3.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { _ } from 'svelte-i18n';
	import ScopeEmptyState from '$lib/components/workbench/ScopeEmptyState.svelte';
	import { hasActiveSceneScope } from '$lib/stores/scene-scope.svelte';
	import { useAllForms, searchForms } from './queries';
	import { formsStore } from './stores/forms.svelte';
	import { FORM_STATUS_LABELS } from './types';
	import type { Form } from './types';
	import type { ViewProps } from '$lib/app-registry';

	let { navigate: _navigate, goBack: _goBack, params: _params }: ViewProps = $props();

	const forms$ = useAllForms();
	const forms = $derived(forms$.value);

	let searchQuery = $state('');
	const filtered = $derived(searchForms(forms, searchQuery));

	let newTitle = $state('');

	async function handleQuickCreate(e: KeyboardEvent) {
		if (e.key !== 'Enter' || !newTitle.trim()) return;
		e.preventDefault();
		const title = newTitle.trim();
		newTitle = '';
		const created = await formsStore.createForm({ title });
		goto(`/forms/${created.id}`);
	}

	function openForm(form: Form) {
		goto(`/forms/${form.id}`);
	}

	function relativeTime(iso: string): string {
		const diffMs = Date.now() - new Date(iso).getTime();
		const minutes = Math.round(diffMs / 60000);
		if (minutes < 1) return $_('forms.list.justNow', { default: 'gerade eben' });
		if (minutes < 60)
			return $_('forms.list.minutesAgo', {
				default: 'vor {n} min',
				values: { n: minutes },
			});
		const hours = Math.round(minutes / 60);
		if (hours < 24)
			return $_('forms.list.hoursAgo', {
				default: 'vor {n} h',
				values: { n: hours },
			});
		const days = Math.round(hours / 24);
		return $_('forms.list.daysAgo', {
			default: 'vor {n} Tagen',
			values: { n: days },
		});
	}
</script>

<div class="forms-shell">
	<header class="forms-header">
		<h1>{$_('forms.app.title', { default: 'Formulare' })}</h1>
		<p class="tagline">
			{$_('forms.app.tagline', {
				default: 'Eigene Formulare bauen und Antworten sammeln.',
			})}
		</p>
	</header>

	<div class="quick-create">
		<input
			type="text"
			bind:value={newTitle}
			onkeydown={handleQuickCreate}
			placeholder={$_('forms.quickAdd.placeholder', {
				default: 'Neues Formular ... (Enter)',
			})}
			aria-label={$_('forms.quickAdd.ariaLabel', { default: 'Formular-Titel' })}
		/>
	</div>

	<div class="search-row">
		<input
			type="search"
			class="search"
			bind:value={searchQuery}
			placeholder={$_('forms.list.searchPlaceholder', { default: 'Formulare durchsuchen ...' })}
		/>
	</div>

	{#if filtered.length === 0}
		{#if hasActiveSceneScope()}
			<ScopeEmptyState label={$_('forms.app.title', { default: 'Formulare' })} />
		{:else if forms.length === 0}
			<div class="empty-state">
				<p class="empty-title">
					{$_('forms.list.emptyAll', { default: 'Noch keine Formulare angelegt.' })}
				</p>
				<p class="empty-hint">
					{$_('forms.list.emptyHint', {
						default: 'Tipp: Tippe oben einen Titel und drücke Enter.',
					})}
				</p>
			</div>
		{:else}
			<div class="empty-state">
				<p class="empty-title">
					{$_('forms.list.emptySearch', { default: 'Keine Treffer für deine Suche.' })}
				</p>
			</div>
		{/if}
	{:else}
		<ul class="form-list">
			{#each filtered as form (form.id)}
				<button
					type="button"
					class="form-card"
					onclick={() => openForm(form)}
					aria-label={form.title}
				>
					<span class="status-pill status-{form.status}">
						{FORM_STATUS_LABELS[form.status].de}
					</span>
					<span class="title">{form.title}</span>
					{#if form.description}
						<span class="description">{form.description}</span>
					{/if}
					<span class="meta">
						<span class="field-count">
							{$_('forms.list.fieldCount', {
								default: '{n} Felder',
								values: { n: form.fields.length },
							})}
						</span>
						<span class="response-count">
							{$_('forms.list.responseCount', {
								default: '{n} Antworten',
								values: { n: form.responseCount },
							})}
						</span>
						<span class="updated">{relativeTime(form.updatedAt)}</span>
					</span>
				</button>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.forms-shell {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1rem;
		max-width: 880px;
		margin: 0 auto;
	}

	.forms-header h1 {
		font-size: 1.25rem;
		font-weight: 600;
		margin: 0;
	}

	.tagline {
		color: rgb(255 255 255 / 0.6);
		font-size: 0.875rem;
		margin: 0.25rem 0 0;
	}

	.quick-create input,
	.search {
		width: 100%;
		padding: 0.625rem 0.875rem;
		background: rgb(255 255 255 / 0.04);
		border: 1px solid rgb(255 255 255 / 0.08);
		border-radius: 0.5rem;
		color: inherit;
		font-size: 0.9375rem;
	}

	.quick-create input:focus,
	.search:focus {
		outline: none;
		border-color: rgb(255 255 255 / 0.2);
	}

	.empty-state {
		text-align: center;
		padding: 3rem 1rem;
		color: rgb(255 255 255 / 0.5);
	}

	.empty-title {
		font-size: 0.9375rem;
		margin: 0 0 0.5rem;
	}

	.empty-hint {
		font-size: 0.8125rem;
		color: rgb(255 255 255 / 0.4);
		margin: 0;
	}

	.form-list {
		list-style: none;
		padding: 0;
		margin: 0;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.form-card {
		display: grid;
		grid-template-columns: auto 1fr;
		grid-template-rows: auto auto auto;
		grid-template-areas: 'pill title' '. description' '. meta';
		gap: 0.25rem 0.75rem;
		padding: 0.875rem 1rem;
		background: rgb(255 255 255 / 0.03);
		border: 1px solid rgb(255 255 255 / 0.06);
		border-radius: 0.5rem;
		text-align: left;
		color: inherit;
		cursor: pointer;
	}

	.form-card:hover {
		background: rgb(255 255 255 / 0.05);
		border-color: rgb(255 255 255 / 0.12);
	}

	.status-pill {
		grid-area: pill;
		align-self: start;
		padding: 0.125rem 0.5rem;
		border-radius: 0.25rem;
		font-size: 0.6875rem;
		font-weight: 500;
		text-transform: uppercase;
		letter-spacing: 0.04em;
	}

	.status-draft {
		background: rgb(255 255 255 / 0.08);
		color: rgb(255 255 255 / 0.7);
	}

	.status-published {
		background: rgb(20 184 166 / 0.18);
		color: rgb(94 234 212);
	}

	.status-closed {
		background: rgb(255 255 255 / 0.06);
		color: rgb(255 255 255 / 0.45);
	}

	.title {
		grid-area: title;
		font-weight: 500;
		font-size: 0.9375rem;
	}

	.description {
		grid-area: description;
		color: rgb(255 255 255 / 0.55);
		font-size: 0.8125rem;
	}

	.meta {
		grid-area: meta;
		display: flex;
		gap: 0.75rem;
		color: rgb(255 255 255 / 0.45);
		font-size: 0.75rem;
	}
</style>
