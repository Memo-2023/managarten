/**
 * Missions projection — replays `sync_changes` rows for appId='ai',
 * table='aiMissions' into live Mission records using field-level LWW.
 *
 * This mirrors what the webapp's `applyServerChanges` does in Dexie but
 * runs against Postgres. Kept deliberately dumb: no caching, no
 * incremental updates, full replay on every tick. Missions per user are
 * bounded (~dozens at most) so O(N) replay is fine for a once-a-minute
 * scheduler. Revisit when users hit >1000 missions or the tick misses
 * its deadline.
 */

import type { MissionGrant } from '@mana/shared-ai';
import type { Sql } from './connection';
import { fieldMetaTime } from './field-meta';

/**
 * Subset of the Mission shape the server needs. Matches
 * `apps/mana/apps/web/src/lib/data/ai/missions/types.ts` — keep in sync.
 */
export interface ServerMission {
	id: string;
	userId: string;
	title: string;
	objective: string;
	conceptMarkdown: string;
	state: 'active' | 'paused' | 'done' | 'archived';
	nextRunAt: string | undefined;
	inputs: { module: string; table: string; id: string }[];
	cadence: unknown; // opaque — the browser Runner owns cadence math
	iterations: unknown[]; // opaque — server just reads count
	/** Present iff the mission has a Key-Grant attached — enables
	 *  decryption of encrypted-table inputs during this tick. */
	grant?: MissionGrant;
	/** Owning Agent id (Multi-Agent Workbench). Undefined on legacy
	 *  missions; tick loads the agent when present to inject
	 *  systemPrompt + memory into the Planner prompt and to stamp the
	 *  server-iteration actor with the correct principal. */
	agentId?: string;
}

interface ChangeRow {
	table_name: string;
	record_id: string;
	user_id: string;
	op: string;
	data: Record<string, unknown> | null;
	/**
	 * Two-shaped on the wire:
	 *   - Legacy plaintext writes:   { state: 'ISO-8601' }
	 *   - F3 field-meta-overhaul:    { state: { at, actor, origin } }
	 * The merge uses `fieldMetaTime` to fold both into a comparable string.
	 */
	field_meta: Record<string, unknown> | null;
	created_at: Date;
}

// fieldMetaTime imported from ./field-meta — see comment in that file.

/**
 * Return all currently-active missions whose `nextRunAt` has passed.
 *
 * Reads from the materialized `mana_ai.mission_snapshots` table via a
 * single indexed WHERE clause — no per-tick LWW replay. The snapshot is
 * kept up-to-date by `refreshSnapshots(sql)` which the tick calls once
 * before this.
 *
 * Fallback: for users whose mission predates the snapshot bootstrap
 * (e.g. first run after deploy), `refreshSnapshots` inserts a row on
 * the next tick and this query picks them up on the tick after that —
 * at most one tick lag, acceptable for a 60s interval.
 *
 * @param now ISO timestamp used as the due-before cutoff.
 */
export async function listDueMissions(sql: Sql, now: string): Promise<ServerMission[]> {
	const rows = await sql<{ user_id: string; record: Record<string, unknown> }[]>`
		SELECT user_id, record
		FROM mana_ai.mission_snapshots
		WHERE record->>'state' = 'active'
		  AND record->>'nextRunAt' IS NOT NULL
		  AND record->>'nextRunAt' <= ${now}
		  AND (record->>'deletedAt') IS NULL
	`;

	return rows.map(({ user_id, record }) => ({
		id: String(record.id),
		userId: user_id,
		title: String(record.title ?? ''),
		objective: String(record.objective ?? ''),
		conceptMarkdown: String(record.conceptMarkdown ?? ''),
		state: record.state as ServerMission['state'],
		nextRunAt: record.nextRunAt as string | undefined,
		inputs: Array.isArray(record.inputs) ? (record.inputs as ServerMission['inputs']) : [],
		cadence: record.cadence,
		iterations: Array.isArray(record.iterations) ? record.iterations : [],
		grant: (record.grant ?? undefined) as MissionGrant | undefined,
		agentId: typeof record.agentId === 'string' ? record.agentId : undefined,
	}));
}

/**
 * Merge `sync_changes` rows for ONE user's aiMissions set via field-level
 * LWW, then filter down to due + active records.
 *
 * Pure function — no DB access, no ambient state. Exported for tests.
 */
export function mergeAndFilter(
	rows: readonly ChangeRow[],
	userId: string,
	now: string
): ServerMission[] {
	const merged = new Map<string, Record<string, unknown>>();

	for (const row of rows) {
		const existing = merged.get(row.record_id);

		if (row.op === 'delete') {
			merged.delete(row.record_id);
			continue;
		}

		if (!existing) {
			if (row.data) {
				merged.set(row.record_id, { id: row.record_id, ...row.data });
			}
			continue;
		}

		const prevFM = (existing.__fieldMeta as Record<string, string> | undefined) ?? {};
		const nextFM = { ...prevFM };
		if (row.data) {
			const rowCreatedAt = row.created_at.toISOString();
			for (const [k, v] of Object.entries(row.data)) {
				const serverTime = fieldMetaTime(row.field_meta?.[k]) || rowCreatedAt;
				const localTime = prevFM[k] ?? '';
				if (serverTime >= localTime) {
					existing[k] = v;
					nextFM[k] = serverTime;
				}
			}
		}
		existing.__fieldMeta = nextFM;
	}

	const missions: ServerMission[] = [];
	for (const record of merged.values()) {
		const state = record.state as ServerMission['state'];
		const nextRunAt = record.nextRunAt as string | undefined;
		const deletedAt = record.deletedAt as string | undefined;
		if (deletedAt) continue;
		if (state !== 'active') continue;
		if (!nextRunAt || nextRunAt > now) continue;

		missions.push({
			id: String(record.id),
			userId,
			title: String(record.title ?? ''),
			objective: String(record.objective ?? ''),
			conceptMarkdown: String(record.conceptMarkdown ?? ''),
			state,
			nextRunAt,
			inputs: Array.isArray(record.inputs) ? (record.inputs as ServerMission['inputs']) : [],
			cadence: record.cadence,
			iterations: Array.isArray(record.iterations) ? record.iterations : [],
			grant: (record.grant ?? undefined) as MissionGrant | undefined,
			agentId: typeof record.agentId === 'string' ? record.agentId : undefined,
		});
	}
	return missions;
}
