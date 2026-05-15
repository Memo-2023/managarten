---
date: 2026-04-14
day: 83
view: macher
weekday: Dienstag
commits: 90
review: written
---

# Dienstag, 2026-04-14 — Tag 83 (Macher-Sicht)

## Stats

90 Commits, +26067 / −6969 LoC, 602 Files. Top-Dirs: `apps/mana/apps/web` (49%), `apps/mana/apps/landing` (8%), `services/mana-ai/src` (4%), `packages/shared-ui/src` (3%), `packages/shared-branding/src` (2%). Tags: ai, sync, mana-ai, brain, shared-ui. Session 11:28 → 23:53 (~553 aktive Min, längster Fokus 284 Min).

## Commits

- `daa5aaf` fix(brain): companion chat — markdown rendering, loading status, streaming feedback (+122/-5)
- `77d455a` fix(brain): companion can now actually list tasks instead of hallucinating (+74/-7)
- `51c8a52` fix(brain): companion can now act on previous tool results across turns (+100/-20)
- `9ff2cfc` feat(workbench): unify system pages as workbench apps + categorize picker (+2812/-334)
- `4192a4b` feat(brain): emit Companion chat + tool events for observability (+73/-1)
- `4b2007e` fix(pwa): wire up manifest link + SW registration so install prompt works (+56/-56)
- `e885713` refactor(brain): migrate Companion engine to LlmOrchestrator (4-tier system) (+90/-64)
- `180e07d` feat(credits): admin-gifted sync subscriptions (+159/-1)
- `c357a1c` feat(brain): AI tier selector in Companion chat toolbar (+83/-0)
- `b196e77` perf(web): idle-defer non-critical (app) init + lazy-load modals (+153/-62)
- `3817111` feat(themes): redesign theme picker with gradient cards + beefy mode selector (+254/-23)
- `a33857f` feat(llm): add BYOK tier + 4 provider adapters (OpenAI, Anthropic, Gemini, Mistral) (+1026/-11)
- `db8c257` feat(byok): IndexedDB vault + settings UI for user API keys (+935/-153)
- `7c6567a` perf(web): re-apply (app) layout idle-defer + lazy modals after BYOK merge (+154/-63)
- `e4f0a41` test(byok): add 35 unit tests + update docs to as-built status (+614/-23)
- `79996f9` feat(sync): schemaVersion + eventId on wire (M2 protocol hardening) (+301/-76)
- `ceb5f72` feat(sync): wire /backup/export route + client + settings UI (M1 tail) (+115/-0)
- `f5cb833` perf(workbench): lazy-mount carousel cards via IntersectionObserver (+82/-2)
- `53b3746` refactor: rename nutriphi module to food (Essen) (+862/-718)
- `1249cc4` feat(sync): backup as .mana zip with manifest + sha256 (M3) (+20/-15)

_… plus 70 weitere Commits._
