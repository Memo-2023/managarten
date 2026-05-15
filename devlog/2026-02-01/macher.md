---
date: 2026-02-01
day: 41
view: macher
weekday: Sonntag
commits: 43
review: written
---

# Sonntag, 2026-02-01 — Tag 41 (Macher-Sicht)

## Stats

43 Commits, +14533 / −3808 LoC, 185 Files. Top-Dirs: `services/mana-core-auth/src` (14%), `docker-compose.macmini.yml` (4%), `docker/grafana/dashboards` (2%), `apps/questions/apps/web` (2%), `packages/shared-credit-ui/src` (2%). Tags: infra, auth, bots, project-doc-bot, calendar-web. Session 11:23 → 03:09 (~176 aktive Min, längster Fokus 166 Min).

## Commits

- `4f90f28` debug: add logging to handleOidcRequest for token exchange debugging (+8/-0)
- `5a8e20e` 🔧 fix(auth): add all apps to CORS_ORIGINS (+1/-1)
- `f0cf1bc` 🐛 fix(mana-core-auth): OIDC token exchange now works with body-parser (+0/-11)
- `e7719ee` ✨ feat(grafana): enhance Master Overview with Key Metrics on top (+164/-162)
- `edbf775` 📊 feat(grafana): add Total Requests and Requests/sec to Key Metrics (+87/-7)
- `84e9f86` 🔧 fix(grafana): rewrite System Overview with available metrics (+234/-185)
- `7aa5115` 📊 feat(monitoring): add node-exporter for host system metrics (+472/-19)
- `6a725a2` 🐛 fix(monitoring): remove duplicate node-exporter definition (+0/-16)
- `816062b` 🐛 fix(monitoring): adjust node-exporter config for macOS Docker (+10/-3)
- `1c65058` fix(infra): use SSD volume for MinIO storage (+3/-3)
- `d703ccf` ✨ feat(auth): add resend verification email to registration screen (+236/-18)
- `fa94399` 🔧 refactor(clock): consolidate register page to standard pattern (+24/-24)
- `fdaf6a9` 🔧 fix(dashboards): fix broken panels and metrics (+305/-124)
- `ff22a29` 🌐 feat(i18n): make all auth pages multilingual (+99/-44)
- `f016d5a` 🔧 fix(questions): use 'de' as fallback locale for consistency (+3/-3)
- `45152ee` 🚀 feat(matrix-bots): add CI/CD pipeline for automated GHCR deployment (+917/-200)
- `df2c518` ✨ feat(auth): add missing auth pages for zitare and planta (+180/-93)
- `5c61a4e` revert(infra): use standard Docker volume for MinIO (+3/-1)
- `efb077b` 🐛 fix(mana-core-auth): use EdDSA for OIDC id_token signing (+1605/-142)
- `c0117b2` 🐛 fix: add missing jwt import in better-auth.service (+149/-154)

_… plus 23 weitere Commits._
