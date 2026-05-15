---
date: 2026-05-13
day: 105
view: spieler
weekday: Mittwoch
commits: 5
review: written
---

# Mittwoch, 2026-05-13 — Tag 105

Kurzer Arbeitstag, Schwerpunkt **scripts**.

## Highlights

- cloudflared: add manaspur.mana.how + manaspur-api.mana.how ingress
- backup: cover all postgres containers (cards, manaspur, nutriphi, zitare, chorportal)
- backup: drop bash-source of .env.macmini (DOTENV format, breaks on PEM keys)
- BACKUP_STRATEGY.md — current local-only setup + off-site plan
- drop bash-source of .env.macmini in migration-step
