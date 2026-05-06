/**
 * Wave-scheduler — webapp-side cron for recurring forms (M10c).
 *
 * Runs while the user has the Mana tab open. Every TICK_INTERVAL_MS,
 * scans the formTable for forms with recurrence configured + due
 * + recipients + an unlisted share-token, then fires the wave via
 * mana-mail's bulk-send endpoint. After a successful send, stamps
 * lastSentAt so the next tick skips the form for one full period.
 *
 * Headless cron via mana-ai or mana-notify is M10d — this version
 * only runs while the owner has Mana open. It still solves the
 * "I forgot to click the button" case for users who keep Mana open
 * during the work week.
 *
 * Page-visibility-aware: pauses while the tab is hidden so we don't
 * fire ticks on a backgrounded laptop with no auth refresh; resumes
 * on visibility-change.
 *
 * Singleton — starting twice is a no-op. start/stop are idempotent.
 */

import { browser } from '$app/environment';
import { decryptRecord, decryptRecords, isVaultUnlocked } from '$lib/data/crypto';
import { authStore } from '$lib/stores/auth.svelte';
import { settingsTable, BROADCAST_SETTINGS_ID } from '$lib/modules/broadcasts/queries';
import { toSettings } from '$lib/modules/broadcasts/queries';
import { buildShareUrl } from '@mana/shared-privacy';
import { formTable } from '../collections';
import { toForm } from '../queries';
import { formsStore } from '../stores/forms.svelte';
import { isWaveDue } from './wave';
import { computeCohort } from './cohort';
import { sendWaveViaBulkMail, WavePreconditionError } from './wave-mail';
import type { LocalBroadcastSettings } from '$lib/modules/broadcasts/types';
import type { Form, LocalForm } from '../types';

// 5 minutes — fast enough that a Monday-morning weekly wave fires
// within a few minutes of the boundary, slow enough to stay invisible.
const TICK_INTERVAL_MS = 5 * 60 * 1000;

let timer: ReturnType<typeof setInterval> | null = null;
let visibilityHandler: (() => void) | null = null;
let started = false;
let tickInFlight = false;

export function startWaveScheduler(): void {
	if (!browser) return;
	if (started) return;
	started = true;

	scheduleNext();

	visibilityHandler = () => {
		if (document.visibilityState === 'visible') {
			scheduleNext();
		}
	};
	document.addEventListener('visibilitychange', visibilityHandler);

	// Fire once after a short delay so the user opening Mana on Monday
	// morning doesn't have to wait 5 minutes for the first scan.
	setTimeout(() => {
		void runTick();
	}, 30_000);
}

export function stopWaveScheduler(): void {
	if (!started) return;
	started = false;
	if (timer) {
		clearInterval(timer);
		timer = null;
	}
	if (visibilityHandler) {
		document.removeEventListener('visibilitychange', visibilityHandler);
		visibilityHandler = null;
	}
}

function scheduleNext() {
	if (timer) return;
	timer = setInterval(() => {
		if (document.visibilityState !== 'visible') return;
		void runTick();
	}, TICK_INTERVAL_MS);
}

async function runTick(): Promise<void> {
	if (tickInFlight) return;
	if (!isVaultUnlocked()) return;
	const jwt = await authStore.getValidToken().catch(() => null);
	if (!jwt) return;

	tickInFlight = true;
	try {
		const forms = await loadDueForms();
		if (forms.length === 0) return;

		const settings = await loadBroadcastSettings();
		if (!settings) return; // No broadcasts settings → can't bulk-send

		for (const form of forms) {
			await fireWaveForForm(form, settings);
		}
	} catch (err) {
		console.warn('[forms-wave-scheduler] tick failed:', (err as Error).message);
	} finally {
		tickInFlight = false;
	}
}

async function loadDueForms(): Promise<Form[]> {
	const raw = (await formTable.toArray()).filter(
		(f) => !f.deletedAt && f.status === 'published' && f.unlistedToken
	);
	if (raw.length === 0) return [];
	const decrypted = (await decryptRecords('forms', raw)) as LocalForm[];
	const forms = decrypted.map(toForm);
	return forms.filter(
		(f) =>
			!!f.settings.recurrence?.frequency &&
			(f.settings.recurrence?.recipientEmails?.length ?? 0) > 0 &&
			isWaveDue(f.settings.recurrence)
	);
}

async function loadBroadcastSettings(): Promise<ReturnType<typeof toSettings> | null> {
	const raw = await settingsTable.get(BROADCAST_SETTINGS_ID);
	if (!raw) return null;
	const decrypted = (await decryptRecord('broadcastSettings', {
		...raw,
	})) as LocalBroadcastSettings;
	return toSettings(decrypted);
}

async function fireWaveForForm(form: Form, settings: ReturnType<typeof toSettings>): Promise<void> {
	const origin = typeof window === 'undefined' ? 'https://mana.how' : window.location.origin;
	const shareUrl = buildShareUrl(origin, form.unlistedToken);
	const cohort = computeCohort(new Date().toISOString(), form.settings.recurrence!.frequency);

	try {
		const result = await sendWaveViaBulkMail({
			form,
			shareUrl,
			settings,
			cohort,
		});
		await formsStore.markWaveSent(form.id);
		console.info(
			`[forms-wave-scheduler] wave fired for "${form.title}" — ${result.delivered}/${result.accepted} delivered`
		);
	} catch (err) {
		if (err instanceof WavePreconditionError) {
			// Settings-side gap (no fromEmail, no impressum, etc.). Log
			// once, don't keep retrying — user has to fix the precondition.
			console.warn(`[forms-wave-scheduler] precondition for "${form.title}": ${err.message}`);
		} else {
			console.warn(
				`[forms-wave-scheduler] send failed for "${form.title}": ${(err as Error).message}`
			);
		}
	}
}
