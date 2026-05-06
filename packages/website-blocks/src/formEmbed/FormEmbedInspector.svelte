<!--
  FormEmbedInspector — paste a Mana Forms share-token to embed an
  existing form. Future M-fancier: a form-picker that lists the user's
  published+unlisted forms with one-click selection. For M8 minimal, a
  text input + helper text pointing to /forms is enough.
-->
<script lang="ts">
	import type { BlockInspectorProps } from '../types';
	import type { FormEmbedProps } from './schema';

	let { block, onChange }: BlockInspectorProps<FormEmbedProps> = $props();

	const TOKEN_REGEX = /^[A-Za-z0-9_-]{32}$/;

	// svelte-ignore state_referenced_locally
	let tokenInput = $state(block.props.token);
	let tokenError = $state<string | null>(null);

	$effect(() => {
		// Re-sync when the block changes upstream (drag/clone).
		tokenInput = block.props.token;
	});

	function commitToken() {
		const trimmed = tokenInput.trim();
		if (!trimmed) {
			tokenError = null;
			onChange({ token: '', resolved: undefined });
			return;
		}
		if (!TOKEN_REGEX.test(trimmed)) {
			tokenError = 'Token muss 32 Zeichen lang sein (base64url)';
			return;
		}
		tokenError = null;
		// Reset resolved on token change — the publish-resolver re-fills.
		onChange({ token: trimmed, resolved: undefined });
	}

	function onTitleInput(e: Event) {
		onChange({ titleOverride: (e.currentTarget as HTMLInputElement).value });
	}

	const resolved = $derived(block.props.resolved);
</script>

<div class="wb-inspector">
	<label class="wb-field">
		<span>Mana-Form Share-Token</span>
		<input
			type="text"
			class="wb-mono"
			value={tokenInput}
			oninput={(e) => (tokenInput = (e.currentTarget as HTMLInputElement).value)}
			onblur={commitToken}
			placeholder="32-Zeichen base64url Token"
		/>
		{#if tokenError}
			<small class="wb-error">{tokenError}</small>
		{:else}
			<small class="wb-hint">
				Erstelle ein Formular unter /forms, setze die Sichtbarkeit auf "unlisted" und kopiere den
				Token aus dem Share-Link.
			</small>
		{/if}
	</label>

	{#if resolved}
		<div class="wb-resolved">
			<p class="wb-resolved-label">Aufgelöstes Formular:</p>
			<p class="wb-resolved-title">{resolved.formTitle || '(ohne Titel)'}</p>
			<p class="wb-hint">
				{resolved.fields.length} Feld{resolved.fields.length === 1 ? '' : 'er'}
				{#if resolved.branching.length > 0}
					· {resolved.branching.length} Logik-Regel{resolved.branching.length === 1 ? '' : 'n'}
				{/if}
			</p>
			{#if resolved.error}
				<p class="wb-error">{resolved.error}</p>
			{/if}
		</div>
	{/if}

	<label class="wb-field">
		<span>Titel-Override <small class="wb-hint">(optional)</small></span>
		<input
			type="text"
			value={block.props.titleOverride}
			oninput={onTitleInput}
			placeholder={resolved?.formTitle ?? 'Formular-Titel überschreiben'}
		/>
		<small class="wb-hint"> Leer lassen → der Titel des Mana-Formulars wird verwendet. </small>
	</label>
</div>

<style>
	.wb-inspector {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 0.75rem;
	}
	.wb-field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.8125rem;
	}
	.wb-field > span {
		font-weight: 500;
	}
	.wb-field input {
		padding: 0.5rem 0.625rem;
		border-radius: 0.375rem;
		border: 1px solid rgba(127, 127, 127, 0.3);
		background: rgba(255, 255, 255, 0.04);
		color: inherit;
		font-size: 0.875rem;
		font-family: inherit;
	}
	.wb-mono {
		font-family: ui-monospace, monospace;
	}
	.wb-hint {
		font-size: 0.75rem;
		opacity: 0.65;
	}
	.wb-error {
		font-size: 0.75rem;
		color: rgb(220, 38, 38);
	}
	.wb-resolved {
		padding: 0.625rem 0.75rem;
		background: rgba(127, 127, 127, 0.06);
		border: 1px solid rgba(127, 127, 127, 0.2);
		border-radius: 0.375rem;
	}
	.wb-resolved-label {
		margin: 0 0 0.25rem;
		font-size: 0.6875rem;
		text-transform: uppercase;
		letter-spacing: 0.04em;
		opacity: 0.5;
	}
	.wb-resolved-title {
		margin: 0;
		font-size: 0.9375rem;
		font-weight: 500;
	}
</style>
