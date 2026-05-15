---
date: 2026-05-08
day: 101
view: macher
weekday: Freitag
commits: 30
review: written
---

# Freitag, 2026-05-08 — Tag 101 (Macher-Sicht)

## Stats

30 Commits, +2748 / −57326 LoC, 600 Files. Top-Dirs: `apps/cards/apps/web` (10%), `apps/mana/apps/landing` (9%), `services/mana-auth/src` (8%), `apps/mana/apps/web` (8%), `services/cards-server/src` (7%). Tags: cutover, dev, decommission, brand, env. Session 11:19 → 00:08 (~143 aktive Min, längster Fokus 74 Min).

## Commits

- `7a96a9a` chore: add dev:cardecky:full + dev:cards-server scripts (+2/-0)
- `a6a003f` fix(dev): mana-notify dev script ships explicit DATABASE_URL (+1/-1)
- `61f2772` chore(brand): rename Cards → Cardecky (display, infra, license-IDs) (+2149/-141)
- `08f4223` fix(dev): cards-server uses --hot + setup-databases creates mana_notify/credits (+10/-3)
- `4cca25e` chore(dev): switch all Bun services from --watch to --hot (+13/-13)
- `15e2abd` fix(env): mana-events default port 3065 → 3115 (+3/-2)
- `8acf35e` chore(dev): finish --watch → --hot sweep across remaining Bun services (+10/-10)
- `364f3c2` infra(tunnel): add zitare.com / zitare.mana.how / zitare-api.mana.how (+15/-0)
- `7b36206` feat(auth): SSO + CORS origins for zitare.mana.how/zitare-api.mana.how (+3/-1)
- `774852b` feat(cutover): platform services build from ../mana, not from this repo (+76/-363)
- `467d833` fix(apps/api): COPY packages/eslint-config in Dockerfile (+4/-0)
- `879975b` chore(cutover): remove services/mana-mail/ — moved to mana-platform (+0/-3070)
- `3c4a6d4` chore(cutover): remove services/mana-stt/ — moved to mana-platform (+0/-2973)
- `6103d4d` chore(cutover): remove services/mana-tts/ — moved to mana-platform (+0/-3360)
- `2b07f6e` chore(cutover): remove services/mana-llm/ — moved to mana-platform (+0/-6371)
- `af8ef60` chore(cutover): remove services/mana-notify/ — moved to mana-platform (+0/-3310)
- `fcc36ea` chore(cutover): remove services/mana-media/ — moved to mana-platform (+0/-2771)
- `af3f21a` chore(cutover): remove services/mana-credits/ — moved to mana-platform (+0/-2704)
- `0a30b91` chore(cutover): remove services/mana-auth/ — moved to mana-platform (+0/-10640)
- `27798f0` chore(cutover): regenerate pnpm-lock after removing 8 platform services (+113/-1023)

_… plus 10 weitere Commits._
