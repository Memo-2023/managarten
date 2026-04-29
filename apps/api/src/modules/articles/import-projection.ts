/**
 * Articles Bulk-Import — sync_changes → live record projection.
 *
 * Mirror of `services/mana-ai/src/db/missions-projection.ts` and
 * `apps/api/src/lib/sync-db.ts:readLatestRecords()`, specialised for the
 * two tables the import-worker tick reads each cycle:
 *
 *   articleImportJobs   — to find running jobs whose lease is free
 *   articleImportItems  — to find pending items inside those jobs
 *
 * No materialized snapshots yet — this is the simple "replay every row
 * for these tables" path. The total volume is small (a few hundred rows
 * per active job, all import history per user) and the worker tick is
 * the only consumer. If the table grows we can plug in the same
 * `mission_snapshots` pattern mana-ai uses; the projection API stays
 * the same.
 *
 * Plan: docs/plans/articles-bulk-import.md.
 */

import { getSyncConnection } from '../../lib/sync-db';
import { fieldMetaTime } from './field-meta';

type Row = Record<string, unknown>;
interface ChangeRow {
	user_id: string;
	record_id: string;
	op: string;
	data: Row | null;
	/** See `./field-meta.ts` — wire shape is two-tone (legacy ISO string
	 *  vs. F3 `{at, actor, origin}` object). */
	field_meta: Record<string, unknown> | null;
	created_at: Date;
}

export interface ImportJobRow {
	id: string;
	userId: string;
	spaceId: string | null;
	totalUrls: number;
	status: 'queued' | 'running' | 'paused' | 'done' | 'cancelled';
	startedAt: string | null;
	finishedAt: string | null;
	savedCount: number;
	duplicateCount: number;
	errorCount: number;
	warningCount: number;
}

export type ImportItemState =
	| 'pending'
	| 'extracting'
	| 'extracted'
	| 'saved'
	| 'duplicate'
	| 'consent-wall'
	| 'error'
	| 'cancelled';

export interface ImportItemRow {
	id: string;
	userId: string;
	spaceId: string | null;
	jobId: string;
	idx: number;
	url: string;
	state: ImportItemState;
	articleId: string | null;
	warning: 'probable_consent_wall' | null;
	error: string | null;
	attempts: number;
	lastAttemptAt: string | null;
}

/**
 * Cross-user scan: which jobs need attention this tick. RLS is
 * intentionally NOT applied — the worker is a privileged consumer that
 * needs to see all users' running jobs in one pass. Per-user RLS
 * scoping is applied on the write-back path in import-extractor.ts.
 */
export async function listClaimableJobs(): Promise<ImportJobRow[]> {
	const sql = getSyncConnection();
	const rows = await sql<ChangeRow[]>`
		SELECT user_id, record_id, op, data, field_meta, created_at
		FROM sync_changes
		WHERE app_id = 'articles' AND table_name = 'articleImportJobs'
		ORDER BY user_id, record_id, created_at ASC
	`;
	const out: ImportJobRow[] = [];
	for (const m of mergeByUserAndRecord(rows).values()) {
		const job = projectJob(m.userId, m.recordId, m.merged);
		if (!job) continue;
		if (job.status !== 'running' && job.status !== 'queued') continue;
		out.push(job);
	}
	return out;
}

/**
 * Per-job item scan. Returns ALL items so the worker can compute
 * job-completion + counter deltas in one pass.
 */
export async function listItemsForJob(userId: string, jobId: string): Promise<ImportItemRow[]> {
	const sql = getSyncConnection();
	const rows = await sql<ChangeRow[]>`
		SELECT user_id, record_id, op, data, field_meta, created_at
		FROM sync_changes
		WHERE app_id = 'articles'
		  AND table_name = 'articleImportItems'
		  AND user_id = ${userId}
		ORDER BY record_id, created_at ASC
	`;
	const out: ImportItemRow[] = [];
	for (const m of mergeByUserAndRecord(rows).values()) {
		const item = projectItem(m.userId, m.recordId, m.merged);
		if (!item || item.jobId !== jobId) continue;
		out.push(item);
	}
	out.sort((a, b) => a.idx - b.idx);
	return out;
}

// ─── Internal: LWW merge per (userId, recordId) ──────────────

interface MergedEntry {
	userId: string;
	recordId: string;
	merged: Row | null;
}

function mergeByUserAndRecord(rows: readonly ChangeRow[]): Map<string, MergedEntry> {
	const out = new Map<string, MergedEntry>();
	type Cur = {
		key: string;
		userId: string;
		recordId: string;
		record: Row | null;
		/** Per-field LWW timestamps (normalised to ISO strings — see
		 *  fieldMetaTime). Both wire shapes are folded down to plain
		 *  strings here so the projection comparison stays trivial. */
		fm: Record<string, string>;
	};
	let current: Cur | null = null;
	const flush = (c: Cur) => {
		out.set(c.key, { userId: c.userId, recordId: c.recordId, merged: c.record });
	};
	for (const r of rows) {
		const key = `${r.user_id}:${r.record_id}`;
		if (!current || current.key !== key) {
			if (current) flush(current);
			current = { key, userId: r.user_id, recordId: r.record_id, record: null, fm: {} };
		}
		if (r.op === 'delete') {
			current.record = null;
			continue;
		}
		if (!r.data) continue;
		const rowCreatedAt = r.created_at.toISOString();
		if (!current.record) {
			current.record = { id: r.record_id, ...r.data };
			const initFM = r.field_meta ?? {};
			current.fm = {};
			for (const k of Object.keys(initFM)) {
				current.fm[k] = fieldMetaTime(initFM[k]) || rowCreatedAt;
			}
			continue;
		}
		const rowFM = r.field_meta ?? {};
		for (const [k, v] of Object.entries(r.data)) {
			const serverTime = fieldMetaTime(rowFM[k]) || rowCreatedAt;
			const localTime = current.fm[k] ?? '';
			if (serverTime >= localTime) {
				current.record[k] = v;
				current.fm[k] = serverTime;
			}
		}
	}
	if (current) flush(current);
	return out;
}

function projectJob(userId: string, recordId: string, merged: Row | null): ImportJobRow | null {
	if (!merged || merged.deletedAt) return null;
	const totalUrls = num(merged.totalUrls);
	const status = str(merged.status);
	if (totalUrls == null || !isJobStatus(status)) return null;
	return {
		id: recordId,
		userId,
		spaceId: optStr(merged.spaceId),
		totalUrls,
		status,
		startedAt: optStr(merged.startedAt),
		finishedAt: optStr(merged.finishedAt),
		savedCount: num(merged.savedCount) ?? 0,
		duplicateCount: num(merged.duplicateCount) ?? 0,
		errorCount: num(merged.errorCount) ?? 0,
		warningCount: num(merged.warningCount) ?? 0,
	};
}

function projectItem(userId: string, recordId: string, merged: Row | null): ImportItemRow | null {
	if (!merged || merged.deletedAt) return null;
	const jobId = str(merged.jobId);
	const url = str(merged.url);
	const state = str(merged.state);
	const idx = num(merged.idx);
	if (!jobId || !url || !isItemState(state) || idx == null) return null;
	return {
		id: recordId,
		userId,
		spaceId: optStr(merged.spaceId),
		jobId,
		idx,
		url,
		state,
		articleId: optStr(merged.articleId),
		warning: merged.warning === 'probable_consent_wall' ? 'probable_consent_wall' : null,
		error: optStr(merged.error),
		attempts: num(merged.attempts) ?? 0,
		lastAttemptAt: optStr(merged.lastAttemptAt),
	};
}

function isJobStatus(s: string): s is ImportJobRow['status'] {
	return s === 'queued' || s === 'running' || s === 'paused' || s === 'done' || s === 'cancelled';
}

function isItemState(s: string): s is ImportItemState {
	return (
		s === 'pending' ||
		s === 'extracting' ||
		s === 'extracted' ||
		s === 'saved' ||
		s === 'duplicate' ||
		s === 'consent-wall' ||
		s === 'error' ||
		s === 'cancelled'
	);
}

function num(v: unknown): number | null {
	return typeof v === 'number' && Number.isFinite(v) ? v : null;
}
function str(v: unknown): string {
	return typeof v === 'string' ? v : '';
}
function optStr(v: unknown): string | null {
	return typeof v === 'string' && v ? v : null;
}
