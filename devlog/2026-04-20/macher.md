---
date: 2026-04-20
day: 89
view: macher
weekday: Montag
commits: 68
review: written
---

# Montag, 2026-04-20 — Tag 89 (Macher-Sicht)

## Stats

68 Commits, +22189 / −111943 LoC, 965 Files. Top-Dirs: `apps/mana/apps/web` (24%), `apps/context/apps/mobile` (15%), `apps/picture/apps/mobile` (13%), `apps/cards/apps/mobile` (13%), `apps/chat/apps/mobile` (11%). Tags: spaces, invoices, ai, broadcast, type-check. Session 12:24 → 19:28 (~351 aktive Min, längster Fokus 203 Min).

## Commits

- `52d008d` fix(goals): start GoalTracker on boot + surface AI proposals inline (+35/-7)
- `a2598b9` feat(crypto): type-safe registry entries + dev-mode drift check (+122/-14)
- `c7af693` feat(crypto): Phase C — build-time registry ↔ Dexie audit (+406/-3)
- `1eda3f5` chore(turbo): lint against recursive \`turbo run\` calls in child packages (+98/-1)
- `5ec1dfc` chore(db): enforce pgSchema isolation with a lint script (+114/-8)
- `d1d3774` fix(install): remove silent `|| true` from postinstall + narrow filter (+13/-9)
- `da47f53` docs(plans): function-calling migration + removal of propose/approve gate (+298/-0)
- `c34175a` fix(type-check): repair silently broken per-package type-check scripts (+26/-5)
- `4b8fede` fix(mana-llm): surface Gemini finish_reason errors instead of returning "" (+208/-13)
- `c612a22` fix(type-check): unblock two more pre-existing failures (+7/-2)
- `e757470` feat(mana-llm): add OpenAI-style tools + tool_calls passthrough (+566/-79)
- `4523ab2` feat(shared-ai): toolToFunctionSchema — catalog → OpenAI function-spec (+235/-2)
- `11f768b` docs(invoices): ClubDesk vs. Mana comparison + invoices module plan (+675/-0)
- `2cf89ce` feat(invoices): M1 skeleton — module registration + empty ListView (+666/-0)
- `4daca89` feat(shared-ai): runPlannerLoop + compact system prompt for function calling (+537/-1)
- `248137e` chore(mobile): remove 6 of 7 mobile apps — keep only memoro (+26/-106334)
- `8d00ee0` feat(invoices): M2 CRUD — draft lifecycle, totals, list + detail (+2704/-61)
- `a44e3df` refactor(mana): remove post-signup onboarding wizard (+1/-1329)
- `0077752` fix(type-check): clear the last five failures — monorepo type-check is now 76/76 green (+22/-10)
- `2dc298a` feat(invoices): M4 PDF rendering — pdf-lib renderer + preview + download (+904/-172)

_… plus 48 weitere Commits._
