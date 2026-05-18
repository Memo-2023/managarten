#!/usr/bin/env node
/**
 * Validate that no non-root package.json calls `turbo run` in a script
 * that turbo itself orchestrates. Those recursive calls are a 10+ minute
 * build hang waiting to happen — see the root CLAUDE.md §Turborepo for
 * the incident that prompted this rule.
 *
 * Rule: inside any package.json EXCEPT the repo root, the scripts
 *   { build, type-check, lint, test, test:coverage }
 * must NOT contain `turbo run`. Turbo drives them from the root; if a
 * child also calls turbo, you get N² task spawns, duplicate work, and
 * eventually a hung CI job.
 *
 * `dev` is explicitly allowed: it's persistent, usually scoped via
 * --filter, and delegating it from a parent package is the intended
 * ergonomic shortcut (e.g. `pnpm mana:dev` → turbo run dev --filter=mana...).
 *
 * Zero deps — runs as plain Node ESM. Uses `git ls-files` so it
 * automatically respects .gitignore (no node_modules traversal).
 */

import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, '..');

/** Scripts that turbo orchestrates from the root. Recursive turbo calls
 *  in these scripts are what cause the build hang. */
const FORBIDDEN_TASKS = new Set(['build', 'type-check', 'lint', 'test', 'test:coverage', 'check']);

function listPackageJsons() {
	const out = execSync('git ls-files "package.json" "**/package.json"', {
		cwd: REPO_ROOT,
		encoding: 'utf8',
	});
	return out
		.split('\n')
		.map((p) => p.trim())
		.filter(Boolean);
}

function validate() {
	const paths = listPackageJsons();
	const rootRel = 'package.json';
	const violations = [];
	let scanned = 0;

	for (const rel of paths) {
		if (rel === rootRel) continue; // root is ALLOWED to orchestrate turbo
		const abs = join(REPO_ROOT, rel);
		if (!existsSync(abs)) continue; // tracked but deleted-on-disk (rm without commit)
		scanned++;
		let pkg;
		try {
			pkg = JSON.parse(readFileSync(abs, 'utf8'));
		} catch (err) {
			violations.push(`${rel}: invalid JSON (${err.message})`);
			continue;
		}
		const scripts = pkg.scripts ?? {};
		for (const [task, cmd] of Object.entries(scripts)) {
			if (!FORBIDDEN_TASKS.has(task)) continue;
			if (typeof cmd !== 'string') continue;
			// Match `turbo run` as a whole word — don't trip on strings like
			// "turbot run" (hypothetical) or unrelated tooling.
			if (/\bturbo\s+run\b/.test(cmd)) {
				violations.push(
					`${rel}: script '${task}' calls \`turbo run\` — this causes recursion when ` +
						`the root turbo also runs '${task}'. Replace with the direct tool ` +
						`(e.g. \`tsc --noEmit\`, \`vite build\`) or remove the script entirely.`
				);
			}
		}
	}

	if (violations.length > 0) {
		console.error(`\n✗ Recursive-turbo check FAILED (${violations.length} violation(s)):\n`);
		for (const v of violations) console.error(`  • ${v}`);
		console.error(
			`\nSee CLAUDE.md §Turborepo for context. Allowed: \`dev\` scripts may call ` +
				`\`turbo run dev --filter=…\` (persistent + scoped).\n`
		);
		process.exit(1);
	}

	console.log(`✓ No recursive turbo calls: scanned ${scanned} non-root package.json files.`);
}

validate();
