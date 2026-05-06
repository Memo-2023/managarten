# Cards

Spaced-repetition flashcards on **cards.mana.how**.

Phase-1 standalone web app. The frontend lives here; data, auth, and
sync are shared with the rest of the Mana stack:

- **Auth:** mana-auth (SSO), `*.mana.how`
- **Sync:** mana-sync, app-id `cards`
- **Storage:** `mana_platform.cards.*` (Postgres, RLS)

The same `cards` data backs the **mana** built-in Cards module at
`mana.how/cards`. Schema changes ship to both frontends together — see
`apps/cards/GUIDELINES.md`.

## Layout

```
apps/cards/
├── apps/
│   └── web/        # SvelteKit 2 + Svelte 5 — the Phase-1 surface
├── GUIDELINES.md   # Project rules (read first)
└── README.md
```

`apps/cards/apps/mobile/` and any production `apps/cards/apps/landing/`
will land in Phase 2/3.

## Quick start

```bash
pnpm install
pnpm --filter @cards/web dev      # cards.mana.how on http://localhost:5180
```
