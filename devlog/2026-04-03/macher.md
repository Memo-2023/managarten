---
date: 2026-04-03
day: 73
view: macher
weekday: Freitag
commits: 74
review: written
---

# Freitag, 2026-04-03 — Tag 73 (Macher-Sicht)

## Stats

74 Commits, +16622 / −248970 LoC, 2443 Files. Top-Dirs: `apps/manacore/apps/web` (11%), `apps/memoro/apps/web-archived` (7%), `apps/calendar/apps/web-archived` (6%), `apps/todo/apps/web-archived` (5%), `apps/contacts/apps/web-archived` (5%). Tags: manacore/web, ui, docker, infra, mana-notify. Session 09:36 → 19:39 (~345 aktive Min, längster Fokus 227 Min).

## Commits

- `794424d` fix(ui): open all AppDrawer apps in new tab (+2/-18)
- `019f3eb` feat(manacore/web): show tags in detail views with click-to-remove (+215/-2)
- `f7ee9ea` fix(branding): rename ManaContacts to Kontakte (+3/-3)
- `9966e9e` fix(ui): remove Observatory, API Keys, Gifts from PillNav (+0/-3)
- `c5906e4` fix: update all dev scripts to use unified API server (+49/-70)
- `1245fdc` feat(manacore/web): enhance Times & Zitare pages, add DetailViews, clean up homepage (+981/-127)
- `2bd8f0b` fix: change unified API default port from 3050 to 3060 (+1/-1)
- `c21793b` fix: resolve all 40 Svelte dev warnings for clean startup (+55/-133)
- `81d5e83` fix: revert @const to svelte:component (invalid placement in div) (+3/-5)
- `9534d29` fix: revert client sync from per-app SSE to HTTP polling (+14/-17)
- `d368bd3` fix: replace bind:clientHeight with calculated bottom chrome height (+5/-14)
- `f0d5ba2` fix: allow localhost in CSP connect-src during development (+3/-0)
- `d735918` fix: move bottomChromeHeight after isTagStripVisible declaration (+3/-2)
- `7ee57b7` feat(manacore/web): add entity descriptor system with cross-module drag-and-drop (+450/-4)
- `d8ce4ea` refactor: consolidate codebase — remove archived code, deduplicate packages, standardize middleware (+172/-21667)
- `e1077e2` fix(manacore/web): fix entity registration hang + registry type errors (+25/-10)
- `6ced238` chore: delete 25 web-archived directories, remove stale stubs, clean workspace config (+41/-223288)
- `f819b24` fix: revert guestMode $state() — caused effect_update_depth_exceeded (+0/-19)
- `1bd001e` fix(manacore/web): restrict page drag to handle only, allow item DnD (+7/-2)
- `9b8814e` fix(ui): make homepage PageCarousel full-width (no side padding) (+17/-0)

_… plus 54 weitere Commits._
