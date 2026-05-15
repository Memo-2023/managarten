---
date: 2026-05-06
day: 99
view: macher
weekday: Mittwoch
commits: 22
review: written
---

# Mittwoch, 2026-05-06 — Tag 99 (Macher-Sicht)

## Stats

22 Commits, +9709 / −8067 LoC, 171 Files. Top-Dirs: `apps/mana/apps/web` (45%), `apps/cards/apps/web` (13%), `apps/cards/apps/landing` (8%), `apps/api/src/modules` (4%), `packages/cards-core/src` (4%). Tags: forms, infra, cards, cards-web, mana-auth. Session 11:39 → 00:39 (~85 aktive Min, längster Fokus 43 Min).

## Commits

- `cb9d79d` feat(articles): finale polish — Help-Eintrag + intentional-console + 5-Locale i18n (#16,#10,#17) (+443/-67)
- `38e0ae2` feat(forms): M10a wiederkehrende Forms — cohort-tagging + UI (+470/-11)
- `664b824` feat(forms): M10b wave-send — Empfänger + Manueller Trigger + Due-Banner (+555/-7)
- `7d8e562` feat(forms): M10c auto-scheduler + mana-mail bulk-send (+430/-5)
- `c1ed45e` feat(forms): M9 form-as-conversation — Typeform-Chat-Render (+774/-6)
- `6d67db4` feat(forms): M9b conversation LLM-extract — free-text → typed Antwort (+468/-0)
- `82dbfe6` feat(forms): M7c auto-sync zu library + space_member (+497/-35)
- `795b39e` feat(forms): M10d headless wave-cron — server-worker + private internal_meta (+502/-5)
- `546b94d` feat(personas): move admin + internal endpoints from mana-auth to apps/api (+636/-25)
- `1b579ab` chore(mana-events): move from port 3065 to 3115 — collision with platform mana-media (+15/-13)
- `c14aef9` docs(infra): Mac-Mini ↔ Windows-GPU-Box workload-split — Plan Option C (+381/-0)
- `c8a292b` tunnel: route memoro.mana.how + memoro-app/api/audio to standalone Memoro stack (+20/-2)
- `950b822` docs(cards): Phase-1 Spinoff-Guidelines — Core-Gameloop, Stack, Datenpfad (+261/-0)
- `0a544ac` feat(cards): Phase-1 Spinoff — standalone cards.mana.how + cards-core extraction (+4090/-7466)
- `f94c047` chore: silence pre-existing svelte-check a11y warnings (+9/-0)
- `86f14bc` fix(cards-web): drop unused @mana/shared-crypto dep — not in sveltekit-base image (+0/-4)
- `dd2e609` fix(docker): COPY packages/cards-core in SvelteKit Dockerfiles (+77/-14)
- `8b71d29` feat(mana-auth): wire Glitchtip/Sentry error tracking via shared-error-tracking (+29/-1)
- `96c0616` fix(cards-web): inject **PUBLIC_MANA_AUTH_URL** on SSR — login was 404 (+32/-0)
- `1bac7cf` fix(mana-auth): COPY packages/shared-error-tracking in Dockerfile (+1/-0)

_… plus 2 weitere Commits._
