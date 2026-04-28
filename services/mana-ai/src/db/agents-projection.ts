/**
 * Agent projection — materializes the `agents` table from `sync_changes`
 * into `mana_ai.agent_snapshots` via field-level LWW, and exposes
 * per-user loaders for the tick loop.
 *
 * Shares semantics with `snapshot-refresh.ts` (mission snapshots):
 *   - incremental refresh since last_applied_at
 *   - bootstraps unseen (userId, agentId) pairs on first sighting
 *   - delete-tombstone on op='delete'
 *
 * NOT done on the server:
 *   - decrypting `systemPrompt` / `memory`. Those fields travel as
 *     `enc:1:…` strings from the webapp's encryption pipeline; the
 *     server treats ciphertext as "do not inject" and only uses
 *     plaintext fields (name, role, avatar, policy, state, budgets).
 *     If the user wants the model to see their memory/system-prompt,
 *     the foreground runner handles that mission.
 */

import type { Sql } from './connection';
import { withUser } from './connection';
import { fieldMetaTime } from './field-meta';
import type { AiPolicy } from '@mana/shared-ai';

export interface ServerAgent {
	id: string;
	userId: string;
	name: string;
	avatar?: string;
	role: string;
	/** May be an encrypted blob (`enc:1:…`) or plaintext depending on
	 *  the user's crypto setup. The runner checks for the prefix and
	 *  only injects plaintext. */
	systemPrompt?: string;
	memory?: string;
	/** Per-tool auto/propose/deny — drives the server-side tool
	 *  allowlist when Phase 4 wiring is complete. Plaintext. Undefined
	 *  on legacy agent records (pre-Phase-2 writes). */
	policy?: AiPolicy;
	state: 'active' | 'paused' | 'archived';
	maxConcurrentMissions: number;
	maxTokensPerDay?: number;
	deletedAt?: string;
}

interface SnapshotRow {
	user_id: string;
	agent_id: string;
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

export interface AgentRefreshStats {
	usersProcessed: number;
	newSnapshots: number;
	updatedSnapshots: number;
	rowsApplied: number;
}

/**
 * Fold every new `sync_changes` row (appId='ai', table='agents') into
 * its matching agent snapshot. Returns counts for logging.
 */
export async function refreshAgentSnapshots(sql: Sql): Promise<AgentRefreshStats> {
	const stats: AgentRefreshStats = {
		usersProcessed: 0,
		newSnapshots: 0,
		updatedSnapshots: 0,
		rowsApplied: 0,
	};

	const due = await sql<{ user_id: string; agent_id: string; since: Date | null }[]>`
		WITH latest AS (
			SELECT user_id, record_id AS agent_id, MAX(created_at) AS max_ts
			FROM sync_changes
			WHERE app_id = 'ai' AND table_name = 'agents'
			GROUP BY user_id, record_id
		)
		SELECT l.user_id, l.agent_id,
		       COALESCE(s.last_applied_at, 'epoch'::timestamptz) AS since
		FROM latest l
		LEFT JOIN mana_ai.agent_snapshots s
			ON s.user_id = l.user_id AND s.agent_id = l.agent_id
		WHERE l.max_ts > COALESCE(s.last_applied_at, 'epoch'::timestamptz)
	`;

	if (due.length === 0) return stats;

	for (const entry of due) {
		const outcome = await refreshOne(sql, entry.user_id, entry.agent_id, entry.since);
		stats.rowsApplied += outcome.rowsApplied;
		if (outcome.created) stats.newSnapshots++;
		else stats.updatedSnapshots++;
	}
	stats.usersProcessed = new Set(due.map((d) => d.user_id)).size;
	return stats;
}

async function refreshOne(
	sql: Sql,
	userId: string,
	agentId: string,
	since: Date | null
): Promise<{ rowsApplied: number; created: boolean }> {
	const rows = await withUser(
		sql,
		userId,
		async (tx) =>
			tx<ChangeRow[]>`
			SELECT user_id, record_id, op, data, field_meta, created_at
			FROM sync_changes
			WHERE app_id = 'ai'
			  AND table_name = 'agents'
			  AND user_id = ${userId}
			  AND record_id = ${agentId}
			  AND created_at > ${since ?? new Date(0)}
			ORDER BY created_at ASC
		`
	);
	if (rows.length === 0) return { rowsApplied: 0, created: false };

	const existing = await sql<SnapshotRow[]>`
		SELECT user_id, agent_id, record, last_applied_at
		FROM mana_ai.agent_snapshots
		WHERE user_id = ${userId} AND agent_id = ${agentId}
	`;

	const seed = existing[0];
	const syntheticPrefix: ChangeRow[] = seed
		? [
				{
					user_id: userId,
					record_id: agentId,
					op: 'insert',
					data: seed.record,
					field_meta: (seed.record.__fieldMeta as Record<string, string> | undefined) ?? null,
					created_at: seed.last_applied_at,
				},
			]
		: [];

	const merged = mergeRaw([...syntheticPrefix, ...rows]);
	if (!merged) {
		await sql`
			DELETE FROM mana_ai.agent_snapshots
			WHERE user_id = ${userId} AND agent_id = ${agentId}
		`;
		return { rowsApplied: rows.length, created: false };
	}

	const newCursor = rows[rows.length - 1].created_at;

	await sql`
		INSERT INTO mana_ai.agent_snapshots (user_id, agent_id, record, last_applied_at, updated_at)
		VALUES (${userId}, ${agentId}, ${sql.json(merged as never)}, ${newCursor}, now())
		ON CONFLICT (user_id, agent_id)
		DO UPDATE SET
			record = EXCLUDED.record,
			last_applied_at = EXCLUDED.last_applied_at,
			updated_at = now()
	`;

	return { rowsApplied: rows.length, created: !seed };
}

/** Field-level LWW reduction over ChangeRow[]. Same semantics as
 *  mission snapshots' inline merge — agents don't have cadence / due
 *  filters to apply here. Exported for unit tests only. */
export function mergeRaw(rows: readonly ChangeRow[]): Record<string, unknown> | null {
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

	if (record && (record.deletedAt as string | undefined)) return null;
	if (record) record.__fieldMeta = fm;
	return record;
}

// ─── Loaders ─────────────────────────────────────────────────

/** Load one agent by id for the given user. Returns null for
 *  unknown/deleted. */
export async function loadAgent(
	sql: Sql,
	userId: string,
	agentId: string
): Promise<ServerAgent | null> {
	const rows = await sql<SnapshotRow[]>`
		SELECT user_id, agent_id, record, last_applied_at
		FROM mana_ai.agent_snapshots
		WHERE user_id = ${userId} AND agent_id = ${agentId}
	`;
	if (rows.length === 0) return null;
	return toServerAgent(rows[0]);
}

/** Load every non-deleted agent for the user. Used by the tick to
 *  build a per-user map for fast lookup. */
export async function loadActiveAgents(sql: Sql, userId: string): Promise<ServerAgent[]> {
	const rows = await sql<SnapshotRow[]>`
		SELECT user_id, agent_id, record, last_applied_at
		FROM mana_ai.agent_snapshots
		WHERE user_id = ${userId}
		  AND (record->>'deletedAt') IS NULL
	`;
	return rows.map(toServerAgent);
}

function toServerAgent(row: SnapshotRow): ServerAgent {
	const r = row.record;
	return {
		id: String(r.id),
		userId: row.user_id,
		name: String(r.name ?? 'Unnamed'),
		avatar: typeof r.avatar === 'string' ? r.avatar : undefined,
		role: String(r.role ?? ''),
		systemPrompt: typeof r.systemPrompt === 'string' ? r.systemPrompt : undefined,
		memory: typeof r.memory === 'string' ? r.memory : undefined,
		policy:
			r.policy && typeof r.policy === 'object' && !Array.isArray(r.policy)
				? (r.policy as AiPolicy)
				: undefined,
		state: (r.state as ServerAgent['state']) ?? 'active',
		maxConcurrentMissions: Number(r.maxConcurrentMissions ?? 1),
		maxTokensPerDay: typeof r.maxTokensPerDay === 'number' ? r.maxTokensPerDay : undefined,
		deletedAt: typeof r.deletedAt === 'string' ? r.deletedAt : undefined,
	};
}
