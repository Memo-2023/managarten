#!/usr/bin/env node

/**
 * setup-secrets.mjs — Pull dev secrets from the Mac Mini into .env.secrets
 *
 * SSHes to mana-server, reads ~/projects/managarten/.env, and writes
 * the secret-shaped keys into a local .env.secrets file. Skips keys that
 * are already populated locally so re-running is safe.
 *
 * Usage: pnpm setup:secrets
 *
 * Requires:
 *   - SSH access to `mana-server` (Cloudflare Tunnel)
 *   - .env.secrets.example as the canonical list of secret keys
 *
 * Refuses to overwrite an existing .env.secrets without --force, so a
 * fat-fingered re-run can't blow away values you've manually edited.
 */

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';
import { createInterface } from 'readline';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = join(__dirname, '..');
const TEMPLATE_FILE = join(ROOT_DIR, '.env.secrets.example');
const TARGET_FILE = join(ROOT_DIR, '.env.secrets');
const REMOTE_HOST = 'mana-server';
const REMOTE_ENV_PATH = '~/projects/managarten/.env';

const FORCE = process.argv.includes('--force');

function parseEnvKeys(content) {
	// Returns the ordered list of keys defined in a .env file (skips
	// comments and blanks). We use this to drive what we ask the remote
	// for, so a new key in .env.secrets.example is automatically picked
	// up next time someone runs setup:secrets.
	const keys = [];
	for (const line of content.split('\n')) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const m = trimmed.match(/^([A-Z_][A-Z0-9_]*)=/);
		if (m) keys.push(m[1]);
	}
	return keys;
}

function parseEnvFile(content) {
	const env = {};
	for (const line of content.split('\n')) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) continue;
		const m = trimmed.match(/^([^=]+)=(.*)$/);
		if (m) {
			let [, key, value] = m;
			if (
				(value.startsWith('"') && value.endsWith('"')) ||
				(value.startsWith("'") && value.endsWith("'"))
			) {
				value = value.slice(1, -1);
			}
			env[key.trim()] = value;
		}
	}
	return env;
}

async function confirm(question) {
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	return new Promise((resolve) => {
		rl.question(`${question} [y/N] `, (answer) => {
			rl.close();
			resolve(/^y(es)?$/i.test(answer.trim()));
		});
	});
}

async function main() {
	if (!existsSync(TEMPLATE_FILE)) {
		console.error(`Error: ${TEMPLATE_FILE} not found.`);
		console.error('This script reads .env.secrets.example to know which keys to fetch.');
		process.exit(1);
	}

	const templateContent = readFileSync(TEMPLATE_FILE, 'utf-8');
	const wantedKeys = parseEnvKeys(templateContent);

	if (existsSync(TARGET_FILE) && !FORCE) {
		console.log(`.env.secrets already exists at ${TARGET_FILE}`);
		const ok = await confirm('Overwrite with values pulled from mana-server?');
		if (!ok) {
			console.log('Aborted. Pass --force to overwrite without prompting.');
			process.exit(0);
		}
	}

	console.log(
		`Fetching ${wantedKeys.length} secret keys from ${REMOTE_HOST}:${REMOTE_ENV_PATH}...`
	);

	let remoteContent;
	try {
		remoteContent = execSync(`ssh ${REMOTE_HOST} 'cat ${REMOTE_ENV_PATH}'`, {
			encoding: 'utf-8',
			stdio: ['ignore', 'pipe', 'pipe'],
		});
	} catch (e) {
		console.error(`Failed to read remote env: ${e.message}`);
		console.error('Check that `ssh mana-server` works from this machine.');
		process.exit(1);
	}

	const remoteEnv = parseEnvFile(remoteContent);

	// Build the new .env.secrets by walking the template line-by-line so
	// we preserve comments + ordering, but substitute real values for
	// any KEY=… line whose key exists in the remote env.
	const outputLines = [];
	let filledCount = 0;
	let missingCount = 0;
	const missingKeys = [];

	for (const line of templateContent.split('\n')) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith('#')) {
			outputLines.push(line);
			continue;
		}
		const m = trimmed.match(/^([A-Z_][A-Z0-9_]*)=/);
		if (!m) {
			outputLines.push(line);
			continue;
		}
		const key = m[1];
		if (key in remoteEnv && remoteEnv[key] !== '') {
			const value = remoteEnv[key];
			const needsQuotes = value.includes(' ') || value.includes('#');
			outputLines.push(`${key}=${needsQuotes ? `"${value}"` : value}`);
			filledCount++;
		} else {
			outputLines.push(`${key}=`);
			missingCount++;
			missingKeys.push(key);
		}
	}

	writeFileSync(TARGET_FILE, outputLines.join('\n'));
	console.log(`\nWrote ${TARGET_FILE}`);
	console.log(`  ${filledCount} key${filledCount === 1 ? '' : 's'} populated from mana-server`);
	if (missingCount > 0) {
		console.log(
			`  ${missingCount} key${missingCount === 1 ? '' : 's'} left empty (not present on mana-server):`
		);
		for (const k of missingKeys) console.log(`    - ${k}`);
		console.log('  → fill these in manually if you need them locally.');
	}
	console.log('\nNext step: run `pnpm setup:env` to propagate into per-app .env files.');
}

main().catch((e) => {
	console.error(e);
	process.exit(1);
});
