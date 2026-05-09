---
title: 'GPU-Offload, Colima-Migration & Organic Growth Gate'
description: 'Mac Mini wird reiner Hosting-Server: Alle AI-Workloads auf GPU-Server (RTX 3090) verlagert, Docker Desktop durch Colima (MIT) ersetzt (~10 GB RAM gespart), taegliches Registrierungslimit eingefuehrt. Peak-Kapazitaet steigt von ~30 auf ~200+ gleichzeitige User.'
date: 2026-03-28
author: 'Till Schneider'
category: 'infrastructure'
tags:
  [
    'colima',
    'docker',
    'gpu',
    'ollama',
    'performance',
    'ram',
    'self-hosting',
    'capacity-planning',
    'open-source',
    'infrastructure',
  ]
featured: true
readTime: 8
stats:
  filesChanged: 17
  linesAdded: 792
  linesRemoved: 383
contributors:
  - name: 'Till Schneider'
    handle: 'Till-JS'
---

> **Legacy-Format.** Dieser Eintrag stammt aus dem Session-basierten Devlog vor der Umstellung auf das Tages-Modell (Cutover 2026-05-09). Bestand bleibt erhalten und unverändert; neue Einträge folgen der Tages-Konvention mit `spieler.md` + `macher.md` pro 06–06-Bucket. Spec: [`mana/docs/DEVLOG.md`](https://github.com/mana-ev/mana/blob/main/docs/DEVLOG.md).


## Das Problem: 16 GB reichen nicht

Unser Mac Mini M4 hostet das komplette ManaCore-Oekosystem: 33 Docker-Container, PostgreSQL, Redis, MinIO, Forgejo, Matrix — plus Ollama (LLM), FLUX.2 (Bildgenerierung) und STT/TTS. Das Problem:

```
Docker Desktop VM:     ~12.5 GB
Container (tatsaechlich): ~0.75 GB
macOS:                    ~1.5 GB
───────────────────────────────────
Benötigt:              ~14.75 GB
Verfuegbar:              16 GB
Swap genutzt:             7.4 GB (!)
```

Docker Desktop allein frisst ~12.5 GB fuer seine Virtualisierungs-Schicht — obwohl die Container selbst nur 750 MiB brauchen. Dazu kam Ollama, das bei einem Chat-Request spontan 3-16 GB RAM beanspruchte. Das System war permanent am Swappen.

## Loesung 1: AI-Workloads auf den GPU-Server

Wir haben einen Windows-PC mit einer NVIDIA RTX 3090 (24 GB VRAM) im selben Netzwerk. Die Idee: Mac Mini macht nur noch Hosting, der GPU-Server uebernimmt alle AI-Aufgaben.

### Was wir geaendert haben

7 Endpoints in `docker-compose.macmini.yml` von `host.docker.internal` (lokal) auf `192.168.178.11` (GPU-Server via LAN) umgestellt:

| Service | Was | Vorher | Nachher |
|---------|-----|--------|---------|
| mana-llm | Ollama | Mac Mini (M4, 53 t/s) | RTX 3090 (~100 t/s) |
| picture-backend | Bildgenerierung | FLUX.2 lokal | GPU-Server |
| api-gateway | STT/TTS | Lokal | GPU-Server |
| mana-matrix-bot | Ollama + Voice | Lokal | GPU-Server |

Alle Werte sind als `${ENV_VAR:-default}` konfiguriert — ein Env-Var-Wechsel genuegt zum Zurueckschalten.

### Ergebnis

- Default-Modell von `gemma3:4b` auf `gemma3:12b` hochgestuft (GPU hat genug VRAM)
- Parallele LLM-Requests von 1 auf 5 erhoeht
- ~1.1 GB RAM auf dem Mac Mini freigemacht (Ollama + FLUX.2 idle)
- Kein Risiko mehr, dass ein Chat-Request den Server zum Swappen bringt

### Cloud-Fallback

`mana-llm` hat `AUTO_FALLBACK_ENABLED=true` — falls der GPU-Server offline ist, fallen Requests automatisch auf OpenRouter, Groq oder Google zurueck.

## Loesung 2: Docker Desktop → Colima

Der groesste Hebel war aber nicht Ollama, sondern Docker Desktop selbst. Die Zahlen:

| | Docker Desktop | Colima |
|--|---------------|--------|
| VM-Overhead | ~12.5 GB | ~0.3-0.5 GB |
| Startup | 15-30 Sekunden | 1-2 Sekunden |
| Disk I/O | VirtioFS (gut) | VirtioFS (gleich) |
| Lizenz | Proprietaer | **MIT (Open Source)** |
| Preis (Business) | $11/Monat pro User | Kostenlos |

### Was ist Colima?

[Colima](https://github.com/abrahamu/colima) ist ein Open-Source Container-Runtime fuer macOS. Es nutzt [Lima](https://github.com/lima-vm/lima) als VM-Manager und Apple's Virtualization.framework — dieselbe Technologie die auch Docker Desktop unter der Haube verwendet, aber ohne den ganzen Ballast der Docker Desktop GUI, dem Kubernetes-Cluster, und dem Electron-basierten Dashboard.

Entscheidend: **Colima ist ein Drop-in-Replacement.** Selbes `docker`-CLI, selbe `docker-compose`-Dateien, selbe Images. Null Code-Aenderungen.

### Warum nicht OrbStack?

OrbStack waere technisch die performanteste Alternative (~200 MiB Overhead, eigener optimierter Disk-Treiber). Aber:

1. **Closed Source** — wir koennen ManaCore nicht als Self-Hosted-Produkt verkaufen, wenn es eine proprietaere Runtime voraussetzt
2. **Lizenzkosten** fuer Business Use ($8/Monat pro User)
3. **Vendor Lock-in** — wenn OrbStack morgen die Preise erhoeht oder eingestellt wird, sind wir abhaengig

Colima unter MIT-Lizenz bedeutet: Jeder kann ManaCore installieren, ohne eine proprietaere Docker-Runtime kaufen zu muessen. Das passt zu unserer Self-Hosted-Philosophie.

### Geschaetzte RAM-Ersparnis

```
Vorher (Docker Desktop):
  VM + Backend + Helpers:  ~13.4 GB
  Container:                ~0.75 GB
  macOS:                    ~1.5 GB
  Swap:                     7.4 GB (!)
  Frei:                     ~0.4 GB

Nachher (Colima):
  Colima VM:                ~0.4 GB
  Container:                ~0.75 GB
  macOS:                    ~1.5 GB
  Swap:                     ~0 GB
  Frei:                    ~13.3 GB
```

**~10 GB weniger RAM-Verbrauch.** Das System geht von "permanentem Memory Pressure mit 7 GB Swap" zu "13 GB frei, null Swap".

### Migrations-Script

Wir haben ein vollstaendiges Migrations-Script geschrieben (`scripts/mac-mini/migrate-to-colima.sh`) das:

1. Alle Named Volumes sichert (tar.gz auf externe SSD)
2. PostgreSQL Dump erstellt (Sicherheitsnetz)
3. Docker Desktop stoppt
4. Colima installiert und konfiguriert
5. Volumes wiederherstellt
6. Container startet und verifiziert
7. LaunchAgent fuer Autostart erstellt

Rollback: `./scripts/mac-mini/migrate-to-colima.sh --rollback`

## Loesung 3: Organic Growth Gate

Mit begrenzter Hardware wollen wir nicht ueberrascht werden. Deshalb haben wir ein taegliches Registrierungslimit in `mana-auth` eingefuehrt:

- `MAX_DAILY_SIGNUPS=5` — pro Tag koennen sich maximal 5 neue User registrieren
- `GET /api/v1/auth/signup-status` — oeffentlicher Endpoint fuer die Signup-Page
- Transparenz: "Heute noch 3 von 5 Plaetzen frei"
- 429 Response wenn Limit erreicht, mit `resetsAt` Timestamp

Das Limit waechst mit der Hardware:

| Phase | Limit | Hardware |
|-------|-------|----------|
| Start | 5/Tag | Mac Mini 16 GB |
| Phase 2 | 15/Tag | Mac Mini 32 GB oder zweiter Server |
| Phase 3 | 50/Tag | Multi-Server Setup |

## Kapazitaet nach Optimierung

| Szenario | Vorher | Nachher |
|----------|--------|---------|
| Local-First Apps (Todo, Calendar, etc.) | ~200 User | ~200 User |
| Mixed (Local-First + API) | ~50-100 User | ~100-150 User |
| Mit aktiver LLM-Nutzung | ~20-30 User | ~80-120 User |
| **Peak (alles gleichzeitig)** | **~20-30 User** | **~200+ User** |

Der Faktor ist **~7x** mehr gleichzeitige User auf derselben Hardware.

## Load Testing

Um das zu verifizieren, haben wir eine k6-basierte Load-Test-Suite erstellt:

- `web-apps.js` — Alle 17 SvelteKit-Frontends, Ramp-up bis 50 VUs
- `auth-api.js` — Login, Register, Token Validation (testet auch Signup-Limit)
- `sync-websocket.js` — WebSocket-Connections zu mana-sync (bis 30 parallel)
- `llm-ollama.js` — Ollama-Inferenz auf GPU-Server (max 3 VUs)

```bash
brew install k6
k6 run load-tests/web-apps.js
```

## Lizenz-Ueberblick (Self-Hosted Stack)

Da wir ManaCore als Self-Hosted-Produkt verkaufen wollen, ist jede Komponente bewusst gewaehlt:

| Komponente | Lizenz | Kommerziell OK |
|-----------|--------|----------------|
| **Colima** | MIT | Ja, uneingeschraenkt |
| PostgreSQL | PostgreSQL (MIT-aehnlich) | Ja |
| Redis | BSD-3 | Ja |
| MinIO | AGPL-3.0 | Ja (als Service, ohne Modifikation) |
| Forgejo | MIT | Ja |
| Hono/Bun/SvelteKit | MIT | Ja |
| Better Auth | MIT | Ja |
| ~~Docker Desktop~~ | ~~Proprietaer~~ | ~~Problematisch~~ |

Keine einzige Komponente im Stack erfordert eine proprietaere Lizenz.

## Zusammenfassung

| Aenderung | Auswirkung |
|-----------|------------|
| AI → GPU-Server | +3-16 GB RAM frei, 3x schnellere Inferenz |
| Docker Desktop → Colima | ~10 GB RAM gespart, MIT-Lizenz |
| Registrierungslimit | Hardware waechst mit Community |
| Load Tests | Kapazitaet messbar und verifizierbar |

Drei Commits, null Euro Zusatzkosten, ~7x mehr Kapazitaet auf derselben Hardware.
