#!/usr/bin/env node
/**
 * Cross-checks i18n key usage in code against keys defined in DE
 * locale JSONs. Two directions:
 *
 *  - **Missing**: a `$_('a.b.c')` call where `a.b.c` is not in DE.
 *    These would render as the raw key string at runtime — a
 *    user-visible bug. Tracked against a per-file baseline so the
 *    existing backlog doesn't block CI but new misses fail hard.
 *
 *  - **Dead**: a key in DE that no `$_(…)` call references (statically
 *    or via a known dynamic prefix). Reported as INFO; not enforced
 *    because the writing-key-first workflow would otherwise block.
 *
 * Dynamic suffixes via template literals (`$_(`ns.foo.${x}`)`) and
 * concatenations (`$_('ns.foo.' + x)`) become "prefix masks": every
 * key under `ns.foo.` is treated as potentially used.
 *
 * Usage:
 *   node scripts/validate-i18n-keys.mjs            # check against baseline
 *   node scripts/validate-i18n-keys.mjs --update   # rewrite baseline
 *   node scripts/validate-i18n-keys.mjs --report   # print full dead-key list
 */

import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');
const LOCALES_DIR = join(REPO_ROOT, 'apps/mana/apps/web/src/lib/i18n/locales');
const SRC_DIR = 'apps/mana/apps/web/src';
const BASELINE_PATH = join(__dirname, 'i18n-missing-baseline.json');

function flattenKeys(obj, prefix = '') {
	const keys = [];
	for (const [k, v] of Object.entries(obj)) {
		const path = prefix ? `${prefix}.${k}` : k;
		if (v && typeof v === 'object' && !Array.isArray(v)) keys.push(...flattenKeys(v, path));
		else keys.push(path);
	}
	return keys;
}

function loadDefinedKeys() {
	const defined = new Set();
	const namespaces = readdirSync(LOCALES_DIR).filter((f) =>
		statSync(join(LOCALES_DIR, f)).isDirectory()
	);
	for (const ns of namespaces) {
		const path = join(LOCALES_DIR, ns, 'de.json');
		if (!existsSync(path)) continue;
		for (const k of flattenKeys(JSON.parse(readFileSync(path, 'utf8')))) {
			defined.add(`${ns}.${k}`);
		}
	}
	return defined;
}

function scanUsages() {
	const files = execSync(`git ls-files '${SRC_DIR}/**/*.svelte' '${SRC_DIR}/**/*.ts'`, {
		cwd: REPO_ROOT,
	})
		.toString()
		.trim()
		.split('\n')
		.filter(Boolean);

	// per-key list of files where it's referenced — for nice error reporting
	const usedByFile = new Map();
	const dynamicPrefixes = new Set();

	for (const f of files) {
		const abs = join(REPO_ROOT, f);
		if (!existsSync(abs)) continue; // tracked but deleted-on-disk (rm without commit)
		const src = readFileSync(abs, 'utf8');

		// $_('a.b.c')  or  _('a.b.c')
		for (const m of src.matchAll(/\$?_\(\s*['"]([a-zA-Z][\w.-]*)['"]/g)) {
			const key = m[1];
			if (!usedByFile.has(key)) usedByFile.set(key, new Set());
			usedByFile.get(key).add(f);
		}

		// $_(`a.b.${x}`)  → prefix "a.b."
		for (const m of src.matchAll(/\$?_\(\s*`([a-zA-Z][\w.-]*\.)\$\{/g)) {
			dynamicPrefixes.add(m[1]);
		}

		// $_('a.b.' + x)  → prefix "a.b."
		for (const m of src.matchAll(/\$?_\(\s*['"]([a-zA-Z][\w.-]*\.)['"]\s*\+/g)) {
			dynamicPrefixes.add(m[1]);
		}
	}

	return { usedByFile, dynamicPrefixes };
}

function loadBaseline() {
	if (!existsSync(BASELINE_PATH)) return {};
	return JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
}

function buildPerFileMissing(usedByFile, defined) {
	// Returns: { file: { count, keys: [...] } }
	const perFile = {};
	for (const [key, files] of usedByFile) {
		if (defined.has(key)) continue;
		for (const f of files) {
			if (!perFile[f]) perFile[f] = { count: 0, keys: new Set() };
			perFile[f].count++;
			perFile[f].keys.add(key);
		}
	}
	const result = {};
	for (const [f, { count, keys }] of Object.entries(perFile)) {
		result[f] = count;
	}
	return { perFileCount: result, missingKeysByFile: perFile };
}

function main() {
	const update = process.argv.includes('--update');
	const reportMode = process.argv.includes('--report');

	const defined = loadDefinedKeys();
	const { usedByFile, dynamicPrefixes } = scanUsages();
	const used = new Set(usedByFile.keys());

	const dead = [...defined].filter(
		(k) => !used.has(k) && ![...dynamicPrefixes].some((p) => k.startsWith(p))
	);

	const { perFileCount, missingKeysByFile } = buildPerFileMissing(usedByFile, defined);
	const totalMissing = Object.values(perFileCount).reduce((a, b) => a + b, 0);

	if (reportMode) {
		console.log(`Defined keys: ${defined.size}`);
		console.log(`Statically used: ${used.size}, dynamic prefixes: ${dynamicPrefixes.size}`);
		console.log(`Dead keys (defined, never referenced): ${dead.length}`);
		console.log('\n--- top 30 dead keys ---');
		for (const k of dead.slice(0, 30)) console.log('  ' + k);
		console.log('\n--- missing keys (used, undefined) ---');
		for (const [f, info] of Object.entries(missingKeysByFile).slice(0, 20)) {
			console.log(`  ${f}: ${info.count}`);
			for (const k of [...info.keys].slice(0, 5)) console.log(`    - ${k}`);
		}
		return;
	}

	if (update) {
		const sorted = Object.fromEntries(
			Object.entries(perFileCount).sort(([a], [b]) => a.localeCompare(b))
		);
		writeFileSync(BASELINE_PATH, JSON.stringify(sorted, null, 2) + '\n');
		console.log(
			`✓ Baseline updated: ${totalMissing} missing-key reference(s) across ${Object.keys(perFileCount).length} files.`
		);
		return;
	}

	const baseline = loadBaseline();
	const baselineTotal = Object.values(baseline).reduce((a, b) => a + b, 0);
	const violations = [];
	for (const [file, n] of Object.entries(perFileCount)) {
		const b = baseline[file] ?? 0;
		if (n > b) {
			violations.push({
				file,
				current: n,
				baseline: b,
				delta: n - b,
				keys: [...missingKeysByFile[file].keys].filter(
					(k) => !(baseline[file] && false) // we don't track which exact keys were baselined; show all
				),
			});
		}
	}

	if (violations.length > 0) {
		console.error(
			`\n✗ i18n missing-key check FAILED — ${violations.length} file(s) over baseline:\n`
		);
		for (const v of violations.slice(0, 20)) {
			console.error(`  ${v.file}: ${v.current} (was ${v.baseline}, +${v.delta})`);
			for (const k of v.keys.slice(0, 3)) console.error(`    - ${k}`);
			if (v.keys.length > 3) console.error(`    … +${v.keys.length - 3} more keys`);
		}
		if (violations.length > 20) console.error(`  … +${violations.length - 20} more files`);
		console.error(
			`\nA $_('…') call references a key that does not exist in any DE locale.\n` +
				`At runtime this renders as the raw key string. Add the key to the\n` +
				`appropriate locales/<ns>/de.json (parity validator will demand the\n` +
				`other locales) — or fix the typo.\n` +
				`If intentional (e.g. you renamed away a key still being referenced\n` +
				`in legacy code), run: pnpm run validate:i18n-keys -- --update\n`
		);
		process.exit(1);
	}

	const shrunk = Object.keys(baseline).filter((f) => (perFileCount[f] ?? 0) < baseline[f]).length;
	const cleaned = Object.keys(baseline).filter((f) => !(f in perFileCount)).length;

	console.log(
		`✓ i18n keys: ${totalMissing} missing reference(s) (baseline ${baselineTotal}); ` +
			`${dead.length} dead key(s) defined but unused.` +
			(shrunk || cleaned
				? `\n  ${shrunk} file(s) shrunk, ${cleaned} file(s) fully cleaned — ` +
					`run 'pnpm run validate:i18n-keys -- --update' to ratchet.`
				: '')
	);
}

main();
