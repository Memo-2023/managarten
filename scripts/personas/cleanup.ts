#!/usr/bin/env bun
/**
 * Hard-delete every persona known to the catalog.
 *
 * Wipes the user row (cascades through personas, persona_actions,
 * persona_feedback, sessions, vault, organizations the user owns alone,
 * and downstream sync data). Useful after iterating on the catalog or
 * before a fresh seed run.
 *
 * Refuses to touch any user where kind != 'persona' (the admin endpoint
 * enforces this server-side too — defense in depth).
 *
 * Usage:
 *   pnpm seed:personas:cleanup
 *   pnpm seed:personas:cleanup --api=https://api.mana.how --jwt=eyJ…
 */

import { loadCatalog } from './catalog';

interface CliOptions {
	apiUrl: string;
	adminJwt: string;
}

function parseArgs(): CliOptions {
	const args = process.argv.slice(2);
	const get = (key: string): string | undefined => {
		const found = args.find((a) => a.startsWith(`--${key}=`));
		return found?.slice(`--${key}=`.length);
	};

	const apiUrl = get('api') ?? get('auth') ?? process.env.MANA_API_URL ?? 'http://localhost:3060';
	const adminJwt = get('jwt') ?? process.env.MANA_ADMIN_JWT ?? '';

	if (!adminJwt) {
		console.error('❌ Missing admin JWT. Set MANA_ADMIN_JWT or pass --jwt=…');
		process.exit(1);
	}
	return { apiUrl, adminJwt };
}

interface PersonaListEntry {
	userId: string;
	email: string;
	archetype: string;
}

async function listPersonas(opts: CliOptions): Promise<PersonaListEntry[]> {
	const res = await fetch(`${opts.apiUrl}/api/v1/personas/admin`, {
		headers: { authorization: `Bearer ${opts.adminJwt}` },
	});
	if (!res.ok) {
		throw new Error(`GET /admin/personas → ${res.status}: ${await res.text()}`);
	}
	const body = (await res.json()) as { personas: PersonaListEntry[] };
	return body.personas;
}

async function deletePersona(opts: CliOptions, userId: string, email: string): Promise<void> {
	const res = await fetch(`${opts.apiUrl}/api/v1/personas/admin/${userId}`, {
		method: 'DELETE',
		headers: { authorization: `Bearer ${opts.adminJwt}` },
	});
	if (!res.ok) {
		const body = await res.text().catch(() => '<unreadable>');
		throw new Error(`DELETE /admin/personas/${userId} → ${res.status}: ${body.slice(0, 300)}`);
	}
	console.log(`  ✓ deleted ${email}  (${userId.slice(0, 8)}…)`);
}

async function main(): Promise<void> {
	const opts = parseArgs();

	// Cross-reference catalog ↔ live to catch drift (a persona that lives
	// in the DB but not the catalog still gets deleted — cleanup means
	// "back to zero personas", not "back to catalog").
	const catalogEmails = new Set(loadCatalog().personas.map((p) => p.email));

	const live = await listPersonas(opts);
	if (live.length === 0) {
		console.log('▸ Nothing to delete — no personas in mana-auth.');
		return;
	}

	console.log(`▸ Found ${live.length} persona(s) to delete:`);
	for (const p of live) {
		const inCatalog = catalogEmails.has(p.email);
		console.log(`  · ${p.email} (${p.archetype})${inCatalog ? '' : '  [⚠ not in catalog]'}`);
	}
	console.log('');

	const failures: string[] = [];
	for (const p of live) {
		try {
			await deletePersona(opts, p.userId, p.email);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			console.error(`  ✗ ${p.email} — ${msg}`);
			failures.push(p.email);
		}
	}

	console.log('');
	if (failures.length > 0) {
		console.error(`✗ Done with ${failures.length} failure(s).`);
		process.exit(1);
	}
	console.log(`✓ Done. ${live.length} personas deleted.`);
}

void main();
