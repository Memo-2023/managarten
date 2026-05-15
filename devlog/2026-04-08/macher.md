---
date: 2026-04-08
day: 77
view: macher
weekday: Mittwoch
commits: 97
review: written
---

# Mittwoch, 2026-04-08 — Tag 77 (Macher-Sicht)

## Stats

97 Commits, +25634 / −54194 LoC, 631 Files. Top-Dirs: `apps/mana/apps/web` (30%), `apps/matrix/apps/web` (10%), `apps/matrix/apps/mobile` (7%), `services/mana-matrix-bot/internal` (6%), `packages/shared-llm/src` (4%). Tags: mana/web, local-llm, csp, mana-auth, todo. Session 09:47 → 00:06 (~445 aktive Min, längster Fokus 185 Min).

## Commits

- `142a65a` docs: Phase 9 documentation roundup — close encryption-shaped doc gaps (+481/-130)
- `b6486a8` fix(mana-video-gen): typo in get_model_info — total_mem → total_memory (+1/-1)
- `fe3fc9e` docs: trim CLAUDE.md files — remove stale + duplicated guidance (+182/-1234)
- `ed8ab44` feat(sync): conflict visualization with restore-my-version toast (+771/-0)
- `b3523f8` chore: cleanup leftover dirs from ManaCore→Mana rename + document apps/api (+13/-442)
- `c8ed58b` fix(mana,ui): integrate guest nudge into bottom stack + theme it (+47/-35)
- `5581295` chore: tidy root files + reorganize a few stale docs (+1/-557)
- `a3a4745` docs(audit): file-bytes encryption implementation plan + audit roll-up (+387/-10)
- `b0a08ce` docs(services): add CLAUDE.md for stt + events, fix stale entries, flag port collisions (+198/-9)
- `3c91691` fix(mana-image-gen): align source default port with production reality (+58/-30)
- `ff7dc5d` feat(auth): structured error codes + conditional passkey UI (+35/-7)
- `abe0a21` refactor(auth-ui): tighten LoginPage UX, a11y, and dead code (+203/-185)
- `b8e18b7` chore(ai-services): adopt Windows GPU as source of truth for llm/stt/tts (+1619/-1257)
- `c7b4388` feat(mana-image-gen): replace Mac flux2.c implementation with Windows GPU diffusers (+547/-592)
- `f434703` chore(mac-mini): remove all AI service infrastructure (moved to Windows GPU) (+232/-1920)
- `4cb1bc1` fix(mana-voice-bot): move default port 3050 → 3024 + Windows GPU deployment notes (+137/-133)
- `2b44946` fix(mana/web): unblock voice capture — permissions policy, notification mount, dev SW (+32/-3)
- `45958ad` feat(mana/web): global requireAuth() gate for guest-blocked features (+356/-2)
- `f567826` chore(deps): reconcile pnpm-lock with package.json drift (+180/-282)
- `0d1d3b9` fix(mana-auth): declare missing nanoid dependency (+13/-2)

_… plus 77 weitere Commits._
