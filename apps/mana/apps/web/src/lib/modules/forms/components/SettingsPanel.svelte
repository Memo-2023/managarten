<!--
  SettingsPanel — form-level settings (submit button, success message,
  email-required, multiple-submissions). The visibility/share controls
  land in M4 alongside the @mana/shared-privacy wiring.
-->
<script lang="ts">
	import { _ } from 'svelte-i18n';
	import type { FormSettings } from '../types';

	let {
		settings,
		onchange,
	}: {
		settings: FormSettings;
		onchange: (patch: Partial<FormSettings>) => void;
	} = $props();
</script>

<div class="settings-panel">
	<p class="panel-title">
		{$_('forms.builder.settings.title', { default: 'Einstellungen' })}
	</p>

	<label class="setting-row">
		<span class="setting-label">
			{$_('forms.builder.settings.submitLabel', { default: 'Beschriftung Absenden-Button' })}
		</span>
		<input
			type="text"
			value={settings.submitButtonLabel}
			onblur={(e) =>
				onchange({
					submitButtonLabel: (e.currentTarget as HTMLInputElement).value.trim() || 'Senden',
				})}
		/>
	</label>

	<label class="setting-row">
		<span class="setting-label">
			{$_('forms.builder.settings.successMessage', {
				default: 'Bestätigungstext nach Absenden',
			})}
		</span>
		<textarea
			rows="2"
			value={settings.successMessage}
			onblur={(e) =>
				onchange({
					successMessage: (e.currentTarget as HTMLTextAreaElement).value.trim() || 'Danke!',
				})}
		></textarea>
	</label>

	<label class="setting-toggle">
		<input
			type="checkbox"
			checked={settings.requireEmail}
			onchange={(e) => onchange({ requireEmail: (e.currentTarget as HTMLInputElement).checked })}
		/>
		<span>
			{$_('forms.builder.settings.requireEmail', {
				default: 'E-Mail-Adresse vom Absender abfragen',
			})}
		</span>
	</label>

	<label class="setting-toggle">
		<input
			type="checkbox"
			checked={settings.allowMultipleSubmissions}
			onchange={(e) =>
				onchange({
					allowMultipleSubmissions: (e.currentTarget as HTMLInputElement).checked,
				})}
		/>
		<span>
			{$_('forms.builder.settings.allowMultiple', {
				default: 'Mehrere Antworten pro Person erlauben',
			})}
		</span>
	</label>

	<label class="setting-toggle">
		<input
			type="checkbox"
			checked={settings.anonymous}
			onchange={(e) => onchange({ anonymous: (e.currentTarget as HTMLInputElement).checked })}
		/>
		<span>
			{$_('forms.builder.settings.anonymous', {
				default: 'Anonym — Submitter-Daten nicht speichern',
			})}
		</span>
	</label>
</div>

<style>
	.settings-panel {
		display: flex;
		flex-direction: column;
		gap: 0.75rem;
		padding: 0.875rem;
		background: rgb(255 255 255 / 0.03);
		border: 1px solid rgb(255 255 255 / 0.06);
		border-radius: 0.5rem;
	}

	.panel-title {
		margin: 0 0 0.25rem;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: rgb(255 255 255 / 0.5);
	}

	.setting-row {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}

	.setting-label {
		font-size: 0.75rem;
		color: rgb(255 255 255 / 0.55);
	}

	.setting-row input,
	.setting-row textarea {
		padding: 0.5rem 0.625rem;
		background: rgb(255 255 255 / 0.04);
		border: 1px solid rgb(255 255 255 / 0.08);
		border-radius: 0.375rem;
		color: inherit;
		font-size: 0.875rem;
		resize: vertical;
		font-family: inherit;
	}

	.setting-toggle {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.875rem;
		color: rgb(255 255 255 / 0.8);
		cursor: pointer;
	}
</style>
