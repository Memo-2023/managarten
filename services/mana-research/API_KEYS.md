# Research-Provider API-Keys — Setup-Anleitung

Alle Provider, die in `mana-research` einen externen API-Key brauchen, wo du den Key bekommst, was er kostet und wohin er im Repo gehört.

**Alle genannten Anbieter sind pay-per-use** (keine Pflicht-Abos). Wo sich das nicht vermeiden lässt, ist es explizit genannt.

---

## Überblick

| Provider                                | Env-Var                | Kosten                         | Free-Tier                        | Kategorie            | Dringlich?                    |
| --------------------------------------- | ---------------------- | ------------------------------ | -------------------------------- | -------------------- | ----------------------------- |
| [SearXNG](#0-searxng-kein-key)          | –                      | 0                              | unbegrenzt                       | Search               | — (läuft self-hosted)         |
| [DuckDuckGo](#0a-duckduckgo-kein-key)   | –                      | 0                              | rate-limited                     | Search               | —                             |
| [Brave Search](#1-brave-search)         | `BRAVE_API_KEY`        | $5/1k Queries                  | 2000/Monat                       | Search               | ⭐ hoch                       |
| [Tavily](#2-tavily)                     | `TAVILY_API_KEY`       | Credit-Packs ab ~$0.008/Query  | 1000 Credits/Monat               | Search               | ⭐ hoch                       |
| [Exa](#3-exa)                           | `EXA_API_KEY`          | $0.001–0.01/Query              | $10 Guthaben bei Signup          | Search (semantisch)  | mittel                        |
| [Serper](#4-serper)                     | `SERPER_API_KEY`       | $0.001–0.003/Query             | 2500 Queries einmalig            | Search (Google SERP) | mittel                        |
| [Jina Reader](#5-jina-reader)           | `JINA_API_KEY`         | $0.02/1M Tokens                | 1M Tokens/Monat + unauthed       | Extract              | niedrig (läuft auch ohne Key) |
| [Firecrawl](#6-firecrawl)               | `FIRECRAWL_API_KEY`    | $16 = 2000 Credits PAYG        | 500 Credits Signup               | Extract (JS-Render)  | mittel                        |
| [Perplexity Sonar](#7-perplexity-sonar) | `PERPLEXITY_API_KEY`   | $5 Token-Credit + $5/1k Suchen | Keiner                           | Agent                | ⭐ hoch                       |
| [Google Gemini](#8-google-gemini)       | `GOOGLE_GENAI_API_KEY` | Token + per-Grounding          | großzügig (`gemini-2.0-flash`)   | Agent + Async        | ⭐ hoch                       |
| [Anthropic Claude](#9-anthropic-claude) | `ANTHROPIC_API_KEY`    | $10/1k web_search + Tokens     | Variabel ($5 Guthaben bei Start) | Agent                | hoch                          |
| [OpenAI](#10-openai)                    | `OPENAI_API_KEY`       | Token + per-Tool               | Nein (ab ~2024)                  | Agent + Async        | hoch                          |
| [ScrapingBee](#11-scrapingbee-deferred) | `SCRAPINGBEE_API_KEY`  | ab $49/Mo                      | 1000 Credits Signup              | Extract              | ❌ **deferred** (Abo-Pflicht) |

**Empfohlene Minimum-Auswahl für einen vollwertigen Research Lab Vergleich:**
Brave + Tavily + Exa + Perplexity + Google Gemini + OpenAI. Das gibt dir 2 unabhängige Search-Indizes, einen semantischen Index, und drei qualitativ unterschiedliche Agents. Typische Startkosten: $0 (Free-Tiers decken Evaluation ab).

---

## 0. SearXNG (kein Key)

Läuft bereits als Docker-Container auf `localhost:8080` via `docker-compose.yml`. Du musst nichts tun. `mana-search` (port 3021) proxied dahin.

## 0a. DuckDuckGo (kein Key)

Die DuckDuckGo Instant-Answer-API braucht keinen Key. Sie ist rate-limited und liefert nur bei klaren Entities brauchbare Ergebnisse — gut als kostenloser Sanity-Check, nicht als Hauptanbieter.

---

## 1. Brave Search

**Was ist das:** Eigener Web-Index (nicht Google-Relay). Starke Privacy-Story, unabhängig, stabile Qualität.

**Signup:**

1. Gehe zu https://api.search.brave.com
2. „Get Started Free" → mit E-Mail registrieren
3. E-Mail verifizieren
4. Im Dashboard: Subscription wählen → **„Data for Search" + „Free plan"** (keine Kreditkarte nötig) ODER **„Pro AI" Plan** ($5/1k Queries, pay-per-use)
5. „API Keys" → „Generate API Key" → kopieren (Format `BSA...`)

**Free Tier:** 2000 Queries/Monat, 1 Query/Sekunde. Reicht für Testing.
**Kosten (paid):** $5/1000 Queries, pay-as-you-go, keine monatliche Mindestgebühr.

**Dokumentation:** https://api.search.brave.com/app/documentation/web-search/get-started

**Env-Var:** `BRAVE_API_KEY=BSA...`

---

## 2. Tavily

**Was ist das:** LLM-agent-optimierte Suche. Liefert extrahierte Inhalte direkt mit (nicht nur Links).

**Signup:**

1. Gehe zu https://tavily.com
2. „Get Free API Key" → mit Google/GitHub oder E-Mail
3. Im Dashboard sofort sichtbar: der Key (Format `tvly-...`)
4. Für mehr als 1000 Credits/Monat: „Upgrade" → Credit Pack kaufen (persistent, läuft nicht ab, **keine Abo-Verpflichtung**)

**Free Tier:** 1000 Credits/Monat (entspricht ~1000 Suchanfragen). Reicht für moderate Nutzung.
**Kosten (paid):** Credit-Packs, ab $30 für 4000 Credits (~$0.0075/Credit), läuft nicht ab.

**Dokumentation:** https://docs.tavily.com/docs/rest-api/api-reference

**Env-Var:** `TAVILY_API_KEY=tvly-...`

---

## 3. Exa

**Was ist das:** Neuronale/semantische Suche. Bestes Tool für „find similar to …" und akademische Paper.

**Signup:**

1. Gehe zu https://dashboard.exa.ai
2. Mit Google oder E-Mail einloggen
3. Du bekommst **$10 Startguthaben** (reicht für ~1000–10.000 Queries je nach Modus)
4. „API Keys" → „Create Key" → kopieren
5. Zahlung hinzufügen optional — erst nötig wenn Guthaben verbraucht

**Kosten:** `neural` ~$0.005/Query, `keyword` $0.001/Query, mit `contents` Aufpreis. Pay-per-use.

**Dokumentation:** https://docs.exa.ai

**Env-Var:** `EXA_API_KEY=...`

---

## 4. Serper

**Was ist das:** Google-SERP-Ergebnisse als JSON. Liefert People-Also-Ask, Knowledge Panels, Shopping-Boxen — 1:1 was Google anzeigt.

**Signup:**

1. Gehe zu https://serper.dev
2. „Sign Up" mit E-Mail oder Google
3. **2500 Gratis-Queries** werden automatisch gutgeschrieben (einmalig, kein Monatsreset)
4. „API Key" im Dashboard kopieren
5. Paid: „Billing" → $50 einzahlen = 50k Queries, pay-as-you-go. Kein Abo-Zwang.

**Kosten:** $0.30–1 pro 1000 Queries je nach Plan. Pay-per-use ab $50.

**Dokumentation:** https://serper.dev/api-key

**Env-Var:** `SERPER_API_KEY=...`

---

## 5. Jina Reader

**Was ist das:** Inhaltsextraktion von jeder Webseite als sauberes Markdown. Läuft ohne Key mit moderaten Rate-Limits — Key ist **optional** aber hebt das Limit.

**Signup (optional):**

1. Gehe zu https://jina.ai
2. Oben rechts „API" → „Get API Key"
3. Mit E-Mail registrieren → Key wird direkt angezeigt (Format `jina_...`)
4. **1M Tokens/Monat kostenlos**, danach $0.02/1M Tokens PAYG

**Ohne Key:** Funktioniert auch, nur mit niedrigerem Rate-Limit (~60 Requests/Min).

**Dokumentation:** https://jina.ai/reader

**Env-Var:** `JINA_API_KEY=jina_...` (optional, aber empfohlen)

---

## 6. Firecrawl

**Was ist das:** Playwright-basierter Scraper. Rendert JavaScript, liefert LLM-ready Markdown. Beste Option für Single-Page-Apps, Paywalls (Teaser), PDFs.

**Signup (Cloud):**

1. Gehe zu https://firecrawl.dev
2. „Get started" → GitHub/Google/E-Mail
3. **500 Credits gratis** beim Signup
4. „API Keys" → „Create" → Key kopieren (Format `fc-...`)
5. Paid: Credit-Packs ab $16 für 2000 Credits, pay-per-use. Es gibt auch Abos ($99/Mo), aber du kannst bei PAYG bleiben.

**Alternative (Self-Hosted):**

```bash
# Firecrawl hat eine Open-Source-Version
git clone https://github.com/mendableai/firecrawl
cd firecrawl && docker compose up -d
# Dann in mana-research:
# FIRECRAWL_API_URL=http://localhost:3002  (im Provider-Code anpassen)
# FIRECRAWL_API_KEY=beliebig-nicht-leer
```

**Kosten (Cloud):** ~$0.008/Scrape (Standard), $0.015 (mit JS-Render).

**Dokumentation:** https://docs.firecrawl.dev

**Env-Var:** `FIRECRAWL_API_KEY=fc-...`

---

## 7. Perplexity Sonar

**Was ist das:** Der beste „Plug&Play"-Research-Agent am Markt. Vier Modelle: `sonar` (schnell), `sonar-pro` (balanced), `sonar-reasoning` (Chain-of-Thought), `sonar-deep-research` (umfangreich).

**Signup:**

1. Gehe zu https://www.perplexity.ai/settings/api
2. Einloggen (Google/Apple/E-Mail)
3. **Kreditkarte hinterlegen** — kein echter Free-Tier auf der API. Du kannst aber ein Mini-Guthaben einzahlen (ab $5) und nur das verbrauchen.
4. „Generate" → Key kopieren (Format `pplx-...`)

**Kosten:**

- `sonar`: $1/1M Input-Tokens, $1/1M Output-Tokens, $5/1000 Web-Suchen
- `sonar-pro`: $3/1M Input, $15/1M Output, $5/1000 Suchen
- `sonar-reasoning`: $1/1M Input, $5/1M Output, $5/1000 Suchen
- `sonar-deep-research`: teurer, mehrere Suchen pro Anfrage

Eine typische Anfrage kostet ~$0.01–0.10.

**Dokumentation:** https://docs.perplexity.ai

**Env-Var:** `PERPLEXITY_API_KEY=pplx-...`

---

## 8. Google Gemini

**Was ist das:** Gemini mit Google-Search-Grounding = Echte Google-Suche im LLM-Antwortprozess. Günstig, guter Free-Tier für Testing.

**Signup:**

1. Gehe zu https://aistudio.google.com/apikey
2. Mit Google-Konto einloggen
3. „Create API key" → Projekt auswählen/erstellen
4. Key kopieren (Format `AIza...`)
5. **Free-Tier aktiv by default** — rate-limited (~15 RPM für Flash-Modelle)
6. Für höhere Limits: In Google Cloud Console Billing aktivieren

**Free Tier:** `gemini-2.0-flash`, `gemini-1.5-flash` haben einen großzügigen kostenlosen Tier. **Achtung:** Wenn dein Google-Konto bereits Paid-API-Nutzung hatte, kann das Free-Tier ausgeschöpft sein — dann musst du entweder Billing aktivieren oder ein frisches Google-Projekt anlegen.

**Kosten (Paid, wenn aktiviert):**

- `gemini-2.0-flash`: $0.10/1M Input, $0.40/1M Output
- Grounding-Query: $35/1000 Suchen
- `gemini-1.5-pro`: teurer

**Deep Research & Deep Research Max (derselbe Key):**
Seit 2026-04-21 deckt derselbe `GOOGLE_GENAI_API_KEY` auch die zwei neuen
async Agents ab — `gemini-deep-research` (~$1–3/Task, Standard) und
`gemini-deep-research-max` (~$3–7/Task, nächtliche Tiefenrecherche). Beide
laufen über die Interactions API mit `background=true` und sind im Service
über `POST /v1/research/async { provider: "gemini-deep-research" | "gemini-deep-research-max" }`
erreichbar. Preview-Status — Rate-Limits niedrig, Modell-IDs enden auf
`-preview-04-2026`. Details: [`docs/reports/gemini-deep-research.md`](../../docs/reports/gemini-deep-research.md).

**Dokumentation:** https://ai.google.dev/gemini-api/docs/api-key
**Deep-Research-Doku:** https://ai.google.dev/gemini-api/docs/deep-research

**Env-Var:** `GOOGLE_GENAI_API_KEY=AIza...`

---

## 9. Anthropic Claude

**Was ist das:** Claude-API mit dem server-seitigen `web_search_20250305`-Tool. Claude kann bis zu 5 Websuchen pro Anfrage machen und liefert präzise Zitate.

**Signup:**

1. Gehe zu https://console.anthropic.com
2. Registrieren (E-Mail oder Google)
3. **Billing einrichten** (Kreditkarte) — es gibt kein dauerhaftes Free-Tier, manche neue Konten bekommen $5 Startguthaben
4. „API Keys" → „Create Key" → kopieren (Format `sk-ant-...`)

**Kosten:**

- `claude-opus-4-7`: $15/1M Input, $75/1M Output Tokens
- `claude-sonnet-4-6`: $3/1M Input, $15/1M Output
- `claude-haiku-4-5`: $0.80/1M Input, $4/1M Output
- **web_search-Tool: $10 pro 1000 Suchen** (zusätzlich zu Tokens)

Typische Research-Anfrage mit Opus + 3 Suchen: ~$0.10–0.30.

**Modell-Wahl:** Unser Provider nutzt `claude-opus-4-7` als Default. Für Kostenersparnis kannst du im UI `options.model: "claude-sonnet-4-6"` setzen.

**Dokumentation:** https://docs.anthropic.com/en/api/getting-started

**Env-Var:** `ANTHROPIC_API_KEY=sk-ant-...`

---

## 10. OpenAI

**Was ist das:** OpenAI Responses API mit `web_search_preview`-Tool (sync) und `o3-deep-research` (async). Deckt zwei Provider ab: `openai-responses` + `openai-deep-research`.

**Signup:**

1. Gehe zu https://platform.openai.com/api-keys
2. Registrieren / einloggen
3. **Billing einrichten** (platform.openai.com/account/billing) — kein Free-Tier auf der API
4. Mindestens $5 Guthaben einzahlen
5. „Create new secret key" → kopieren (Format `sk-proj-...` oder `sk-...`)

**Kosten:**

- `gpt-4o`: $2.50/1M Input, $10/1M Output
- `gpt-4.1`: aktuellere Version, ähnlich bepreist
- `web_search_preview`-Tool: $25–30 pro 1000 Calls (zusätzlich zu Tokens)
- `o3-deep-research`: $10–20/1M Input (nutzt intern viele Suchen, kann $0.50–5 pro Task kosten)

**Async-Hinweis:** Der `openai-deep-research`-Provider startet Hintergrundjobs. Die laufen 5–30 Minuten. Das UI pollt `/v1/research/async/:taskId`. Denke an **Quota**: deine OpenAI-Org hat ggf. ein RPM- und TPM-Limit, das bei parallelen Jobs erreicht werden kann.

**Dokumentation:** https://platform.openai.com/docs/guides/tools-web-search

**Env-Var:** `OPENAI_API_KEY=sk-proj-...`

---

## 11. ScrapingBee (deferred)

ScrapingBee hat nur **Abo-Pläne ab $49/Monat** — passt nicht zur Pay-per-use-Regel dieses Projekts. Der Provider ist im Code-Stub angelegt aber nicht implementiert. Wenn du trotzdem ein Abo hast und es brauchst: Issue öffnen, ich implementiere die Extraction-Pipeline (Raw-HTML → Readability-Post-Process) nach.

---

## Wohin mit den Keys?

### Dev (lokal)

Kopiere `.env.secrets.example` nach `.env.secrets` (ist gitignored):

```bash
cd /Users/till/Documents/Code/managarten
cp .env.secrets.example .env.secrets
```

Füge deine Keys in `.env.secrets` hinzu:

```env
# === Research-Provider Keys ===
BRAVE_API_KEY=BSA-dein-key-hier
TAVILY_API_KEY=tvly-dein-key-hier
EXA_API_KEY=dein-exa-key
SERPER_API_KEY=dein-serper-key
JINA_API_KEY=jina_dein-key-hier
FIRECRAWL_API_KEY=fc-dein-key-hier
PERPLEXITY_API_KEY=pplx-dein-key-hier
ANTHROPIC_API_KEY=sk-ant-dein-key-hier
OPENAI_API_KEY=sk-proj-dein-key-hier
GOOGLE_GENAI_API_KEY=AIza-dein-key-hier
```

Dann neu generieren und Service neustarten:

```bash
pnpm setup:env
# mana-research neu starten (existierende PID killen, dann:)
cd services/mana-research && MANA_SERVICE_KEY=dev-service-key bun run dev
```

> Hinweis: Der manuelle `MANA_SERVICE_KEY=dev-service-key` ist temporär nötig wegen einem cross-service env-Mismatch. Wenn mana-credits neu mit dem neueren Service-Key gestartet wird (oder `.env.development` angepasst), entfällt das.

### Produktion (Mac-Mini Docker)

Die Keys sind bereits im `docker-compose.macmini.yml` als `${BRAVE_API_KEY:-}` etc. referenziert. Setze sie in der Docker-Compose-`.env`-Datei auf dem Mac-Mini oder als Docker-Secrets. Detail siehe `docs/DEPLOYMENT.md` und `docs/MAC_MINI_SERVER.md`.

### BYO-Keys pro User (Frontend)

User können ihre eigenen Keys in `/research-lab/keys` hinterlegen — die landen in `research.provider_configs` pro `userId`. Diese Keys **überschreiben** den Server-Key für diesen User und umgehen mana-credits (kein Credit-Verbrauch, der User zahlt direkt beim Provider).

Aktuell plaintext in der DB. **TODO:** AES-GCM-256 via `shared-crypto` KEK — siehe `storage/configs.ts:decryptKey()`.

---

## Verifikation nach Setup

Nach `pnpm setup:env` und Service-Restart:

```bash
# 1. Welche Provider sind ready (haben Server-Key)?
curl -s http://localhost:3068/api/v1/providers/health | python3 -m json.tool

# Erwarten: Jeder Provider mit Key zeigt status=ready, ohne Key: status=needs-key

# 2. Echter Testcall (JWT via Login holen)
TOKEN=$(curl -s -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"tills95@gmail.com","password":"Aa-123456789"}' \
  | python3 -c "import sys,json; print(json.load(sys.stdin)['accessToken'])")

# Compare-Call mit allen Such-Providern:
curl -s -X POST http://localhost:3068/api/v1/search/compare \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"Claude Opus 4.7","providers":["brave","tavily","exa","serper","searxng"],"options":{"limit":3}}' \
  | python3 -m json.tool | head -80

# Agent-Call:
curl -s -X POST http://localhost:3068/api/v1/research/compare \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"query":"What is Mana (the app at mana.how)?","providers":["perplexity-sonar","gemini-grounding","claude-web-search"]}' \
  | python3 -m json.tool | head -60
```

## Kosten-Monitoring

Jede Compare-Anfrage reserviert Credits via `mana-credits`. Bei Fehler wird refundet. Check das Ledger:

```bash
docker exec mana-postgres psql -U mana -d mana_platform -c "
SELECT provider_id, COUNT(*), SUM(cost_credits) AS total_credits, AVG(latency_ms)::int AS avg_latency
FROM research.eval_results
WHERE success = true
GROUP BY provider_id
ORDER BY total_credits DESC;"
```

## Troubleshooting

| Fehler                                 | Ursache                                                           | Fix                                                                                          |
| -------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `needs-key` im Health-Check            | Env-Var nicht gesetzt oder Service nicht neu gestartet            | `.env.secrets` prüfen → `pnpm setup:env` → Service restart                                   |
| `credits.reserve failed: 401`          | MANA_SERVICE_KEY zwischen mana-research und mana-credits mismatch | mana-research mit `MANA_SERVICE_KEY=dev-service-key` starten                                 |
| `429 RESOURCE_EXHAUSTED` (Gemini)      | Free-Tier verbraucht oder Account ohne Billing                    | Neues Google-Projekt oder Billing aktivieren                                                 |
| `Insufficient credits` (402)           | User-Balance in mana-credits zu niedrig                           | Credits gutschreiben (`/api/v1/internal/credits/init` + direkt DB-Update in Dev)             |
| `Provider "X" is not configured` (501) | Provider `requiresApiKey=true` aber weder Server- noch BYO-Key    | Key setzen (siehe oben)                                                                      |
| Redis `NOAUTH Authentication required` | Redis hat Passwort, aber `REDIS_URL` ohne Credentials             | `REDIS_URL=redis://:password@localhost:6379` — Cache degradiert sonst graceful (nicht fatal) |
