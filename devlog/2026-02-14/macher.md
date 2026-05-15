---
date: 2026-02-14
day: 47
view: macher
weekday: Samstag
commits: 58
review: written
---

# Samstag, 2026-02-14 — Tag 47 (Macher-Sicht)

## Stats

58 Commits, +9314 / −2460 LoC, 146 Files. Top-Dirs: `apps/manacore/apps/web` (7%), `services/matrix-stats-bot/src` (7%), `services/matrix-clock-bot/src` (7%), `apps/matrix/apps/web` (5%), `docker-compose.macmini.yml` (5%). Tags: matrix-tts-bot, clock-bot, matrix-stt-bot, docker, stats-bot. Session 09:55 → 13:34 (~176 aktive Min, längster Fokus 115 Min).

## Commits

- `7c0bc73` ✨ feat(matrix): add drag & drop file upload to chat (+131/-3)
- `1c9c230` fix(matrix-tts-bot): add API key authentication for mana-tts service (+18/-2)
- `5e01c83` ✨ feat(matrix): improve chat UI with WhatsApp-style input and emoji picker (+199/-40)
- `70e45ed` fix(matrix-stats-bot): adapt to Umami v2 API response format (+121/-40)
- `fa7fb3c` 🩹 fix(matrix-bots): use authenticated media download for all bots (+44/-61)
- `e013384` chore(docker): build matrix-tts-bot locally instead of from registry (+4/-1)
- `aff2db9` ✨ feat(matrix): add recently used emojis section in emoji picker (+71/-97)
- `0f234a0` fix(matrix-tts-bot): use WAV format for better Matrix compatibility (+5/-5)
- `c843531` feat(analytics): update Umami tracking IDs for all web apps (+21/-9)
- `ff1affb` 🩹 fix(nutriphi-bot): add automatic token refresh on JWT expiration (+199/-77)
- `4a26926` 🩹 fix(bot-services): export LOGIN_MESSAGES and auth error helpers (+244/-12)
- `e88597c` ✨ feat(gifts): add gift code creation script and initial codes (+199/-0)
- `bd7f197` feat(stats-bot): add infrastructure monitoring commands (+446/-48)
- `c698318` chore(deploy): add PROMETHEUS_URL to stats-bot config (+3/-0)
- `d81b8ae` 🔒 refactor(bots): remove !login command and enforce OIDC-only auth (+158/-786)
- `83c75ce` 🩹 fix(nutriphi-bot): use correct API field name for image analysis (+1/-1)
- `2521a1e` feat(matrix): sync recent emojis across apps via mana-core-auth (+256/-42)
- `67f3d30` fix(matrix-tts-bot): use /synthesize/auto endpoint for German voices (+5/-8)
- `0099e1e` chore(matrix-tts-bot): set German (de_thorsten) as default voice (+2/-2)
- `acd8d02` 🔧 fix(clock-bot): use local build with SSO-Link auth (+13/-2)

_… plus 38 weitere Commits._
