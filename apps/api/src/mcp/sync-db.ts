/**
 * Backwards-compatible re-export shim. The actual implementation lives
 * at `apps/api/src/lib/sync-db.ts`; this file just keeps existing
 * MCP-side import paths working while non-MCP consumers (articles
 * bulk-import worker, forms module, …) import from `lib/` directly.
 */

export {
	getSyncConnection,
	withUser,
	readLatestRecords,
	writeRecord,
	type SyncSql,
} from '../lib/sync-db';
