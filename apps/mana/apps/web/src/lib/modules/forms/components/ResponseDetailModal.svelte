<!--
  ResponseDetailModal — full answer view for one submission. Click-
  outside or ESC closes.
-->
<script lang="ts">
	import { _ } from 'svelte-i18n';
	import { responsesStore } from '../stores/responses.svelte';
	import { RESPONSE_STATUS_LABELS } from '../types';
	import type { Form, FormResponse, ResponseStatus, AnswerValue } from '../types';

	let {
		form,
		response,
		onclose,
	}: {
		form: Form;
		response: FormResponse;
		onclose: () => void;
	} = $props();

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'Escape') onclose();
	}

	function formatAnswer(value: AnswerValue | undefined): string {
		if (value === null || value === undefined) return '—';
		if (Array.isArray(value)) return value.length > 0 ? value.join(', ') : '—';
		if (typeof value === 'boolean') {
			return value
				? $_('forms.responses.detail.yes', { default: 'Ja' })
				: $_('forms.responses.detail.no', { default: 'Nein' });
		}
		const str = String(value);
		return str.length > 0 ? str : '—';
	}

	async function setStatus(status: ResponseStatus) {
		await responsesStore.setStatus(response.id, status);
	}

	async function handleDelete() {
		const ok = confirm(
			$_('forms.responses.detail.deleteConfirm', {
				default: 'Diese Antwort wirklich löschen?',
			})
		);
		if (!ok) return;
		await responsesStore.deleteResponse(response.id);
		onclose();
	}
</script>

<svelte:window onkeydown={handleKeydown} />

<button
	type="button"
	class="backdrop"
	onclick={onclose}
	aria-label={$_('forms.responses.detail.closeAria', { default: 'Modal schließen' })}
></button>

<div class="modal" role="dialog" aria-modal="true">
	<header class="modal-header">
		<div>
			<h2>{$_('forms.responses.detail.title', { default: 'Antwort' })}</h2>
			<p class="submitted-at">{response.submittedAt}</p>
		</div>
		<button
			type="button"
			class="close"
			onclick={onclose}
			aria-label={$_('forms.responses.detail.closeAria', { default: 'Modal schließen' })}>×</button
		>
	</header>

	<div class="status-row">
		{#each Object.keys(RESPONSE_STATUS_LABELS) as st}
			<button
				type="button"
				class="status-pill"
				class:active={response.status === st}
				data-status={st}
				onclick={() => setStatus(st as ResponseStatus)}
			>
				{RESPONSE_STATUS_LABELS[st as ResponseStatus].de}
			</button>
		{/each}
	</div>

	{#if response.submitterName || response.submitterEmail}
		<section class="submitter">
			<p class="submitter-line">
				{#if response.submitterName}
					<strong>{response.submitterName}</strong>
				{/if}
				{#if response.submitterEmail}
					<span class="email">{response.submitterEmail}</span>
				{/if}
			</p>
		</section>
	{/if}

	<section class="answers">
		{#each form.fields as field (field.id)}
			{#if field.type !== 'section'}
				<div class="answer-row">
					<p class="field-label">
						{field.label}
						{#if field.required}<span class="required-mark">*</span>{/if}
					</p>
					<p class="answer-value">{formatAnswer(response.answers[field.id])}</p>
				</div>
			{:else}
				<hr class="section-divider" />
				<p class="section-label">{field.label}</p>
			{/if}
		{/each}
	</section>

	<footer class="modal-footer">
		<button type="button" class="delete" onclick={handleDelete}>
			{$_('forms.responses.detail.delete', { default: 'Löschen' })}
		</button>
	</footer>
</div>

<style>
	.backdrop {
		position: fixed;
		inset: 0;
		background: rgb(0 0 0 / 0.5);
		border: none;
		cursor: pointer;
		z-index: 50;
	}

	.modal {
		position: fixed;
		top: 50%;
		left: 50%;
		transform: translate(-50%, -50%);
		width: min(720px, calc(100vw - 2rem));
		max-height: calc(100vh - 4rem);
		overflow: auto;
		background: rgb(15 15 18);
		border: 1px solid rgb(255 255 255 / 0.1);
		border-radius: 0.75rem;
		padding: 1.25rem;
		display: flex;
		flex-direction: column;
		gap: 1rem;
		z-index: 51;
		color: inherit;
	}

	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		gap: 0.5rem;
	}

	.modal-header h2 {
		margin: 0;
		font-size: 1rem;
		font-weight: 600;
	}

	.submitted-at {
		margin: 0.25rem 0 0;
		font-size: 0.75rem;
		color: rgb(255 255 255 / 0.5);
		font-variant-numeric: tabular-nums;
	}

	.close {
		width: 2rem;
		height: 2rem;
		padding: 0;
		display: inline-flex;
		justify-content: center;
		align-items: center;
		background: transparent;
		border: 1px solid rgb(255 255 255 / 0.1);
		border-radius: 0.375rem;
		color: rgb(255 255 255 / 0.6);
		font-size: 1.25rem;
		cursor: pointer;
	}

	.close:hover {
		background: rgb(255 255 255 / 0.06);
	}

	.status-row {
		display: flex;
		gap: 0.25rem;
		flex-wrap: wrap;
	}

	.status-pill {
		padding: 0.25rem 0.625rem;
		background: rgb(255 255 255 / 0.04);
		border: 1px solid rgb(255 255 255 / 0.08);
		border-radius: 0.375rem;
		color: rgb(255 255 255 / 0.55);
		font-size: 0.75rem;
		cursor: pointer;
	}

	.status-pill:hover {
		background: rgb(255 255 255 / 0.07);
	}

	.status-pill.active[data-status='new'] {
		background: rgb(20 184 166 / 0.18);
		color: rgb(94 234 212);
		border-color: rgb(20 184 166 / 0.4);
	}

	.status-pill.active[data-status='reviewed'] {
		background: rgb(255 255 255 / 0.1);
		color: rgb(255 255 255 / 0.85);
		border-color: rgb(255 255 255 / 0.2);
	}

	.status-pill.active[data-status='archived'] {
		background: rgb(255 255 255 / 0.04);
		color: rgb(255 255 255 / 0.4);
		border-color: rgb(255 255 255 / 0.1);
	}

	.status-pill.active[data-status='spam'] {
		background: rgb(248 113 113 / 0.18);
		color: rgb(252 165 165);
		border-color: rgb(248 113 113 / 0.4);
	}

	.submitter {
		padding: 0.625rem 0.875rem;
		background: rgb(255 255 255 / 0.03);
		border: 1px solid rgb(255 255 255 / 0.06);
		border-radius: 0.5rem;
	}

	.submitter-line {
		margin: 0;
		display: flex;
		gap: 0.5rem;
		flex-wrap: wrap;
		align-items: baseline;
		font-size: 0.875rem;
	}

	.email {
		color: rgb(255 255 255 / 0.6);
		font-size: 0.8125rem;
	}

	.answers {
		display: flex;
		flex-direction: column;
		gap: 0.875rem;
	}

	.answer-row {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.field-label {
		margin: 0;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		color: rgb(255 255 255 / 0.5);
	}

	.required-mark {
		color: rgb(248 113 113);
		margin-left: 0.125rem;
	}

	.answer-value {
		margin: 0;
		font-size: 0.9375rem;
		white-space: pre-wrap;
		word-break: break-word;
	}

	.section-divider {
		border: none;
		border-top: 1px solid rgb(255 255 255 / 0.06);
		margin: 0.5rem 0 0;
	}

	.section-label {
		margin: 0;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: rgb(255 255 255 / 0.4);
	}

	.modal-footer {
		display: flex;
		justify-content: flex-end;
	}

	.delete {
		padding: 0.375rem 0.75rem;
		background: transparent;
		border: 1px solid rgb(255 255 255 / 0.1);
		border-radius: 0.375rem;
		color: rgb(255 255 255 / 0.55);
		font-size: 0.8125rem;
		cursor: pointer;
	}

	.delete:hover {
		color: rgb(248 113 113);
		border-color: rgb(248 113 113 / 0.4);
	}
</style>
