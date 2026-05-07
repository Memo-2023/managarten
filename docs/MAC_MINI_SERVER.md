# Mac Mini Server Setup

Dokumentation des Mac Mini als Self-Hosted Server für Mana Apps.

## Übersicht

Der Mac Mini dient als Self-Hosted Server fuer alle Mana-Anwendungen. Er ist ueber Cloudflare Tunnel oeffentlich erreichbar und fuehrt automatische Health Checks mit Benachrichtigungen durch.

### Container Runtime: Colima (MIT-Lizenz)

Statt Docker Desktop nutzen wir **Colima** als Container-Runtime. Colima ist Open Source (MIT), Docker-CLI-kompatibel und verbraucht ~10 GB weniger RAM als Docker Desktop.

| | Docker Desktop (vorher) | Colima (jetzt) |
|--|------------------------|----------------|
| VM-Overhead | ~12.5 GB | ~0.3-0.5 GB |
| Lizenz | Proprietaer | MIT (Open Source) |
| docker-compose | Identisch | Identisch |

**Konfiguration:** 8 CPUs, 12 GB RAM, 200 GB Disk, Apple VZ, VirtioFS
**LaunchAgent:** `~/Library/LaunchAgents/com.mana.colima.plist`
**Migration:** `./scripts/mac-mini/migrate-to-colima.sh`
**Rollback:** `./scripts/mac-mini/migrate-to-colima.sh --rollback`

### Architektur

```
Internet
    │
    ▼
Cloudflare Tunnel (cloudflared)
    │
    ▼
┌─────────────────────────────────────────────────────────────┐
│  Mac Mini M4 (mana-server)                                  │
│                                                             │
│  ┌─────────────────┐  ┌─────────────────┐                  │
│  │   PostgreSQL    │  │     Redis       │                  │
│  │   (Docker)      │  │    (Docker)     │                  │
│  └─────────────────┘  └─────────────────┘                  │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  Docker Container (~61 Services)                     │   │
│  │  ├── mana-auth     (Port 3001)                 │   │
│  │  ├── dashboard-web      (Port 5173)                 │   │
│  │  ├── chat-web           (Port 3000)                 │   │
│  │  ├── todo-web           (Port 5188)                 │   │
│  │  ├── calendar-web       (Port 5186)                 │   │
│  │  ├── clock-web          (Port 5187)                 │   │
│  │  ├── mana-sync (Go)     (Port 3050)                 │   │
│  │  ├── mana-llm           (Port 3020)                 │   │
│  │  └── ... (19 web apps, core services, monitoring)   │   │
│  └─────────────────────────────────────────────────────┘   │
│                           │                                 │
│                           │ LAN (192.168.178.11)            │
│                           ▼                                 │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  GPU Server (Windows, RTX 3090, 24 GB VRAM)         │   │
│  │  ├── Ollama             (Port 11434) - gemma3:12b   │   │
│  │  ├── STT (Whisper)      (Port 3020)                 │   │
│  │  ├── TTS                (Port 3022)                 │   │
│  │  ├── Image Gen (FLUX)   (Port 3023)                 │   │
│  │  └── cloudflared        (Windows Service, Tunnel    │   │
│  │                          mana-gpu-server)           │   │
│  │                          → gpu-*.mana.how           │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │  LaunchAgents (Autostart, Mac Mini)                 │   │
│  │  ├── cloudflared            (Tunnel mana-server,    │   │
│  │  │                          → all .mana.how except  │   │
│  │  │                          gpu-*)                  │   │
│  │  ├── docker-startup         (Container beim Boot)   │   │
│  │  └── health-check           (alle 5 Minuten)        │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘
```

> **Two-tunnel setup**: There are two Cloudflare tunnels in this stack.
> The **mana-server** tunnel runs on the Mac Mini (LaunchAgent, locally-managed
> via `~/.cloudflared/config.yml`) and handles every `*.mana.how` route except
> the GPU ones. The **mana-gpu-server** tunnel runs on the Windows GPU box as
> a Windows Service (token-managed via the Cloudflare dashboard, NOT a local
> config.yml) and handles `gpu-stt`, `gpu-llm`, `gpu-tts`, `gpu-img`,
> `gpu-ollama`. See the "GPU Tunnel" section below for adding new hostnames.

### Öffentliche URLs

| Service | URL |
|---------|-----|
| Dashboard | https://mana.how |
| Auth API | https://auth.mana.how |
| Chat | https://chat.mana.how |
| Todo | https://todo.mana.how |
| Calendar | https://calendar.mana.how |
| Clock | https://clock.mana.how |

## SSH-Zugang

### Verbindung

```bash
ssh mana-server
```

SSH-Config (`~/.ssh/config`):

```
# Lokales Netzwerk (direkt)
Host mana-server
    HostName 192.168.178.131
    User mana

# Über Cloudflare Tunnel (von extern)
Host mana-server-remote
    HostName mac-mini.mana.how
    User mana
    ProxyCommand /opt/homebrew/bin/cloudflared access ssh --hostname %h
```

### Projekt-Verzeichnis

```bash
cd ~/projects/mana-monorepo
```

## CI/CD

Ein GitHub Actions Self-Hosted Runner läuft nativ auf dem Mac Mini und deployt automatisch bei Push auf `main`.

- **CD Workflow:** `.github/workflows/cd-macmini.yml`
- **Mirror Workflow:** `.github/workflows/mirror-to-forgejo.yml` (GitHub → Forgejo Sync)
- **Runner:** `mac-mini` (self-hosted, macOS, ARM64, LaunchAgent)
- **Manuelles Deployment:** https://github.com/Memo-2023/mana-monorepo/actions/workflows/cd-macmini.yml

### Forgejo (Mirror-Only)

Forgejo v11 läuft als Push-Mirror von GitHub — kein CI/CD, nur Backup und Sichtbarkeit.

- **URL:** https://git.mana.how (Port 3041)
- **SSH:** Port 2222
- **Sync:** Automatisch bei jedem Push auf `main` via GitHub Actions
- **Kein Runner:** Forgejo Runner hat kein macOS-Binary, Docker-Runner kann nicht auf Host zugreifen

```
lokal → git push → GitHub → CD (nativer Runner) → Docker deploy
                          → Mirror → Forgejo (Backup)
```

## Wichtige Befehle

### Status & Monitoring

```bash
# HTTP-Erreichbarkeit aller mana.how Domains prüfen (liest aus cloudflared-config.yml)
pnpm check:status
# oder direkt:
bash scripts/check-status.sh

# Übersicht aller Services
./scripts/mac-mini/status.sh

# Health Check manuell ausführen
./scripts/mac-mini/health-check.sh

# Docker Container Status
docker ps

# Logs eines Containers
docker logs mana-chat-backend
docker logs -f mana-chat-backend  # Live-Logs
```

**Grafana Uptime-Dashboard:** `grafana.mana.how` → Ordner "Mana" → **"Mana Uptime"**
Zeigt probe_success und probe_duration_seconds aller Dienste via Blackbox Exporter (Port 9115).
Alerts: WebAppDown (2 min), APIDown (1 min), InfraToolDown (3 min), GPUServiceDown (5 min), SlowHTTPResponse (5 min > 5s).

### Public Status Page (status.mana.how)

> **Stand 2026-05-07** — Status-Page-Generator + dedizierter Nginx wurden auf die GPU-Box umgezogen (Phase 2e, siehe [`PLAN_OPTION_C.md`](./PLAN_OPTION_C.md)). Die Container `mana-mon-status-gen` + `mana-mon-status-nginx` leben jetzt in [`infrastructure/docker-compose.gpu-box.yml`](../infrastructure/docker-compose.gpu-box.yml), DNS routet `status.mana.how` auf den `mana-gpu-server`-Tunnel.

| Komponente | Pfad |
|---|---|
| Generator-Script | `scripts/generate-status-page.sh` (vom GPU-Box-Sparse-Repo `/srv/mana/source/` bind-gemountet) |
| Docker-Services | `status-page-gen` + `status-nginx` in `infrastructure/docker-compose.gpu-box.yml` |
| Output | docker-volume `status-output` (geteilt zwischen den beiden Containern) |
| Public-Tunnel | mana-gpu-server, Port `:8090` |

**Datenquellen:**
- **Service-Uptime:** VictoriaMetrics via Blackbox Exporter (`probe_success`, `probe_duration_seconds`) — VM läuft jetzt im selben docker-network auf der GPU-Box, kein Cloudflare-Round-Trip mehr.
- **App Release Tiers:** Automatisch aus `packages/shared-branding/src/mana-apps.ts` geparst.

**Automatische Aktualisierung:** Der GPU-Box-systemd-timer `mana-source-pull.timer` macht stündlich `git pull` auf `/srv/mana/source/`. Änderungen an `requiredTier` in `mana-apps.ts` schlagen nach maximal 1 h Pull-Latenz + 60 s Status-Tick auf der Status-Seite durch.

**`status.json`** wird parallel generiert und enthält Service-Status + Tier-Daten als JSON.

### Service Management

```bash
# Alle Container neustarten
./scripts/mac-mini/restart.sh

# Alle Container stoppen
./scripts/mac-mini/stop.sh

# Einzelnen Container neustarten
docker restart mana-chat-backend

# Neueste Images pullen und Container aktualisieren
./scripts/mac-mini/deploy.sh
```

### Autostart Management

```bash
# LaunchAgents Status prüfen
launchctl list | grep -E "(cloudflare|mana)"

# Health Check manuell triggern
launchctl start com.mana.health-check

# Service neuladen
launchctl unload ~/Library/LaunchAgents/com.mana.docker-startup.plist
launchctl load ~/Library/LaunchAgents/com.mana.docker-startup.plist
```

## GPU Tunnel (mana-gpu-server)

The Windows GPU box is **not** reached via the Mac Mini's tunnel. It runs its
own Cloudflare tunnel as a Windows Service, exposing five public hostnames:

| Hostname | Local target on Windows | Service |
|---|---|---|
| `gpu-stt.mana.how` | `localhost:3020` | mana-stt (Whisper) |
| `gpu-llm.mana.how` | `localhost:3025` | mana-llm |
| `gpu-tts.mana.how` | `localhost:3022` | mana-tts |
| `gpu-img.mana.how` | `localhost:3023` | mana-image-gen (FLUX) |
| `gpu-ollama.mana.how` | `localhost:11434` | Ollama |

The connector itself runs as the Windows Service `Cloudflared`, installed via
`cloudflared.exe service install <TOKEN>`. **Token-managed** means the routing
config (which hostname → which local port) lives in the Cloudflare Zero Trust
dashboard, **not** in any local config file. Editing
`~/.cloudflared/config.yml` on the Windows box has no effect on this tunnel.

### Adding a new GPU hostname

1. **Cloudflare dashboard**: Zero Trust → Networks → Tunnels → `mana-gpu-server`
   → Public Hostname → "Add a public hostname" with `Service Type: HTTP` and
   `URL: localhost:<PORT>`. The dashboard creates both the DNS CNAME and the
   ingress rule in one step.
2. **Verify**: `curl https://<new-host>.mana.how/health` should return 200 within
   a few seconds (no need to restart the connector — it picks up dashboard
   changes automatically).

### If a `gpu-*` hostname returns 502

Most likely the DNS CNAME points at a different tunnel (e.g. `mana-server`
instead of `mana-gpu-server`). To force-repoint from the Mac Mini:

```bash
ssh mana-server "/opt/homebrew/bin/cloudflared tunnel route dns \
    --overwrite-dns 83454e8e-d7f5-4954-b2cb-0307c2dba7a6 <hostname>"
```

(`83454e8e-…` is the `mana-gpu-server` tunnel UUID. Use the UUID, not the
name — the CLI resolves the name against the wrong tunnel context otherwise.)

Other 502 root causes to check, in order of likelihood:

1. **Cloudflared service stopped on Windows**: `ssh mana-gpu "Get-Service Cloudflared"` → must show `Running`. Restart with `Restart-Service Cloudflared`.
2. **Origin service down**: `ssh mana-gpu "Get-ScheduledTask -TaskName ManaSTT"` → must show `Running`. The Python service runs as a Scheduled Task with `RestartCount=5, RestartInterval=PT1M`, so a crash should self-heal within ~1 min.
3. **Public Hostname missing in dashboard**: tunnel has zero ingress rules for the requested hostname.

### API key for STT proxy

The unified mana-web container's `/api/v1/voice/transcribe` proxy needs
`MANA_STT_API_KEY` to authenticate against `gpu-stt.mana.how`. The key:

- Lives in **Mac Mini `~/projects/mana-monorepo/.env`** (gitignored)
- Is referenced from `docker-compose.macmini.yml` as `${MANA_STT_API_KEY:-}`
- The source-of-truth is `services/mana-stt/.env` on the Windows GPU box (`API_KEYS=<key>:<name>`)

To rotate: append a new entry on the Windows side, restart the `ManaSTT`
scheduled task, update both `.env` files (Mac Mini + any local dev), restart
`mana-app-web`. Use a separate key per consumer (`mana-web`, future apps) so
they can be revoked individually.

## Autostart-Konfiguration

Drei LaunchAgents sorgen fuer automatischen Betrieb:

### 1. Cloudflare Tunnel

**Datei:** `~/Library/LaunchAgents/com.cloudflare.cloudflared.plist`

- Startet beim Login
- Haelt den Tunnel zu Cloudflare offen (mana-server tunnel only — the
  GPU tunnel runs on the Windows box as a Windows Service, not here)
- Automatischer Neustart bei Absturz

### 2. Docker Container Startup

**Datei:** `~/Library/LaunchAgents/com.mana.docker-startup.plist`

- Startet beim Login
- Wartet auf Docker Desktop
- Fuehrt `docker compose up -d` aus
- Erstellt fehlende Datenbanken automatisch

### 3. Health Check

**Datei:** `~/Library/LaunchAgents/com.mana.health-check.plist`

- Laeuft alle 5 Minuten
- Prueft alle Services (HTTP + Docker)
- Sendet Benachrichtigungen bei Fehlern

### Deaktivierte / entfernte LaunchAgents

Seit der GPU-Server-Migration laufen keine AI-Services mehr auf dem Mac
Mini. Die zugehörigen LaunchAgents sind deaktiviert und ihre Repo-Vorlagen
wurden entfernt:
- `homebrew.mxcl.ollama.plist` — LLM läuft auf GPU-Server (`gpu-llm.mana.how`)
- `com.mana.image-gen.plist` — entfernt; image-gen läuft als
  Scheduled Task `ManaImageGen` auf GPU-Server (`gpu-img.mana.how`)
- `com.mana.mana-stt.plist` — entfernt; STT als Task `ManaSTT`
- `com.mana.mana-tts.plist` — entfernt; TTS als Task `ManaTTS`
- `com.mana.vllm-voxtral.plist` — entfernt; vLLM-Voxtral nicht mehr verwendet
- `com.mana.telegram-ollama-bot.plist` — Bot deaktiviert

Falls auf einem Mac Mini noch alte plists installiert sind:

```bash
launchctl unload ~/Library/LaunchAgents/com.mana.image-gen.plist 2>/dev/null
launchctl unload ~/Library/LaunchAgents/com.mana.mana-stt.plist 2>/dev/null
launchctl unload ~/Library/LaunchAgents/com.mana.mana-tts.plist 2>/dev/null
launchctl unload ~/Library/LaunchAgents/com.mana.vllm-voxtral.plist 2>/dev/null
rm -f ~/Library/LaunchAgents/com.mana.{image-gen,mana-stt,mana-tts,vllm-voxtral}.plist
```

### Setup neu ausführen

Falls die LaunchAgents neu eingerichtet werden müssen:

```bash
./scripts/mac-mini/setup-autostart.sh
```

## Benachrichtigungen

### Konfiguration

**Datei:** `.env.notifications`

```bash
# Telegram
TELEGRAM_BOT_TOKEN=xxx
TELEGRAM_CHAT_ID=xxx

# Email
EMAIL_TO=your@email.com
EMAIL_FROM=mana@mana.how

# ntfy.sh (optional)
NTFY_TOPIC=your-topic
```

### Telegram Bot

- **Bot:** @alterts_mana_bot
- **Chat ID:** 7117174865
- Sendet Alerts mit:
  - Fehlgeschlagene Services
  - Hostname und Zeitstempel
  - Anleitung zur Fehlersuche

### Email

- Verwendet `msmtp` als SMTP-Client
- Konfiguration in `~/.msmtprc`
- Gmail mit App-Password

### Benachrichtigung testen

```bash
# Test-Nachricht senden
curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
  -d "chat_id=${TELEGRAM_CHAT_ID}" \
  -d "text=Test notification"
```

## Docker Compose

**Datei:** `docker-compose.macmini.yml`

### Container-Namen

| Container | Service |
|-----------|---------|
| mana-postgres | PostgreSQL Datenbank |
| mana-redis | Redis Cache |
| mana-auth | Auth Service |
| mana-dashboard-web | Dashboard |
| mana-chat-backend | Chat API |
| mana-chat-web | Chat Frontend |
| mana-todo-backend | Todo API |
| mana-todo-web | Todo Frontend |
| mana-calendar-backend | Calendar API |
| mana-calendar-web | Calendar Frontend |
| mana-clock-backend | Clock API |
| mana-clock-web | Clock Frontend |

### Nützliche Docker-Befehle

```bash
# Alle Container starten
docker compose -f docker-compose.macmini.yml up -d

# Alle Container stoppen
docker compose -f docker-compose.macmini.yml down

# Container neustarten
docker compose -f docker-compose.macmini.yml restart

# Neueste Images pullen
docker compose -f docker-compose.macmini.yml pull

# Logs aller Container
docker compose -f docker-compose.macmini.yml logs -f

# Einzelnen Service neustarten
docker compose -f docker-compose.macmini.yml restart chat-backend
```

## Cloudflare Tunnel

### Konfiguration

**Datei:** `~/.cloudflared/config.yml`

> ⚠️ **Wichtig:** Dies ist eine separate Datei vom Repo-File `cloudflared-config.yml`.
> Neue Hostnames müssen in **beiden** Dateien eingetragen werden:
> 1. `cloudflared-config.yml` im Repo (für Dokumentation und Git-History)
> 2. `~/.cloudflared/config.yml` auf dem Server (was cloudflared tatsächlich liest)
> 3. DNS-Eintrag anlegen: `cloudflared tunnel route dns <tunnel-id> <hostname>`
> 4. Cloudflared neu starten: `launchctl stop com.cloudflare.cloudflared && launchctl start com.cloudflare.cloudflared`

```yaml
tunnel: mana-tunnel
credentials-file: ~/.cloudflared/credentials.json

ingress:
  - hostname: mana.how
    service: http://localhost:5173
  - hostname: auth.mana.how
    service: http://localhost:3001
  - hostname: chat.mana.how
    service: http://localhost:3000
  # ... weitere Services
  - service: http_status:404
```

### Tunnel Status

```bash
# Prüfen ob cloudflared läuft
pgrep -x cloudflared

# Tunnel-Logs
tail -f ~/.cloudflared/cloudflared.log
```

## Troubleshooting

### Container startet nicht

```bash
# Logs prüfen
docker logs mana-<service-name>

# Container manuell starten
docker start mana-<service-name>

# Bei Problemen: Container neu erstellen
docker compose -f docker-compose.macmini.yml up -d --force-recreate <service-name>
```

### Tunnel nicht erreichbar

```bash
# cloudflared Status
pgrep -x cloudflared

# cloudflared neustarten
launchctl stop com.cloudflare.cloudflared
launchctl start com.cloudflare.cloudflared

# Logs prüfen
tail -100 ~/.cloudflared/cloudflared.log
```

### Datenbank-Probleme

```bash
# PostgreSQL Status
docker exec mana-postgres pg_isready -U postgres

# Datenbanken auflisten
docker exec mana-postgres psql -U postgres -c "\l"

# Datenbank manuell erstellen
docker exec mana-postgres psql -U postgres -c "CREATE DATABASE chat_db;"
```

### Health Check Fehler

```bash
# Health Check manuell ausführen
./scripts/mac-mini/health-check.sh

# Einzelnen Service testen
curl -s http://localhost:3002/api/v1/health
curl -s http://localhost:3000/
```

The health check monitors:
- All backend APIs and web frontends
- Infrastructure (PostgreSQL, Redis)
- Monitoring stack (Grafana, Umami, GlitchTip, VictoriaMetrics)
- Alerting stack (vmalert, Alertmanager, Alert Notifier)
- Disk space for `/` and `/Volumes/ManaData` (warning at 80%, critical at 90%)
- Cloudflare Tunnel (cloudflared process)

### Docker PATH auf dem Server

Bei SSH-Zugriff ist Docker nicht im Standard-PATH. Für Remote-Befehle:

```bash
# Docker liegt unter Docker Desktop
PATH=/Applications/Docker.app/Contents/Resources/bin:$PATH

# Beispiel: Remote docker compose
ssh mana-server "PATH=/Applications/Docker.app/Contents/Resources/bin:\$PATH && docker compose -f ~/projects/mana-monorepo/docker-compose.macmini.yml restart grafana"
```

### Container existiert nicht (wurde nie erstellt)

Wenn ein Service im Health-Check als `HTTP 000` erscheint und `docker ps -a` den Container nicht zeigt, wurde er vermutlich beim letzten Deploy übersprungen:

```bash
# Container erstellen und starten
docker compose -f docker-compose.macmini.yml up -d <service-name>

# Nach Restart prüfen
docker ps --filter name=mana-<service> --format '{{.Names}} {{.Status}}'
```

## Wartung

### Updates einspielen

```bash
# Neuesten Code holen
git pull

# Neue Images pullen und deployen
./scripts/mac-mini/deploy.sh

# Einzelne App bauen und deployen (empfohlen)
./scripts/mac-mini/build-app.sh todo-web
./scripts/mac-mini/build-app.sh todo-web todo-backend

# Base Images neu bauen (nach Änderungen an shared packages)
./scripts/mac-mini/build-app.sh --base
```

### Docker Base Images

Alle Web-Apps werden auf einem vorgebauten Base Image aufgebaut, um Build-Zeit und Memory-Verbrauch zu reduzieren. Backend-Server verwenden `docker/Dockerfile.hono-server` (Hono + Bun) direkt.

| Base Image | Dockerfile | Verwendet von |
|------------|-----------|---------------|
| `sveltekit-base:local` | `docker/Dockerfile.sveltekit-base` | Alle SvelteKit Web-Apps |

Das Base Image enthaelt alle Shared Packages (`packages/`) vorinstalliert und vorgebaut. App-Dockerfiles muessen nur noch ihren app-spezifischen Code kopieren.

**Base Image neu bauen** wenn sich Shared Packages aendern:

```bash
./scripts/mac-mini/build-app.sh --base
```

### Build-Script (`build-app.sh`)

Das Script prüft vor dem Build den verfügbaren RAM und stoppt Monitoring-Container **nur wenn nötig** (< 3 GB frei). Alle Container haben explizite `mem_limit` Obergrenzen in der `docker-compose.macmini.yml`, sodass der tatsächliche Verbrauch typischerweise 50-70% der Limits beträgt und genug Headroom für Builds bleibt.

**Was es tut:**
1. Prüft verfügbaren RAM in der Colima VM
2. Stoppt 13 Monitoring-Container nur wenn < 3 GB frei (vorher: immer)
3. Baut die angegebenen Services
4. Startet Monitoring bei Exit automatisch wieder (auch bei Fehler/Ctrl+C via `trap`)

```bash
# Einzelne App
./scripts/mac-mini/build-app.sh todo-web

# Mehrere Apps
./scripts/mac-mini/build-app.sh todo-web todo-backend

# Alle Web-Apps
./scripts/mac-mini/build-app.sh --all-web

# Monitoring immer stoppen (altes Verhalten)
./scripts/mac-mini/build-app.sh --force-free todo-web
```

### Memory Baseline

Misst den tatsächlichen RAM-Verbrauch aller Container, sortiert nach Kategorie:

```bash
# Einmalige Messung mit Zusammenfassung
./scripts/mac-mini/memory-baseline.sh

# Live-Monitoring (docker stats)
./scripts/mac-mini/memory-baseline.sh --watch
```

### Memory-Limits

> **Stand 2026-05-07** — nach Phase 2c+2d Cleanup (siehe [`PLAN_OPTION_C.md`](./PLAN_OPTION_C.md)) sind 14 Service-Blöcke (Grafana, VictoriaMetrics, Loki, Tempo, Promtail, Pushgateway, Blackbox-Exporter, Vmalert, Alertmanager, Alert-Notifier, Umami, Glitchtip+Worker, Forgejo) auf die GPU-Box gewandert und aus der Mini-Compose entfernt.

Container in `docker-compose.macmini.yml` haben explizite `mem_limit`:

| Kategorie | Container (~) | Budget |
|-----------|-----------|--------|
| Infrastructure (postgres, redis, minio, …) | 6 | ~1.712 MB |
| Core (Hono/Bun + Go) | ~17 | ~2.500 MB |
| Web Apps + Standalone | ~6 | ~700 MB |
| Memoro Stack | 3 | ~900 MB |
| Helper-Exporter (cadvisor, node-exporter, postgres-exporter, redis-exporter) | 4 | ~270 MB |
| Andere (admin, verdaccio, mail, news-ingester, searxng) | 5 | ~970 MB |
| **Total (~45 running)** | **~45** | **~6 GiB nominal** |

Colima VM: 12 GiB → Headroom: ~6 GiB (Limits) / ~10 GiB (real, da reale Last typisch 2–3 GiB liegt). Build-Skript `build-app.sh` muss seit dem Cleanup das Monitoring-Stop-Trigger nicht mehr feuern (war zuvor bei < 3 GiB free aktiv).

**Was auf der GPU-Box läuft**, sieh in [`PLAN_OPTION_C.md`](./PLAN_OPTION_C.md) §"Was läuft heute auf der GPU-Box". Hostnames `grafana.mana.how`, `git.mana.how`, `stats.mana.how`, `glitchtip.mana.how` werden vom **`mana-gpu-server`-Tunnel** (UUID `83454e8e-…`) bedient, nicht vom Mini.

### Backup

Die PostgreSQL-Datenbank sollte regelmäßig gesichert werden:

```bash
# Backup erstellen
docker exec mana-postgres pg_dumpall -U postgres > backup_$(date +%Y%m%d).sql

# Backup wiederherstellen
cat backup_20260123.sql | docker exec -i mana-postgres psql -U postgres
```

### Logs aufräumen

```bash
# Docker Logs beschränken (bereits in compose konfiguriert)
# max-size: 10m, max-file: 3

# Alte Docker Images entfernen
docker image prune -a
```

## Skript-Übersicht

| Skript | Beschreibung |
|--------|--------------|
| `setup-autostart.sh` | Richtet LaunchAgents ein (einmalig) |
| `setup-notifications.sh` | Interaktives Notification-Setup |
| `startup.sh` | Wird von launchd beim Boot aufgerufen |
| `health-check.sh` | Prüft Services, sendet Alerts |
| `status.sh` | Zeigt Übersicht aller Services |
| `restart.sh` | Startet alle Container neu |
| `stop.sh` | Stoppt alle Container |
| `deploy.sh` | Pullt neue Images und startet neu |
| `build-app.sh` | Baut einzelne Apps (smart memory check, stoppt Monitoring nur wenn nötig) |
| `memory-baseline.sh` | Misst RAM-Verbrauch aller Container nach Kategorie |

## Hardware

- **Chip:** Apple M4 (10 Cores)
- **RAM:** 16 GB Unified Memory
- **Interne SSD:** 228 GB
- **Externe SSD:** 4 TB (ManaData)

## AI-Workloads (GPU-Server)

Alle AI-Services (LLM, Bildgenerierung, STT, TTS) laufen auf dem Windows GPU-Server (RTX 3090, 24 GB VRAM) unter `192.168.178.11`. Der Mac Mini ist reiner Hosting-Server fuer Web, API, DB und Sync.

| Service | GPU-Server Port | Zugriff aus Docker | Public URL |
|---------|----------------|-------------------|------------|
| mana-llm | 3025 | `http://192.168.178.11:3025` | `gpu-llm.mana.how` |
| mana-stt (Whisper) | 3020 | `http://192.168.178.11:3020` | `gpu-stt.mana.how` |
| mana-tts | 3022 | `http://192.168.178.11:3022` | `gpu-tts.mana.how` |
| mana-image-gen | 3023 | `http://192.168.178.11:3023` | `gpu-img.mana.how` |
| mana-video-gen | 3026 | `http://192.168.178.11:3026` | `gpu-video.mana.how` |
| Ollama | 11434 | `http://192.168.178.11:11434` | `gpu-ollama.mana.how` |

Repo-Pendants: `services/mana-{llm,stt,tts,image-gen,video-gen}/` — die `service.pyw` Runner werden direkt auf der Windows-Box als Scheduled Tasks ausgeführt.

Alle Werte sind per Env-Var ueberschreibbar (`OLLAMA_URL`, `STT_SERVICE_URL`, `TTS_SERVICE_URL`, `IMAGE_GEN_SERVICE_URL`).

Cloud-Fallback bei GPU-Server-Ausfall: `mana-llm` hat `AUTO_FALLBACK_ENABLED=true` (OpenRouter, Groq, Google).

### Ollama/FLUX.2 Mac-Mini-Reste (deaktiviert)

Ollama und das alte Mac-Mini FLUX.2 (`flux2.c` MPS) waren früher lokal installiert, sind seit 2026-03-28 deaktiviert. Die zugehörigen Repo-Setup-Skripte (`scripts/mac-mini/setup-image-gen.sh`, launchd plists) wurden 2026-04-08 entfernt; die Modelle liegen ggf. noch auf der SSD als Backup:
- `/Volumes/ManaData/ollama/` (~58 GB)
- `/Volumes/ManaData/flux2/` (~15 GB)

Falls du sie auf einem alten Mac Mini noch findest, einfach löschen — sie laufen nicht mehr und werden nirgendwo gebraucht.

## Externe 4TB SSD

Die externe SSD wird für persistente Daten verwendet - sowohl für große Dateien (AI-Modelle) als auch für kritische Datenbanken (PostgreSQL, MinIO).

### Mount-Punkt

- **Volume:** `/Volumes/ManaData`
- **Geschwindigkeit:** ~1 GB/s (USB-C/Thunderbolt)

### Verzeichnisstruktur

```
/Volumes/ManaData/
├── Docker/          # Docker Desktop Daten (~228 GB) ⭐ Kritisch
│   └── com.docker.docker/  # Symlink von ~/Library/Containers/
├── postgres/        # PostgreSQL Datenbank (~200 MB) ⭐ Kritisch
├── minio/           # MinIO Object Storage (Storage App)
├── backups/         # PostgreSQL Backups (täglich 3:00)
├── ollama/          # LLM Modelle (~58 GB)
├── flux2/           # FLUX.2 Bildgenerierung (~15 GB)
└── stt-models/      # Speech-to-Text Modelle (~19 GB)
```

### Docker auf externer SSD

Docker Desktop läuft komplett von der externen SSD um die interne SSD zu entlasten:

**Symlink:**
```
~/Library/Containers/com.docker.docker -> /Volumes/ManaData/Docker/com.docker.docker
```

**Vorteile:**
- Interne SSD hat ~80GB mehr freien Speicher
- Docker kann unbegrenzt wachsen (3.5TB verfügbar)
- Keine Speicherprobleme beim Pullen großer Images

**Wichtig:** Die externe SSD muss IMMER angeschlossen sein, wenn Docker läuft!

### Vorteile der SSD-Speicherung

| Aspekt | Docker VM | Externe SSD |
|--------|-----------|-------------|
| **Bei Docker-Reset** | ❌ Daten weg | ✅ Daten bleiben |
| **Bei macOS-Neuinstall** | ❌ Daten weg | ✅ Daten bleiben |
| **Performance** | Langsamer | ~20-30% schneller |
| **Backup** | Schwieriger | Einfacher |

### Docker-Integration

Die folgenden Services nutzen direkte SSD-Mounts (kein Docker Volume):

| Service | SSD-Pfad | docker-compose.macmini.yml |
|---------|----------|---------------------------|
| PostgreSQL | `/Volumes/ManaData/postgres` | `volumes: - /Volumes/ManaData/postgres:/var/lib/postgresql/data` |
| MinIO | `/Volumes/ManaData/minio` | `volumes: - /Volumes/ManaData/minio:/data` |

### Symlinks (archiviert, fuer Backup-Modelle)

| Original | Symlink | Status |
|----------|---------|--------|
| `~/.ollama` | `/Volumes/ManaData/ollama` | Deaktiviert (GPU-Server) |
| `~/stt-models` | `/Volumes/ManaData/stt-models` | Deaktiviert (GPU-Server) |
| `~/flux2` | `/Volumes/ManaData/flux2` | Deaktiviert (GPU-Server) |

### SSD prüfen

```bash
# Mount-Status
df -h /Volumes/ManaData

# Nutzung
du -sh /Volumes/ManaData/*/

# Speed-Test
dd if=/dev/zero of=/Volumes/ManaData/test bs=1m count=1024 && rm /Volumes/ManaData/test
```

### Automatische Backups

PostgreSQL-Backups laufen täglich um 3:00 Uhr:

```bash
# Backup-Skript
/Users/mana/backup-postgres.sh

# Backup-Verzeichnis
/Volumes/ManaData/backups/postgres/

# Retention: 30 Tage
```

### Docker Desktop Voraussetzung

Docker Desktop benötigt "Full Disk Access" für SSD-Mounts:

```
Systemeinstellungen → Datenschutz & Sicherheit → Voller Festplattenzugriff → Docker.app ✅
```

## Chronologie der Einrichtung

1. **Docker Setup** - PostgreSQL, Redis, App-Container
2. **Cloudflare Tunnel** - Oeffentliche Erreichbarkeit
3. **SSH via Cloudflare Access** - Sicherer Remote-Zugang
4. **LaunchAgents** - Autostart bei Boot
5. **Health Checks** - Automatische Ueberwachung
6. **Telegram Notifications** - Alerts bei Fehlern
7. **Email Notifications** - Redundante Benachrichtigung
8. ~~**Ollama** - Lokale LLM-Inferenz~~ → Migriert auf GPU-Server (2026-03-28)
9. ~~**Telegram Ollama Bot**~~ → Deaktiviert (2026-03-28)
10. **GPU-Server Offload** - Alle AI-Workloads auf RTX 3090 (2026-03-28)
