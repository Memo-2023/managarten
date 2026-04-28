/**
 * Articles Bulk-Import — background worker.
 *
 * Boots from `apps/api/src/index.ts`. On every tick:
 *
 *   1. Try `pg_try_advisory_xact_lock` on a fixed key. If another
 *      apps/api instance already holds it, skip this tick. The lock
 *      is per-transaction so we never need a heartbeat — a crashed
 *      worker's tx auto-aborts and the next tick claims it cleanly.
 *   2. Project the live state of `articleImportJobs` and pick the
 *      ones still 'queued' or 'running'.
 *   3. For each job: project items, take up to N pending items,
 *      extract concurrently. Each extraction writes a Pickup row +
 *      flips the item state via `import-extractor.ts`.
 *   4. Fold terminal item states into job counters
 *      (savedCount / duplicateCount / errorCount / warningCount).
 *      When every item is terminal, flip the job to 'done'.
 *
 * No own state — every meaningful transition is a `sync_changes` row.
 * The worker is therefore stateless across restarts.
 *
 * Plan: docs/plans/articles-bulk-import.md.
 */

import { getSyncConnection } from '../../mcp/sync-db';
import {
	listClaimableJobs,
	listItemsForJob,
	type ImportItemRow,
	type ImportJobRow,
} from './import-projection';
import { extractOneItem, writeItemUpdate, writeJobUpdate } from './import-extractor';

/** Counts ticks so the pickup-GC sweep can run every Nth one rather
 *  than on every 2-second cycle (the DELETE is cheap but not free). */
let tickCount = 0;
/** Run pickup-GC every 30 ticks ≈ once per minute. */
const PICKUP_GC_EVERY_N_TICKS = 30;

const TICK_INTERVAL_MS = 2_000;
const PER_JOB_CONCURRENCY = 3;
/**
 * If an item has been in `state='extracting'` longer than this without
 * a follow-up state-write, it's orphaned (worker crashed mid-fetch,
 * pod restart, OOM, …) and gets bounced back to `pending` so the next
 * tick can re-claim it.
 *
 * Tuned so a slow but live extraction (15 s shared-rss fetch timeout +
 * a few seconds of JSDOM parse on a 2 MB page) doesn't reset
 * prematurely — 5 minutes is comfortable headroom.
 */
const STALE_EXTRACTING_MS = 5 * 60 * 1000;
/** TTL for `articleExtractPickup` rows. The pickup-consumer normally
 *  deletes them seconds after the worker writes them; anything older
 *  than this is garbage from a stuck consumer (all tabs closed,
 *  Web-Lock mismatch, …) and would otherwise accumulate without bound. */
const PICKUP_TTL_MS = 24 * 60 * 60 * 1000;
/** Fixed int8 lock key — derived from the ASCII bytes of 'ARTI'. */
const ADVISORY_LOCK_KEY = 0x4152_5449;

let timer: ReturnType<typeof setInterval> | null = null;
let running = false;

/**
 * Start the recurring tick. Idempotent — safe to call multiple times.
 * Intended to be called once from `apps/api/src/index.ts` at boot.
 *
 * Disable via `ARTICLES_IMPORT_WORKER_DISABLED=true` (for tests, or
 * when running multiple apps/api instances and you want to designate
 * a different one as the worker).
 */
export function startArticleImportWorker(): void {
	if (timer) return;
	if (process.env.ARTICLES_IMPORT_WORKER_DISABLED === 'true') {
		console.log('[articles-import] worker disabled via env');
		return;
	}
	console.log(
		`[articles-import] worker starting — tick=${TICK_INTERVAL_MS}ms, concurrency=${PER_JOB_CONCURRENCY}`
	);
	timer = setInterval(() => {
		void runTickGuarded();
	}, TICK_INTERVAL_MS);
}

export function stopArticleImportWorker(): void {
	if (timer) {
		clearInterval(timer);
		timer = null;
	}
}

async function runTickGuarded(): Promise<void> {
	if (running) return;
	running = true;
	try {
		await runTickOnce();
	} catch (err) {
		console.error('[articles-import] tick error:', err);
	} finally {
		running = false;
	}
}

/**
 * One tick body. Exported for tests + a potential
 * `/internal/articles-import/tick`-style admin route.
 */
export async function runTickOnce(): Promise<{
	skipped: boolean;
	jobsConsidered: number;
	itemsProcessed: number;
	pickupGcRows?: number;
}> {
	if (!(await tryAcquireLock())) {
		return { skipped: true, jobsConsidered: 0, itemsProcessed: 0 };
	}
	tickCount++;
	let pickupGcRows: number | undefined;
	if (tickCount % PICKUP_GC_EVERY_N_TICKS === 0) {
		pickupGcRows = await runPickupGc();
	}
	const jobs = await listClaimableJobs();
	let itemsProcessed = 0;
	for (const job of jobs) {
		itemsProcessed += await processOneJob(job);
	}
	return { skipped: false, jobsConsidered: jobs.length, itemsProcessed, pickupGcRows };
}

/**
 * Hard-delete pickup rows older than `PICKUP_TTL_MS`. The
 * pickup-consumer on a healthy client removes each row seconds after
 * the worker writes it; anything older is residue from a stuck
 * consumer (all tabs closed, Web-Lock mismatch). Without this sweep
 * the rows would accumulate without bound in sync_changes.
 *
 * Runs against `sync_changes` directly, not via a soft-delete on the
 * row data — pickup rows are server-write inbox only, never editable
 * by users; a hard DELETE keeps the table tight.
 */
async function runPickupGc(): Promise<number> {
	const sql = getSyncConnection();
	const cutoff = new Date(Date.now() - PICKUP_TTL_MS).toISOString();
	const rows = await sql<{ count: string }[]>`
		WITH deleted AS (
			DELETE FROM sync_changes
			WHERE app_id = 'articles'
			  AND table_name = 'articleExtractPickup'
			  AND created_at < ${cutoff}
			RETURNING 1
		)
		SELECT count(*)::text AS count FROM deleted
	`;
	const n = parseInt(rows[0]?.count ?? '0', 10);
	if (n > 0) console.log(`[articles-import] pickup-gc: removed ${n} rows older than 24h`);
	return n;
}

/**
 * Brief advisory-lock probe via a single short transaction. Returns
 * true if we won the probe — that's a soft signal for "you're the
 * worker for this tick"; the lock releases as the probe tx commits.
 * For multi-instance deploys this is a soft-only coordination — if
 * two probes happen to interleave their work, the field-LWW merge on
 * the client still produces a coherent state.
 */
async function tryAcquireLock(): Promise<boolean> {
	const sql = getSyncConnection();
	let acquired = false;
	await sql.begin(async (tx) => {
		const rows = await tx<{ acquired: boolean }[]>`
			SELECT pg_try_advisory_xact_lock(${ADVISORY_LOCK_KEY}) AS acquired
		`;
		acquired = rows[0]?.acquired === true;
	});
	return acquired;
}

async function processOneJob(job: ImportJobRow): Promise<number> {
	const items = await listItemsForJob(job.userId, job.id);

	// Crash-recovery sweep — bounce items that have been 'extracting'
	// for too long back to 'pending'. Without this, a worker that
	// crashed (or got OOM'd, restarted mid-extract) leaves orphaned
	// items in 'extracting' forever; the job never completes. Worker
	// re-attribution happens via the next tick's claim path.
	const now = Date.now();
	for (const it of items) {
		if (it.state !== 'extracting') continue;
		const since = it.lastAttemptAt ? Date.parse(it.lastAttemptAt) : 0;
		if (!Number.isFinite(since)) continue;
		if (now - since < STALE_EXTRACTING_MS) continue;
		console.warn(
			`[articles-import] resetting stale extracting item ${it.id} (job=${job.id}) — ${Math.round((now - since) / 1000)}s old`
		);
		await writeItemUpdate(it.userId, it.id, { state: 'pending' });
	}

	// Flip 'queued' → 'running' so the UI shows progress.
	if (job.status === 'queued') {
		await writeJobUpdate(job.userId, job.id, {
			status: 'running',
			startedAt: new Date().toISOString(),
		});
	}

	// Counter-derivation from current item states.
	const counts = countByState(items);
	const counterPatch: Record<string, unknown> = {};
	let dirty = false;
	if (counts.saved !== job.savedCount) {
		counterPatch.savedCount = counts.saved;
		dirty = true;
	}
	if (counts.duplicate !== job.duplicateCount) {
		counterPatch.duplicateCount = counts.duplicate;
		dirty = true;
	}
	if (counts.error !== job.errorCount) {
		counterPatch.errorCount = counts.error;
		dirty = true;
	}
	if (counts.consentWall !== job.warningCount) {
		counterPatch.warningCount = counts.consentWall;
		dirty = true;
	}
	if (counts.allTerminal && job.status !== 'done') {
		counterPatch.status = 'done';
		counterPatch.finishedAt = new Date().toISOString();
		dirty = true;
	}
	if (dirty) {
		await writeJobUpdate(job.userId, job.id, counterPatch);
	}

	if (counts.allTerminal) return 0;

	// Cancelled → flip every still-pending item to 'cancelled'.
	if (job.status === 'cancelled') {
		const pending = items.filter((i) => i.state === 'pending');
		for (const it of pending) {
			await writeItemUpdate(it.userId, it.id, { state: 'cancelled' });
		}
		return pending.length;
	}

	// Paused → already-extracting items finish their roundtrip; nothing
	// new gets claimed.
	if (job.status === 'paused') return 0;

	// Running → claim up to PER_JOB_CONCURRENCY pending items in
	// parallel. We deliberately don't try to rescue 'extracting' items:
	// if a worker died mid-fetch they stay 'extracting' forever for
	// now. Future polish: time-out 'extracting' rows older than ~5min
	// and bounce them back to 'pending'.
	const claimable = items.filter((i) => i.state === 'pending').slice(0, PER_JOB_CONCURRENCY);
	if (claimable.length === 0) return 0;

	await Promise.allSettled(claimable.map((it) => extractOneItem(it)));
	return claimable.length;
}

interface StateCounts {
	saved: number;
	duplicate: number;
	error: number;
	consentWall: number;
	cancelled: number;
	allTerminal: boolean;
}

function countByState(items: readonly ImportItemRow[]): StateCounts {
	let saved = 0;
	let duplicate = 0;
	let error = 0;
	let consentWall = 0;
	let cancelled = 0;
	let nonTerminal = 0;
	for (const it of items) {
		switch (it.state) {
			case 'saved':
				saved++;
				break;
			case 'duplicate':
				duplicate++;
				break;
			case 'error':
				error++;
				break;
			case 'consent-wall':
				saved++; // consent-wall is "saved with warning" semantically
				consentWall++;
				break;
			case 'cancelled':
				cancelled++;
				break;
			default:
				nonTerminal++;
		}
	}
	return {
		saved,
		duplicate,
		error,
		consentWall,
		cancelled,
		allTerminal: items.length > 0 && nonTerminal === 0,
	};
}
