---
date: 2026-02-02
day: 42
view: macher
weekday: Montag
commits: 41
review: written
---

# Montag, 2026-02-02 — Tag 42 (Macher-Sicht)

## Stats

41 Commits, +9491 / −6409 LoC, 170 Files. Top-Dirs: `services/mana-media/apps` (10%), `packages/bot-services/src` (9%), `services/mana-core-auth/src` (8%), `apps/calendar/apps/web` (7%), `services/matrix-nutriphi-bot/src` (4%). Tags: mana-core-auth, mana-media, nutriphi, docker, playground. Session 12:17 → 18:16 (~230 aktive Min, längster Fokus 159 Min).

## Commits

- `feaf27d` feat(auth): implement cross-subdomain SSO for all web apps (+491/-16)
- `7bad849` docs(server): document Docker on external SSD and Matrix Bots (+65/-2)
- `2777f60` feat(bots): enable Redis SSO for todo-bot and calendar-bot (+2917/-758)
- `8525020` feat(playground): integrate shared auth UI for consistent login experience (+171/-228)
- `a416dad` fix(playground): add missing shared packages to Dockerfile (+4/-0)
- `0b46d20` feat(infra): add mana-llm service to production deployment (+34/-1)
- `60d2f64` fix(matrix-bots): update all bots for async SessionService methods (+551/-350)
- `aba79f5` fix(mana-llm): fix SSE double data prefix causing message parsing issues (+8/-9)
- `23852cf` feat(matrix-web): add bots page with all 19 Matrix bots (+793/-0)
- `9d7e6c6` fix(matrix-web): change bots page to single column layout (+2/-2)
- `5c688d7` fix(mana-core-auth): return real refreshToken in SSO session-to-token exchange (+41/-1)
- `c2c80ef` ✨ feat(matrix-bots): add i18n system and direct message fallback (+1626/-18)
- `b404ddc` fix(nutriphi): increase body size limit to 50mb for image uploads (+13/-2)
- `509bbb9` fix(nutriphi): add shared-nestjs-setup to Dockerfile (+4/-0)
- `ac477aa` fix(nutriphi): add missing shared packages to Dockerfile (+5/-0)
- `0cafd4f` chore: update pnpm-lock.yaml for express dependency (+12/-24)
- `b6925e0` feat(matrix-bots): enable cross-bot SSO via Redis sessions (+33/-17)
- `ad22d26` fix(nutriphi): add shared-drizzle-config and make db:push non-fatal (+7/-3)
- `f556665` fix(shared-nestjs-setup): export compiled JS instead of TypeScript (+9/-3)
- `9c45879` feat(nutriphi-bot): auto-analyze images when received (+39/-13)

_… plus 21 weitere Commits._
