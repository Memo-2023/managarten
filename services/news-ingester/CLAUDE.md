# news-ingester — DEPRECATED 2026-05-17

> **Dieser Service wurde am 2026-05-17 durch
> [`mana-news-pool`](https://git.mana.how/mana/mana) (Plattform-Port 3079,
> eigene DB `mana_news_pool`, Schema `pool.curated_articles`) ersetzt.**

Der Container `news-ingester:3066` läuft nicht mehr. `managarten/apps/api/
src/modules/news/routes.ts` ist seit Commit `ad97c5362` ein HTTP-Proxy
auf `MANA_NEWS_POOL_URL=http://mana-news-pool:3079`.

Source-Liste, Ingest-Logik, Konventionen leben jetzt in:
`mana/services/mana-news-pool/` (siehe `CLAUDE.md` dort).

## Was hier noch steht — und warum

- **Source-Tree als Referenz**: `services/news-ingester/src/sources.ts`
  ist die Stand-2026-05-16-Source-Liste. Wenn jemand die Drift zwischen
  alten und neuen Sources rückblickend prüfen will, ist das die letzte
  managarten-eigene Version.
- **Dockerfile + package.json**: dokumentieren das alte Pattern. Können
  beim Sprint-Aufräumen gedroppt werden.

## Drop-Plan

Dieses Verzeichnis kann komplett gelöscht werden, sobald:

1. `mana-news-pool` 30 Tage stabil läuft (~2026-06-17).
2. Das alte `mana_platform.news.curated_articles`-Schema gedroppt ist
   (siehe Memory `project_news_pool_old_schema_drop`).

Bis dahin: nicht anfassen, dokumentiert den Cutover-Pfad.

## Cross-Refs

- `mana/services/mana-news-pool/CLAUDE.md` — neuer Service
- `managarten/apps/api/src/modules/news/routes.ts` — Proxy-Implementation
- `mana/docs/MICROSERVICES_KANDIDATEN.md` — Lift-B-Plan
