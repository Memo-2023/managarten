---
date: 2026-05-12
day: 104
view: spieler
weekday: Dienstag
commits: 5
review: written
---

# Dienstag, 2026-05-12 — Tag 104

Kurzer Arbeitstag, Schwerpunkt **apps**.

## Highlights

- migrate to central auth portal — no embedded login UI, clean cut
- route manawald.mana.how + add to mana-auth CORS
- read PUBLIC\_\*\_URL from window-injected vars, not $env/dynamic/public
- add @simplewebauthn/browser as explicit dep
