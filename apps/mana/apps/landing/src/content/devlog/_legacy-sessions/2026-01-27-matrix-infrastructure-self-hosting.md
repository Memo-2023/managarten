---
title: 'Matrix Self-Hosting, 3 neue Bots & Chat Model Comparison'
description: 'GDPR-konforme Matrix-Infrastruktur mit Synapse, neue Stats/ProjectDoc/Ollama Bots, GuestWelcomeModal und Chat Model-Vergleichsfeature.'
date: 2026-01-27
author: 'Till Schneider'
category: 'feature'
tags:
  [
    'matrix',
    'synapse',
    'gdpr',
    'self-hosting',
    'stats-bot',
    'project-doc-bot',
    'ollama-bot',
    'chat',
    'model-comparison',
    'guest-mode',
    'telegram-bot',
  ]
featured: true
commits: 11
readTime: 12
stats:
  filesChanged: 112
  linesAdded: 7365
  linesRemoved: 257
contributors:
  - name: 'Till Schneider'
    handle: 'Till-JS'
    commits: 11
workingHours:
  start: '2026-01-27T11:00'
  end: '2026-01-28T11:00'
---

> **Legacy-Format.** Dieser Eintrag stammt aus dem Session-basierten Devlog vor der Umstellung auf das Tages-Modell (Cutover 2026-05-09). Bestand bleibt erhalten und unverändert; neue Einträge folgen der Tages-Konvention mit `spieler.md` + `macher.md` pro 06–06-Bucket. Spec: [`mana/docs/DEVLOG.md`](https://github.com/mana-ev/mana/blob/main/docs/DEVLOG.md).

Strategischer Tag mit **11 Commits** und Fokus auf GDPR-Compliance und Developer Experience:

- **Matrix Self-Hosting** - Eigene Synapse-Instanz für GDPR
- **3 neue Matrix Bots** - Stats, Project Doc, Ollama
- **Chat Model Comparison** - Feature zum Vergleich von AI-Modellen
- **GuestWelcomeModal** - Verbessertes Guest Onboarding
- **Cleanup** - Märchenzauber-Projekt entfernt

---

## Matrix Self-Hosting für GDPR

Eigene Matrix-Infrastruktur für GDPR-konforme Bot-Kommunikation.

### Warum Self-Hosting?

| Aspekt      | Matrix.org    | Self-Hosted     |
| ----------- | ------------- | --------------- |
| Datenhoheit | ❌ US-Server  | ✅ Mac Mini DE  |
| GDPR        | ⚠️ Fragwürdig | ✅ Voll konform |
| Latenz      | ~100ms        | ~10ms           |
| Kosten      | Kostenlos     | Server-Kosten   |
| Kontrolle   | Keine         | Volle           |

### Architektur

```
┌─────────────────────────────────────────────────────┐
│                 Mac Mini Server                      │
├─────────────────────────────────────────────────────┤
│  ┌─────────────┐    ┌─────────────┐                 │
│  │   Synapse   │    │  PostgreSQL │                 │
│  │  (Matrix)   │◄───│   Database  │                 │
│  │  Port 8448  │    │             │                 │
│  └──────┬──────┘    └─────────────┘                 │
│         │                                            │
│         ▼                                            │
│  ┌─────────────────────────────────────────────┐    │
│  │              Matrix Bots                     │    │
│  ├──────────┬──────────┬──────────┬───────────┤    │
│  │ Stats    │ Project  │ Ollama   │ Clock     │    │
│  │ Bot      │ Doc Bot  │ Bot      │ Bot       │    │
│  └──────────┴──────────┴──────────┴───────────┘    │
└─────────────────────────────────────────────────────┘
           │
           ▼
┌─────────────────────────────────────────────────────┐
│               Element Web Client                     │
│          https://element.mana.how                    │
└─────────────────────────────────────────────────────┘
```

### Docker Konfiguration

```yaml
# docker-compose.matrix.yml
synapse:
  image: matrixdotorg/synapse:latest
  volumes:
    - ./synapse-data:/data
  environment:
    - SYNAPSE_SERVER_NAME=matrix.mana.how
    - SYNAPSE_REPORT_STATS=no
  ports:
    - '8448:8448'
    - '8008:8008'

postgres-matrix:
  image: postgres:15
  volumes:
    - ./postgres-matrix-data:/var/lib/postgresql/data
```

### OIDC Integration

```yaml
# homeserver.yaml
oidc_providers:
  - idp_id: manacore
    idp_name: ManaCore SSO
    issuer: 'https://auth.mana.how'
    client_id: 'synapse'
    client_secret: '${MATRIX_OIDC_SECRET}'
    scopes: ['openid', 'profile', 'email']
```

---

## Neue Matrix Bots

### Stats Bot

Statistiken über die ManaCore-Plattform direkt in Matrix.

```
!stats users      - Anzahl registrierter User
!stats apps       - App-Nutzungsstatistiken
!stats daily      - Tägliche Aktivität
!global           - Globale Plattform-Stats
```

**Features:**

- Prometheus-Integration für Live-Metriken
- Grafana-Dashboard-Links
- Historische Datenanalyse

### Project Doc Bot

Dokumentations-Assistent für Entwickler.

```
!doc search <query>   - Docs durchsuchen
!doc api <endpoint>   - API-Dokumentation
!doc setup <app>      - Setup-Anleitung
!doc claude           - CLAUDE.md anzeigen
```

**Features:**

- Durchsucht alle CLAUDE.md Dateien
- API-Dokumentation aus OpenAPI Specs
- Code-Beispiele mit Syntax-Highlighting

### Ollama Bot

Direkter Zugang zu lokalen LLMs via Matrix.

```
!llm <prompt>         - Prompt an Standard-Modell
!llm model <name>     - Modell wechseln
!llm list             - Verfügbare Modelle
!code <prompt>        - Code-optimiertes Modell
```

**Verfügbare Modelle:**

- gemma3:4b, gemma3:12b
- llama3.2:3b, llama3.2:11b
- codellama:13b
- mistral:7b

---

## Chat Model Comparison

Neues Feature: Vergleiche Antworten verschiedener AI-Modelle.

### UI Design

```
┌─────────────────────────────────────────────────────┐
│  Model Comparison Mode                    [Toggle]  │
├─────────────────────────────────────────────────────┤
│  ┌──────────────────┐  ┌──────────────────┐        │
│  │   GPT-4 Turbo    │  │   Claude 3.5     │        │
│  │                  │  │                  │        │
│  │  Response A      │  │  Response B      │        │
│  │                  │  │                  │        │
│  └──────────────────┘  └──────────────────┘        │
│                                                     │
│  ┌──────────────────┐  ┌──────────────────┐        │
│  │   Gemini Pro     │  │   Ollama Local   │        │
│  │                  │  │                  │        │
│  │  Response C      │  │  Response D      │        │
│  │                  │  │                  │        │
│  └──────────────────┘  └──────────────────┘        │
└─────────────────────────────────────────────────────┘
```

### Implementation

```typescript
// apps/chat/apps/web/src/lib/components/ModelComparison.svelte
<script lang="ts">
  let selectedModels = $state<string[]>(['gpt-4-turbo', 'claude-3.5-sonnet']);
  let responses = $state<Record<string, string>>({});

  async function compareModels(prompt: string) {
    const results = await Promise.all(
      selectedModels.map(model =>
        chatService.generate(prompt, { model })
      )
    );
    // ... display results side by side
  }
</script>
```

---

## GuestWelcomeModal

Verbessertes Onboarding für Guest-Nutzer.

### Features

| Feature                | Beschreibung                           |
| ---------------------- | -------------------------------------- |
| **Intro Animation**    | Kurze Vorstellung der App              |
| **Feature Highlights** | Was ist ohne Login möglich             |
| **Upgrade CTA**        | Prominenter "Account erstellen" Button |
| **Skip Option**        | "Als Gast fortfahren"                  |

### Design

```svelte
<!-- packages/shared-auth-ui/src/lib/components/GuestWelcomeModal.svelte -->
<Modal bind:open={showModal}>
	<h2>Willkommen bei {appName}!</h2>

	<p>Du kannst die App auch ohne Account nutzen.</p>

	<ul>
		<li>✅ {guestFeature1}</li>
		<li>✅ {guestFeature2}</li>
		<li>❌ {authOnlyFeature}</li>
	</ul>

	<div class="actions">
		<Button variant="primary" on:click={register}>Account erstellen</Button>
		<Button variant="ghost" on:click={continueAsGuest}>Als Gast fortfahren</Button>
	</div>
</Modal>
```

---

## Telegram Bot Improvements

Local STT Support und Prometheus Metriken.

### Speech-to-Text

```typescript
// Vorher: Nur Cloud STT
// Nachher: Lokale Whisper-Instanz
const sttService = new LocalSTTService({
	model: 'whisper-large-v3',
	device: 'cuda', // GPU-beschleunigt
});
```

### Metriken

```typescript
// Neue Prometheus Metriken
register.registerMetric(
	new Counter({
		name: 'telegram_messages_total',
		help: 'Total Telegram messages processed',
		labelNames: ['type'], // text, voice, image
	})
);

register.registerMetric(
	new Histogram({
		name: 'telegram_stt_duration_seconds',
		help: 'STT processing time',
	})
);
```

---

## Cleanup: Märchenzauber entfernt

Das Märchenzauber-Projekt wurde aus der Codebase entfernt.

### Entfernte Dateien

```
apps-archived/maerchenzauber/    # Komplett entfernt
- 11 Dateien
- 231 Zeilen
```

### Begründung

- Projekt nicht mehr aktiv entwickelt
- Ressourcen auf aktive Apps fokussieren
- Archiv-Ordner wurde zu groß

---

## Developer Experience Verbesserungen

Lokale Entwicklung wurde verbessert.

### Neue Scripts

```json
{
	"dev:matrix": "docker-compose -f docker-compose.matrix.yml up -d",
	"dev:stats-bot": "pnpm --filter @matrix/stats-bot dev",
	"dev:doc-bot": "pnpm --filter @matrix/project-doc-bot dev"
}
```

### Health Check Fixes

| Service       | Fix                      |
| ------------- | ------------------------ |
| presi-backend | Korrekter `/health` Pfad |

---

## Zusammenfassung

| Bereich          | Commits | Highlights             |
| ---------------- | ------- | ---------------------- |
| **Matrix Infra** | 2       | Self-Hosted Synapse    |
| **Matrix Bots**  | 3       | Stats, Doc, Ollama     |
| **Chat**         | 1       | Model Comparison       |
| **Guest UX**     | 1       | Welcome Modal          |
| **Telegram**     | 1       | Local STT + Metrics    |
| **Cleanup**      | 1       | Märchenzauber entfernt |
| **Fixes**        | 2       | Health Checks          |

---

## Nächste Schritte

1. **Element Web** auf eigenem Server deployen
2. **E2EE** für Matrix-Räume aktivieren
3. **Voice Messages** in Matrix Bots
4. **Bot-to-Bot** Kommunikation für komplexe Workflows
