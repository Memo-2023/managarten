---
date: 2026-05-12
day: 104
view: macher
weekday: Dienstag
commits: 5
review: written
---

# Dienstag, 2026-05-12 — Tag 104 (Macher-Sicht)

## Stats

5 Commits, +860 / −604 LoC, 32 Files. Top-Dirs: `apps/mana/apps/web` (81%), `docker-compose.macmini.yml` (8%), `.env.development` (3%), `scripts/generate-env.mjs` (3%), `cloudflared-config.yml` (3%). Tags: mana, infra, mana-auth, mana-web, mana-llm. Session 15:00 → 16:58 (~25 aktive Min, längster Fokus 26 Min).

## Commits

- `5635598` feat(mana): migrate to central auth portal — no embedded login UI, clean cut (+773/-489)
- `b299a4a` feat(infra): route manawald.mana.how + add to mana-auth CORS (+6/-1)
- `dd2e4b6` fix(mana-auth): read PUBLIC\_\*\_URL from window-injected vars, not $env/dynamic/public (+41/-9)
- `009a695` fix(mana-web): add @simplewebauthn/browser as explicit dep (+39/-104)
- `cec84c2` chore(mana-llm): manawald.mana.how + localhost:3090 in CORS_ORIGINS (+1/-1)
