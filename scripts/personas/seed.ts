#!/usr/bin/env bun
/**
 * Seed the persona catalog via apps/api.
 *
 * Idempotent: re-running upserts metadata, never duplicates users. New
 * personas in catalog.json get registered; existing ones get their
 * descriptor refreshed.
 *
 * After the platform/product split, the personas admin endpoint lives
 * in apps/api (which talks to mana-auth via service-key for user
 * lifecycle). The script targets MANA_API_URL, defaulting to
 * http://localhost:3060.
 *
 * Requires:
 *   - apps/api running (default http://localhost:3060)
 *   - mana-auth running (apps/api calls it for register + persona-stamp)
 *   - An admin-tier user JWT (export MANA_ADMIN_JWT or pass --jwt=…)
 *   - PERSONA_SEED_SECRET in env (or accept the dev fallback locally)
 *
 * Usage:
 *   pnpm seed:personas
 *   pnpm seed:personas --api=https://api.mana.how --jwt=eyJ…
 */

import { loadCatalog, type PersonaSpec } from './catalog';
import { personaPassword } from './password';

interface CliOptions {
	apiUrl: string;
	adminJwt: string;
	dryRun: boolean;
}

function parseArgs(): CliOptions {
	const args = process.argv.slice(2);
	const get = (key: string): string | undefined => {
		const found = args.find((a) => a.startsWith(`--${key}=`));
		return found?.slice(`--${key}=`.length);
	};

	// Accept --api= going forward; --auth= still works as a legacy alias
	// since some shells/scripts already cache the old flag.
	const apiUrl = get('api') ?? get('auth') ?? process.env.MANA_API_URL ?? 'http://localhost:3060';
	const adminJwt = get('jwt') ?? process.env.MANA_ADMIN_JWT ?? '';
	const dryRun = args.includes('--dry-run');

	if (!adminJwt) {
		console.error(
			'❌ Missing admin JWT. Set MANA_ADMIN_JWT or pass --jwt=… (must be a token for a user with role=admin).'
		);
		process.exit(1);
	}

	return { apiUrl, adminJwt, dryRun };
}

async function upsertPersona(opts: CliOptions, p: PersonaSpec): Promise<void> {
	const password = personaPassword(p.email);
	const body = {
		email: p.email,
		name: p.name,
		password,
		archetype: p.archetype,
		systemPrompt: p.systemPrompt,
		moduleMix: p.moduleMix,
		tickCadence: p.tickCadence,
	};

	if (opts.dryRun) {
		console.log(`  · would upsert ${p.email} (${p.archetype})`);
		return;
	}

	const res = await fetch(`${opts.apiUrl}/api/v1/personas/admin`, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			authorization: `Bearer ${opts.adminJwt}`,
		},
		body: JSON.stringify(body),
	});

	if (!res.ok) {
		const text = await res.text().catch(() => '<unreadable body>');
		throw new Error(`POST /personas/admin → ${res.status}: ${text.slice(0, 300)}`);
	}

	const result = (await res.json()) as { ok: true; userId: string; email: string };
	console.log(`  ✓ ${result.email}  (${p.archetype})  user=${result.userId.slice(0, 8)}…`);
}

async function main(): Promise<void> {
	const opts = parseArgs();
	const { personas } = loadCatalog();

	console.log(`▸ Persona catalog: ${personas.length} entries`);
	console.log(`▸ API URL:  ${opts.apiUrl}`);
	if (opts.dryRun) console.log('▸ DRY-RUN — no requests will be sent');
	console.log('');

	const failures: Array<{ email: string; error: string }> = [];
	for (const persona of personas) {
		try {
			await upsertPersona(opts, persona);
		} catch (err) {
			const msg = err instanceof Error ? err.message : String(err);
			console.error(`  ✗ ${persona.email}  — ${msg}`);
			failures.push({ email: persona.email, error: msg });
		}
	}

	console.log('');
	if (failures.length > 0) {
		console.error(`✗ Done with ${failures.length} failure(s).`);
		process.exit(1);
	}
	console.log(`✓ Done. ${personas.length} personas upserted.`);
}

void main();
