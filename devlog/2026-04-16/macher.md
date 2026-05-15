---
date: 2026-04-16
day: 85
view: macher
weekday: Donnerstag
commits: 60
review: written
---

# Donnerstag, 2026-04-16 — Tag 85 (Macher-Sicht)

## Stats

60 Commits, +24613 / −7218 LoC, 233 Files. Top-Dirs: `apps/mana/apps/web` (59%), `packages/shared-ai/src` (7%), `packages/subscriptions/src` (6%), `services/mana-ai/src` (5%), `apps/mana/apps/landing` (3%). Tags: ai, workbench, credits, settings, ai-tools. Session 09:45 → 01:57 (~264 aktive Min, längster Fokus 228 Min).

## Commits

- `9161c0b` feat(templates): two more non-AI templates + split gallery into two sections (+390/-34)
- `334c36a` docs: document reasoning loop, research pre-step, debug log, new tools (+74/-1)
- `0af1dd7` feat(workbench): section deep-links + migrate profile & themes to workbench (+24/-198)
- `bc5c150` feat(spiral): migrate to workbench app, delete standalone route (+25/-66)
- `1266b58` feat(ai-tools): unlock create_note + create_journal_entry + habit tools for agents (+76/-0)
- `5d46aa1` refactor(help): drop standalone /help route, use workbench app (+1/-35)
- `ae53e93` feat(mana): migrate subscription page to workbench app (+19/-8)
- `23b8cc1` feat(ai-tools): server-side web-research + contacts for agents (+253/-2)
- `27ac5fc` feat(credits): merge Credits + Mana subscription into one workbench app (+1033/-648)
- `95e65bb` chore: remove /apps route — not needed (+0/-16)
- `8a0bf93` chore(cloud-tier): upgrade default model gemini-2.0-flash → gemini-2.5-flash (+12/-13)
- `be81d11` feat(ai): SSE streaming for foreground Mission Runner (+635/-108)
- `2ead0f3` fix(subscriptions): single-column layout for workbench context (+1/-32)
- `d83fc37` docs: update tool coverage table + server-side research + templates (+56/-3)
- `c6c4d63` refactor(subscriptions): compact row-based card layout (+275/-535)
- `659a7d9` fix(mana-llm): add google-genai to requirements.txt for Docker builds (+3/-0)
- `3ce8420` fix: drop duplicate manaHref — Credits & Abo is the single billing entry (+0/-1)
- `3be4612` fix(mana-llm): google-genai v1.73 keyword-only Part.from_text() (+4972/-7)
- `b4ce852` feat(credits): merge subscription management into Credits & Abo (+632/-907)
- `d40a611` refactor(ai): dynamic tool registry — single-source catalog in shared-ai (+579/-329)

_… plus 40 weitere Commits._
