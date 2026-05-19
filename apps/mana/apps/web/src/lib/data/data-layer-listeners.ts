/**
 * Wires the data-layer event bus into the rest of the app.
 *
 * The sync engine and quota helpers emit fire-and-forget CustomEvents on
 * `window` so they stay free of UI/error-tracking dependencies. This module
 * is the single subscriber that bridges those events to:
 *
 *   1. The user-visible toast store (quota warnings)
 *   2. The shared error tracker (sync errors → Sentry/GlitchTip)
 *   3. The console (sync warnings + telemetry summary in dev)
 *
 * It also kicks off the periodic tombstone cleanup so soft-deleted rows
 * don't grow unbounded in IndexedDB.
 *
 * Call `installDataLayerListeners()` once from the root layout's onMount.
 * It returns a dispose function that should be called on unmount.
 */

import { captureException, captureMessage } from '@mana/shared-error-tracking/browser';
import { toast } from '$lib/stores/toast.svelte';
import { QUOTA_EVENT, type QuotaExceededDetail } from './quota-detect';
import { cleanupTombstones } from './quota';
import { pruneActivityLog } from './activity';
import { SYNC_TELEMETRY_EVENT, type SyncTelemetryDetail } from './sync-telemetry';
import { installConflictListener } from './conflict-store.svelte';

/** How often to run the tombstone cleanup. 24h is a comfortable cadence
 * given that the cutoff is 30 days — runs roughly once per app session. */
const TOMBSTONE_CLEANUP_INTERVAL_MS = 24 * 60 * 60 * 1000;

/**
 * Subscribes to all data-layer CustomEvents and starts the tombstone
 * cleanup loop. Idempotent within a single call but should NOT be invoked
 * twice without disposing — the returned cleanup tears down listeners and
 * the interval timer.
 */
export function installDataLayerListeners(): () => void {
	if (typeof window === 'undefined') {
		// SSR safety net — nothing to wire up server-side.
		return () => {};
	}

	// ─── Quota events → toast + telemetry ──────────────────────
	const handleQuota = (event: Event) => {
		const detail = (event as CustomEvent<QuotaExceededDetail>).detail;
		if (detail.recovered) {
			// We freed enough space to retry; gentle info, not alarming.
			toast.info(`Speicher war voll – ${detail.cleaned} alte Einträge bereinigt, fertig.`);
		} else if (detail.cleaned > 0) {
			// We cleaned but still failed; the user needs to know data may be lost.
			toast.error('Speicher voll. Manche Änderungen konnten nicht gesichert werden.');
			captureException(
				new Error(
					`IndexedDB quota exceeded after cleanup (table=${detail.table}, op=${detail.op})`
				),
				{ tag: 'quota-exceeded', ...detail }
			);
		} else {
			// First-time hit, no cleanup happened (e.g. fired from a sync hook).
			toast.warning('Speicher fast voll. Die App bereinigt alte Daten…');
			captureMessage(`IndexedDB quota warning (table=${detail.table ?? 'unknown'})`, 'warning');
		}
	};

	// ─── Sync telemetry → console + Sentry on errors ───────────
	const handleTelemetry = (event: Event) => {
		const detail = (event as CustomEvent<SyncTelemetryDetail>).detail;

		if (detail.kind === 'push:error' || detail.kind === 'pull:error') {
			// Auth errors are user-driven (token expired) and pollute Sentry —
			// surface them as console warnings only. Network blips are noisy
			// for the same reason. Real server-side faults still get logged.
			if (detail.errorCategory === 'auth' || detail.errorCategory === 'network') {
				console.warn('[mana-sync]', detail.kind, detail);
				return;
			}
			captureException(
				new Error(`mana-sync ${detail.kind} app=${detail.appId} category=${detail.errorCategory}`),
				{ tag: 'sync-error', ...detail }
			);
			console.error('[mana-sync]', detail.kind, detail);
			return;
		}

		if (detail.kind === 'apply:malformed-drop') {
			captureMessage(
				`mana-sync dropped ${detail.count ?? 0} malformed server changes (app=${detail.appId})`,
				'warning'
			);
			return;
		}

		// Successful lifecycle events: log only when Vite dev server is on, so
		// production console stays quiet but devs get visibility.
		if (import.meta.env.DEV) {
			console.debug('[mana-sync]', detail.kind, detail);
		}
	};

	window.addEventListener(QUOTA_EVENT, handleQuota);
	window.addEventListener(SYNC_TELEMETRY_EVENT, handleTelemetry);

	// ─── Sync conflict listener (Backlog C) ────────────────────
	// Wires the field-LWW overwrite events into the conflict store
	// that the SyncConflictToast component reads. The store handles
	// coalescing, auto-dismiss, and the restore-write path.
	const disposeConflict = installConflictListener();

	// ─── Periodic cleanup loop ─────────────────────────────────
	// Runs once on boot, then daily. Two independent jobs share the
	// schedule so we never have a third interval competing for the same
	// idle window:
	//   - cleanupTombstones: hard-deletes soft-deleted rows >30d old
	//   - pruneActivityLog:  drops activity entries >90d old + caps the
	//                        log at ACTIVITY_MAX_ENTRIES rows
	// Errors are caught locally and reported via Sentry so a broken
	// cleanup never crashes the app.
	const runCleanup = () => {
		cleanupTombstones()
			.then((cleaned) => {
				if (cleaned > 0 && import.meta.env.DEV) {
					console.debug(`[mana-data] tombstone cleanup removed ${cleaned} rows`);
				}
			})
			.catch((err) => {
				captureException(err, { tag: 'tombstone-cleanup' });
			});
		pruneActivityLog()
			.then((pruned) => {
				if (pruned > 0 && import.meta.env.DEV) {
					console.debug(`[mana-data] activity log pruned ${pruned} rows`);
				}
			})
			.catch((err) => {
				captureException(err, { tag: 'activity-prune' });
			});
	};

	// Defer the first run until the browser is idle so it never competes
	// with the initial render.
	const idle = (cb: () => void) =>
		typeof window.requestIdleCallback === 'function'
			? window.requestIdleCallback(cb, { timeout: 5000 })
			: window.setTimeout(cb, 2000);
	idle(runCleanup);
	const cleanupTimer = window.setInterval(runCleanup, TOMBSTONE_CLEANUP_INTERVAL_MS);

	// ─── Dispose ───────────────────────────────────────────────
	return () => {
		window.removeEventListener(QUOTA_EVENT, handleQuota);
		window.removeEventListener(SYNC_TELEMETRY_EVENT, handleTelemetry);
		window.clearInterval(cleanupTimer);
		disposeConflict();
	};
}
