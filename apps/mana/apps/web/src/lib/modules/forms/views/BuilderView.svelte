<!--
  Forms — BuilderView (M2)

  Edits the title, description, fields, and settings of a single form.
  Saves on blur (text fields) or change (settings, field-edits, drag-
  reorder). The store is the source of truth — local state mirrors
  `entry` and re-syncs whenever a different form id loads in.
-->
<script lang="ts">
	import { goto } from '$app/navigation';
	import { _ } from 'svelte-i18n';
	import { dndzone, SOURCES } from 'svelte-dnd-action';
	import { flip } from 'svelte/animate';
	import { formsStore } from '../stores/forms.svelte';
	import { FORM_STATUS_LABELS } from '../types';
	import type { BranchingRule, Form, FormField, FormSettings, FormStatus } from '../types';
	import { makeDefaultField } from '../lib/field-defaults';
	import FieldEditor from '../components/FieldEditor.svelte';
	import FieldPalette from '../components/FieldPalette.svelte';
	import SettingsPanel from '../components/SettingsPanel.svelte';
	import BranchingEditor from '../components/BranchingEditor.svelte';
	import { buildWaveMailto, isWaveDue, nextWaveDueAt } from '../lib/wave';
	import { sendWaveViaBulkMail, WavePreconditionError } from '../lib/wave-mail';
	import { computeCohort } from '../lib/cohort';
	import { decryptRecord } from '$lib/data/crypto';
	import {
		settingsTable,
		BROADCAST_SETTINGS_ID,
		toSettings,
	} from '$lib/modules/broadcasts/queries';
	import type { LocalBroadcastSettings, BroadcastSettings } from '$lib/modules/broadcasts/types';
	import {
		VisibilityPicker,
		SharedLinkControls,
		buildShareUrl,
		type VisibilityLevel,
	} from '@mana/shared-privacy';

	let { entry }: { entry: Form } = $props();

	/* svelte-ignore state_referenced_locally */
	let title = $state(entry.title);
	/* svelte-ignore state_referenced_locally */
	let description = $state(entry.description ?? '');
	/* svelte-ignore state_referenced_locally */
	let items = $state<FormField[]>(entry.fields.slice());

	/* svelte-ignore state_referenced_locally */
	let lastSeenId = $state(entry.id);
	$effect(() => {
		if (entry.id !== lastSeenId) {
			lastSeenId = entry.id;
			title = entry.title;
			description = entry.description ?? '';
			items = entry.fields.slice();
		}
	});

	// Re-sync the field array when an upstream change rewrites it
	// (server pull, autosave from another tab) — guard against
	// clobbering an in-progress drag by comparing ids only.
	$effect(() => {
		const upstreamIds = entry.fields.map((f) => f.id).join(',');
		const localIds = items.map((f) => f.id).join(',');
		if (upstreamIds !== localIds) {
			items = entry.fields.slice();
		}
	});

	async function saveTitle() {
		const next = title.trim();
		if (next && next !== entry.title) {
			await formsStore.updateForm(entry.id, { title: next });
		} else if (!next) {
			title = entry.title;
		}
	}

	async function saveDescription() {
		const next = description.trim();
		const current = entry.description ?? '';
		if (next !== current) {
			await formsStore.updateForm(entry.id, { description: next.length > 0 ? next : null });
		}
	}

	async function patchField(fieldId: string, patch: Partial<FormField>) {
		// Update local state optimistically so type-changes etc. render
		// without round-tripping through the store. The store update
		// then lands in the next live-query tick.
		items = items.map((f) => (f.id === fieldId ? { ...f, ...patch, id: f.id } : f));
		await formsStore.updateField(entry.id, fieldId, patch);
	}

	async function removeField(fieldId: string) {
		items = items.filter((f) => f.id !== fieldId);
		await formsStore.removeField(entry.id, fieldId);
	}

	async function pickField(type: FormField['type']) {
		const field = makeDefaultField(type);
		items = [...items, field];
		await formsStore.addField(entry.id, field);
	}

	function handleDndConsider(e: CustomEvent<{ items: FormField[] }>) {
		items = e.detail.items;
	}

	async function handleDndFinalize(
		e: CustomEvent<{ items: FormField[]; info: { source: string } }>
	) {
		items = e.detail.items;
		if (e.detail.info.source === SOURCES.POINTER) {
			await formsStore.reorderFields(
				entry.id,
				items.map((f) => f.id)
			);
		}
	}

	async function patchSettings(patch: Partial<FormSettings>) {
		await formsStore.updateForm(entry.id, {
			settings: { ...entry.settings, ...patch },
		});
	}

	async function patchBranching(next: BranchingRule[]) {
		await formsStore.updateBranching(entry.id, next);
	}

	// ── Visibility / Share-Link ────────────────────────────
	let visibilityError = $state<string | null>(null);

	async function onVisibilityChange(next: VisibilityLevel) {
		visibilityError = null;
		try {
			await formsStore.setVisibility(entry.id, next);
		} catch (err) {
			visibilityError = err instanceof Error ? err.message : String(err);
		}
	}

	async function handleRegenerate() {
		await formsStore.regenerateUnlistedToken(entry.id);
	}

	async function handleRevoke() {
		await formsStore.setVisibility(entry.id, 'private');
	}

	async function handleExpiryChange(expiresAt: Date | null) {
		await formsStore.setUnlistedExpiry(entry.id, expiresAt);
	}

	const shareUrl = $derived.by(() => {
		if (!entry.unlistedToken) return '';
		const origin = typeof window === 'undefined' ? 'https://mana.how' : window.location.origin;
		return buildShareUrl(origin, entry.unlistedToken);
	});

	// ── Wave-Send (M10b) ──────────────────────────────────
	const recurrence = $derived(entry.settings.recurrence);
	const waveDue = $derived(isWaveDue(recurrence));
	const waveDueAt = $derived(nextWaveDueAt(recurrence));
	const canSendWave = $derived(
		!!recurrence &&
			!!entry.unlistedToken &&
			!!shareUrl &&
			(recurrence.recipientEmails ?? []).length > 0
	);

	let waveError = $state<string | null>(null);

	async function sendWave() {
		if (!canSendWave || !shareUrl) return;
		const recipients = entry.settings.recurrence?.recipientEmails ?? [];
		if (recipients.length === 0) return;
		waveError = null;

		// Try bulk-send first (M10c) — needs broadcasts settings configured.
		// Fallback to mailto bridge (M10b) if bulk-send preconditions miss.
		const bulkSettings = await loadBulkMailSettings();

		if (bulkSettings) {
			const ok = confirm(
				$_('forms.builder.recurrence.confirmBulk', {
					default:
						'Welle an {n} Empfänger via Mana-Mail senden? Antworten landen direkt in deinem Forms-Inbox.',
					values: { n: recipients.length },
				})
			);
			if (!ok) return;
			try {
				const cohort = computeCohort(
					new Date().toISOString(),
					entry.settings.recurrence!.frequency
				);
				await sendWaveViaBulkMail({
					form: entry,
					shareUrl,
					settings: bulkSettings,
					cohort,
				});
				await formsStore.markWaveSent(entry.id);
				return;
			} catch (err) {
				if (err instanceof WavePreconditionError) {
					// Fall through to mailto bridge — settings have a gap.
					waveError = err.message;
				} else {
					waveError = err instanceof Error ? err.message : 'Bulk-Send fehlgeschlagen.';
					return;
				}
			}
		}

		// Mailto bridge path (M10b)
		const subject = $_('forms.builder.recurrence.mailSubject', {
			default: 'Bitte ausfüllen: {title}',
			values: { title: entry.title },
		});
		const description = entry.description ? `${entry.description}\n\n` : '';
		const body = $_('forms.builder.recurrence.mailBody', {
			default: '{description}Hier kannst du antworten:\n{url}\n\nDanke!',
			values: { description, url: shareUrl },
		});
		const mailto = buildWaveMailto({ recipientEmails: recipients, subject, body });

		const ok = confirm(
			$_('forms.builder.recurrence.confirmSend', {
				default:
					'Welle an {n} Empfänger senden? Dein Mail-Programm öffnet sich mit BCC-Liste und Link. Nach dem Versand stempeln wir den Zeitpunkt.',
				values: { n: recipients.length },
			})
		);
		if (!ok) return;

		window.open(mailto, '_blank');
		await formsStore.markWaveSent(entry.id);
	}

	async function loadBulkMailSettings(): Promise<BroadcastSettings | null> {
		const raw = await settingsTable.get(BROADCAST_SETTINGS_ID);
		if (!raw) return null;
		const decrypted = (await decryptRecord('broadcastSettings', {
			...raw,
		})) as LocalBroadcastSettings;
		const settings = toSettings(decrypted);
		if (!settings.defaultFromEmail?.trim() || !settings.legalAddress?.trim()) {
			return null; // missing precondition — caller falls back to mailto
		}
		return settings;
	}

	function formatDueAt(d: Date | null): string {
		if (!d) return '';
		return d.toLocaleString();
	}

	async function setStatus(status: FormStatus) {
		await formsStore.setStatus(entry.id, status);
	}

	async function deleteForm() {
		const ok = confirm(
			$_('forms.builder.deleteConfirm', {
				default: 'Formular "{title}" wirklich löschen?',
				values: { title: entry.title },
			})
		);
		if (!ok) return;
		await formsStore.deleteForm(entry.id);
		goto('/forms');
	}
</script>

<div class="builder">
	<div class="top-bar">
		<button type="button" class="back" onclick={() => goto('/forms')}>
			{$_('forms.builder.back', { default: '← Zurück' })}
		</button>

		<div
			class="status-pills"
			role="group"
			aria-label={$_('forms.builder.statusGroupAria', { default: 'Status' })}
		>
			{#each Object.keys(FORM_STATUS_LABELS) as st}
				<button
					type="button"
					class="status-pill"
					class:active={entry.status === st}
					data-status={st}
					onclick={() => setStatus(st as FormStatus)}
				>
					{FORM_STATUS_LABELS[st as FormStatus].de}
				</button>
			{/each}
		</div>

		<a class="responses-link" href="/forms/{entry.id}/responses">
			{$_('forms.builder.viewResponses', {
				default: 'Antworten ({n})',
				values: { n: entry.responseCount },
			})}
		</a>

		<button type="button" class="delete" onclick={deleteForm}>
			{$_('forms.builder.delete', { default: 'Löschen' })}
		</button>
	</div>

	<div class="meta">
		<input
			type="text"
			class="title-input"
			bind:value={title}
			onblur={saveTitle}
			placeholder={$_('forms.builder.titlePlaceholder', { default: 'Formular-Titel' })}
			aria-label={$_('forms.builder.titleAria', { default: 'Formular-Titel' })}
		/>
		<textarea
			class="description-input"
			rows="2"
			bind:value={description}
			onblur={saveDescription}
			placeholder={$_('forms.builder.descriptionPlaceholder', {
				default: 'Beschreibung (optional)',
			})}
		></textarea>
	</div>

	<section class="fields-section">
		<header class="section-header">
			<h2>{$_('forms.builder.fields.title', { default: 'Felder' })}</h2>
			<span class="count">
				{$_('forms.builder.fields.count', {
					default: '{n} Felder',
					values: { n: items.length },
				})}
			</span>
		</header>

		{#if items.length === 0}
			<p class="empty-fields">
				{$_('forms.builder.fields.empty', {
					default: 'Noch keine Felder. Wähle unten einen Typ.',
				})}
			</p>
		{:else}
			<div
				use:dndzone={{ items, flipDurationMs: 180, dropTargetStyle: {} }}
				onconsider={handleDndConsider}
				onfinalize={handleDndFinalize}
				class="fields-list"
			>
				{#each items as field, i (field.id)}
					<div animate:flip={{ duration: 180 }}>
						<FieldEditor
							{field}
							index={i}
							onchange={(patch) => patchField(field.id, patch)}
							onremove={() => removeField(field.id)}
						/>
					</div>
				{/each}
			</div>
		{/if}

		<FieldPalette onpick={pickField} />
	</section>

	<section class="visibility-section">
		<header class="vis-header">
			<p class="panel-title">
				{$_('forms.builder.visibility.title', { default: 'Sichtbarkeit & Teilen' })}
			</p>
			{#if entry.status !== 'published' && entry.visibility !== 'unlisted'}
				<span class="vis-hint">
					{$_('forms.builder.visibility.publishHint', {
						default: 'Setze den Status auf "Veröffentlicht", um zu teilen.',
					})}
				</span>
			{/if}
		</header>
		<VisibilityPicker level={entry.visibility} onChange={onVisibilityChange} />
		{#if visibilityError}
			<p class="vis-error">{visibilityError}</p>
		{/if}
		{#if entry.visibility === 'unlisted' && entry.unlistedToken && shareUrl}
			<SharedLinkControls
				token={entry.unlistedToken}
				url={shareUrl}
				expiresAt={entry.unlistedExpiresAt}
				onRegenerate={handleRegenerate}
				onRevoke={handleRevoke}
				onExpiryChange={handleExpiryChange}
			/>
		{/if}

		{#if recurrence}
			<div class="wave-block">
				{#if waveDue}
					<p class="wave-due-banner">
						{$_('forms.builder.recurrence.waveDue', {
							default: 'Nächste Welle ist fällig — schicke den Link an deine Empfänger.',
						})}
					</p>
				{:else if waveDueAt && entry.settings.recurrence?.lastSentAt}
					<p class="wave-hint">
						{$_('forms.builder.recurrence.nextWaveAt', {
							default: 'Nächste Welle: {date}',
							values: { date: formatDueAt(waveDueAt) },
						})}
					</p>
				{/if}
				<button
					type="button"
					class="wave-send"
					onclick={sendWave}
					disabled={!canSendWave}
					class:due={waveDue}
				>
					{$_('forms.builder.recurrence.sendNow', {
						default: 'Welle jetzt senden',
					})}
				</button>
				{#if !canSendWave}
					<p class="wave-hint">
						{!entry.unlistedToken
							? $_('forms.builder.recurrence.needsUnlisted', {
									default: 'Setze die Sichtbarkeit auf "unlisted", um den Link zu erzeugen.',
								})
							: $_('forms.builder.recurrence.needsRecipients', {
									default: 'Trage Empfänger-Emails in den Settings ein.',
								})}
					</p>
				{/if}
				{#if waveError}
					<p class="vis-error">{waveError}</p>
				{/if}
			</div>
		{/if}
	</section>

	<section class="branching-section">
		<BranchingEditor fields={items} branching={entry.branching} onchange={patchBranching} />
	</section>

	<section class="settings-section">
		<SettingsPanel settings={entry.settings} fields={items} onchange={patchSettings} />
	</section>
</div>

<style>
	.builder {
		display: flex;
		flex-direction: column;
		gap: 1rem;
		padding: 1rem;
		max-width: 880px;
		margin: 0 auto;
	}

	.top-bar {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.back {
		padding: 0.375rem 0.625rem;
		background: rgb(255 255 255 / 0.04);
		border: 1px solid rgb(255 255 255 / 0.08);
		border-radius: 0.375rem;
		color: inherit;
		font-size: 0.8125rem;
		cursor: pointer;
	}

	.back:hover {
		background: rgb(255 255 255 / 0.07);
	}

	.status-pills {
		display: inline-flex;
		gap: 0.25rem;
	}

	.status-pill {
		padding: 0.375rem 0.625rem;
		background: rgb(255 255 255 / 0.04);
		border: 1px solid rgb(255 255 255 / 0.08);
		border-radius: 0.375rem;
		color: rgb(255 255 255 / 0.55);
		font-size: 0.8125rem;
		cursor: pointer;
	}

	.status-pill:hover {
		background: rgb(255 255 255 / 0.07);
	}

	.status-pill.active[data-status='draft'] {
		background: rgb(255 255 255 / 0.08);
		color: rgb(255 255 255 / 0.85);
		border-color: rgb(255 255 255 / 0.18);
	}

	.status-pill.active[data-status='published'] {
		background: rgb(20 184 166 / 0.18);
		color: rgb(94 234 212);
		border-color: rgb(20 184 166 / 0.4);
	}

	.status-pill.active[data-status='closed'] {
		background: rgb(255 255 255 / 0.04);
		color: rgb(255 255 255 / 0.45);
		border-color: rgb(255 255 255 / 0.12);
	}

	.responses-link {
		margin-left: auto;
		padding: 0.375rem 0.625rem;
		background: rgb(255 255 255 / 0.04);
		border: 1px solid rgb(255 255 255 / 0.08);
		border-radius: 0.375rem;
		color: inherit;
		font-size: 0.8125rem;
		text-decoration: none;
	}

	.responses-link:hover {
		background: rgb(255 255 255 / 0.07);
	}

	.delete {
		padding: 0.375rem 0.625rem;
		background: transparent;
		border: 1px solid rgb(255 255 255 / 0.08);
		border-radius: 0.375rem;
		color: rgb(255 255 255 / 0.5);
		font-size: 0.8125rem;
		cursor: pointer;
	}

	.delete:hover {
		color: rgb(248 113 113);
		border-color: rgb(248 113 113 / 0.4);
	}

	.meta {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}

	.title-input {
		padding: 0.625rem 0.875rem;
		background: rgb(255 255 255 / 0.04);
		border: 1px solid rgb(255 255 255 / 0.08);
		border-radius: 0.5rem;
		color: inherit;
		font-size: 1.125rem;
		font-weight: 600;
	}

	.title-input:focus {
		outline: none;
		border-color: rgb(20 184 166 / 0.5);
	}

	.description-input {
		padding: 0.5rem 0.875rem;
		background: rgb(255 255 255 / 0.04);
		border: 1px solid rgb(255 255 255 / 0.08);
		border-radius: 0.5rem;
		color: inherit;
		font-size: 0.875rem;
		font-family: inherit;
		resize: vertical;
	}

	.description-input:focus {
		outline: none;
		border-color: rgb(255 255 255 / 0.18);
	}

	.fields-section,
	.settings-section,
	.branching-section,
	.visibility-section {
		display: flex;
		flex-direction: column;
		gap: 0.625rem;
	}

	.visibility-section {
		padding: 0.875rem;
		background: rgb(255 255 255 / 0.03);
		border: 1px solid rgb(255 255 255 / 0.06);
		border-radius: 0.5rem;
	}

	.vis-header {
		display: flex;
		justify-content: space-between;
		align-items: baseline;
		gap: 0.5rem;
		flex-wrap: wrap;
	}

	.panel-title {
		margin: 0;
		font-size: 0.75rem;
		text-transform: uppercase;
		letter-spacing: 0.06em;
		color: rgb(255 255 255 / 0.5);
	}

	.vis-hint {
		font-size: 0.75rem;
		color: rgb(255 255 255 / 0.45);
	}

	.vis-error {
		margin: 0;
		font-size: 0.8125rem;
		color: rgb(252 165 165);
	}

	.wave-block {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding-top: 0.625rem;
		border-top: 1px solid rgb(255 255 255 / 0.06);
	}

	.wave-due-banner {
		margin: 0;
		padding: 0.5rem 0.75rem;
		background: rgb(245 158 11 / 0.16);
		border: 1px solid rgb(245 158 11 / 0.4);
		border-radius: 0.375rem;
		color: rgb(252 211 77);
		font-size: 0.8125rem;
	}

	.wave-hint {
		margin: 0;
		font-size: 0.75rem;
		color: rgb(255 255 255 / 0.5);
	}

	.wave-send {
		align-self: flex-start;
		padding: 0.5rem 0.875rem;
		background: rgb(20 184 166 / 0.16);
		border: 1px solid rgb(20 184 166 / 0.4);
		border-radius: 0.375rem;
		color: rgb(94 234 212);
		font-size: 0.8125rem;
		cursor: pointer;
	}

	.wave-send:hover:not(:disabled) {
		background: rgb(20 184 166 / 0.24);
	}

	.wave-send:disabled {
		opacity: 0.45;
		cursor: not-allowed;
	}

	.wave-send.due {
		background: rgb(245 158 11 / 0.18);
		border-color: rgb(245 158 11 / 0.5);
		color: rgb(252 211 77);
	}

	.wave-send.due:hover:not(:disabled) {
		background: rgb(245 158 11 / 0.26);
	}

	.section-header {
		display: flex;
		align-items: baseline;
		gap: 0.625rem;
	}

	.section-header h2 {
		margin: 0;
		font-size: 0.875rem;
		font-weight: 600;
	}

	.count {
		font-size: 0.75rem;
		color: rgb(255 255 255 / 0.45);
	}

	.empty-fields {
		padding: 1rem;
		text-align: center;
		color: rgb(255 255 255 / 0.45);
		background: rgb(255 255 255 / 0.02);
		border: 1px dashed rgb(255 255 255 / 0.1);
		border-radius: 0.5rem;
		font-size: 0.875rem;
	}

	.fields-list {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
	}
</style>
