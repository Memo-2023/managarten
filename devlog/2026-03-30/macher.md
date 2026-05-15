---
date: 2026-03-30
day: 69
view: macher
weekday: Montag
commits: 47
review: written
---

# Montag, 2026-03-30 — Tag 69 (Macher-Sicht)

## Stats

47 Commits, +26473 / −10152 LoC, 400 Files. Top-Dirs: `apps-archived/moodlit/apps` (35%), `apps/{taktik => times}/apps/web` (10%), `apps/manacore/apps/web` (5%), `{apps-archived => apps}/moodlit/apps` (5%), `apps/todo/apps/web` (4%). Tags: docker, monitoring, infra, startup, inventar. Session 08:40 → 20:39 (~234 aktive Min, längster Fokus 135 Min).

## Commits

- `de6af12` feat(calendar): integrate NL parser into QuickEventOverlay (+8284/-1)
- `aee0934` feat(manacore): migrate all remaining widgets to local-first IndexedDB (+779/-956)
- `06e5d9e` feat(todo,calendar): auto-apply smart duration, add settings toggle (+146/-72)
- `1bbf0ef` feat: integrate shared-links into Calendar, Contacts, and ManaCore (+66/-2)
- `fbe3c95` feat(shared-links): add ManaLinkPicker for cross-app search and linking (+479/-2)
- `4cee74e` feat(shared-links): deep-link navigation to target app detail views (+114/-11)
- `7f2b9f8` docs(todo,calendar): document smart duration settings (+981/-4)
- `72da55d` feat(moodlit): restore from git history, migrate to local-first + Hono (+5607/-5877)
- `45a1718` feat(manavoxel): complete game engine with behavior system, NPCs, lighting, and dialog (+2486/-110)
- `ad82a83` feat(manavoxel): add merchant trading UI and NPC loot drops (+308/-3)
- `451ab03` feat(contacts): add NL quick-input and live duplicate detection (+425/-0)
- `5f9c2a6` docs(contacts): document NL quick-input and duplicate detection (+28/-0)
- `1eb370e` feat(manacore): tiling layout — resizable, splittable dashboard panels (+996/-83)
- `c33339b` rename(taktik): rebrand to Times (+970/-1263)
- `ff19c7f` feat(times): add NL time entry parser with multi-entry and quick-input (+649/-0)
- `d0c2302` fix(docker): fix multiline entrypoint YAML bug + searxng entrypoint path (+6/-42)
- `e21e09b` fix(docker): fix vmalert rules scope + disable synapse OIDC (+11/-22)
- `667d8cf` fix(infra): simplify alertmanager config mount (direct file mount) (+2/-2)
- `aeef352` fix(startup): force-recreate synapse on boot to avoid stale config cache (+5/-0)
- `c866c42` fix(startup): add /Users/mana mount to colima start (root cause fix) (+1/-0)

_… plus 27 weitere Commits._
