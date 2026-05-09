---
title: 'Encryption Phasen 1–9: Vault-Ende-zu-Ende + Dreams, Period, Events Module'
description: 'Größter Tag der Woche: AES-GCM-256 Encryption für 27 Tabellen in 9 Phasen ausgerollt, inkl. Zero-Knowledge-Modus mit Recovery-Code. Plus drei neue Module: Dreams (Voice→STT), Period (Menstrual-Tracking) und Events (öffentliche RSVP).'
date: 2026-04-07
author: 'Till Schneider'
category: 'feature'
tags:
  [
    'encryption',
    'vault',
    'zero-knowledge',
    'recovery-code',
    'dreams',
    'period',
    'events',
    'rsvp',
    'mana-stt',
    'data-layer-audit',
    'sprint',
  ]
featured: true
commits: 88
readTime: 18
stats:
  filesChanged: 880
  linesAdded: 38302
  linesRemoved: 22129
contributors:
  - name: 'Till Schneider'
    handle: 'Till-JS'
    commits: 88
workingHours:
  start: '2026-04-07T12:26'
  end: '2026-04-07T23:57'
---

> **Legacy-Format.** Dieser Eintrag stammt aus dem Session-basierten Devlog vor der Umstellung auf das Tages-Modell (Cutover 2026-05-09). Bestand bleibt erhalten und unverändert; neue Einträge folgen der Tages-Konvention mit `spieler.md` + `macher.md` pro 06–06-Bucket. Spec: [`mana/docs/DEVLOG.md`](https://github.com/mana-ev/mana/blob/main/docs/DEVLOG.md).

## Highlights

- **At-Rest Encryption** in 9 Phasen ausgerollt: AES-GCM-256 für 27 Tabellen
- **Zero-Knowledge-Modus** mit User-only Recovery-Code (Mana kann nichts lesen)
- **Lock-Screen** mit Recovery-Unlock-Modal
- **Drei neue Module**: Dreams (Traumtagebuch), Period (Zyklus-Tracking), Events (öffentliche RSVP)
- **Data-Layer-Audit Sprints 1–4** abgeschlossen — LWW, retry, atomic cascades, perf, quota, telemetry
- **mana-stt Voice-Pipeline** für Dreams + Memoro live
- **Pre-Launch Cleanup** — Schema-Collapse, Ghost-API-Clients raus, RLS auf sync_changes

---

## Encryption: 9 Phasen in einem Tag

Das große Thema des Tages. Die `DATA_LAYER_AUDIT.md` hatte Encryption als langfristige Roadmap — heute durchgezogen. **Alle 9 Phasen heute committed.**

### Designprinzipien

```
─────────────────────────────────────────────────
  Master Key (MK)            ── 256 bit
   └─ AES-GCM-256 für alle Records
   └─ liegt nirgendwo unverschlüsselt rum
─────────────────────────────────────────────────
  Standard-Modus
   MK wird mit KEK (Key Encryption Key) wrapped
   KEK liegt im mana-auth Service (`MANA_AUTH_KEK` env)
   → Mana kann den MK rekonstruieren
   → User braucht nur Login
─────────────────────────────────────────────────
  Zero-Knowledge-Modus (opt-in)
   MK wird mit user-derivierten Recovery-Code
   verschlüsselt, KEK-wrapped Version wird gelöscht
   → Mana kann den MK NICHT rekonstruieren
   → User braucht Recovery-Code zum Entsperren
─────────────────────────────────────────────────
```

### Phase 1: Foundation (No-Op)

`apps/mana/apps/web/src/lib/data/crypto/` mit allen Primitives angelegt — `encryptRecord`, `decryptRecords`, registry, key-derivation. Alles compiled, nichts wird tatsächlich verschlüsselt. Zero-Risk-Foundation.

### Phase 2: Server-Side Master-Key Custody

`mana-auth` bekommt Vault-Endpoints:

- `POST /api/v1/vault/init` — neuer User: MK generieren, KEK-wrappen, persistieren
- `GET /api/v1/vault/unlock` — Login: KEK-unwrap, MK an Client liefern (https-only, kurzlebige Session)
- `POST /api/v1/vault/rotate-recovery` — Recovery-Code rotieren

Plus Tests gegen echte Postgres (`vault.spec.ts`).

### Phase 3: Vault-Client + Record-Helpers + Layout-Wire-Up

Client-Seite:

- `vaultClient` lädt MK beim Login
- `encryptRecord(table, record)` und `decryptRecords(table, records)` Helpers
- App-Layout wartet auf Vault-Unlock bevor Module geladen werden

### Phase 4: Notes-Pilot

Erstes Modul mit aktiver Encryption: **Notes**. Klein, kontrolliert, low-risk. Funktioniert? → Phase 5.

### Phase 5: Rollout auf 6 Module

chat, dreams, memoro, contacts, period, finance — alles user-typed Content der eindeutig privat ist.

### Phase 6: Polish + UI

- **6.1**: cards, presi, inventar, planta — Karten + Notiz-haltige Module
- **6.2**: Settings-Page mit Vault-Status (verschlüsselt seit, ZK an/aus, …)
- **6.3**: Onboarding-Banner für neue User der Encryption erklärt

### Phase 7: Coupled & Storeless Tables

- **7.1**: Tasks + Calendar Events — beide referenzieren TimeBlocks und müssen synchron verschlüsselt werden
- **7.2**: Storeless Module (questions, links, documents, meals) die keinen eigenen Store haben aber sensitive Felder

### Phase 8: Restliche Tabellen

Storage-Items, Picture-Boards, Music-Metadata, Events, Guests. **Damit sind alle 27 Tabellen verschlüsselt.**

### Phase 9: Zero-Knowledge

Das härteste Stück. Bisher konnte mana-auth den MK immer rekonstruieren. ZK-Modus macht das per Design unmöglich.

#### Milestone 1: Recovery-Code Primitives

- 32-Byte Random-Code, BIP39-encodiert (24 Wörter)
- PBKDF2 mit 600k Iterations als KDF
- Recovery-Wrap des MK

#### Milestone 2: mana-auth Vault-Recovery-Wrap

- Server speichert NUR den recovery-wrapped MK
- KEK-wrapped Version wird gelöscht beim Aktivieren von ZK
- Server kann den MK nicht mehr unwrap'en

#### Milestone 3: Vault-Client Recovery-Flow

- ZK-User wird beim Login gepromtet den Recovery-Code einzugeben
- Lock-Screen-Modal mit 24-Wort-Eingabe
- Unwrap clientseitig, MK in Memory

#### Milestone 4: Settings UI

- Settings → Sicherheit zeigt:
  - Aktueller Modus (Standard / ZK)
  - "Recovery-Code anzeigen" (mit Re-Auth)
  - "Zero-Knowledge aktivieren" (irreversibel-ish — Recovery-Code wird einmal gezeigt)
  - "Recovery-Code rotieren" (auch in ZK-Modus möglich)

#### Lock-Screen

- Wenn die Tab inaktiv war > X Minuten oder die Seite manuell gesperrt wird
- Screen verlangt Recovery-Code (ZK) oder Passwort (Standard)
- Modal blendet alles ab, App ist nicht bedienbar bis unlock

### Vault-Status-Endpoint

`GET /api/v1/vault/status` liefert für die Settings-Page:

```json
{
  "encrypted": true,
  "mode": "standard" | "zero_knowledge",
  "encryptedSince": "2026-04-07T15:23:00Z",
  "recoveryCodeRotatedAt": "2026-04-07T15:23:00Z"
}
```

### Audit-Roll-up

`DATA_LAYER_AUDIT.md` mit allen Phasen 6/7/8/9 dokumentiert. Plus eine separate Roadmap **`FILE_BYTES_ENCRYPTION_PLAN.md`** für die nächste Stufe (verschlüsselte Bild/Audio/PDF-Bytes — bisher sind nur strukturierte Felder verschlüsselt).

---

## Drei neue Module

Während die Encryption durch die Phasen lief, entstanden parallel drei neue Module.

### Dreams (Traumtagebuch)

- **Voice-Capture via mana-stt** — Aufnahme im Browser, Transkript wird automatisch eingefügt
- **Symbol-Library** mit Detail-Views, Bedeutung, Mood-Stats
- **Filter-Tabs** und Symbol-Filter-Pills
- **Date-/Time-Picker** statt Standard-Inputs
- **Auto-Save**, Sort, Merge, Navigation in der Symbol-Library
- **Mic-Permission UX** auf macOS — wenn Browser den Prompt nicht zeigt, gibt's einen erklärenden Screen + Force-Retry
- **Proxy-Toleranz**: octet-stream und invalid form bodies werden vom Voice-Proxy nicht abgewiesen

### Period (Menstruelle Zyklus-Tracking)

- **Period Auto-Detect**: Start/Ende werden aus Symptomen + Bleeding-Levels abgeleitet
- **Symptom Management UI**: konfigurierbare Symptome mit Severity
- **Edit/Delete past entries**
- **Month Calendar View** mit Phase-Coloring (folliculär, ovulatorisch, luteal, menstruell)
- **Dashboard-Widget** mit aktueller Phase + Countdown zum nächsten Event
- **Locale-aware date formatting**
- **Echte i18n** für it/fr/es (es waren leere Strings im Stub)
- **i18n Key-Parity Tests** für alle 5 Locales
- **Integration-Tests** mit fake-indexeddb
- **ROADMAP** mit zukünftigen Features

### Events (Public RSVP Module)

Event-Modul für Ad-hoc Veranstaltungen mit öffentlichem RSVP-Link:

- **`mana-events` Service** (Hono/Bun) — own DB schema, public RSVP routes
- **Phase 1a**: Scaffold lokaler Tabellen + UI
- **Phase 1b**: Public RSVP-Flow mit Cancel-Token
- **Phase 2**: Bring-List ("Wer bringt was?") — Slot-Reservation, Multi-User
- **35 Server-Tests** für routes + sweeper
- **Playwright e2e** mit flake-resistant config
- **i18n** für RSVP-Page in it/fr/es + extracted helper
- **Cascade rate buckets** wenn Event un-published wird
- **Self-heal Snapshots, Tombstones, Polling-Cleanup**
- **Production wiring + Polling resilience** (quick wins)
- **Roadmap** für Phase 2 (tech debt + remaining features)

---

## Data-Layer-Audit: Sprints 1–4

Die `DATA_LAYER_AUDIT.md` Backlog hatte vier Sprints. Heute alle vier abgeschlossen.

### Sprint 1: Data Integrity

- **LWW (Last-Write-Wins)** mit Field-Level Timestamps
- **Retry mit Exponential Backoff**
- **Atomic Cascades** — wenn ein Parent gelöscht wird, werden Children atomisch markiert
- **Three runtime regressions** im Anschluss gefixt

### Sprint 2: Auth-Aware Data Layer + Guest Migration

- Data-Layer kennt jetzt den `userId` zum Stempeln
- Guest → registered Migration übernimmt alle existierenden lokalen Daten (mit User-Stempel)

### Sprint 3: Type-Safe Sync Protocol

- Sync-Protocol bekommt einen Zod-Schema
- Client + Server validieren beim Encode/Decode
- Tests die das Schema gegen mana-sync (Go) validieren
- **3 Pre-existing Test-Files** wieder lauffähig gemacht

### Sprint 4: Perf, Quota, Telemetry

- **`updatedAt` Index** für Recent-X Dashboard-Widgets
- **Quota-Recovery** wenn IndexedDB-Quota voll ist (Auto-Prune oldest)
- **Telemetry-Hooks** für Sync-Events
- **SSE-Pipeline-Read** parallel zu sequential apply (perf win)
- **Local Activity Log** mit periodic prune

### Toast-Subscription

Data-Layer-Events werden jetzt direkt subscribed:

- Sync-Errors → Toast + Sentry
- Quota-Warnings → Toast
- Conflict-Detected → Toast mit "View Conflict"
- Scheduler-Events → Toast (für Reminders)

---

## mana-stt Voice-Pipeline

Dreams + Memoro nutzen jetzt eine geteilte Voice-Pipeline:

```
Browser MediaRecorder
  ↓ POST /api/v1/voice/transcribe
mana-web Proxy
  ↓ X-Service-Key
mana-stt (Windows GPU, WhisperX)
  ↓
Transcript JSON
  ↓
Modul (Dreams: zur Note, Memoro: zum Memo)
```

**STT-Postmortem heute** — `docs/postmortems/2026-04-07-stt-tunnel-down.md` dokumentiert einen 35-Minuten-Ausfall der STT-Pipeline (Cloudflare Tunnel zur Windows-GPU war runtergefallen). Fix: Tunnel-Health-Probe in Status-Page integriert.

**GPU Tunnel Setup** + **STT env wiring** in dem Postmortem dokumentiert.

---

## Pre-Launch Cleanup

Vor dem Production-Launch eine größere Aufräumrunde:

### Schema-Collapse + Dead Code

- **`PRE_LAUNCH_CLEANUP.md`** dokumentiert was raus kam und warum
- **Lazy Search** statt eager loading von search-providern
- **Ghost Backend-API-Clients** entfernt — Module die noch HTTP-Clients hatten obwohl alles über die unified API geht

### Mac-Mini Infra-Cleanup

- `COMPOSE_PROJECT_NAME=manacore-monorepo` pinned
- Compose-Env, blackbox-Memory, Prometheus GPU-Probes optimiert
- Runbook-Hardening: Status-Diff Script, Ingress-Walk Script
- `startup.sh` idempotent + non-destruktiv gemacht

### Sync RLS

- `sync_changes` Tabelle bekommt **row-level security** in PostgreSQL
- User können nur ihre eigenen Changes lesen, auch wenn jemand Postgres-Direct-Access hätte

### `rrule` SSR Bundle

- `/calendar` 500-Error gefixt: rrule wurde in SSR-Build nicht inkludiert
- Vite-Config: rrule explizit als `noExternal`

---

## Sonstige Fixes & Polish

| Fix                                    | Detail                                         |
| -------------------------------------- | ---------------------------------------------- |
| timeblocks recurrence migration        | Type-Errors aus dem Sprint von vorgestern      |
| ManaCore→Mana stale templates          | Type-Errors vom Rename                         |
| `manaSvg` dedupe                       | Rename-Collision in shared-branding            |
| `cards-database` `.js` extensions      | Für NodeNext-Module-Resolution                 |
| vitest unify                           | Workspace-weit auf `^4.1.2`                    |
| `/offline` prerender                   | Disabled — FIXME, prerender-Schritt war kaputt |
| `module-registry` + `module.config.ts` | Build-critical files committed                 |
| MANA_STT_URL/API_KEY Wiring            | mana-web Container env                         |

---

## Dokumentation

- **`DATA_LAYER_AUDIT.md`** — Sprints 1–4 + Encryption-Phasen 1–9 vollständig dokumentiert
- **`PRE_LAUNCH_CLEANUP.md`** — was wurde entfernt vor Launch und warum
- **`FILE_BYTES_ENCRYPTION_PLAN.md`** — nächste Encryption-Stufe für Bytes/Bilder
- **`docs/postmortems/2026-04-07-stt-tunnel-down.md`** — STT-Ausfall Postmortem
- **`docs/period/ROADMAP.md`** — Period Feature-Backlog
- **`docs/events/PHASE2_ROADMAP.md`** — Events Phase 2 + tech debt
- GPU Tunnel Setup, STT env wiring docs

---

## Zusammenfassung

| Bereich               | Commits | Highlights                                                         |
| --------------------- | ------- | ------------------------------------------------------------------ |
| Encryption Phasen 1–9 | ~22     | 27 Tabellen, ZK-Modus, Recovery-Code, Lock-Screen, Settings, Tests |
| Data-Layer Sprints    | ~8      | LWW, retry, cascades, perf, quota, telemetry                       |
| Dreams Modul          | ~9      | Voice via mana-stt, Symbol-Library, Mic-UX                         |
| Period Modul          | ~12     | Phase-Detection, Symptome, Calendar-View, Widget, i18n             |
| Events Modul          | ~12     | RSVP-Flow, Bring-List, 35 Tests, Playwright, Phase 2               |
| mana-stt              | ~3      | Voice-Pipeline, Postmortem, GPU-Tunnel                             |
| Pre-Launch Cleanup    | ~7      | Schema-Collapse, RLS, idempotent startup                           |
| Sonstige Fixes        | ~15     | Type-Errors aus Renames, vitest unify, build fixes                 |

---

## Nächste Schritte

- File-Bytes Encryption (Bilder, Audio, PDFs)
- Login-Flow Polish (passkey UI, structured errors)
- Voice-Quick-Add für Notes + Todo (nicht nur Dreams + Memoro)
- AI-Services konsolidieren auf Windows GPU als Source of Truth
