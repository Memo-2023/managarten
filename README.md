# Managarten

Der Garten der mana-Apps — ein selbst-gehostetes Multi-App-Ökosystem unter `mana.how` mit geteilten Packages und einheitlichem Tooling. Teil der mana-e.V.-Plattform.

## Projects

| Project | Description | Apps |
|---------|-------------|------|
| **mana** | Multi-app ecosystem platform | Expo mobile, SvelteKit web |
| **chat** | AI chat application | NestJS backend, Expo mobile, SvelteKit web, Astro landing |
| **todo** | Task management | NestJS backend, SvelteKit web, Astro landing |
| **calendar** | Calendar & scheduling | NestJS backend, SvelteKit web, Astro landing |
| **clock** | Pomodoro & time tracking | NestJS backend, SvelteKit web, Astro landing |
| **contacts** | Contact management | NestJS backend, SvelteKit web |
| **picture** | AI image generation | NestJS backend, Expo mobile, SvelteKit web, Astro landing |
| **cards** | Card/deck management | NestJS backend, Expo mobile, SvelteKit web |
| **quotes** | Daily inspiration quotes | NestJS backend, Expo mobile, SvelteKit web, Astro landing |
| **mukke** | Music player | NestJS backend, SvelteKit web |
| **plants** | Plant care tracker | NestJS backend, SvelteKit web |
| **storage** | Cloud storage | NestJS backend, SvelteKit web |
| **questions** | Q&A with web search | SvelteKit web |
| **skilltree** | Skill tree visualization | NestJS backend, SvelteKit web |
| **food** | Nutrition tracking | NestJS backend, SvelteKit web |
| **citycorners** | City guide | NestJS backend, SvelteKit web, Astro landing |
| **presi** | Presentation tool | NestJS backend, SvelteKit web |
| **photos** | Photo management | NestJS backend, SvelteKit web |

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm 9.15.0+
- Docker (for PostgreSQL, Redis, MinIO)

### Installation

```bash
pnpm install
```

### Development

```bash
# Start infrastructure (PostgreSQL, Redis, MinIO)
pnpm docker:up

# Start any app with auto DB setup
pnpm dev:chat:full
pnpm dev:todo:full
pnpm dev:calendar:full
pnpm dev:contacts:full

# Build & quality
pnpm run build
pnpm run type-check
pnpm run format
```

See [CLAUDE.md](./CLAUDE.md) for comprehensive development documentation.

## Architecture

```
managarten/
├── apps/                    # Product applications
├── services/                # Microservices (auth, search, LLM, bots)
├── packages/                # Shared packages
├── docker/                  # Docker configuration
└── scripts/                 # Development & deployment scripts
```

## Tooling

- **Package Manager:** pnpm 9.15.0
- **Build System:** Turborepo
- **Formatting:** Prettier (tabs, single quotes, 100 char width)
- **Hosting:** Mac Mini (self-hosted) via Docker + Cloudflare Tunnel
- **Analytics:** Umami (stats.mana.how)

## License

Private - All rights reserved
