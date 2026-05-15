---
date: 2026-03-27
day: 66
view: macher
weekday: Freitag
commits: 66
review: written
---

# Freitag, 2026-03-27 — Tag 66 (Macher-Sicht)

## Stats

66 Commits, +57251 / −126214 LoC, 1709 Files. Top-Dirs: `services/mana-core-auth/src` (11%), `packages/bot-services/src` (3%), `apps/todo/apps/web` (3%), `apps/inventar/apps/web` (3%), `apps/presi/apps/backend` (3%). Tags: infra, auth, apps, local-first, services. Session 10:17 → 02:15 (~287 aktive Min, längster Fokus 112 Min).

## Commits

- `2e4bb9b` feat(local-first): add local-first architecture with Dexie.js, Go sync server, and Todo pilot (+4388/-340)
- `86d1da3` feat(inventar): add configurable inventory management app (+5050/-0)
- `cc50c0c` feat(auth): add password strength indicator and magic links (+430/-1)
- `c6b1f83` test(auth): add tests for audit log, magic links, and security events (+547/-0)
- `63376c1` fix(mana-sync): correct JWKS URL to /api/auth/jwks (+1/-1)
- `17df7b3` feat(auth): add Gilden (guilds) shared Mana pool system (+1900/-969)
- `2624e5a` feat(pricing): migrate to Mana Quelle S-XXL subscription tiers with new Stripe products (+834/-440)
- `8f56feb` feat(auth): session management UI and improved account lockout feedback (+898/-4)
- `b85c32f` feat(todo): wire up browser sync with Go server (+62/-1)
- `bac0a82` docs(auth): document Gilden endpoints and architecture in CLAUDE.md (+71/-0)
- `fe8f0a2` fix(pricing): update remaining content pages to Mana Quelle naming and new prices (+42/-46)
- `b16e245` feat(zitare): migrate to local-first with Dexie.js (+649/-671)
- `3a13355` fix(auth): add GuildPoolService mock to credits unit tests (+27/-12)
- `d4c6f25` docs: add devlog for 2026-03-25 and update 2026-03-26 (+332/-217)
- `427195d` feat(todo): add Hono + Bun server for compute-only endpoints (+543/-0)
- `2c9a368` feat(apps): migrate Calendar, Clock, Contacts, ManaDeck to local-first (+1594/-764)
- `8f40de2` docs: update CLAUDE.md and migration plan for local-first architecture (+62/-4)
- `ce51fd5` feat(apps): migrate Presi, Picture, Inventar, NutriPhi, Planta, Storage to local-first (+1621/-209)
- `819568c` feat(infra): consolidate 21 Matrix bots into Go binary + add Go API gateway (+9927/-47044)
- `3589558` fix(gateway): change api-gateway port to 3030 (3010 used by mukke-backend) (+3/-3)

_… plus 46 weitere Commits._
