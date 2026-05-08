# Gemini 3.1 Pro Deep Research & Deep Research Max

**Datum:** 2026-04-22
**Anlass:** Googles Launch am 2026-04-21 — zwei autonome Research-Agenten auf Basis von Gemini 3.1 Pro, verfügbar als Public Preview über die Gemini API.
**Status:** Schritt 1 + 2 geliefert und **deployt auf Mac-Mini** (2026-04-22 18:21 MESZ). `MANA_AI_DEEP_RESEARCH_ENABLED=false` — Feature ist dark, Infra bereit. Schritt 3 (MCP-Server) geplant, nicht implementiert.

## TL;DR

Google hat zwei neue Research-Agenten veröffentlicht, die bei uns direkt in die Provider-Landschaft von `mana-research` passen und die Phase-3b-Lücke (`openai-deep-research` als einziger async Agent) auf natürliche Weise ergänzen. Besonderheit: **beide Agenten sprechen Model Context Protocol (MCP)**, wodurch sie potenziell an *unsere* Daten andocken könnten — was in Kombination mit dem existierenden AI-Mission-Key-Grant-System (RSA-wrapped MDK, audit-logged) ein strategisch interessanter Vektor ist.

Schritt 1 (async Provider) und Schritt 2 (`mana-ai` Cross-Tick-Pre-Research) sind geliefert und hinter einem Opt-in-Flag (`MANA_AI_DEEP_RESEARCH_ENABLED=true`) aktivierbar. Schritt 3 (MCP-Server für unsere verschlüsselten Kontextdaten) ist spezifiziert, aber Security-Review erforderlich vor Rollout.

## 1. Die Modelle im Detail

### 1.1 Varianten und Positionierung

| | **Deep Research** | **Deep Research Max** |
|---|---|---|
| **Model-ID** | `deep-research-preview-04-2026` | `deep-research-max-preview-04-2026` |
| **Zielbild** | Interaktiv, niedrige Latenz, eingebettet in User-Surfaces | Asynchron, nächtliche Cron-Jobs, maximale Tiefe |
| **Typ. Laufzeit** | Minutenbereich (eingebaut in Chat-UIs) | Bis zu 60 min (typ. ~20 min) |
| **Typ. Volumen** | ~80 Suchen, ~250k Input-Tokens, ~60k Output | ~160 Suchen, ~900k Input-Tokens, ~80k Output |
| **Preis (geschätzt)** | $1.00–3.00 pro Task | $3.00–7.00 pro Task |
| **DeepSearchQA** | — | 93.3 % (von 66.1 % im Dez 2025) |
| **Humanity's Last Exam** | — | 54.6 % (von 46.4 %) |

Beide laufen ausschließlich **async** (`background=true` ist Pflicht, `store=true` erforderlich). Es gibt keinen synchronen Request-Response-Modus wie bei `gemini-grounding`.

### 1.2 API-Shape — submit

```
POST https://generativelanguage.googleapis.com/v1beta/interactions
x-goog-api-key: <GOOGLE_GENAI_API_KEY>
Content-Type: application/json

{
  "agent": "deep-research-preview-04-2026",
  "input": "query",
  "background": true,
  "store": true,
  "agent_config": {
    "type": "deep-research",
    "thinking_summaries": "auto",       // Live-Gedanken streamen
    "visualization": "auto",            // Charts/Infographics inline
    "collaborative_planning": false
  },
  "tools": [
    { "type": "google_search" },
    { "type": "url_context" },
    { "type": "code_execution" },
    { "type": "file_search" },
    {
      "type": "mcp_server",
      "name": "mana-kontext",
      "url": "https://mcp.mana.how/...",
      "headers": { "Authorization": "Bearer …" },
      "allowed_tools": ["search_notes", "search_journal"]
    }
  ]
}

→ 200
{
  "id": "v1_Chd...",
  "status": "in_progress",
  "role": "agent",
  "created": "...",
  "agent": "deep-research-preview-04-2026"
}
```

### 1.3 API-Shape — poll (completed)

Die tatsächlich beobachtete Response-Shape (Smoke-Test am 2026-04-22) weicht von der OpenAI-Responses-API deutlich ab. Wir hatten initial OpenAI-Style (`output: [{type:'message', content:[...]}]`) erwartet — die echte Shape sieht so aus:

```
GET https://generativelanguage.googleapis.com/v1beta/interactions/{id}

→ 200
{
  "id": "v1_Chd...",
  "status": "completed",
  "outputs": [                                  // Plural! Flaches Array.
    { "type": "thought",
      "signature": "...",
      "summary": [                              // Thought-Summaries als Liste
        { "type": "text", "text": "..." }
      ]
    },
    {},                                         // Gelegentlich leer → ignorieren
    { "type": "text",
      "text": "# Hono and Bun...",
      "annotations": [
        { "type": "url_citation",
          "url": "https://...",
          "start_index": 268,
          "end_index": 283
        }
      ]
    },
    { "type": "image",
      "mime_type": "image/png",
      "data": "<base64>"                         // Charts/Infographics
    },
    { "type": "text", "text": "**Sources:** ..." }
  ],
  "usage": {
    "total_tokens": 145268,
    "total_input_tokens": 93025,
    "total_output_tokens": 7770,
    "total_cached_tokens": 16384,                // Prompt-Cache
    "total_tool_use_tokens": 28371,
    "total_thought_tokens": 16102,
    "input_tokens_by_modality": [...],
    "output_tokens_by_modality": [...]
  },
  "role": "agent",
  "object": "interaction",
  "agent": "deep-research-preview-04-2026"
}
```

Wichtig für den Parser:
- **`outputs` (nicht `output`)** ist ein flaches Array mit `type: 'thought' | 'text' | 'image' | null`
- `text` items haben `annotations[]` mit `type: 'url_citation'`, `url`, `start_index`/`end_index` — **kein `title`-Feld**, wir ziehen den Hostname aus der URL
- `image` items tragen base64-codierte Bilder (PNG) als `data` mit `mime_type`
- `thought` items sind die live-gestreamten Reasoning-Summaries — wenn wir nur den finalen Report brauchen, skip
- `usage` nutzt `total_input_tokens` / `total_output_tokens` (nicht `input_tokens` / `output_tokens`)

### 1.4 Was die Agenten können

- **Autonom planen** und iterativ nachsuchen, bis sie eine Antwort haben
- **Google Search + URL Context + Code Execution + File Search** parallel oder einzeln; Web-Zugriff lässt sich auch komplett deaktivieren (Pure-MCP-Mode)
- **MCP-Server** als Brücke zu proprietären Datenquellen — Enterprise-Partner sind FactSet, S&P Global, PitchBook
- **Native Visualisierung**: Charts und Infographics inline als HTML oder Nano-Banana
- **Thought-Summaries** als Live-Stream — brauchbar für "Agent denkt gerade…"-UIs
- **Keine** Structured Outputs, **keine** custom Function-Calls (dafür gibt es MCP)

## 2. Einordnung in unsere Landschaft

### 2.1 `mana-research` (port 3068)

Phase 3a liefert vier **synchrone** Agents (`perplexity-sonar`, `gemini-grounding`, `openai-responses`, `claude-web-search`). Phase 3b war ursprünglich nur für `openai-deep-research` (1000 credits) vorgesehen; mit Schritt 1 kommen die beiden Gemini-Async-Provider dazu und verdoppeln die Abdeckung des Max-Tiers.

### 2.2 `mana-ai` (port 3067)

v0.6 hatte den RSS-basierten `NewsResearchClient` und den **Pre-Planning-Research-Step** geshipped. Mit Schritt 2 (v0.7) kommt daneben ein zweiter Pfad: wenn eine Mission explizit nach deep research fragt und der Service die entsprechende ENV-Flag gesetzt hat, wird statt RSS eine async Gemini Deep Research Max Task submittet und über Ticks hinweg gepollt.

## 3. Integrationsplan — Status

| Schritt | Status | Datum | Details |
|---|---|---|---|
| 1 — Gemini als async Provider in mana-research | ✅ Geliefert | 2026-04-22 | §3.1 |
| 2 — Cross-Tick Deep-Research in mana-ai | ✅ Geliefert | 2026-04-22 | §3.2 |
| 3 — MCP-Server für unsere Daten | ⏳ Spezifiziert | — | §3.3 |

### 3.1 Schritt 1 — `gemini-deep-research[-max]` als async Provider — ✅ GELIEFERT

Zwei neue Provider-IDs neben `openai-deep-research` in `mana-research`:

**Geänderte/neue Dateien:**
- `packages/shared-research/src/ids.ts` — `AGENT_PROVIDER_IDS` erweitert um `gemini-deep-research` + `gemini-deep-research-max`
- `services/mana-research/src/providers/agent/gemini-deep-research.ts` — neuer Provider, submit/poll-Split tier-parametrisiert (`standard`/`max`). Parser nutzt die echte Response-Shape aus §1.3.
- `services/mana-research/src/routes/research.ts` — `/async` POST + `/async/:id` GET dispatchen via `dispatchAsync(providerId, config)`. Default: `openai-deep-research` (backward compatible).
- `services/mana-research/src/routes/internal-research.ts` — **neu** — service-to-service Pendant unter `/api/v1/internal/research/async`, gated durch `X-Service-Key` + `X-User-Id` Header für Credit-Accounting.
- `src/lib/pricing.ts` — 300 / 1500 credits (Standard / Max)
- `src/executor/env-map.ts` + `src/router/auto-route.ts` — beide neue IDs auf `googleGenai`, explizit **nicht** in `AGENT_DEFAULT_ORDER` (sync-Auto-Route überspringt sie; nur `/async` erreichbar)
- `src/routes/providers.ts` — Health-keyMap ergänzt
- `src/index.ts` — internal route gemountet unter `/api/v1/internal/research/*`
- `services/mana-research/API_KEYS.md` + `CLAUDE.md` — dokumentiert

**Use (user-facing):**
```
POST /api/v1/research/async
{ "query": "…", "provider": "gemini-deep-research-max" }
→ { taskId, status: "queued", providerId, costCredits: 1500 }

GET /api/v1/research/async/:taskId
```

**Use (service-to-service):**
```
POST /api/v1/internal/research/async
X-Service-Key: <MANA_SERVICE_KEY>
X-User-Id: <userId>
{ "query": "…", "provider": "gemini-deep-research-max" }
```

**Verifiziert** mit echtem `GOOGLE_GENAI_API_KEY` am 2026-04-22: submit + poll über Googles Preview-API → HTTP 200 in beiden Richtungen, completed Response korrekt geparst.

### 3.2 Schritt 2 — `mana-ai` v0.7 Cross-Tick Deep Research — ✅ GELIEFERT

**Problem:** Max-Tasks laufen bis 60 min. Der mana-ai Tick-Loop läuft alle 60 s. Wir brauchen Cross-Tick-State, um genau einen pending Research-Job pro Mission zu tracken und über mehrere Ticks zu pollen, ohne neu zu submitten.

**Geänderte/neue Dateien:**
- `services/mana-ai/src/clients/mana-research.ts` — **neu** — HTTP-Client für die internen Async-Endpoints. Graceful-null bei Fehler, damit eine kaputte mana-research den Tick nicht crasht.
- `services/mana-ai/src/db/migrate.ts` — neue Tabelle `mana_ai.mission_research_jobs (user_id, mission_id, task_id, provider_id, submitted_at, last_polled_at)` mit PK `(user_id, mission_id)`. Ein Row = es läuft ein Job.
- `services/mana-ai/src/db/research-jobs.ts` — **neu** — `get/insert/touch/delete`. Nach `completed`/`failed`: DELETE.
- `services/mana-ai/src/cron/tick.ts`:
  - neuer `handleDeepResearch(m, sql, config)` mit State-Machine:
    - Wenn pending Job existiert → poll
      - `queued`/`running` → `'pending'` (skip tick)
      - `failed`/`cancelled` → delete, fall through zu shallow
      - `completed` → delete + return ResolvedInput
    - Kein Job aber `DEEP_RESEARCH_TRIGGER` + `config.deepResearchEnabled` → submit + insert → `'pending'`
  - `planOneMission` Rückgabetyp auf Discriminated Union erweitert: `{outcome:'planned'|'skipped'|'failed'}` statt `T | null`, damit skipped-wegen-pending-research nicht als parse-failure gezählt wird
  - Shallow RSS-Pfad läuft nur noch, wenn deep weder ein Ergebnis geliefert hat, noch pending ist
- `services/mana-ai/src/config.ts` — `manaResearchUrl` + `deepResearchEnabled` (`MANA_AI_DEEP_RESEARCH_ENABLED`)
- `services/mana-ai/src/metrics.ts` — vier neue Counter: `mana_ai_research_jobs_submitted_total{provider}`, `_completed_total{provider}`, `_failed_total{provider}`, `_pending_skips_total`
- `services/mana-ai/package.json` — `@mana/shared-research` als workspace-dep + `type-check` script
- `docker-compose.macmini.yml` — mana-ai bekommt `MANA_RESEARCH_URL`, `MANA_AI_DEEP_RESEARCH_ENABLED` (default `false`), `depends_on: mana-research`

**Opt-in-Trigger (streng enger als shallow):**
```
DEEP_RESEARCH_TRIGGER = /\b(deep research|tiefe recherche|umfassende recherche|hintergrundrecherche|deep dive)\b/i
```
Zusätzlich per ENV gegated. In Prod default off; ein expliziter Flip erlaubt Rollout nur an uns selbst / Founder-Tier zuerst.

**Flow:**

```
 tick N-1: Mission X, objective: "deep research zu Thema Y"
   ├ RESEARCH_TRIGGER matched UND DEEP_RESEARCH_TRIGGER matched
   ├ config.deepResearchEnabled = true
   ├ client.submit(userId, "deep research zu…", "gemini-deep-research-max")
   │   → { taskId, status: "queued", costCredits: 1500 }
   ├ INSERT INTO mana_ai.mission_research_jobs (task_id, …)
   └ skip planner this tick

 tick N, N+1, … während Google den Task ausarbeitet (~20 min):
   ├ SELECT * FROM mana_ai.mission_research_jobs WHERE (user_id, mission_id) = …
   ├ client.poll(userId, taskId) → { status: "running" }
   ├ touchPendingResearchJob() bumpt last_polled_at
   └ skip planner this tick

 tick N+k: Max ist fertig
   ├ client.poll(userId, taskId) → { status: "completed", result: { answer: {...} } }
   ├ DELETE FROM mana_ai.mission_research_jobs WHERE …
   ├ resolvedInputs.push({id:"__web-research__", content: formatDeepResearchContext(...)})
   └ Planner läuft mit Deep-Research-Kontext als Input
```

**Graceful Degradation:** Wenn `mana-research` down oder der Gemini-Submit 500t, fällt die Mission auf den Shallow-RSS-Pfad zurück. Wenn ein bereits submittierter Job nicht mehr gepollt werden kann, rotiert der Row ab über `touchPendingResearchJob`, bis manuelle Intervention oder ein späterer poll Erfolg hat.

### 3.3 Schritt 3 — MCP-Server für verschlüsselte Kontextdaten — ⏳ SPEZIFIZIERT

**Warum der Aufwand:** Der Grund, warum dieses Feature gerade *für uns* strategisch ist: wir haben ein Zero-Knowledge-Crypto-Setup mit per-mission Key-Grants (RSA-OAEP-2048 wrapped MDK, HKDF-Scope-Binding, audit-logged). Das MCP-Pattern kreuzt exakt unsere Stärke (lokale, verschlüsselte Daten) mit Googles Stärke (Deep-Research-Synthese). Positioning: **"Deep Research, das deine Kontextdaten kennt — ohne sie in Google's Trainings-Pipeline zu schicken"**.

#### 3.3.1 Architektur

```
 ┌──────────────────┐       ┌──────────────────┐
 │  Gemini DR Max   │◀──────│  mana-mcp-server │  (Cloudflare-tunneled,
 │  (bei Google)    │  MCP  │  (neu, port 3069)│   öffentlich erreichbar)
 └──────────────────┘       └──────┬───────────┘
                                   │ Bearer <mcp-token>
                                   │ (Mission-ID, TTL-clamped)
                                   ▼
                            ┌──────────────────┐
                            │    mana-auth     │  verifiziert token,
                            │                  │  lädt Mission-Grant,
                            │  /api/v1/mcp-    │  unwrappt MDK
                            │  token/verify    │
                            └──────┬───────────┘
                                   │
                                   ▼
                            ┌──────────────────┐       ┌─────────────────┐
                            │ Encrypted-Data   │──────▶│  mana_sync DB   │
                            │ Resolver         │       │  (+ RLS)        │
                            │ (re-use of       │       └─────────────────┘
                            │  mana-ai's       │
                            │  encrypted.ts)   │
                            └──────────────────┘
```

Der neue Service `mana-mcp` übernimmt die Rolle des MCP-Servers für Gemini. Er:

1. **hört auf eingehende MCP-Requests** von Google (z. B. `tools/call` mit `search_notes`), authentifiziert per **Bearer-Token pro Mission**. Der Token ist kein JWT, sondern eine opaque ID, die in mana-auth auf `{missionId, userId, allowedTools, expiresAt}` aufgelöst wird — analog zum existierenden Mission-Key-Grant.
2. **verifiziert das Token** gegen mana-auth's neue `/api/v1/mcp-token/verify` Route (returned `{userId, missionId, mdk-wrapped, allowedTools}` oder 401).
3. **unwrappt den Mission-Grant** (MDK) via den existierenden `crypto/unwrap-grant.ts`-Code aus mana-ai — wird in ein geteiltes Paket `@mana/mission-grant` gehoben.
4. **liest und entschlüsselt** die relevanten Records aus `mana_sync` via den existierenden `encrypted.ts` Resolver-Pattern (ebenfalls ins gleiche Paket heben).
5. **antwortet in MCP-Shape** mit Titel + Body + URL pro gefundenem Record.

#### 3.3.2 Tool-Set (Minimal)

Start mit drei readonly Tools, alle audit-logged nach `mana_ai.decrypt_audit`:

| Tool | Signatur | Was es macht |
|---|---|---|
| `search_notes` | `(query: string, limit?: number)` | Volltext über entschlüsselte Notizen |
| `search_journal` | `(date_range?: {from,to}, query?: string, limit?: number)` | Journal-Einträge nach Datum + Query |
| `search_kontext` | `(scope: string)` | Kontext-Felder aus dem Interview (bereits strukturiert) |

Alle drei sind scoped auf die Mission — sie sehen nur Records, die der Mission-Grant in der Allowlist hat. Schreibende Tools bewusst nicht.

#### 3.3.3 Token-Lifecycle

1. **Mission-Erstellung (Webapp):** Wenn eine Mission für Deep-Research-Max konfiguriert wird, erzeugt die Webapp zusätzlich zum existierenden Key-Grant einen **MCP-Token** via `POST /api/v1/me/ai-mission-mcp-token` auf mana-auth. Der Endpoint:
   - erzeugt eine opaque Bearer-ID (crypto random, 32 bytes)
   - speichert sie in `mana_auth.mcp_tokens` mit `{tokenHash, userId, missionId, allowedTools, expiresAt}`
   - TTL-clamped [1h, 7d] — kürzer als Key-Grants, weil das Token exakt einen Research-Run abdeckt

2. **Submit (mana-ai):** Beim Submit der Max-Task wird der MCP-Token als `headers.Authorization` in den `tools.mcp_server`-Block eingebaut, passend zum Request-Shape aus §1.2.

3. **MCP-Call (mana-mcp):** Jeder eingehende Request wird via mana-auth verifiziert. Bei `expires`/unbekanntem Token → 401. Bei OK → Resolver-Aufruf + audit-row.

4. **Teardown:** Nach Poll-Result `completed`/`failed` markiert mana-ai den Token als verbraucht (mana-auth DELETE). Auch expirte Tokens werden über einen Cron entfernt.

#### 3.3.4 Was wir neu bauen müssen

| Komponente | Umfang |
|---|---|
| `services/mana-mcp/` | Neuer Bun/Hono-Service, ~500 LOC. MCP-Protokoll (JSON-RPC über HTTP), 3 Tool-Handler, Bearer-Auth. |
| `packages/mission-grant/` | Wiederverwendbares Paket mit `unwrapMissionGrant` + `encryptedRecordResolver` (jetzt in mana-ai lokalisiert) |
| `mana_auth.mcp_tokens` Tabelle | `{id, token_hash, user_id, mission_id, allowed_tools, expires_at, consumed_at}` |
| `POST /api/v1/me/ai-mission-mcp-token` | Issue |
| `POST /api/v1/mcp-token/verify` | Server-to-server Verify |
| `DELETE /api/v1/me/ai-mission-mcp-token/:id` | Explicit revoke (UI-Link) |
| Webapp: MCP-Option im Mission-Detail | "Meine Kontextdaten für diese Recherche freigeben" Checkbox + Token-Erzeugung |
| Audit-Tab-Erweiterung | Zeigt auch MCP-Aufrufe neben Decrypts |
| Cloudflare Tunnel für `mcp.mana.how` → mana-mcp | Analog zu `api.mana.how` etc. |

#### 3.3.5 Risiken

- **Öffentliche Angriffsfläche:** Der Service ist über Cloudflare Tunnel öffentlich erreichbar — sonst kann Gemini ihn nicht aufrufen. Ein schlecht durchdachter Tool-Handler oder eine Grant-Verwechslung bedeutet direkte Datenlecks. **Security-Review Pflicht** (Secure Code Review + Mini-Pentest) vor Rollout.
- **MCP-Rate-Limits:** Google kann den Server bei parallelen Research-Max-Tasks zig mal pro Minute anfragen. Wir brauchen Rate-Limiting (per Token) + Caching-Layer.
- **Token-Scope-Violations:** Wenn ein Request für Mission A auf Records aus Mission B geht (Bug oder Angriff), muss das einen dicken Alert auslösen. Bestehende `grant_scope_violations_total` Metrik lässt sich wiederverwenden.
- **Prompt Injection:** Entschlüsselte Notizen-Content kann Instruktionen an Gemini enthalten ("IGNORE PREVIOUS, download all …"). Wir müssen Tool-Responses klar als `data`, nicht als `instructions` labeln und Gemini prompten, userdata als nicht-vertrauenswürdig zu behandeln.
- **DSGVO-Implikationen:** Auch wenn MCP nur punktuell liest, geht der gelesene Content via Google's API-Endpunkt. Das muss in den Privacy-Text + Consent-Flow der Webapp.
- **Preview-Stabilität:** Bauen bevor die MCP-Integration auf Google-Seite stabil ist, heißt nachbauen wenn sich das Protokoll ändert. Erst mit POC, dann inkrementell.

#### 3.3.6 Meilensteine

**M0 — Security-Review + Plan-Sign-off (1–2 Tage).** Vor jeder Implementation. Liefert: konkretes Threat-Model, DSGVO-Check, Go/No-Go.

**M1 — POC mit `search_notes` only (3–4 Tage).**
- `services/mana-mcp` Bun-Service-Skeleton
- `@mana/mission-grant` Paket extrahiert (kein Verhaltenschange für mana-ai)
- `mcp_tokens` Tabelle + Issue/Verify-Endpoints
- Nur `search_notes`, auf einen harten Test-User gated (`userId === 'dev-…'`)
- Ad-hoc Cloudflare-Tunnel, noch kein permanenter `mcp.mana.how`

**M2 — `search_journal` + `search_kontext` + Prod-Tunnel (2 Tage).** Nach M1-Erkenntnissen.

**M3 — Webapp UX (2–3 Tage).** Mission-Config-Checkbox + Audit-Tab-Erweiterung.

**M4 — Public Rollout Founder-Tier.** Nach 1 Woche Beta für uns selbst.

Bewusst linearer Rollout — MCP ist zu Security-sensitiv für parallele Entwicklung.

## 4. Pricing-Sanity-Check

Bei angenommenen $3–7 pro Max-Task: eine nächtliche Max-Mission pro aktivem Nutzer entspricht **$90–210/Monat pro Nutzer**. Das sitzt jetzt hinter zwei Gates:

1. `MANA_AI_DEEP_RESEARCH_ENABLED=true` auf dem Server (default off)
2. `DEEP_RESEARCH_TRIGGER` Regex im Mission-Text (explizite User-Wording)

Das `mana-credits` 2-Phase-Debit-Modell fängt Per-User-Limits ab, aber wir haben konservativ mit 1500 credits (≈ $15) für Max gepreist statt 700 (≈ $7) — als Puffer. Nach ersten echten Runs nachjustieren in `services/mana-research/src/lib/pricing.ts`.

## 5. Risiken & offene Fragen (Stand nach Schritt 1+2)

- **Preview-Status:** Model-IDs enden auf `-preview-04-2026`. Google deprecated solche Varianten typischerweise innerhalb von 6–12 Monaten. Aktuelle Strategie: `modelVersion` liegt als Konstante in `gemini-deep-research.ts` — Upgrade auf GA ist ein 1-Zeilen-Change, kein Refactor.
- **Charts/Infographics (`image`-Items):** Wir parsen sie derzeit nur in `providerRaw` — nicht im `AgentAnswer.answer` String. Follow-up: neues optionales Feld `AgentAnswer.visualizations: Array<{mime, data}>` plus MinIO-Upload für große Bilder.
- **Thought-Summaries:** Gehen heute verloren. Für eine zukünftige Research-Lab-UI wäre Streaming (`stream=true`) + Live-Anzeige der Gedanken ein differenzierendes Feature.
- **Quota:** Public Preview heißt niedrige Rate-Limits. Ersten 2 Wochen nur Founder-Tier. Monitoring via `mana_ai_research_jobs_failed_total{provider}` — sobald Spikes, Rate-Limit-Retry-Logic nachziehen.
- **`collaborative_planning: true`**: Ignoriert. Wäre ein interessanter UX-Modus für eine zukünftige **Webapp**-Research-Lab-UI (Agent fragt vor Start zurück, ob der Plan passt). Irrelevant für den Background-Runner.
- **MCP-Seite (Schritt 3):** siehe §3.3.5 — eigener Risk-Catalog.

## 6. Betrieb

### 6.1 Metriken

```
# mana-research
research.async_jobs  — Tabelle, ein Row pro submit (inkl. finalem result)

# mana-ai
mana_ai_research_jobs_submitted_total{provider}    — Pro Tick submittet
mana_ai_research_jobs_completed_total{provider}    — Pro Tick Ergebnisse verfuettert
mana_ai_research_jobs_failed_total{provider}       — Pro Tick failed/cancelled
mana_ai_research_jobs_pending_skips_total          — Pro Tick skipped (Job läuft noch)
mana_ai_mission_research_jobs  — Tabelle, ein Row pro pending Job pro Mission
```

### 6.2 Debug-Workflow

```bash
# Welche Missions haben aktuell einen pending Deep-Research-Job?
docker exec mana-postgres psql -U mana -d mana_sync -c "
  SELECT user_id, mission_id, provider_id,
         age(now(), submitted_at) AS running_for,
         last_polled_at
  FROM mana_ai.mission_research_jobs
  ORDER BY submitted_at DESC;"

# Was ist der aktuelle Status upstream?
docker exec mana-postgres psql -U mana -d mana_platform -c "
  SELECT id, user_id, provider_id, status, cost_credits, age(now(), created_at) AS age
  FROM research.async_jobs
  ORDER BY created_at DESC LIMIT 20;"
```

### 6.3 Notfall-Kill-Switch

`MANA_AI_DEEP_RESEARCH_ENABLED=false` + Service-Restart → keine neuen Jobs. Bereits pending Jobs laufen zu Ende (werden brav gepollt bis fertig), keine neuen kommen dazu.

Härter: direkte DB-Bereinigung —

```sql
DELETE FROM mana_ai.mission_research_jobs WHERE submitted_at < now() - interval '2 hours';
```

Die upstream-Tasks bleiben bei Google, aber wir lassen sie einfach laufen (Google berechnet sie trotzdem — aber das ist der Compute-Kosten-Sunk-Cost, nicht der Hebel).

### 6.4 Deploy-Log — 2026-04-22 (Mac-Mini)

Erst-Deploy von Schritt 1 + 2 auf dem Produktions-Mac-Mini. Alles, was von der Standard-Konfiguration abwich:

- **`mana-research` war auf Mac-Mini noch nie gestartet** — Service ist zwar in `docker-compose.macmini.yml` definiert, aber nie hochgezogen. Erst-Boot via `docker compose ... up -d mana-research`.
- **`research.*` Schema existierte nicht in `mana_platform`** — das Drizzle-Push läuft **nicht** automatisch beim Service-Boot. Manuell nachgezogen:
  ```bash
  docker exec mana-research bun run db:push
  ```
  Ergebnis: 5 Tabellen (`async_jobs`, `eval_results`, `eval_runs`, `provider_configs`, `provider_stats`).
- **`GOOGLE_GENAI_API_KEY` fehlte in `.env`** — lokalen Key aus `.env.secrets` nach `/Users/mana/projects/managarten/.env` übertragen. Backup: `.env.bak.pre-gemini-deep-research`.
- **Redis-NOAUTH-Spam**: mana-research hatte `REDIS_URL: redis://redis:6379` ohne Passwort-Credentials, Redis läuft aber mit `--requirepass`. Cache degradierte graceful, aber Log-Noise. Fix: commit `4867300d0` — `REDIS_URL: redis://:${REDIS_PASSWORD:-redis123}@redis:6379`.
- **Smoke-Test**: Submit über `POST /api/v1/internal/research/async` (Standard-Tier, 300 credits, Test-User ohne Wallet-Eintrag) → HTTP 500 in mana-credits (`credits.reserve failed: 404 Not Found`). **Erwartetes Ergebnis** — beweist den Chain `X-Service-Key → dispatch → googleGenai apiKey → credits.reserve` bis zum mana-credits-HTTP-Call. Kein Fehler in unserem neuen Code.

Bekannte offene Punkte nach Deploy:

- `mana-llm` (Port 3025) hat dieselbe Redis-ohne-Passwort-Config. Out-of-Scope für diesen Deploy, aber dokumentiert hier für einen separaten Fix.
- `/api/v1/providers/health` listet async-Provider nicht (weil sie nicht in der `buildRegistry()`-Map stehen). Health-Seite-Lücke, kein funktionaler Fehler.
- Für den ersten echten Test-Run braucht es (a) einen User mit Credits in `credits.balances` und (b) `MANA_AI_DEEP_RESEARCH_ENABLED=true` + mana-ai-Restart.

## 7. Empfehlung

1. **Jetzt (erledigt, 2026-04-22):** Schritt 1 + 2 umgesetzt. Ein Pilot mit uns selbst (einem Test-User mit Founder-Tier und expliziter "deep research" Mission) kann ab sofort laufen. `MANA_AI_DEEP_RESEARCH_ENABLED=true` auf dem Mac-Mini setzen und eine Nightly-Mission anlegen.
2. **Nach 1 Woche Pilot:** Wenn Response-Qualität + Latenz überzeugen und kein größerer Parser-Fail auftritt → Founder-Tier öffnen (ENV-Flag bleibt, Opt-in per Mission-Wording).
3. **Nach 2 Wochen Pilot + Beta-Tier-Öffnung:** Schritt 3 (MCP-Server) M0-M1 starten — POC mit `search_notes` only + harter User-Gate.
4. **Nach Erfolg von M1:** M2-M4 iterativ. Public Rollout erst mit kompletter Audit-UX + dokumentiertem Privacy-Flow.

## Quellen

- [Google Blog — Deep Research Max: a step change for autonomous research agents](https://blog.google/innovation-and-ai/models-and-research/gemini-models/next-generation-gemini-deep-research/)
- [Google AI for Developers — Gemini Deep Research Agent docs](https://ai.google.dev/gemini-api/docs/deep-research)
- [Google AI for Developers — Gemini API changelog](https://ai.google.dev/gemini-api/docs/changelog)
- [VentureBeat — Google's new Deep Research and Deep Research Max agents can search the web and your private data](https://venturebeat.com/technology/googles-new-deep-research-and-deep-research-max-agents-can-search-the-web-and-your-private-data)
- [The Decoder — Google launches Deep Research and Deep Research Max agents to automate complex research](https://the-decoder.com/google-launches-deep-research-and-deep-research-max-agents-to-automate-complex-research/)
- [Testing Catalog — Google debuts Deep Research agents on AI Studio and APIs](https://www.testingcatalog.com/google-debuts-deep-research-agents-on-ai-studio-and-apis/)
- [H2S Media — Google Launches Deep Research Max, Its Most Powerful Autonomous Research Agent](https://www.how2shout.com/news/google-deep-research-max-gemini-api-autonomous-agent.html)
- [Model Context Protocol Specification (für Schritt 3)](https://modelcontextprotocol.io/specification)
