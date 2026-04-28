/**
 * Wire-shape adapter for `sync_changes.field_meta`.
 *
 * Two shapes coexist on the wire today:
 *
 *   - Legacy plaintext writes:   { state: 'ISO-8601' }
 *   - Field-meta-overhaul (F3):  { state: { at, actor, origin } }
 *
 * Every projection / snapshot-refresh in this service performs LWW
 * merges by string-comparing the per-field timestamp. A naive
 * `rowFM[k] >= localTime` works for the all-legacy case but silently
 * collapses the moment one side is an F3 object — the comparison
 * becomes `'[object Object]' >= 'ISO-…'` (false), the older value
 * wins and the projection lies.
 *
 * This single helper folds both shapes into a comparable ISO string.
 * Any consumer that reads `field_meta` for LWW MUST go through it.
 *
 * Same helper exists in `apps/api/src/modules/articles/import-projection.ts`
 * (kept duplicated for now — both services treat sync_changes as a
 * read-only event log; sharing infrastructure code across services
 * is out of scope here).
 */

/**
 * Returns the ISO-string timestamp of a single `field_meta[k]` slot,
 * regardless of whether the wire format is the legacy plain string
 * or the F3 `{ at, actor, origin }` object. Returns the empty string
 * when no usable value is present so the LWW comparison treats the
 * field as never-stamped (callers fall back to row.created_at).
 */
export function fieldMetaTime(meta: unknown): string {
	if (typeof meta === 'string') return meta;
	if (meta && typeof meta === 'object') {
		const at = (meta as { at?: unknown }).at;
		if (typeof at === 'string') return at;
	}
	return '';
}
