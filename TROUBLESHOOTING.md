# Troubleshooting Guide

Common issues and solutions for the managarten.

## Table of Contents

- [Recursive Turbo Calls](#recursive-turbo-calls)
- [Build Issues](#build-issues)
- [Linting Issues](#linting-issues)
- [NestJS Dependency Injection](#nestjs-dependency-injection)
- [Staging Deployment Issues](#staging-deployment-issues)
  - [GitHub Running Disabled Workflows](#problem-1-github-running-disabled-workflows)
  - [chat-backend Container Unhealthy](#problem-2-chat-backend-container-unhealthy)
  - [SvelteKit Static Environment Variable Imports](#problem-3-sveltekit-static-environment-variable-imports)
  - [Orphan Docker Containers](#problem-4-orphan-docker-containers)
  - [Client-Side Calling localhost Instead of Public IP](#problem-5-client-side-calling-localhost-instead-of-public-ip)
  - [CORS Blocking Cross-Origin Requests](#problem-6-cors-blocking-cross-origin-requests)
  - [Missing Database Schema](#problem-7-missing-database-schema)
  - [pnpm Symlinks Broken in Docker Container](#problem-8-pnpm-symlinks-broken-in-docker-container)
  - [Hardcoded localhost URLs in SvelteKit Web Apps](#problem-9-hardcoded-localhost-urls-in-sveltekit-web-apps)

---

## Recursive Turbo Calls

### Problem: Infinite Loop / Tasks Running Forever

**Symptoms:**

- `pnpm run build` runs for 10+ minutes without completing
- `pnpm run lint` hangs indefinitely
- `pnpm run type-check` shows thousands of duplicate task entries
- CI/CD pipelines timeout after 10+ minutes

**Root Cause:**

Parent workspace packages (e.g., `apps/quotes/package.json`, `apps/presi/package.json`) have scripts that call `turbo run <task>`, creating an **infinite recursion loop**.

### How It Happens

```
Root turbo → finds "build" script in apps/quotes/package.json
  → runs "turbo run build" in quotes
    → finds "build" script again
      → runs "turbo run build" again
        → (infinite loop!)
```

### ❌ WRONG - Causes Infinite Recursion

```json
// apps/quotes/package.json - DON'T DO THIS!
{
	"scripts": {
		"build": "turbo run build", // ❌ WRONG
		"lint": "turbo run lint", // ❌ WRONG
		"type-check": "turbo run type-check", // ❌ WRONG
		"clean": "turbo run clean" // ❌ WRONG
	}
}
```

```json
// apps/picture/package.json - DON'T DO THIS!
{
	"scripts": {
		"build": "pnpm run --recursive build", // ❌ WRONG
		"lint": "pnpm --filter '@picture/*' run lint" // ❌ WRONG
	}
}
```

### ✅ CORRECT - Let Root Turbo Handle Orchestration

```json
// apps/quotes/package.json - CORRECT
{
	"scripts": {
		"dev": "turbo run dev", // ✅ OK for dev (persistent task, scoped)
		// No build, lint, type-check scripts - handled by root turbo
		"db:push": "pnpm --filter @quotes/backend db:push", // ✅ OK
		"db:studio": "pnpm --filter @quotes/backend db:studio" // ✅ OK
	}
}
```

### Why `dev` is the Exception

Using `turbo run dev` in parent packages is acceptable because:

1. It's typically run directly on that package (scoped: `pnpm quotes:dev`)
2. Dev tasks are persistent (long-running) and turbo handles them differently
3. Root never orchestrates `dev` across all packages simultaneously

### The Rule

> **Parent workspace packages must NEVER have scripts that call `turbo run <task>` for tasks that turbo orchestrates from the root.**

Tasks orchestrated from root (defined in `turbo.json`):

- ✅ `build` - Root handles this
- ✅ `lint` - Root handles this
- ✅ `type-check` - Root handles this
- ✅ `test` - Root handles this
- ✅ `clean` - Root handles this
- ❌ `dev` - Exception (scoped usage is fine)

### How to Fix

**If you added a recursive script:**

1. Open the parent package.json (e.g., `apps/myapp/package.json`)
2. Remove the problematic script entirely:

```diff
  {
    "scripts": {
      "dev": "turbo run dev",
-     "build": "turbo run build",
-     "lint": "turbo run lint",
-     "type-check": "turbo run type-check",
      "db:push": "pnpm --filter @myapp/backend db:push"
    }
  }
```

3. The root `turbo.json` already handles orchestration for these tasks

### Affected Locations

Parent packages are located at:

- `apps/*/package.json` (e.g., `apps/quotes/package.json`)
- `games/*/package.json` (e.g., `games/mana-games/package.json`)

**Do NOT add turbo scripts here!**

Child packages (these are fine):

- `apps/*/apps/*/package.json` (e.g., `apps/quotes/apps/backend/package.json`)
- `packages/*/package.json` (e.g., `packages/shared-theme/package.json`)

---

## Build Issues

### Build Fails with "ELIFECYCLE Command failed"

**Check for:**

1. **Recursive turbo calls** (see above)
2. **Missing dependencies** in a package
3. **TypeScript errors** in source code
4. **Import/export mismatches**

**Debugging:**

```bash
# Run build and capture full output
pnpm run build 2>&1 | tee build.log

# Search for actual error (not just ELIFECYCLE)
grep -A10 "error during build" build.log

# Build specific package to isolate issue
pnpm --filter @quotes/backend build
```

### Build Times Out in CI

**Symptoms:**

- CI runs for 10+ minutes
- Timeout before completion
- "No output has been received in the last 10m0s"

**Solution:**

This is almost always caused by **recursive turbo calls**. See the [Recursive Turbo Calls](#recursive-turbo-calls) section above.

**Quick fix:**

```bash
# Locally, check if build completes in reasonable time
time pnpm run build

# Should complete in < 2 minutes for clean build
# Should complete in < 30 seconds for cached build
```

If it takes longer than 2-3 minutes, you have recursive scripts.

---

## Linting Issues

### Lint Hangs or Runs Forever

**Same issue as build** - recursive turbo calls!

**❌ WRONG:**

```json
// apps/presi/package.json - DON'T DO THIS!
{
	"scripts": {
		"lint": "pnpm --filter '@presi/*' run lint" // ❌ Recursive
	}
}
```

**✅ CORRECT:**

```json
// apps/presi/package.json - Remove the lint script
{
	"scripts": {
		"dev": "pnpm --filter '@presi/*' run dev"
		// No lint script - root turbo handles it
	}
}
```

**Run lint from root:**

```bash
# Lint all packages
pnpm run lint

# Lint specific package
pnpm --filter @presi/backend lint

# Lint specific project
pnpm turbo run lint --filter=presi
```

### ESLint Errors

**Common issues:**

1. **Missing eslint config**

   ```bash
   # Add shared config
   pnpm add -D @mana/eslint-config --filter @myapp/backend
   ```

2. **Incompatible ESLint versions**

   ```bash
   # Check versions
   pnpm ls eslint

   # Update to match root version
   pnpm add -D eslint@latest --filter @myapp/backend
   ```

---

## Prevention Checklist

When creating a new app or package:

- [ ] **DO NOT** add `build`, `lint`, `type-check`, or `test` scripts to parent packages
- [ ] **DO** add these scripts to child packages (apps/myapp/apps/backend/package.json)
- [ ] **DO** use project-specific scripts (e.g., `db:push`, `db:studio`)
- [ ] **DO** test locally: `pnpm run build` should complete in < 2 minutes
- [ ] **DO** refer to `CLAUDE.md` for patterns

### Quick Validation

```bash
# Check for problematic patterns in parent packages
for pkg in apps/*/package.json games/*/package.json; do
  if grep -q '"build".*turbo run build' "$pkg" 2>/dev/null; then
    echo "❌ RECURSIVE SCRIPT FOUND: $pkg"
  fi
done
```

---

## NestJS Dependency Injection

### Problem: "Nest can't resolve dependencies" Error

**Symptoms:**

- NestJS fails to start with error: `Nest can't resolve dependencies of the XService (?)`
- Error mentions "argument Function at index [0] is available"
- The module imports look correct but service still won't inject

**Root Cause:**

Using **type-only imports** (`import {X }`) for classes that need to be injected. TypeScript erases type-only imports at compile time, so the actual class is not available at runtime for dependency injection.

### ❌ WRONG - Type-Only Import

```typescript
// services/mana-auth/src/ai/ai.service.ts - DON'T DO THIS!
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config'; // ❌ Type-only import

@Injectable()
export class AiService {
	constructor(private configService: ConfigService) {
		// NestJS can't inject ConfigService because it was type-only imported!
	}
}
```

**What happens:**

1. TypeScript compiles the code
2. The `type` keyword tells TypeScript to erase the import at compile time
3. The compiled JS has NO import for ConfigService
4. At runtime, NestJS can't find the ConfigService class to inject
5. Error: "Nest can't resolve dependencies of the AiService (?)"

### ✅ CORRECT - Regular Import

```typescript
// services/mana-auth/src/ai/ai.service.ts - CORRECT
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config'; // ✅ Regular import

@Injectable()
export class AiService {
	constructor(private configService: ConfigService) {
		// ConfigService is properly imported and can be injected
	}
}
```

### The Rule

> **For NestJS dependency injection, NEVER use type-only imports (`import {X }`) for classes you need to inject.**

- ✅ `import { ConfigService }` - Regular import (works)
- ❌ `import {ConfigService }` - Type-only import (breaks DI)
- ✅ `import type { MyInterface }` - Type-only for interfaces (fine, not injected)
- ✅ `import {MyType, MyClass }` - Mixed (MyType erased, MyClass available)

### How to Fix

1. Find the service with the DI error
2. Check all imports for classes used in the constructor
3. Remove the `type` keyword from class imports:

```diff
  import { Injectable } from '@nestjs/common';
- import {ConfigService } from '@nestjs/config';
+ import { ConfigService } from '@nestjs/config';

  @Injectable()
  export class AiService {
    constructor(private configService: ConfigService) {}
  }
```

4. Rebuild and test:

```bash
pnpm --filter mana-auth build
pnpm --filter mana-auth start:dev
```

### Debugging

If you're still getting DI errors after removing type-only imports:

1. **Check the module imports the provider's dependencies:**

```typescript
@Module({
	imports: [ConfigModule], // ← ConfigService needs ConfigModule
	providers: [AiService],
	exports: [AiService],
})
export class AiModule {}
```

2. **Verify the compiled JavaScript:**

```bash
# Build the service
pnpm --filter mana-auth build

# Check the compiled output
cat services/mana-auth/dist/ai/ai.service.js | grep "require"

# Should see:
# const config_1 = require("@nestjs/config");  ✅ Good
# NOT:
# const config_1 = undefined;  ❌ Bad (type-only import)
```

3. **Check Docker builds:**

If the error only happens in Docker but not locally:

```bash
# Build Docker image without cache
docker build --no-cache -f services/mana-auth/Dockerfile -t test .

# Check the compiled code in the image
docker run --rm --entrypoint cat test /app/dist/ai/ai.service.js
```

### Related Issues

- [Commit d69cc607](https://github.com/Memo-2023/managarten/commit/d69cc607) - Fixed type-only ConfigService import in AiService
- TypeScript `import type` vs `import {}` - both erase at compile time
- Docker layer caching can hide fixes if source wasn't properly copied

---

## References

- [CLAUDE.md - Turborepo Configuration](./CLAUDE.md#turborepo-configuration)
- [turbo.json](./turbo.json) - Root task orchestration
- [Turborepo Docs](https://turbo.build/repo/docs)

## Getting Help

If you encounter an issue not covered here:

1. Check the [GitHub Issues](https://github.com/Memo-2023/managarten/issues)
2. Review recent commits that may have introduced the issue
3. Run `pnpm clean` and `pnpm install` to reset
4. Create a new issue with full error logs
