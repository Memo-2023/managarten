---
date: 2025-12-18
day: 24
view: spieler
weekday: Donnerstag
commits: 11
review: written
---

# Donnerstag, 2025-12-18 — Tag 24

Dichter Tag in **services** und Umgebung.

## Highlights

- 🔒 security(auth): migrate to EdDSA JWT and add automated monitoring
- 🐛 fix(auth-migrations): make initial migration idempotent
- 🐛 fix(auth-migrations): add missing session columns migration
- 🐛 fix(auth-migrations): use native ADD COLUMN IF NOT EXISTS syntax
- 🐛 fix(ci): add db:push fallback when migrations fail
