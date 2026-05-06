/**
 * Wave bulk-send via mana-mail (M10c).
 *
 * Headless wave-send for recurring forms: instead of opening a
 * mailto: link (the M10b bridge, which requires a user gesture and
 * caps at ~50 BCC recipients), we POST directly to mana-mail's
 * /v1/mail/bulk-send with a minimal HTML/text payload built from
 * the form's title + description + share-link.
 *
 * Pre-conditions:
 *   - The form has `recurrence` configured + non-empty
 *     `recipientEmails` + a published unlisted share-link.
 *   - The user has filled BroadcastSettings.defaultFromEmail and
 *     legalAddress in /broadcasts/settings (DSGVO mandate).
 *
 * If those preconditions aren't met, the caller falls back to the
 * M10b mailto bridge.
 */

import { browser } from '$app/environment';
import type { BroadcastSettings } from '$lib/modules/broadcasts/types';
import type { Form } from '../types';

export interface WaveBulkSendResult {
	campaignId: string;
	accepted: number;
	delivered: number;
	failed: number;
	errors: Array<{ email: string; reason: string }>;
}

export class WavePreconditionError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'WavePreconditionError';
	}
}

/**
 * Owner-private blob that gets stored on the snapshot row's
 * `internal_meta` column at publish-time (M10d). The headless wave-
 * worker reads it server-side to fire due waves. The public unlisted
 * GET endpoint MUST strip this column — it carries recipient emails
 * and sender details that would leak via the share-link otherwise.
 *
 * Returns null when the form isn't ready for headless sending yet
 * (no recurrence, no recipients, missing broadcast settings). The
 * snapshot still gets published; the worker just skips it.
 */
export function buildFormInternalMeta(
	form: Form,
	settings: BroadcastSettings | null
): Record<string, unknown> | null {
	const recurrence = form.settings.recurrence;
	if (!recurrence?.frequency) return null;
	const recipients = recurrence.recipientEmails ?? [];
	if (recipients.length === 0) return null;
	if (!settings?.defaultFromEmail?.trim() || !settings.defaultFromName?.trim()) return null;
	if (!settings.legalAddress?.trim()) return null;

	return {
		kind: 'forms-recurrence',
		recurrence: {
			frequency: recurrence.frequency,
			recipientEmails: recipients.slice(0, 50),
			lastSentAt: recurrence.lastSentAt ?? null,
		},
		sender: {
			fromEmail: settings.defaultFromEmail.trim(),
			fromName: settings.defaultFromName.trim(),
			replyTo: settings.defaultReplyTo?.trim() || null,
			legalAddress: settings.legalAddress.trim(),
		},
		formMeta: {
			title: form.title,
			description: form.description ?? null,
		},
	};
}

function getMailUrl(): string {
	if (browser) {
		const fromWindow = (window as unknown as { __PUBLIC_MANA_MAIL_URL__?: string })
			.__PUBLIC_MANA_MAIL_URL__;
		if (fromWindow) return fromWindow;
	}
	return import.meta.env.PUBLIC_MANA_MAIL_URL || 'http://localhost:3042';
}

/**
 * Render a minimal HTML body for the wave email. Inline-styled because
 * email clients ignore <style> blocks. Mirrors the structure
 * broadcasts/render uses but without the rich-text editor + analytics
 * pixels — wave-mails are short transactional notifications.
 */
function renderWaveHtml(opts: {
	formTitle: string;
	formDescription: string | null;
	shareUrl: string;
	settings: BroadcastSettings;
}): string {
	const desc = opts.formDescription
		? `<p style="margin:0 0 1em;color:#374151;line-height:1.5;">${escapeHtml(opts.formDescription)}</p>`
		: '';
	return [
		'<!doctype html><html><body style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:2em auto;padding:0 1em;">',
		`<h1 style="margin:0 0 0.5em;font-size:1.25rem;">${escapeHtml(opts.formTitle)}</h1>`,
		desc,
		`<p style="margin:1.5em 0;"><a href="${escapeHtml(opts.shareUrl)}" style="display:inline-block;padding:0.625rem 1.25rem;background:#14b8a6;color:white;border-radius:6px;text-decoration:none;font-weight:500;">Antworten</a></p>`,
		`<p style="margin:1em 0;color:#6b7280;font-size:0.875rem;">Oder direkt: <a href="${escapeHtml(opts.shareUrl)}">${escapeHtml(opts.shareUrl)}</a></p>`,
		`<hr style="border:none;border-top:1px solid #e5e7eb;margin:2em 0 1em;">`,
		`<p style="margin:0;color:#9ca3af;font-size:0.75rem;line-height:1.5;white-space:pre-wrap;">${escapeHtml(opts.settings.legalAddress)}</p>`,
		`<p style="margin:0.5em 0 0;color:#9ca3af;font-size:0.75rem;"><a href="{{unsubscribe_url}}" style="color:#9ca3af;">Abmelden</a></p>`,
		'</body></html>',
	].join('');
}

function renderWaveText(opts: {
	formTitle: string;
	formDescription: string | null;
	shareUrl: string;
	settings: BroadcastSettings;
}): string {
	const desc = opts.formDescription ? `${opts.formDescription}\n\n` : '';
	return [
		opts.formTitle,
		'',
		desc + `Antworten: ${opts.shareUrl}`,
		'',
		'---',
		opts.settings.legalAddress,
		'',
		'Abmelden: {{unsubscribe_url}}',
	].join('\n');
}

function escapeHtml(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;')
		.replace(/'/g, '&#39;');
}

/**
 * Send a wave via mana-mail bulk-send. Throws WavePreconditionError if
 * the broadcast-settings/recipients/share-link state isn't valid —
 * caller decides whether to surface the error or fall back to mailto.
 */
export async function sendWaveViaBulkMail(opts: {
	form: Form;
	shareUrl: string;
	settings: BroadcastSettings | null;
	cohort: string;
}): Promise<WaveBulkSendResult> {
	const { form, shareUrl, settings, cohort } = opts;
	const recipients = form.settings.recurrence?.recipientEmails ?? [];

	if (!shareUrl) {
		throw new WavePreconditionError('Share-Link fehlt — Form ist nicht unlisted.');
	}
	if (recipients.length === 0) {
		throw new WavePreconditionError('Keine Empfänger konfiguriert.');
	}
	if (!settings) {
		throw new WavePreconditionError(
			'Broadcasts-Settings fehlen — konfiguriere Absender + Impressum unter /broadcasts/settings.'
		);
	}
	const fromEmail = settings.defaultFromEmail?.trim();
	const fromName = settings.defaultFromName?.trim();
	if (!fromEmail) {
		throw new WavePreconditionError('Absender-Email fehlt in den Broadcasts-Settings.');
	}
	if (!fromName) {
		throw new WavePreconditionError('Absender-Name fehlt in den Broadcasts-Settings.');
	}
	if (!settings.legalAddress?.trim()) {
		throw new WavePreconditionError('Impressum fehlt in den Broadcasts-Settings (DSGVO-Pflicht).');
	}

	const subject = `${form.title} — ${cohort}`;
	const htmlBody = renderWaveHtml({
		formTitle: form.title,
		formDescription: form.description,
		shareUrl,
		settings,
	});
	const textBody = renderWaveText({
		formTitle: form.title,
		formDescription: form.description,
		shareUrl,
		settings,
	});

	// campaignId — synthetic, derived from the form + cohort so the
	// orchestrator's idempotency keys play nicely. Multiple sends of
	// the same wave (manual retry) produce the same id.
	const campaignId = `form-${form.id}-${cohort}`.slice(0, 80);

	const res = await fetch(`${getMailUrl()}/api/v1/mail/bulk-send`, {
		method: 'POST',
		credentials: 'include',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({
			campaignId,
			subject,
			fromName,
			fromEmail,
			replyTo: settings.defaultReplyTo ?? undefined,
			htmlBody,
			textBody,
			recipients: recipients.map((email) => ({ email })),
		}),
	});

	if (!res.ok) {
		const text = await res.text().catch(() => '');
		throw new Error(`bulk-send fehlgeschlagen (${res.status}): ${text.slice(0, 200)}`);
	}
	return (await res.json()) as WaveBulkSendResult;
}
