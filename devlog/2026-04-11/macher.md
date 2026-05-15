---
date: 2026-04-11
day: 80
view: macher
weekday: Samstag
commits: 28
review: written
---

# Samstag, 2026-04-11 — Tag 80 (Macher-Sicht)

## Stats

28 Commits, +4425 / −1225 LoC, 80 Files. Top-Dirs: `apps/mana/apps/web` (50%), `packages/shared-ui/src` (11%), `services/mana-geocoding/src` (8%), `packages/shared-theme/src` (6%), `scripts/generate-status-page.sh` (5%). Tags: geocoding, workbench, mana-credits, web, status-page. Session 13:47 → 21:38 (~149 aktive Min, längster Fokus 132 Min).

## Commits

- `1293756` fix(mana-sync): bump Go base image to 1.25 to match go.mod (+1/-1)
- `e82b5c1` feat(geocoding): auto-categorize places via Pelias taxonomy (+195/-156)
- `3717f42` fix(mana-sync): update Dockerfile to copy workspace shared-go dependency (+10/-5)
- `f7de9fd` docs(geocoding): document the Pelias category patch + import gotchas (+90/-17)
- `f783547` feat(workbench): match AppPagePicker design to module pages (+21/-12)
- `0ba9767` feat: extend geocoding to events, contacts, photos (+470/-25)
- `957060c` feat(monitoring): add mana-geocoding + Pelias to prod compose, Prometheus, Grafana, and status.mana.how (+949/-155)
- `12bbe29` fix(workbench): move @const out of {#if} in AppPagePicker snippet (+2/-2)
- `c9a3c8c` fix(mana-credits): rewrite Dockerfile to use WORKDIR instead of cd (+4/-2)
- `fa7bfd3` fix(mana-credits): use pnpm in Dockerfile to handle workspace deps (+12/-11)
- `3a93c56` fix(mana-credits): multi-stage Dockerfile with node+pnpm installer (+17/-7)
- `21360d9` feat(mana/web): redesign settings page + pill-nav compute selector (+1146/-422)
- `6977d18` fix(geocoding): don't bind libpostal to host port 4400 (+6/-2)
- `c47ce83` fix(geocoding): proxy Pelias health through wrapper for monitoring (+40/-16)
- `1c94234` fix(web): point credits/sync API client at credits.mana.how (+26/-5)
- `56a9811` fix(status-page): replace multi-line awk with shell loop for ash compatibility (+22/-7)
- `6f975a5` fix(status-page): use ${TIER_APPS:-} for set -u safety (+1/-1)
- `3ac3a4b` fix(status-page): drop set -e — heredoc subshells trigger silent exits (+6/-1)
- `6373330` feat(pill-nav): collapse user pills into account dropdown + solid pill backgrounds (+131/-204)
- `020f327` fix(geocoding): drop unused Pelias services, raise Bun idleTimeout (+4/-9)

_… plus 8 weitere Commits._
