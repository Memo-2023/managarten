/**
 * Encryption wrapper — Phase-1 stub.
 *
 * The full Mana crypto stack (vault server roundtrip, KEK-wrapped
 * master key, recovery codes, zero-knowledge mode) lives in the mana
 * web app under `apps/mana/.../data/crypto/`. Lifting it intact into
 * the standalone Cards app is a Phase-2 task — it requires a vault
 * client, key provider, and boot-race handling that aren't worth
 * dragging in until we have the deployment story for them.
 *
 * For Phase 1 these helpers are intentionally identity functions:
 * data lands in IndexedDB and on `mana-sync` as plaintext. Everything
 * is wired up at the right call sites (stores → write, queries → read,
 * sync.applyServerChanges → apply) so flipping to real encryption is a
 * single-file change here, not a sweep through every store.
 *
 * Allowlist is the contract with the future vault. It mirrors the
 * mana-modul registry exactly so when sync converges, the same fields
 * are protected on both ends.
 */

const ENCRYPTED_FIELDS: Record<string, readonly string[]> = {
	cards: ['front', 'back', 'fields'],
	cardDecks: ['name', 'description'],
};

/**
 * Phase-1 identity. Phase-2 swap-in: import `wrapValue` from
 * `@mana/shared-crypto`, fetch master key from the vault, encrypt
 * each allowlisted field in place.
 */
export async function encryptRecord<T extends object>(tableName: string, record: T): Promise<T> {
	void ENCRYPTED_FIELDS[tableName];
	return record;
}

export async function decryptRecord<T extends object>(_tableName: string, record: T): Promise<T> {
	return record;
}

export async function decryptRecords<T extends object>(
	tableName: string,
	records: T[]
): Promise<T[]> {
	if (records.length === 0) return records;
	return Promise.all(records.map((r) => decryptRecord(tableName, r)));
}

/**
 * Reports the fields that *will* be encrypted once the vault is on.
 * Stays exported so the GUIDELINES audit script can prove parity with
 * the mana-modul registry.
 */
export function encryptedFieldsFor(tableName: string): readonly string[] {
	return ENCRYPTED_FIELDS[tableName] ?? [];
}
