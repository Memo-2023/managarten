---
date: 2026-04-02
day: 72
view: macher
weekday: Donnerstag
commits: 107
review: written
---

# Donnerstag, 2026-04-02 — Tag 72 (Macher-Sicht)

## Stats

107 Commits, +67522 / −68285 LoC, 3408 Files. Top-Dirs: `apps/manacore/apps/web` (19%), `apps/bauntown/apps/landing` (7%), `apps/memoro/apps/{web => web-archived}` (5%), `apps/calendar/apps/{web => web-archived}` (5%), `apps/todo/apps/{web => web-archived}` (4%). Tags: manacore/web, ui, shared-stores, analytics, i18n. Session 08:45 → 22:30 (~504 aktive Min, längster Fokus 163 Min).

## Commits

- `82abde6` fix(wisekeep/landing): add missing TalkGrid and QuoteCollection components (+159/-0)
- `071d217` fix(guides/web): add missing supportedLocales export to i18n (+4/-1)
- `3b5f77d` feat(manacore/web): port calendar UI components from standalone app (+3438/-501)
- `f408d70` feat(manacore/web): refactor todo page into modular components with i18n (+4168/-375)
- `1cbd9a2` feat(spiral-db): add mana activity schema for cross-app unified spiral (+79/-0)
- `9c0613d` feat(manacore/web): add spiral module with activity collection and page (+1657/-281)
- `249cbc9` feat(manacore/web): add calendar event parser/estimator and LLM test page (+1049/-0)
- `a658822` fix(manacore/web): fix LLM test page derived rune, unused import, and auto-scroll (+16/-4)
- `e5a6946` feat(manacore/web): add model comparison tab to LLM test page (+329/-77)
- `348b6ff` chore: remove playground, reader, bauntown, voxelava, and worldream apps (+13/-11273)
- `c3c02c6` feat(manacore/web): add benchmark, compare history, markdown & cache status to LLM test (+523/-114)
- `91d61e5` refactor: remove leaflet dependency, replace with OSM embeds (+197/-35400)
- `3bef29b` feat(local-llm): add generate utilities and reactive Svelte status (+134/-0)
- `82516e9` fix(manacore/web): fix build errors for production deployment (+19/-9)
- `78e726c` fix(docker): add local-llm package to Docker build context (+2/-0)
- `f625c7b` fix(manacore/web): disable SSR for llm-test page (+1/-0)
- `d574dda` fix(manacore/web): externalize @mlc-ai/web-llm from SSR build (+1/-0)
- `919cb4b` fix(local-llm): wrap @mlc-ai/web-llm in dynamic import for Docker builds (+17/-1)
- `88864fd` fix(shared-ui): open AppDrawer above PillNav instead of below (+4/-4)
- `05e5e95` feat(manacore/web): unified IndexedDB sync via Dexie hooks, eliminate cross-app readers (+783/-854)

_… plus 87 weitere Commits._
