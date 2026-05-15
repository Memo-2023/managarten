---
date: 2026-04-28
day: 97
view: macher
weekday: Dienstag
commits: 65
review: written
---

# Dienstag, 2026-04-28 — Tag 97 (Macher-Sicht)

## Stats

65 Commits, +21935 / −29438 LoC, 491 Files. Top-Dirs: `apps/mana/apps/web` (54%), `games/arcade/apps` (13%), `services/mana-geocoding/src` (9%), `apps/api/src/modules` (3%), `packages/shared-branding/src` (2%). Tags: articles, forms, feedback, geocoding, deploy. Session 12:54 → 00:50 (~436 aktive Min, längster Fokus 273 Min).

## Commits

- `44f9155` chore(dev): pnpm dev:analytics script + test-checklist mentions local-dev startup (+19/-1)
- `0c30a16` fix: 4 boot-time noise + correctness bugs surfaced by post-deploy smoke (+106/-55)
- `5377190` infra(macmini): bump squeezed container memory limits (+10/-5)
- `eaa1d74` fix: silence two cosmetic boot-time devtools warnings (+55/-20)
- `94d3277` feat(feedback): "Idee teilen" lebt jetzt im PillNav-Usermenü (+65/-109)
- `ff823bf` fix(feedback): POST /api/v1/feedback liest appId aus X-App-Id-Header (+6/-1)
- `f1e4a39` feat(geocoding): provider chain with Photon + Nominatim fallbacks (+2120/-184)
- `f39e723` chore(ci): drop 16 dead build-\* jobs + per-product detect-changes branches (+30/-727)
- `15ab24b` feat(feedback): heart-half als globales Feedback-Icon + inline-Form in der Workbench (+441/-341)
- `9a0cf5b` fix(geocoding): bump PROVIDER_TIMEOUT_MS default 5s → 8s (+6/-2)
- `34b1690` fix(mana-ai): copy missing workspace deps into Docker installer stage (+11/-1)
- `164d5da` fix(mana-llm): copy aliases.yaml into Docker image (+5/-1)
- `bcc21ca` feat(geocoding): privacy hardening — sensitive-query block + coord quantization + extended cache TTL for public answers (+658/-29)
- `698e09b` chore(deploy): auto-apply additive Drizzle schema migrations + RAM headroom for mana-web build (+283/-0)
- `112e2cc` feat(feedback): rename community → feedback (module + routes + domain) (+51/-51)
- `f20a411` chore(infra): right-size mem_limits based on observed RSS (Tier-3 sweep) (+28/-8)
- `b1fa55d` feat(places): surface geocoding privacy notices in autocomplete UI (+218/-25)
- `e4d9dc5` fix(deploy): safe-db-push uses pnpm dlx when local drizzle-kit is missing (+14/-2)
- `6f83fba` docs(reports): geocoding self-hosting decision — recommend Photon on mana-gpu (+219/-0)
- `941df57` feat(feedback): rename community-identity columns + settings-section (+544/-209)

_… plus 45 weitere Commits._
