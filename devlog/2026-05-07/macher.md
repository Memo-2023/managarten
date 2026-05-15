---
date: 2026-05-07
day: 100
view: macher
weekday: Donnerstag
commits: 48
review: written
---

# Donnerstag, 2026-05-07 — Tag 100 (Macher-Sicht)

## Stats

48 Commits, +14288 / −1326 LoC, 117 Files. Top-Dirs: `apps/cards/apps/web` (42%), `services/cards-server/src` (23%), `docker-compose.macmini.yml` (5%), `infrastructure/docker-compose.gpu-box.yml` (4%), `cloudflared-config.yml` (3%). Tags: cards, cards-web, gpu-box, cards-server, infra. Session 10:44 → 00:48 (~419 aktive Min, längster Fokus 265 Min).

## Commits

- `585bee4` docs(mac-mini): refresh container counts + memory budget after Phase 2c+2d (+15/-14)
- `009fb35` feat(cards-web): streak indicator + per-deck due counts (+90/-3)
- `0c2df08` fix(status-page): point at vm.mana.how (GPU-Box VM) instead of localhost:9090 (+4/-4)
- `22cce59` feat(cards-web): Anki .apkg import — first acquisition lever (+599/-132)
- `778e5a2` chore(infra): drop status-page-gen from Mini, status.mana.how → GPU-Box tunnel (+351/-31)
- `e3cca9e` feat(cards-web): PWA installability + AI card generation from text (+2/-9)
- `d8a35af` infra(gpu-box): commit GPU-Box compose to repo + Phase 2e docs (+576/-9)
- `1f2206f` feat(cards-web): PDF input for AI generator + study activity heatmap (+375/-10)
- `daa1ef0` feat(cards): image / audio attachments on cards via mana-media (+197/-8)
- `0ae1e70` fix(monitoring): status-page covers all standalone apps + restore who.mana.how routing (+29/-3)
- `82db4eb` feat(cards-web): Anki import carries images + audio along (+250/-41)
- `1e8d18a` fix(monitoring): photon via Cloudflare-Tunnel, drop dead whopxl (+8/-10)
- `c1423d2` fix(cards-web): missing static assets — sql-wasm-browser.wasm + PWA icons (+0/-0)
- `6f1b032` docs(infra): document photon.mana.how + cross-LAN workaround pattern (+29/-2)
- `ceed8cc` feat(mana-sync): per-app billing exemption — Cards bypasses sync gate (+145/-16)
- `cd888cd` fix(gpu-box): drop gpu-promtail healthcheck — image has no curl/wget/nc (+1/-6)
- `8a90cd2` docs(cards): competitor analysis Mai 2026 (+353/-0)
- `384be93` feat(gpu-box): healthchecks for glitchtip-worker, gpu-promtail, status-gen (+18/-1)
- `cf5349c` feat(gpu-box): adopt photon container into compose with healthcheck (+37/-0)
- `0686300` docs(cards): Marktplatz Plan — Vollvision mit mana-credits + dual verification (+602/-0)

_… plus 28 weitere Commits._
