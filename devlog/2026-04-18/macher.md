---
date: 2026-04-18
day: 87
view: macher
weekday: Samstag
commits: 23
review: written
---

# Samstag, 2026-04-18 — Tag 87 (Macher-Sicht)

## Stats

23 Commits, +8915 / −906 LoC, 75 Files. Top-Dirs: `apps/mana/apps/web` (43%), `services/mana-events/src` (40%), `packages/shared-ai/src` (4%), `services/mana-research/src` (3%), `docs/plans/event-discovery.md` (1%). Tags: workbench, events, research, research-lab, page-carousel. Session 13:30 → 16:51 (~122 aktive Min, längster Fokus 121 Min).

## Commits

- `b5d55fd` feat(events): add Event Discovery — Phase 1 + 2 (+5106/-46)
- `2f226a9` feat(workbench): user-visible error toasts + stale-SW safety net (+52/-21)
- `2c0d866` feat(events): Phase 3 — AI tools, Event-Scout template, feedback loop (+406/-0)
- `4d82381` perf(workbench): LRU-evict PageCarousel's mounted-cards cache (+18/-7)
- `ed801cf` feat(events): Phase 4 — provider adapters for Eventbrite + Meetup (+708/-44)
- `0a928c1` fix(workbench): replace brittle setTimeout with tick() in scene rename (+8/-8)
- `4e5c317` feat(workbench): MRU fallback for active scene + atomic reorderScenes (+54/-5)
- `afdbc43` refactor(page-carousel): name the IntersectionObserver magic numbers (+9/-5)
- `120a191` test(workbench): pure-helper coverage for toScene + pickActiveId (+167/-2)
- `5d67179` docs(workbench): plan for scene-scope empty state (+158/-0)
- `536fc89` fix(research): Claude Opus 4.7 rejects `temperature` param + log executor errors (+20/-14)
- `97abd25` fix(events): Eventbrite provider — switch from dead API to web scraping (+61/-156)
- `f09a84a` feat(workbench): scope-aware empty state for scoped modules (+162/-4)
- `dcec0d3` feat(workbench): scope-active badge on scene pills (+21/-1)
- `85537cb` fix(research): default Gemini to 2.5-flash (2.0-flash deprecated for new users) (+1/-1)
- `0f4535c` feat(workbench): interactive scope badge — click to clear, tooltip lists tags (+51/-1)
- `20ec81e` style(research-lab): drop duplicate h2 title (PageShell already renders it) (+7/-14)
- `e813401` style(research-lab): move help into MODULE_HELP, drop subtitle, keys-button to footer (+48/-23)
- `cd59450` chore: clear svelte-check errors + document scene-scope pattern (+27/-1)
- `b19f5a7` docs(help-content): add MODULE_HELP entries for 17 missing modules (+221/-0)

_… plus 3 weitere Commits._
