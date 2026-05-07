import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;

/**
 * Lazy singleton — caller passes the url, but reuses the pool across
 * the lifetime of the process. drizzle-kit cli skips this and opens
 * its own connection from drizzle.config.ts.
 */
export function getDb(url: string) {
	if (_db) return _db;
	const client = postgres(url, {
		max: 10,
		idle_timeout: 20,
		connect_timeout: 10,
	});
	_db = drizzle(client, { schema });
	return _db;
}

export type Database = ReturnType<typeof getDb>;
