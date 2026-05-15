---
date: 2026-04-15
day: 84
view: macher
weekday: Mittwoch
commits: 81
review: written
---

# Mittwoch, 2026-04-15 — Tag 84 (Macher-Sicht)

## Stats

81 Commits, +22946 / −7192 LoC, 335 Files. Top-Dirs: `apps/mana/apps/web` (59%), `packages/shared-ai/src` (8%), `services/mana-ai/src` (7%), `packages/shared-ui/src` (5%), `packages/shared-auth-ui/src` (2%). Tags: ai, workbench, ai-missions, dev, infra. Session 11:11 → 23:10 (~407 aktive Min, längster Fokus 161 Min).

## Commits

- `9686198` feat(companion): refactor into PageCarousel — every AI feature is a page (+2795/-1635)
- `37e39a5` feat(ai): AI features as top-level workbench apps (not sub-routes) (+927/-1732)
- `9809b06` feat(app-registry): new 'AI' category at top of the app picker (+24/-11)
- `6882ffb` feat(shared-ai): Mission Key-Grant contract + plan for encrypted server-side runs (+610/-0)
- `9a3025f` feat(ai,auth): Mission Grant endpoint + unwrap helper + audit table (+1203/-152)
- `a6d51af` feat(mana-ai): encrypted resolver + tick uses Mission Grant to decrypt scoped inputs (+818/-21)
- `394931e` fix(ai-missions): strip Svelte \$state Proxies before Dexie writes (+15/-6)
- `4b29f6d` fix(ai-missions): swap structuredClone for JSON-roundtrip deepClone (+47/-6)
- `74bbfda` feat(ai): Mission Grant consent UI + Workbench audit tab (+950/-10)
- `bb3da78` feat(ai): Mission Grant rollout gating — flag, alerts, runbook, user docs (+204/-15)
- `ef47adb` feat(ai-missions): live phase + elapsed + cancel for running iterations (+357/-44)
- `003f75f` chore(web): unblock pre-push hook (+458/-43)
- `7f1520d` chore(dev): wire mana-crawler into the local dev stack (+13/-2)
- `121a0c0` feat(api): POST /api/v1/context/import-url — crawler + optional LLM summary (+180/-0)
- `12072c6` feat(kontext): URL import helpers — API client + appendContent (+54/-1)
- `cb384bc` feat(infra): deploy mana-ai + wire Mission Grant keys via docker-compose (+79/-6)
- `6acb044` feat(kontext,notes): cross-module handoff — save Kontext as a Note (+67/-0)
- `f0f5b7d` fix(infra): relocate mana-ai from 3066 to 3067 — port clash with news-ingester (+16/-16)
- `70c62e7` fix(infra): include shared-logger in mana-ai + mana-auth Dockerfile installers (+2/-0)
- `2497a65` feat(ai-missions): richer error surfacing + retry button on failed runs (+137/-17)

_… plus 61 weitere Commits._
