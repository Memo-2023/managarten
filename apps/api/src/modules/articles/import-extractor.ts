/**
 * Articles Bulk-Import — per-item extraction + write-back.
 *
 * For one `articleImportItems` row in state='pending':
 *
 *   1. Flip to state='extracting' (so other ticks / the UI see progress).
 *   2. Run `extractFromUrl` against the URL.
 *   3a. On success → write a `articleExtractPickup` row carrying the
 *       full ExtractedArticle payload + flip the item to 'extracted'.
 *       The client-side pickup-consumer picks it up, encrypts the
 *       article into the user's IndexedDB, and flips the item to 'saved'
 *       (or 'consent-wall' if the warning fired).
 *   3b. On failure → bump `attempts`, flip back to 'pending' if
 *       attempts < 3, else flip to state='error' with the technical
 *       error message.
 *
 * Every state-change is one `sync_changes` row attributed to the
 * `system:articles-import-worker` actor (built inline below — kept out
 * of the shared-ai SystemSource union for now to keep the worker self-
 * contained; can be hoisted later). Origin is `'system'` so the
 * conflict-detection gate on the client doesn't surface these as
 * user-visible toasts.
 *
 * Plan: docs/plans/articles-bulk-import.md.
 */

import { extractFromUrl } from '@mana/shared-rss';
import { makeFieldMeta, type Actor, type FieldOrigin } from '@mana/shared-ai';
import { getSyncConnection } from '../../mcp/sync-db';
import { looksLikeConsentWall } from './consent-wall';
import type { ImportItemRow } from './import-projection';

const MAX_ATTEMPTS = 3;
const CLIENT_ID = 'articles-import-worker';

/** System-actor blob stamped on every worker write. Built inline because
 *  the underlying SystemSource union in @mana/shared-ai isn't extended
 *  here — both fields are runtime values, not type discriminators, so
 *  this composes cleanly without a shared-ai change. */
const WORKER_ACTOR: Actor = Object.freeze({
	kind: 'system' as const,
	principalId: 'system:articles-import-worker',
	displayName: 'Artikel-Import',
});
const WORKER_ORIGIN: FieldOrigin = 'system';

export interface ExtractStats {
	itemId: string;
	terminal: 'pending' | 'extracted' | 'error';
}

/**
 * Run one extraction round-trip for a single item. Idempotent at the
 * sync_changes level — if two ticks race the same item the field-LWW
 * merge yields a single coherent state on the client.
 */
export async function extractOneItem(item: ImportItemRow): Promise<ExtractStats> {
	if (item.state !== 'pending') {
		return {
			itemId: item.id,
			terminal: item.state === 'error' ? 'error' : 'extracted',
		};
	}

	// Step 1 — claim. Flip the item to 'extracting' before the slow
	// fetch so concurrent ticks (and the UI) see we own it.
	const nowClaim = new Date().toISOString();
	await writeItemUpdate(item.userId, item.id, {
		state: 'extracting',
		lastAttemptAt: nowClaim,
		attempts: item.attempts + 1,
	});

	// Step 2 — fetch + parse. Hard-failure path returns null; we treat
	// that as a single failed attempt and recycle.
	const extracted = await extractFromUrl(item.url);
	const nowDone = new Date().toISOString();

	if (!extracted) {
		const nextAttempts = item.attempts + 1;
		const nextState = nextAttempts >= MAX_ATTEMPTS ? 'error' : 'pending';
		await writeItemUpdate(item.userId, item.id, {
			state: nextState,
			error: nextState === 'error' ? 'Extraktion fehlgeschlagen nach mehreren Versuchen.' : null,
			lastAttemptAt: nowDone,
		});
		return { itemId: item.id, terminal: nextState === 'error' ? 'error' : 'pending' };
	}

	// Step 3 — write the Pickup row (server payload for the client) and
	// flip item state to 'extracted' so the consume-pickup path picks it
	// up. Pickup row first so a client liveQuery seeing the 'extracted'
	// state can immediately find the matching pickup payload.
	const pickupId = `pickup-${item.id}`;
	const wordCount = extracted.wordCount ?? 0;
	const readingTimeMinutes = extracted.readingTimeMinutes ?? 0;
	const warning = looksLikeConsentWall(extracted.content, wordCount)
		? 'probable_consent_wall'
		: null;

	await writePickupInsert(item.userId, pickupId, {
		itemId: item.id,
		spaceId: item.spaceId ?? null,
		payload: {
			originalUrl: item.url,
			title: extracted.title ?? '',
			excerpt: extracted.excerpt ?? null,
			content: extracted.content,
			htmlContent: extracted.htmlContent ?? '',
			author: extracted.byline ?? null,
			siteName: extracted.siteName ?? null,
			wordCount,
			readingTimeMinutes,
			...(warning && { warning }),
		},
	});

	await writeItemUpdate(item.userId, item.id, {
		state: 'extracted',
		warning,
		error: null,
		lastAttemptAt: nowDone,
	});

	return { itemId: item.id, terminal: 'extracted' };
}

// ─── Sync-changes write helpers (worker-attributed) ──────────

/**
 * Worker-attributed update on an `articleImportItems` row. Exported so
 * the worker tick can flip pending items to 'cancelled' when the parent
 * job is cancelled, without going through the extraction pipeline.
 */
export async function writeItemUpdate(
	userId: string,
	itemId: string,
	patch: Record<string, unknown>
): Promise<void> {
	await insertSyncChange({
		userId,
		recordId: itemId,
		appId: 'articles',
		tableName: 'articleImportItems',
		op: 'update',
		data: patch,
	});
}

async function writePickupInsert(
	userId: string,
	pickupId: string,
	data: Record<string, unknown>
): Promise<void> {
	await insertSyncChange({
		userId,
		recordId: pickupId,
		appId: 'articles',
		tableName: 'articleExtractPickup',
		op: 'insert',
		data,
	});
}

/**
 * Worker-attributed update on an `articleImportJobs` row. Counter-only
 * for now (savedCount, errorCount, …) plus status flips like
 * 'queued' → 'running' and 'running' → 'done'.
 */
export async function writeJobUpdate(
	userId: string,
	jobId: string,
	patch: Record<string, unknown>
): Promise<void> {
	await insertSyncChange({
		userId,
		recordId: jobId,
		appId: 'articles',
		tableName: 'articleImportJobs',
		op: 'update',
		data: patch,
	});
}

interface InsertParams {
	userId: string;
	recordId: string;
	appId: string;
	tableName: string;
	op: 'insert' | 'update' | 'delete';
	data: Record<string, unknown>;
}

async function insertSyncChange(params: InsertParams): Promise<void> {
	const sql = getSyncConnection();
	const now = new Date().toISOString();
	const fieldMeta: Record<string, unknown> = {};
	for (const key of Object.keys(params.data)) {
		fieldMeta[key] = makeFieldMeta(now, WORKER_ACTOR, WORKER_ORIGIN);
	}
	const actorJson = WORKER_ACTOR as unknown;
	const dataJson = params.data as unknown;
	const fmJson = fieldMeta as unknown;
	await sql.begin(async (tx) => {
		await tx`SELECT set_config('app.current_user_id', ${params.userId}, true)`;
		await tx`
			INSERT INTO sync_changes
				(app_id, table_name, record_id, user_id, op, data, field_meta, client_id, schema_version, actor, origin)
			VALUES
				(${params.appId}, ${params.tableName}, ${params.recordId}, ${params.userId}, ${params.op},
				 ${tx.json(dataJson as never)}, ${tx.json(fmJson as never)},
				 ${CLIENT_ID}, 1, ${tx.json(actorJson as never)}, ${WORKER_ORIGIN})
		`;
	});
}

// looksLikeConsentWall lives in ./consent-wall.ts — shared with routes.ts.
