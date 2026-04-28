/**
 * Incremental snapshot refresh.
 *
 * Runs once per tick before `listDueMissions` is called. For every
 * (userId, missionId) combination, folds any `sync_changes` rows newer
 * than the snapshot's `last_applied_at` into the merged record.
 *
 * Bootstrap: unseen (userId, missionId) pairs get a row inserted with
 * the full-replay snapshot. Subsequent ticks apply only the delta.
 *
 * Kept intentionally simple: no concurrency control beyond the natural
 * single-instance assumption (the service runs as one process per
 * deploy today). If we ever scale to multiple instances, wrap the
 * refresh in an advisory lock keyed by user_id.
 */

import type { Sql } from './connection';
import { withUser } from './connection';
import { fieldMetaTime } from './field-meta';

interface SnapshotRow {
	user_id: string;
	mission_id: string;
	record: Record<string, unknown>;
	last_applied_at: Date;
}

interface ChangeRow {
	user_id: string;
	record_id: string;
	op: string;
	data: Record<string, unknown> | null;
	/** See `./field-meta.ts` — wire shape is two-tone (legacy ISO string
	 *  vs. F3 `{at, actor, origin}` object). */
	field_meta: Record<string, unknown> | null;
	created_at: Date;
}

export interface RefreshStats {
	usersProcessed: number;
	newSnapshots: number;
	updatedSnapshots: number;
	rowsApplied: number;
}

/**
 * Fold every new `sync_changes` row (for appId='ai', table='aiMissions')
 * into its matching snapshot. Returns counts for logging.
 */
export async function refreshSnapshots(sql: Sql): Promise<RefreshStats> {
	const stats: RefreshStats = {
		usersProcessed: 0,
		newSnapshots: 0,
		updatedSnapshots: 0,
		rowsApplied: 0,
	};

	// One cross-user sweep to find the pairs that have new rows since
	// their snapshot's cursor. Joining on mana_ai.mission_snapshots with
	// COALESCE-to-epoch so unseeded missions are included automatically.
	const due = await sql<{ user_id: string; mission_id: string; since: Date | null }[]>`
		WITH latest AS (
			SELECT user_id, record_id AS mission_id, MAX(created_at) AS max_ts
			FROM sync_changes
			WHERE app_id = 'ai' AND table_name = 'aiMissions'
			GROUP BY user_id, record_id
		)
		SELECT l.user_id, l.mission_id,
			   COALESCE(s.last_applied_at, 'epoch'::timestamptz) AS since
		FROM latest l
		LEFT JOIN mana_ai.mission_snapshots s
			ON s.user_id = l.user_id AND s.mission_id = l.mission_id
		WHERE l.max_ts > COALESCE(s.last_applied_at, 'epoch'::timestamptz)
	`;

	if (due.length === 0) return stats;

	for (const entry of due) {
		const newOrUpdated = await refreshOne(sql, entry.user_id, entry.mission_id, entry.since);
		stats.rowsApplied += newOrUpdated.rowsApplied;
		if (newOrUpdated.created) stats.newSnapshots++;
		else stats.updatedSnapshots++;
	}
	stats.usersProcessed = new Set(due.map((d) => d.user_id)).size;
	return stats;
}

async function refreshOne(
	sql: Sql,
	userId: string,
	missionId: string,
	since: Date | null
): Promise<{ rowsApplied: number; created: boolean }> {
	// RLS-scoped SELECT on sync_changes. The snapshot table itself lives
	// in the mana_ai schema (no RLS), but the source rows require the
	// same per-user scoping as every other read path in this service.
	const rows = await withUser(
		sql,
		userId,
		async (tx) =>
			tx<ChangeRow[]>`
			SELECT user_id, record_id, op, data, field_meta, created_at
			FROM sync_changes
			WHERE app_id = 'ai'
			  AND table_name = 'aiMissions'
			  AND user_id = ${userId}
			  AND record_id = ${missionId}
			  AND created_at > ${since ?? new Date(0)}
			ORDER BY created_at ASC
		`
	);
	if (rows.length === 0) return { rowsApplied: 0, created: false };

	const existing = await sql<SnapshotRow[]>`
		SELECT user_id, mission_id, record, last_applied_at
		FROM mana_ai.mission_snapshots
		WHERE user_id = ${userId} AND mission_id = ${missionId}
	`;

	const seed = existing[0];
	// If we have a prior snapshot, feed its record back in as a synthetic
	// "insert"-like row so the merge helper starts from where we left off.
	const syntheticPrefix: ChangeRow[] = seed
		? [
				{
					user_id: userId,
					record_id: missionId,
					op: 'insert',
					data: seed.record,
					field_meta: (seed.record.__fieldMeta as Record<string, string> | undefined) ?? null,
					created_at: seed.last_applied_at,
				},
			]
		: [];

	// `mergeAndFilter` filters by due+active and is therefore useless for
	// snapshot storage. Use its merge half only; inline the reduction
	// here rather than exporting another public function.
	const merged = mergeRaw([...syntheticPrefix, ...rows]);
	if (!merged) {
		// Record was deleted — drop the snapshot.
		await sql`
			DELETE FROM mana_ai.mission_snapshots
			WHERE user_id = ${userId} AND mission_id = ${missionId}
		`;
		return { rowsApplied: rows.length, created: false };
	}

	const newCursor = rows[rows.length - 1].created_at;
	const recordJson = merged as unknown;

	await sql`
		INSERT INTO mana_ai.mission_snapshots (user_id, mission_id, record, last_applied_at, updated_at)
		VALUES (${userId}, ${missionId}, ${sql.json(recordJson as never)}, ${newCursor}, now())
		ON CONFLICT (user_id, mission_id)
		DO UPDATE SET
			record = EXCLUDED.record,
			last_applied_at = EXCLUDED.last_applied_at,
			updated_at = now()
	`;

	return { rowsApplied: rows.length, created: !seed };
}

/**
 * Inline merge: reduce ChangeRow[] to a single record via field-level
 * LWW, same semantics as `mergeAndFilter` but without the due-active
 * filter (we want to persist any state, not just due ones).
 */
function mergeRaw(rows: readonly ChangeRow[]): Record<string, unknown> | null {
	let record: Record<string, unknown> | null = null;
	let fm: Record<string, string> = {};

	for (const row of rows) {
		if (row.op === 'delete') return null;
		const rowCreatedAt = row.created_at.toISOString();
		if (!record) {
			record = row.data ? { id: row.record_id, ...row.data } : { id: row.record_id };
			const initFM = row.field_meta ?? {};
			fm = {};
			for (const k of Object.keys(initFM)) {
				fm[k] = fieldMetaTime(initFM[k]) || rowCreatedAt;
			}
			continue;
		}
		if (!row.data) continue;
		const rowFM = row.field_meta ?? {};
		for (const [k, v] of Object.entries(row.data)) {
			const serverTime = fieldMetaTime(rowFM[k]) || rowCreatedAt;
			const localTime = fm[k] ?? '';
			if (serverTime >= localTime) {
				record[k] = v;
				fm[k] = serverTime;
			}
		}
	}
	if (record) record.__fieldMeta = fm;
	return record;
}
