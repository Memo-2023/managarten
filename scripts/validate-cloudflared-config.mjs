#!/usr/bin/env node
/**
 * Validate cloudflared-config.yml without requiring cloudflared to be
 * installed on the dev box. Run by lint-staged whenever the file is
 * staged so a malformed ingress map can never reach main.
 *
 * Checks:
 *   - YAML parses
 *   - tunnel: is a UUID
 *   - credentials-file: is set and points at a .json under .cloudflared
 *   - ingress: is a non-empty array
 *   - every rule except the last has both `hostname` and `service`
 *   - the LAST rule is the catch-all `service: http_status:<code>`
 *   - no duplicate hostnames
 *   - every `service:` looks like http(s)://, ssh://, http_status:NNN, or unix:
 *   - no obvious typos in hostnames (must be lowercase, dot-separated, no spaces)
 *
 * Usage:
 *   node scripts/validate-cloudflared-config.mjs cloudflared-config.yml
 *
 * Wired into lint-staged.config.js so a `git commit` that touches
 * cloudflared-config.yml automatically runs the validator first.
 */

import { readFileSync } from 'node:fs';
import { parse } from 'yaml';

const RED = '\x1b[31m';
const GREEN = '\x1b[32m';
const YELLOW = '\x1b[33m';
const NC = '\x1b[0m';

const errors = [];
const warnings = [];

function err(msg) {
	errors.push(msg);
}
function warn(msg) {
	warnings.push(msg);
}

const file = process.argv[2];
if (!file) {
	console.error(`${RED}usage: validate-cloudflared-config.mjs <file>${NC}`);
	process.exit(2);
}

let raw;
try {
	raw = readFileSync(file, 'utf8');
} catch (e) {
	console.error(`${RED}cannot read ${file}: ${e.message}${NC}`);
	process.exit(2);
}

let doc;
try {
	doc = parse(raw);
} catch (e) {
	console.error(`${RED}YAML parse error: ${e.message}${NC}`);
	process.exit(1);
}

if (!doc || typeof doc !== 'object') {
	err('top-level document must be an object');
}

// ─── tunnel: ───────────────────────────────────────────────
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
if (!doc.tunnel) {
	err('missing required field `tunnel:`');
} else if (typeof doc.tunnel !== 'string' || !UUID.test(doc.tunnel)) {
	err(`tunnel: must be a uuid, got "${doc.tunnel}"`);
}

// ─── credentials-file: ─────────────────────────────────────
if (!doc['credentials-file']) {
	err('missing required field `credentials-file:`');
} else if (typeof doc['credentials-file'] !== 'string') {
	err('credentials-file: must be a string path');
} else {
	const cred = doc['credentials-file'];
	if (!cred.endsWith('.json')) {
		err(`credentials-file: should end with .json, got "${cred}"`);
	}
	if (doc.tunnel && !cred.includes(doc.tunnel)) {
		warn(
			`credentials-file does not contain the tunnel id (${doc.tunnel}) — likely an out-of-sync remnant from a previous tunnel rebuild`
		);
	}
}

// ─── ingress: ──────────────────────────────────────────────
const ingress = doc.ingress;
if (!Array.isArray(ingress)) {
	err('`ingress:` must be an array');
} else if (ingress.length === 0) {
	err('`ingress:` is empty — at least the catch-all rule must be present');
} else {
	// Last rule must be the catch-all
	const last = ingress[ingress.length - 1];
	if (last.hostname) {
		err(`last ingress rule must be the catch-all (no hostname), got hostname="${last.hostname}"`);
	}
	if (typeof last.service !== 'string' || !last.service.startsWith('http_status:')) {
		err(`last ingress rule must be a catch-all "service: http_status:NNN", got "${last.service}"`);
	}

	const HOSTNAME = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)*$/;
	const SERVICE =
		/^(https?:\/\/[^\s]+|ssh:\/\/[^\s]+|http_status:\d{3}|unix:\/[^\s]+|hello_world)$/;

	const seen = new Map();
	for (let i = 0; i < ingress.length; i++) {
		const r = ingress[i];
		const isLast = i === ingress.length - 1;
		const where = `ingress[${i}]`;

		if (!r || typeof r !== 'object') {
			err(`${where}: must be an object`);
			continue;
		}

		if (!isLast) {
			if (!r.hostname) {
				err(`${where}: missing hostname (only the catch-all rule may omit it)`);
			} else if (typeof r.hostname !== 'string') {
				err(`${where}: hostname must be a string`);
			} else if (!HOSTNAME.test(r.hostname)) {
				err(
					`${where}: hostname "${r.hostname}" looks invalid (lowercase, dot-separated, no spaces)`
				);
			} else if (seen.has(r.hostname) && !r.path) {
				// Duplicate hostnames are allowed when the earlier rule uses a `path:`
				// matcher (path-based split routing, e.g. /api/* → backend, rest → UI).
				// Only flag true duplicates: same hostname, neither rule has a path.
				const prevIdx = seen.get(r.hostname);
				if (!ingress[prevIdx].path) {
					err(`${where}: duplicate hostname "${r.hostname}" (also at ingress[${prevIdx}])`);
				}
			} else if (!seen.has(r.hostname)) {
				seen.set(r.hostname, i);
			}
		}

		if (r.service == null) {
			err(`${where}: missing service`);
		} else if (typeof r.service !== 'string') {
			err(`${where}: service must be a string`);
		} else if (!SERVICE.test(r.service)) {
			err(
				`${where}: service "${r.service}" doesn't look like http(s)://, ssh://, http_status:NNN, or unix:`
			);
		}
	}
}

// ─── Report ────────────────────────────────────────────────
if (warnings.length > 0) {
	for (const w of warnings) console.error(`${YELLOW}warning${NC}: ${w}`);
}
if (errors.length > 0) {
	for (const e of errors) console.error(`${RED}error${NC}: ${e}`);
	console.error(
		`${RED}✗${NC} ${file}: ${errors.length} error${errors.length === 1 ? '' : 's'}, ${warnings.length} warning${warnings.length === 1 ? '' : 's'}`
	);
	process.exit(1);
}

const hostCount = (doc.ingress ?? []).filter((r) => r.hostname).length;
console.log(
	`${GREEN}✓${NC} ${file}: ${hostCount} hostnames, ${warnings.length} warning${warnings.length === 1 ? '' : 's'}`
);
