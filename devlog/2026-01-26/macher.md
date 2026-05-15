---
date: 2026-01-26
day: 35
view: macher
weekday: Montag
commits: 57
review: written
---

# Montag, 2026-01-26 — Tag 35 (Macher-Sicht)

## Stats

57 Commits, +16578 / −3468 LoC, 184 Files. Top-Dirs: `services/mana-core-auth/src` (11%), `apps/todo/apps/web` (8%), `docker-compose.macmini.yml` (8%), `services/telegram-project-doc-bot/src` (7%), `apps/chat/apps/backend` (6%). Tags: auth, docker, stt, todo, metrics. Session 08:35 → 02:39 (~268 aktive Min, längster Fokus 100 Min).

## Commits

- `1c5a1b8` feat(metrics): add Prometheus metrics to all backends (+611/-14)
- `b7d4893` docs: add daily report for 2026-01-25 (+299/-0)
- `475246a` fix(todo): correct health check endpoints (+11/-1)
- `41dea77` fix(watchtower): use existing TELEGRAM env vars for notifications (+1/-1)
- `8c259a0` feat(monitoring): add comprehensive Grafana dashboards and alerting (+2029/-0)
- `8820532` 🔧 chore(watchtower): add debug logging for telegram notifications (+3/-1)
- `cacebab` 🔧 chore(watchtower): switch to n8n webhook for notifications (+4/-3)
- `d2b1a1c` 🔧 chore(watchtower): use URL-encoded telegram token from env (+3/-4)
- `bbc536d` fix(docker): correct todo-backend health check path in compose (+1/-1)
- `98c08fd` 🔧 chore(watchtower): disable broken telegram notifications (+2/-4)
- `57a7a39` fix(docker): use root path for todo-web health check (+1/-1)
- `0b35e71` fix(docker): use 127.0.0.1 instead of localhost in health checks (+21/-21)
- `2480d92` 🔧 chore(watchtower): try list format for telegram notification URL (+107/-7)
- `4573f6e` feat(web): add /health endpoints to all web apps (+1/-1)
- `ebd0e53` 🔧 chore(watchtower): switch to nickfedor fork with telegram notifications (+15/-1)
- `618c58c` feat(ci): add Telegram notifications and Grafana CI/CD dashboard (+1100/-0)
- `5cf3c33` fix(calendar): correct port to 3016 (+1/-1)
- `412344e` chore(infra): add pushgateway to Cloudflare tunnel (+2/-0)
- `edf13b7` revert: fix CI by reverting Telegram notifications (+0/-1100)
- `9fedb7c` fix(docker): correct health check paths for mana-core-auth and clock-backend (+2/-2)

_… plus 37 weitere Commits._
