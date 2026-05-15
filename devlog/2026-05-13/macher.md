---
date: 2026-05-13
day: 105
view: macher
weekday: Mittwoch
commits: 5
review: written
---

# Mittwoch, 2026-05-13 — Tag 105 (Macher-Sicht)

## Stats

5 Commits, +219 / −37 LoC, 4 Files. Top-Dirs: `scripts/mac-mini/backup-databases.sh` (40%), `cloudflared-config.yml` (20%), `docs/BACKUP_STRATEGY.md` (20%), `.github/workflows/cd-macmini.yml` (20%). Tags: deploy. Session 12:38 → 19:32 (~17 aktive Min, längster Fokus 17 Min).

## Commits

- `b223247` cloudflared: add manaspur.mana.how + manaspur-api.mana.how ingress (+10/-0)
- `7f0e2ba` backup: cover all postgres containers (cards, manaspur, nutriphi, zitare, chorportal) (+63/-25)
- `97e285b` backup: drop bash-source of .env.macmini (DOTENV format, breaks on PEM keys) (+7/-7)
- `670036d` docs: BACKUP_STRATEGY.md — current local-only setup + off-site plan (+129/-0)
- `52bca11` fix(deploy): drop bash-source of .env.macmini in migration-step (+10/-5)
