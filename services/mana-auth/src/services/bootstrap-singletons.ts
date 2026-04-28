/**
 * Server-side singleton bootstrap.
 *
 * On first user-creation, write the singleton records that the webapp
 * would otherwise create on demand via `ensureDoc()` /
 * `getOrCreateLocalDoc()`. This makes the bootstrap deterministic —
 * every fresh client pulls the singleton from mana-sync instead of
 * racing on a local insert that the next pull would clobber.
 *
 * Currently bootstrapped:
 *   - `userContext` — per-user. The structured profile + freeform markdown
 *     blob keyed by `id='singleton'`. Default shape mirrors the webapp's
 *     `emptyUserContext()` factory in `profile/types.ts`.
 *
 * (The per-Space `kontextDoc` singleton was retired — the
 * notes.isSpaceContext flag now carries the same role, and a flagged
 * Note is created on demand by the user, not bootstrapped empty.)
 *
 * Idempotency: the function performs an existence-check on
 * `sync_changes` before inserting — if a row matching the singleton's
 * scope already exists, the call is a no-op. This makes the bootstrap
 * safe to run from multiple sources without producing duplicate rows:
 *   - signup-time hook (databaseHooks.user.create.after) — fires on the
 *     happy path
 *   - boot-time endpoint (POST /api/v1/me/bootstrap-singletons) — fires
 *     on every webapp boot as a reconciliation belt-and-suspenders
 *
 * The TOCTOU race between two concurrent callers can theoretically
 * still produce a duplicate insert, but field-LWW collapses duplicates
 * harmlessly on the client (latest `at` wins). The check is a
 * waste-reduction, not a correctness mechanism.
 */

import postgres from 'postgres';

interface Actor {
	kind: 'system';
	principalId: string;
	displayName: string;
}

const BOOTSTRAP_ACTOR: Actor = {
	kind: 'system',
	principalId: 'system:bootstrap',
	displayName: 'Bootstrap',
};

const BOOTSTRAP_CLIENT_ID = 'system:bootstrap';
const BOOTSTRAP_ORIGIN = 'system';

/**
 * Build a `field_meta` object for the bootstrap insert: every key in
 * `data` (except `id`) gets the same `at` timestamp. The receiving client
 * reads this column and populates `__fieldMeta[k] = { at, actor:
 * changeActor, origin: 'server-replay' }` — never surfaces as a conflict.
 */
function buildFieldMeta(data: Record<string, unknown>, at: string): Record<string, string> {
	const meta: Record<string, string> = {};
	for (const key of Object.keys(data)) {
		if (key === 'id') continue;
		meta[key] = at;
	}
	return meta;
}

/**
 * Default content for a new user's `userContext` singleton. Keep in sync
 * with `apps/mana/apps/web/src/lib/modules/profile/types.ts:emptyUserContext()`.
 * If the shape ever drifts, the receiving client will merge whatever
 * fields the server emits via field-LWW — extra fields stay at their
 * default (`undefined` → no override), missing fields default to the
 * client's local TypeScript shape on read.
 */
function emptyUserContextData(userId: string): Record<string, unknown> {
	return {
		id: 'singleton',
		about: {},
		interests: [],
		routine: {},
		nutrition: {},
		leisure: {},
		goals: [],
		social: {},
		freeform: '',
		interview: { answeredIds: [], skippedIds: [] },
		userId,
	};
}

/**
 * Insert the per-user singletons into mana_sync.sync_changes. Idempotent
 * — skips the insert if a row for `(userContext, 'singleton', userId)`
 * already exists. Called from the post-signUp hook in routes/auth.ts and
 * from the boot-time `/me/bootstrap-singletons` endpoint; both are
 * fire-and-forget at the caller, but the caller can also `await` it
 * (the boot endpoint does) and report failure to the client without
 * causing a write conflict.
 *
 * Returns true if an insert was actually written, false if the
 * idempotency check skipped it.
 */
export async function bootstrapUserSingletons(
	userId: string,
	syncSql: ReturnType<typeof postgres>
): Promise<boolean> {
	if (!userId) throw new Error('bootstrapUserSingletons: empty userId');

	const existing = await syncSql<Array<{ exists: number }>>`
		SELECT 1 AS exists
		FROM sync_changes
		WHERE table_name = 'userContext'
			AND record_id = 'singleton'
			AND user_id = ${userId}
		LIMIT 1
	`;
	if (existing.length > 0) return false;

	const now = new Date().toISOString();
	const data = emptyUserContextData(userId);
	const fieldMeta = buildFieldMeta(data, now);

	await syncSql`
		INSERT INTO sync_changes (
			app_id, table_name, record_id, user_id, space_id, op, data,
			field_meta, client_id, schema_version, actor, origin
		)
		VALUES (
			'profile', 'userContext', 'singleton', ${userId}, NULL, 'insert',
			${syncSql.json(data as never)},
			${syncSql.json(fieldMeta as never)},
			${BOOTSTRAP_CLIENT_ID}, 1,
			${syncSql.json(BOOTSTRAP_ACTOR as never)},
			${BOOTSTRAP_ORIGIN}
		)
	`;
	return true;
}
