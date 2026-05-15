---
date: 2026-01-28
day: 37
view: macher
weekday: Mittwoch
commits: 72
review: written
---

# Mittwoch, 2026-01-28 — Tag 37 (Macher-Sicht)

## Stats

72 Commits, +56325 / −11567 LoC, 651 Files. Top-Dirs: `apps/calendar/apps/web` (6%), `apps/questions/apps/backend` (6%), `apps/questions/apps/web` (6%), `apps/matrix/apps/web` (5%), `apps/calendar/apps/backend` (5%). Tags: matrix, auth, calendar, matrix-bots, matrix-ollama-bot. Session 10:43 → 00:43 (~351 aktive Min, längster Fokus 137 Min).

## Commits

- `13754f2` Merge pull request #23 from Memo-2023/claude/gdpr-bot-alternatives-VFgL1 (+0/-0)
- `cb13019` 🔥 chore(picture): remove PostHog analytics for GDPR compliance (+2053/-1655)
- `78ff102` feat(calendar): add production launch features (+2338/-31)
- `2e73787` 🧹 chore(calendar): cleanup debug logs and stale comments (+7/-10)
- `9dfad01` 📈 feat(monitoring): upgrade to VictoriaMetrics + DuckDB analytics (+2901/-18)
- `b50376d` fix(matrix-bots): update to matrix-bot-sdk v0.7 API (+94/-49)
- `2e71b5f` feat(calendar): add Google/Apple Calendar sync module (+1858/-3)
- `5365374` fix(matrix-bots): add --ignore-scripts to Dockerfiles (+8/-8)
- `f778e95` 🐛 fix(auth): use node:20-slim for DuckDB glibc compatibility (+7/-5)
- `9ff709d` fix(matrix): use local Docker images for Matrix bots (+3/-3)
- `b017534` fix(matrix): use bind mount instead of named volume for Synapse data (+1/-1)
- `b1a8ca8` fix(matrix): separate config and data mounts for Synapse (+4/-4)
- `d614587` 📝 docs: add comprehensive monitoring stack documentation (+308/-0)
- `7f3842b` fix(matrix): set session_lifetime >= refresh_token_lifetime (+2/-2)
- `8e6adfd` feat(services): add Telegram bot services for NutriPhi, Todo, and Zitare (+4390/-0)
- `f488bd8` fix(matrix): hardcode database password (env vars not expanded in YAML) (+1/-1)
- `96e64b2` fix(matrix-bots): exclude crypto-nodejs module that fails on Alpine (+24/-0)
- `8eac785` fix(matrix-project-doc-bot): fix main.js path in Dockerfile (+1/-1)
- `2f3473b` 🔥 refactor(calendar): remove statistics and heatmap feature (+6/-1461)
- `1919929` fix(matrix): hide E2E encryption warnings in Element (+52/-45)

_… plus 52 weitere Commits._
