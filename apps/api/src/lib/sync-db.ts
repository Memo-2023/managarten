/**
 * Connection helpers for the `mana_sync` database (the shared sync
 * event log). Multiple modules read/write `sync_changes` directly:
 *
 *   - apps/api MCP tools (apps/api/src/mcp/executor.ts)
 *   - apps/api articles bulk-import worker (modules/articles/import-*.ts)
 *   - apps/api forms module (modules/forms/public-routes.ts)
 *
 * Lives under lib/ rather than mcp/ so non-MCP consumers don't depend
 * on the MCP module. Originally introduced for MCP and later
 * generalised — the legacy import path via `mcp/sync-db.ts` re-exports
 * from here for backwards compatibility.
 *
 * Connection uses SYNC_DATABASE_URL (same env var as services/mana-ai).
 */

import postgres from 'postgres';

const SYNC_DATABASE_URL =
	process.env.SYNC_DATABASE_URL ?? 'postgresql://mana:devpassword@localhost:5432/mana_sync';

let syncPool: ReturnType<typeof postgres> | null = null;

/** Returns the shared sync database connection pool. */
export function getSyncConnection() {
	if (!syncPool) {
		syncPool = postgres(SYNC_DATABASE_URL, { max: 5, idle_timeout: 30 });
	}
	return syncPool;
}

export type SyncSql = ReturnType<typeof postgres>;

/**
 * Run a callback within an RLS-scoped transaction for the given user.
 * Sets `app.current_user_id` so the sync_changes RLS policy allows
 * reads and writes only for that user's data.
 */
export async function withUser<T>(
	userId: string,
	fn: (tx: postgres.TransactionSql<Record<string, never>>) => Promise<T>
): Promise<T> {
	if (!userId) throw new Error('withUser: empty userId');
	const sql = getSyncConnection();
	return sql.begin(async (tx) => {
		await tx`SELECT set_config('app.current_user_id', ${userId}, true)`;
		return fn(tx);
	}) as Promise<T>;
}

/**
 * Read the latest version of all records for a user + app + table from
 * sync_changes. Applies field-level LWW to reconstruct current state.
 *
 * This is the server-side equivalent of the Dexie liveQuery: it replays
 * the sync_changes log to build the latest record versions. For small
 * datasets this is fine; for large tables we'll need materialized
 * snapshots (like mana-ai's mission_snapshots).
 */
export async function readLatestRecords(
	userId: string,
	appId: string,
	tableName: string
): Promise<Record<string, unknown>[]> {
	const sql = getSyncConnection();
	// Get the latest change per record_id (by created_at desc), then
	// reconstruct the record. Only include non-deleted records.
	const rows = await sql<{ record_id: string; data: Record<string, unknown>; op: string }[]>`
		SELECT DISTINCT ON (record_id)
			record_id, data, op
		FROM sync_changes
		WHERE user_id = ${userId}
			AND app_id = ${appId}
			AND table_name = ${tableName}
		ORDER BY record_id, created_at DESC
	`;

	// Filter out deleted records and records with delete ops
	return rows
		.filter((r) => r.op !== 'delete' && r.data && !(r.data as Record<string, unknown>).deletedAt)
		.map((r) => r.data);
}

/**
 * Write a new record via sync_changes INSERT. The record will appear
 * on the user's devices on their next sync cycle.
 *
 * MCP-Tool calls always carry `origin='agent'` because the pipeline
 * that produced the value is an AI agent invoking a tool — the
 * actor's `kind` may be `system` (the MCP server itself) but the
 * write semantics are agent-driven for conflict-detection purposes.
 */
export async function writeRecord(
	userId: string,
	appId: string,
	tableName: string,
	recordId: string,
	op: 'insert' | 'update' | 'delete',
	data: Record<string, unknown>,
	fieldMeta: Record<string, string>
): Promise<void> {
	await withUser(userId, async (tx) => {
		await tx`
			INSERT INTO sync_changes
				(app_id, table_name, record_id, user_id, op, data, field_meta, client_id, schema_version, actor, origin)
			VALUES
				(${appId}, ${tableName}, ${recordId}, ${userId}, ${op},
				 ${tx.json(data as never)}, ${tx.json(fieldMeta as never)},
				 'mcp-server', 1,
				 ${tx.json({ kind: 'system', principalId: 'system:mcp', displayName: 'MCP Server' } as never)},
				 'agent')
		`;
	});
}
