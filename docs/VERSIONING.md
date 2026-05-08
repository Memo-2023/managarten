# Versioning Strategy

## Overview

This monorepo uses **independent semantic versioning** per app, managed by [Changesets](https://github.com/changesets/changesets).

## Semantic Versioning (SemVer)

All apps follow `MAJOR.MINOR.PATCH`:
- **MAJOR** (1.x.x): Breaking changes, major rewrites
- **MINOR** (x.1.x): New features, significant improvements
- **PATCH** (x.x.1): Bug fixes, minor improvements

## Version Tiers

| Tier | Range | Criteria |
|------|-------|----------|
| **Production** | 1.0.0+ | Audit >=85, Tests >=80%, deployed 2+ months |
| **Stable Beta** | 0.3.0+ | Deployed, audit >=75, has tests |
| **Beta** | 0.2.0+ | Functional, deployed or ready to deploy |
| **Early Beta** | 0.1.0+ | Core features working, architecture solid |
| **Alpha** | 0.0.x | Early development, experimental |

## Current Versions

### Apps

| App | Version | Status |
|-----|---------|--------|
| Calendar | 1.0.0 | Production |
| Contacts | 1.0.0 | Production |
| Todo | 1.0.0 | Production |
| Chat | 0.3.0 | Stable Beta |
| Picture | 0.3.0 | Stable Beta |
| Mukke | 0.2.0 | Beta |
| Quotes | 0.2.0 | Beta |
| Clock | 0.2.0 | Beta |
| Food | 0.2.0 | Beta |
| Cardecky | 0.2.0 | Beta |
| Mana | 0.2.0 | Beta |
| Matrix | 0.2.0 | Beta |
| Photos | 0.2.0 | Beta |
| Skilltree | 0.2.0 | Beta |
| Presi | 0.2.0 | Beta |
| Storage | 0.2.0 | Beta |
| Context | 0.1.0 | Early Beta |
| Planta | 0.1.0 | Early Beta |
| Questions | 0.1.0 | Early Beta |
| Traces | 0.0.1 | Alpha |

### Services

| Service | Version | Status |
|---------|---------|--------|
| mana-auth | 1.0.0 | Production |
| mana-search | 0.1.0 | Early Beta |
| mana-crawler | 0.1.0 | Early Beta |
| mana-llm | 0.0.1 | Alpha |
| mana-notify | 0.0.1 | Alpha |

## How to Use

### Creating a Changeset

After making changes, run:

```bash
pnpm changeset
```

This prompts you to:
1. Select which packages changed
2. Choose bump type (major/minor/patch)
3. Write a summary of changes

### Applying Version Bumps

```bash
pnpm version:bump
```

This reads pending changesets, bumps versions, and updates CHANGELOGs.

### Checking Status

```bash
pnpm version:status
```

Shows pending changesets and which packages will be bumped.

## Mobile App Versioning

Mobile apps (Expo) use EAS Build with `appVersionSource: "remote"` and `autoIncrement: true` for production builds. The `version` in app.json matches the package.json version, while buildNumber/versionCode are managed by EAS.

## Graduation Criteria

To move up a version tier:

- **Alpha -> Early Beta (0.1.0)**: Core features implemented, good architecture
- **Early Beta -> Beta (0.2.0)**: Deployed or ready, audit >55
- **Beta -> Stable Beta (0.3.0)**: Deployed, audit >=75, has tests
- **Stable Beta -> Production (1.0.0)**: Audit >=85, tests >=80%, deployed 2+ months, zero critical bugs for 1 month
