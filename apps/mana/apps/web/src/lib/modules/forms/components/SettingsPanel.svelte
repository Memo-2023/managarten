<!--
  SettingsPanel — form-level settings (submit button, success message,
  email-required, multiple-submissions, auto-sync). Visibility/share
  controls leben in BuilderView, das @mana/shared-privacy direkt nutzt.
-->
<script lang="ts">
	import { _ } from 'svelte-i18n';
	import type { AutoSyncTarget, FormField, FormSettings } from '../types';

	let {
		settings,
		fields,
		onchange,
	}: {
		settings: FormSettings;
		fields: FormField[];
		onchange: (patch: Partial<FormSettings>) => void;
	} = $props();

	// v1: nur 'contacts' implementiert (M7a). Andere Targets sind
	// strukturell vorgesehen, aber die dispatchTarget-Branch wirft —
	// wir filtern sie aus dem UI raus, bis M7b sie scharfschaltet.
	const SUPPORTED_TARGETS: AutoSyncTarget[] = ['contacts'];

	const CONTACT_KEYS = [
		'name',
		'firstName',
		'lastName',
		'email',
		'phone',
		'mobile',
		'company',
		'jobTitle',
		'street',
		'city',
		'postalCode',
		'country',
		'birthday',
		'website',
		'notes',
	] as const;
	type ContactKey = (typeof CONTACT_KEYS)[number];

	function contactKeyLabel(key: ContactKey): string {
		switch (key) {
			case 'name':
				return $_('forms.builder.autoSync.contactKey.name', {
					default: 'Vor- + Nachname (auto split)',
				});
			case 'firstName':
				return 'Vorname';
			case 'lastName':
				return 'Nachname';
			case 'email':
				return 'E-Mail';
			case 'phone':
				return 'Telefon (Festnetz)';
			case 'mobile':
				return 'Mobil';
			case 'company':
				return 'Firma';
			case 'jobTitle':
				return 'Rolle / Position';
			case 'street':
				return 'Straße';
			case 'city':
				return 'Ort';
			case 'postalCode':
				return 'PLZ';
			case 'country':
				return 'Land';
			case 'birthday':
				return 'Geburtstag';
			case 'website':
				return 'Website';
			case 'notes':
				return 'Notiz';
		}
	}

	const ANSWER_FIELDS = $derived(
		fields.filter((f) => f.type !== 'section' && f.type !== 'consent')
	);

	const target = $derived<AutoSyncTarget | 'none'>(settings.autoSync?.target ?? 'none');
	const mapping = $derived(settings.autoSync?.mapping ?? {});

	function setTarget(next: AutoSyncTarget | 'none') {
		if (next === 'none') {
			onchange({ autoSync: undefined });
		} else {
			onchange({
				autoSync: {
					target: next,
					mapping: settings.autoSync?.mapping ?? {},
				},
			});
		}
	}

	function setMappingFor(fieldId: string, contactKey: ContactKey | '') {
		const next = { ...mapping };
		if (!contactKey) {
			delete next[fieldId];
		} else {
			next[fieldId] = contactKey;
		}
		const t = settings.autoSync?.target ?? 'contacts';
		onchange({ autoSync: { target: t, mapping: next } });
	}
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

	<div class="auto-sync-block">
		<p class="block-title">
			{$_('forms.builder.autoSync.title', { default: 'Auto-Sync — bei Antwort erzeugen' })}
		</p>

		<select
			class="target-select"
			value={target}
			onchange={(e) =>
				setTarget((e.currentTarget as HTMLSelectElement).value as AutoSyncTarget | 'none')}
		>
			<option value="none">
				{$_('forms.builder.autoSync.targetNone', { default: 'Nichts' })}
			</option>
			{#each SUPPORTED_TARGETS as t}
				<option value={t}>
					{t === 'contacts'
						? $_('forms.builder.autoSync.targetContacts', { default: 'Kontakt' })
						: t}
				</option>
			{/each}
		</select>

		{#if target === 'contacts'}
			{#if ANSWER_FIELDS.length === 0}
				<p class="hint">
					{$_('forms.builder.autoSync.needFields', {
						default: 'Lege mindestens ein Antwortfeld an, um Mapping zu konfigurieren.',
					})}
				</p>
			{:else}
				<p class="hint">
					{$_('forms.builder.autoSync.contactsHint', {
						default:
							'Wähle für jedes Form-Feld, welches Kontakt-Feld es füllen soll. Leerlassen = ignorieren.',
					})}
				</p>
				<div class="mapping-grid">
					{#each ANSWER_FIELDS as f (f.id)}
						<div class="mapping-row">
							<span class="form-field-label" title={f.label}>{f.label}</span>
							<select
								class="contact-key-select"
								value={mapping[f.id] ?? ''}
								onchange={(e) =>
									setMappingFor(
										f.id,
										(e.currentTarget as HTMLSelectElement).value as ContactKey | ''
									)}
							>
								<option value="">
									{$_('forms.builder.autoSync.ignore', { default: 'Ignorieren' })}
								</option>
								{#each CONTACT_KEYS as ck}
									<option value={ck}>{contactKeyLabel(ck)}</option>
								{/each}
							</select>
						</div>
					{/each}
				</div>
			{/if}
		{/if}
	</div>
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

	.auto-sync-block {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		margin-top: 0.5rem;
		padding-top: 0.625rem;
		border-top: 1px solid rgb(255 255 255 / 0.06);
	}

	.block-title {
		margin: 0 0 0.25rem;
		font-size: 0.6875rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: rgb(255 255 255 / 0.45);
	}

	.target-select {
		max-width: 240px;
		padding: 0.375rem 0.625rem;
		background: rgb(255 255 255 / 0.04);
		border: 1px solid rgb(255 255 255 / 0.08);
		border-radius: 0.375rem;
		color: inherit;
		font-size: 0.8125rem;
	}

	.hint {
		margin: 0;
		font-size: 0.75rem;
		color: rgb(255 255 255 / 0.5);
	}

	.mapping-grid {
		display: flex;
		flex-direction: column;
		gap: 0.375rem;
	}

	.mapping-row {
		display: grid;
		grid-template-columns: 1fr auto;
		gap: 0.5rem;
		align-items: center;
	}

	.form-field-label {
		font-size: 0.8125rem;
		color: rgb(255 255 255 / 0.75);
		overflow: hidden;
		text-overflow: ellipsis;
		white-space: nowrap;
	}

	.contact-key-select {
		min-width: 200px;
		padding: 0.25rem 0.5rem;
		background: rgb(255 255 255 / 0.04);
		border: 1px solid rgb(255 255 255 / 0.08);
		border-radius: 0.25rem;
		color: inherit;
		font-size: 0.8125rem;
	}
</style>
