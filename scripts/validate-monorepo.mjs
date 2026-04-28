#!/usr/bin/env node

/**
 * Validate Monorepo Best Practices
 *
 * Checks:
 * 1. No "turbo run" commands in child package.json files (prevents infinite loops)
 * 2. All internal packages have "private": true
 * 3. All internal dependencies use "workspace:*" protocol
 * 4. No prepublishOnly scripts in private packages
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, relative } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const MONOREPO_ROOT = join(__dirname, '..');

const errors = [];
const warnings = [];

// Colors for terminal output
const RED = '\x1b[31m';
const YELLOW = '\x1b[33m';
const GREEN = '\x1b[32m';
const RESET = '\x1b[0m';

/**
 * Find all package.json files in the monorepo
 */
function findPackageJsonFiles(dir, files = []) {
	const entries = readdirSync(dir);

	for (const entry of entries) {
		const fullPath = join(dir, entry);
		const stat = statSync(fullPath);

		// Skip node_modules and hidden directories
		if (entry === 'node_modules' || entry.startsWith('.')) {
			continue;
		}

		if (stat.isDirectory()) {
			findPackageJsonFiles(fullPath, files);
		} else if (entry === 'package.json') {
			files.push(fullPath);
		}
	}

	return files;
}

/**
 * Check if a package.json has turbo run commands (infinite loop risk)
 */
function checkTurboRecursion(packagePath, packageJson) {
	const relativePath = relative(MONOREPO_ROOT, packagePath);

	// Skip root package.json
	if (relativePath === 'package.json') {
		return;
	}

	// Check if package is in apps/, games/, packages/, or services/
	const isChildPackage =
		relativePath.startsWith('apps/') ||
		relativePath.startsWith('games/') ||
		relativePath.startsWith('packages/') ||
		relativePath.startsWith('services/');

	if (!isChildPackage) {
		return;
	}

	const scripts = packageJson.scripts || {};

	for (const [scriptName, scriptCommand] of Object.entries(scripts)) {
		if (typeof scriptCommand === 'string' && scriptCommand.includes('turbo run')) {
			// Exception: "dev" script with turbo run is sometimes OK if it filters correctly
			if (scriptName === 'dev' && scriptCommand.includes('--filter')) {
				warnings.push(
					`⚠️  ${relativePath}: "dev" script uses "turbo run" with --filter. Make sure it doesn't create infinite loops.`
				);
			} else {
				errors.push(
					`❌ ${relativePath}: "${scriptName}" script contains "turbo run" which can cause infinite loops. Remove it and let root turbo.json handle orchestration.`
				);
			}
		}
	}
}

/**
 * Check if all internal packages are marked private
 */
function checkPrivateFlag(packagePath, packageJson) {
	const relativePath = relative(MONOREPO_ROOT, packagePath);

	// Skip root
	if (relativePath === 'package.json') {
		return;
	}

	// Only check packages in packages/ and services/
	const isInternalPackage =
		relativePath.startsWith('packages/') || relativePath.startsWith('services/');

	if (!isInternalPackage) {
		return;
	}

	if (packageJson.private !== true) {
		errors.push(
			`❌ ${relativePath}: Missing "private": true. All internal packages should be private to prevent accidental npm publishing.`
		);
	}
}

/**
 * Check if all internal dependencies use workspace protocol
 */
function checkWorkspaceProtocol(packagePath, packageJson) {
	const relativePath = relative(MONOREPO_ROOT, packagePath);

	// Skip root
	if (relativePath === 'package.json') {
		return;
	}

	const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
	const internalScopes = [
		'@mana/',
		'@mana-core/',
		'@chat/',
		'@picture/',
		'@calendar/',
		'@contacts/',
		'@todo/',
		'@cards/',
		'@quotes/',
		'@voxel-lava/',
		'@mana-games/',
		'@figgos/',
		'@worldream/',
	];

	for (const [depName, depVersion] of Object.entries(deps)) {
		// Check if dependency is internal
		const isInternal = internalScopes.some((scope) => depName.startsWith(scope));

		if (isInternal && !depVersion.startsWith('workspace:')) {
			errors.push(
				`❌ ${relativePath}: Dependency "${depName}" should use "workspace:*" instead of "${depVersion}"`
			);
		}
	}
}

/**
 * Check for prepublishOnly scripts in private packages
 */
function checkPrepublishOnlyScripts(packagePath, packageJson) {
	const relativePath = relative(MONOREPO_ROOT, packagePath);

	// Skip root
	if (relativePath === 'package.json') {
		return;
	}

	// Only check private packages
	if (packageJson.private !== true) {
		return;
	}

	const scripts = packageJson.scripts || {};

	if (scripts.prepublishOnly) {
		warnings.push(
			`⚠️  ${relativePath}: Has "prepublishOnly" script but is marked private. This script won't execute. Consider removing it.`
		);
	}
}

/**
 * Main validation function
 */
function validateMonorepo() {
	console.log('🔍 Validating Monorepo Best Practices...\n');

	const packageJsonFiles = findPackageJsonFiles(MONOREPO_ROOT);

	for (const packagePath of packageJsonFiles) {
		try {
			const content = readFileSync(packagePath, 'utf-8');
			const packageJson = JSON.parse(content);

			checkTurboRecursion(packagePath, packageJson);
			checkPrivateFlag(packagePath, packageJson);
			checkWorkspaceProtocol(packagePath, packageJson);
			checkPrepublishOnlyScripts(packagePath, packageJson);
		} catch (error) {
			errors.push(`❌ Failed to parse ${relative(MONOREPO_ROOT, packagePath)}: ${error.message}`);
		}
	}

	// Print results
	console.log(`\n📊 Validation Results:`);
	console.log(`   Checked ${packageJsonFiles.length} package.json files\n`);

	if (errors.length === 0 && warnings.length === 0) {
		console.log(`${GREEN}✅ All checks passed! Monorepo follows best practices.${RESET}\n`);
		process.exit(0);
	}

	if (errors.length > 0) {
		console.log(`${RED}❌ Found ${errors.length} error(s):${RESET}\n`);
		errors.forEach((error) => console.log(`   ${error}`));
		console.log('');
	}

	if (warnings.length > 0) {
		console.log(`${YELLOW}⚠️  Found ${warnings.length} warning(s):${RESET}\n`);
		warnings.forEach((warning) => console.log(`   ${warning}`));
		console.log('');
	}

	if (errors.length > 0) {
		console.log(`${RED}❌ Validation failed. Please fix the errors above.${RESET}\n`);
		process.exit(1);
	} else {
		console.log(`${GREEN}✅ Validation passed with warnings. Consider fixing them.${RESET}\n`);
		process.exit(0);
	}
}

// Run validation
validateMonorepo();
