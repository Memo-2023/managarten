# Empfohlene Services für den Mac Mini Server

Diese Dokumentation beschreibt Services, die die bestehende Infrastruktur sinnvoll ergänzen würden. Für jeden Service wird erklärt: Was ist es? Warum braucht man es? Wie würde es integriert?

## Inhaltsverzeichnis

1. [Aktuelle Infrastruktur](#aktuelle-infrastruktur)
2. [Kritische Ergänzungen](#kritische-ergänzungen)
   - [Backup-Lösung (restic/borgmatic)](#1-backup-lösung-resticborgmatic)
   - [Zentrales Logging (Loki + Promtail)](#2-zentrales-logging-loki--promtail)
3. [Wichtige Ergänzungen](#wichtige-ergänzungen)
   - [Uptime Monitoring (Uptime Kuma)](#3-uptime-monitoring-uptime-kuma)
   - [Reverse Proxy (Traefik/Caddy)](#4-reverse-proxy-traefikcaddy)
4. [Empfohlene Ergänzungen](#empfohlene-ergänzungen)
   - [Secrets Management (Vault/Infisical)](#5-secrets-management-vaultinfisical)
   - [API Gateway (Kong)](#6-api-gateway-kong)
5. [Optionale Ergänzungen](#optionale-ergänzungen)
   - [CI/CD Runner](#7-cicd-runner)
   - [Container Registry](#8-container-registry)
   - [Speech-to-Text (Whisper)](#9-speech-to-text-whisper)
6. [Noch nicht deployed (bereits entwickelt)](#noch-nicht-deployed-bereits-entwickelt)
7. [Priorisierte Roadmap](#priorisierte-roadmap)

---

## Aktuelle Infrastruktur

### Was bereits läuft

```
┌─────────────────────────────────────────────────────────────────────────┐
│  INFRASTRUKTUR                                                          │
│  ├── PostgreSQL      Relationale Datenbank für alle Apps                │
│  ├── Redis           Cache & Session-Store                              │
│  ├── MinIO           S3-kompatibler Object Storage                      │
│  └── Cloudflare      Tunnel für öffentliche Erreichbarkeit              │
├─────────────────────────────────────────────────────────────────────────┤
│  AUTH & CORE                                                            │
│  ├── mana-auth  Zentraler Auth-Service (Better Auth + EdDSA JWT)   │
│  └── mana-web    Dashboard für alle Apps                            │
├─────────────────────────────────────────────────────────────────────────┤
│  PRODUKTIVITÄTS-APPS (je Backend + Web)                                 │
│  ├── Chat            AI-Chat mit verschiedenen Modellen                 │
│  ├── Todo            Aufgabenverwaltung                                 │
│  ├── Calendar        Kalender & Termine                                 │
│  ├── Clock           Zeiterfassung                                      │
│  ├── Contacts        Kontaktverwaltung                                  │
│  ├── Storage         Cloud-Speicher                                     │
│  ├── Presi           Präsentationen                                     │
│  └── Food        Ernährungstracking                                 │
├─────────────────────────────────────────────────────────────────────────┤
│  MONITORING                                                             │
│  ├── VictoriaMetrics Zeitreihen-Datenbank für Metriken                  │
│  ├── Grafana         Dashboards & Visualisierung                        │
│  ├── Pushgateway     Metriken von Batch-Jobs                            │
│  ├── Node Exporter   Host-Metriken (CPU, RAM, Disk)                     │
│  ├── cAdvisor        Container-Metriken                                 │
│  ├── Postgres Exp.   PostgreSQL-Metriken                                │
│  └── Redis Exporter  Redis-Metriken                                     │
├─────────────────────────────────────────────────────────────────────────┤
│  AUTOMATION & ANALYTICS                                                 │
│  ├── n8n             Workflow-Automation (wie Zapier)                   │
│  ├── Watchtower      Automatische Container-Updates                     │
│  └── Umami           Privacy-freundliche Web-Analytics                  │
├─────────────────────────────────────────────────────────────────────────┤
│  MATRIX (DSGVO-KONFORM)                                                 │
│  ├── Synapse         Matrix Homeserver                                  │
│  ├── Element Web     Web-Client für Matrix                              │
│  └── 8 Bots          Ollama, Stats, Doc, Calendar, Todo, etc.           │
├─────────────────────────────────────────────────────────────────────────┤
│  KI-SERVICES                                                            │
│  ├── Ollama          Lokale LLM-Inferenz (nativ, Metal GPU)             │
│  ├── Telegram Bot    Ollama-Chat via Telegram                           │
│  └── Telegram Stats  Server-Status via Telegram                         │
└─────────────────────────────────────────────────────────────────────────┘
```

### Was fehlt

| Bereich | Lücke | Risiko |
|---------|-------|--------|
| **Backup** | Kein automatisches Backup | Datenverlust bei Hardware-Ausfall |
| **Logging** | Logs nur in einzelnen Containern | Schwierige Fehlersuche |
| **Externe Überwachung** | Nur interne Health-Checks | Kein Alarm wenn Server offline |
| **Secrets** | .env Dateien auf Disk | Sicherheitsrisiko |

---

## Kritische Ergänzungen

### 1. Backup-Lösung (restic/borgmatic)

#### Was ist das?

**Backup-Tools** erstellen automatische Sicherungskopien deiner Daten und speichern sie an einem sicheren Ort (lokal oder remote). Bei einem Ausfall können alle Daten wiederhergestellt werden.

- **restic**: Modernes Backup-Tool mit Deduplizierung und Verschlüsselung
- **borgmatic**: Wrapper um Borg Backup mit einfacher YAML-Konfiguration

#### Warum braucht man das?

```
OHNE BACKUP:
┌──────────────┐     Hardware-Defekt     ┌──────────────┐
│  PostgreSQL  │  ────────────────────>  │  ALLE DATEN  │
│  MinIO       │                         │   VERLOREN   │
│  Volumes     │                         │      💀      │
└──────────────┘                         └──────────────┘

MIT BACKUP:
┌──────────────┐     Hardware-Defekt     ┌──────────────┐
│  PostgreSQL  │  ────────────────────>  │  Neuer Mac   │
│  MinIO       │                         │  Mini kaufen │
│  Volumes     │                         └──────┬───────┘
└──────────────┘                                │
       │                                        │
       │ Täglich 3:00 Uhr                       │ Restore
       ▼                                        ▼
┌──────────────┐                         ┌──────────────┐
│   Hetzner    │  ────────────────────>  │  Alles wie   │
│ Storage Box  │                         │    vorher    │
│   (20€/TB)   │                         │      ✓       │
└──────────────┘                         └──────────────┘
```

**Konkrete Szenarien:**
- SSD-Ausfall → Alle Datenbanken weg
- Versehentliches `DROP TABLE` → Daten unwiederbringlich
- Ransomware → Verschlüsselte Daten
- macOS-Update schlägt fehl → System nicht bootbar

#### Wie würde es integriert?

**Docker-Compose Ergänzung:**

```yaml
services:
  backup:
    image: mazzolino/restic:latest
    container_name: mana-backup
    hostname: macmini-backup
    environment:
      # Backup-Ziel (Hetzner Storage Box)
      RESTIC_REPOSITORY: sftp:u123456@u123456.your-storagebox.de:/backups
      RESTIC_PASSWORD: ${BACKUP_PASSWORD}

      # Backup-Zeitplan
      BACKUP_CRON: "0 3 * * *"  # Täglich 3:00 Uhr

      # Aufbewahrung
      RESTIC_KEEP_DAILY: 7
      RESTIC_KEEP_WEEKLY: 4
      RESTIC_KEEP_MONTHLY: 12
    volumes:
      # PostgreSQL Daten
      - postgres_data:/data/postgres:ro
      # MinIO Daten
      - minio_data:/data/minio:ro
      # App-Volumes
      - synapse_data:/data/synapse:ro
      # SSH-Key für Hetzner
      - ./backup/ssh:/root/.ssh:ro
    depends_on:
      - postgres
      - minio
```

**Pre-Backup Script für PostgreSQL:**

```bash
#!/bin/bash
# Vor dem Backup: Konsistenten DB-Dump erstellen
docker exec mana-postgres pg_dumpall -U postgres > /backup/postgres_dump.sql
```

**Kosten:**
- Hetzner Storage Box: ~3,50€/Monat für 100 GB
- Hetzner Object Storage: ~2,50€/Monat für 100 GB

---

### 2. Zentrales Logging (Loki + Promtail)

#### Was ist das?

**Loki** ist ein Log-Aggregationssystem (wie Elasticsearch, aber leichtgewichtiger). **Promtail** sammelt Logs von allen Containern und sendet sie an Loki. Die Logs können dann in **Grafana** durchsucht und analysiert werden.

```
┌─────────────┐  ┌─────────────┐  ┌─────────────┐
│ chat-backend│  │ todo-backend│  │ auth-service│
│    Logs     │  │    Logs     │  │    Logs     │
└──────┬──────┘  └──────┬──────┘  └──────┬──────┘
       │                │                │
       └────────────────┼────────────────┘
                        │
                        ▼
                ┌───────────────┐
                │   Promtail    │  Sammelt alle Logs
                │   (Agent)     │
                └───────┬───────┘
                        │
                        ▼
                ┌───────────────┐
                │     Loki      │  Speichert & Indexiert
                │   (Server)    │
                └───────┬───────┘
                        │
                        ▼
                ┌───────────────┐
                │    Grafana    │  Suche & Dashboards
                │  (bereits da) │
                └───────────────┘
```

#### Warum braucht man das?

**Aktuelles Problem:**

```bash
# Fehler in der App? Du musst jeden Container einzeln durchsuchen:
docker logs mana-chat-backend | grep error
docker logs mana-todo-backend | grep error
docker logs mana-auth | grep error
docker logs mana-calendar-backend | grep error
# ... 15+ weitere Container
```

**Mit Loki:**

```
Grafana Query: {job="docker"} |= "error" | json | level="error"
→ Alle Fehler aller Container in einer Ansicht
→ Filterbar nach App, Zeit, User, Request-ID
→ Korrelation zwischen Services möglich
```

**Konkrete Vorteile:**

| Situation | Ohne Loki | Mit Loki |
|-----------|-----------|----------|
| User meldet Fehler | 20 Min. Suche in 15 Containern | 30 Sek. Query nach Request-ID |
| Performance-Problem | Unklar welcher Service | Timeline aller Requests |
| Security-Incident | Logs evtl. schon rotiert | 30 Tage Retention |
| Debugging nachts | Logs am nächsten Tag weg | Alles gespeichert |

#### Wie würde es integriert?

**Docker-Compose Ergänzung:**

```yaml
services:
  loki:
    image: grafana/loki:3.0.0
    container_name: mana-loki
    ports:
      - "3100:3100"
    volumes:
      - ./loki/config.yaml:/etc/loki/config.yaml
      - loki_data:/loki
    command: -config.file=/etc/loki/config.yaml
    restart: unless-stopped

  promtail:
    image: grafana/promtail:3.0.0
    container_name: mana-promtail
    volumes:
      - ./promtail/config.yaml:/etc/promtail/config.yaml
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - /var/lib/docker/containers:/var/lib/docker/containers:ro
    command: -config.file=/etc/promtail/config.yaml
    restart: unless-stopped
```

**Loki Config (loki/config.yaml):**

```yaml
auth_enabled: false

server:
  http_listen_port: 3100

common:
  ring:
    instance_addr: 127.0.0.1
    kvstore:
      store: inmemory
  replication_factor: 1
  path_prefix: /loki

schema_config:
  configs:
    - from: 2024-01-01
      store: tsdb
      object_store: filesystem
      schema: v13
      index:
        prefix: index_
        period: 24h

storage_config:
  filesystem:
    directory: /loki/chunks

limits_config:
  retention_period: 744h  # 31 Tage
```

**Promtail Config (promtail/config.yaml):**

```yaml
server:
  http_listen_port: 9080

positions:
  filename: /tmp/positions.yaml

clients:
  - url: http://loki:3100/loki/api/v1/push

scrape_configs:
  - job_name: docker
    docker_sd_configs:
      - host: unix:///var/run/docker.sock
        refresh_interval: 5s
    relabel_configs:
      - source_labels: ['__meta_docker_container_name']
        regex: '/(.*)'
        target_label: 'container'
      - source_labels: ['__meta_docker_container_label_com_docker_compose_service']
        target_label: 'service'
```

**Ressourcen:**
- RAM: ~200-500 MB für Loki
- Disk: ~1-5 GB für 30 Tage Logs
- CPU: Minimal

---

## Wichtige Ergänzungen

### 3. Uptime Monitoring (Uptime Kuma)

#### Was ist das?

**Uptime Kuma** ist ein Self-Hosted Monitoring-Tool, das regelmäßig deine Services von außen prüft und bei Ausfällen alarmiert. Es bietet auch eine öffentliche Status-Seite.

```
┌─────────────────────────────────────────────────────────────────┐
│                      UPTIME KUMA                                │
│                                                                 │
│  Checks alle 60 Sekunden:                                       │
│                                                                 │
│  ✓ https://mana.how             200 OK      Latenz: 142ms      │
│  ✓ https://chat.mana.how        200 OK      Latenz: 89ms       │
│  ✓ https://auth.mana.how/health 200 OK      Latenz: 45ms       │
│  ✗ https://calendar.mana.how    503 Error   ← ALARM!           │
│  ✓ https://matrix.mana.how      200 OK      Latenz: 234ms      │
│                                                                 │
│  Uptime (30 Tage):                                              │
│  ████████████████████████████░░ 99.7%                          │
└─────────────────────────────────────────────────────────────────┘
                          │
                          ▼
            ┌─────────────────────────┐
            │  Benachrichtigungen:    │
            │  • Telegram             │
            │  • Matrix               │
            │  • Email                │
            │  • Webhook              │
            └─────────────────────────┘
```

#### Warum braucht man das?

**Unterschied zu internen Health-Checks:**

| Aspekt | Interner Health-Check | Uptime Kuma |
|--------|----------------------|-------------|
| **Perspektive** | Vom Server selbst | Von außen (wie User) |
| **Erkennt** | Container-Crash | DNS, Cloudflare, SSL, Container |
| **Server offline** | Keine Benachrichtigung! | Sofort Alarm |
| **Tunnel-Problem** | Nicht erkennbar | Erkennbar |
| **SSL-Ablauf** | Nicht geprüft | Warnung vor Ablauf |

**Beispiel:** Der Mac Mini läuft, aber Cloudflare Tunnel ist down:
- Interner Health-Check: "Alles OK" ✓
- Uptime Kuma (extern): "Alle Services down!" → Alarm

#### Wie würde es integriert?

**Option A: Auf einem externen VPS (empfohlen)**

```bash
# Auf einem 3€/Monat VPS (Hetzner/Netcup)
docker run -d \
  --name uptime-kuma \
  -p 3001:3001 \
  -v uptime-kuma:/app/data \
  louislam/uptime-kuma:1
```

**Option B: Auf dem Mac Mini selbst (eingeschränkt)**

```yaml
# docker-compose.macmini.yml
services:
  uptime-kuma:
    image: louislam/uptime-kuma:1
    container_name: mana-uptime-kuma
    ports:
      - "3099:3001"
    volumes:
      - uptime_kuma_data:/app/data
    restart: unless-stopped
```

**Einrichtung:**

1. Web-Interface öffnen: `https://status.mana.how`
2. Monitors hinzufügen:
   - Type: HTTP(s)
   - URL: `https://chat.mana.how`
   - Interval: 60 Sekunden
   - Retry: 3
3. Benachrichtigungen konfigurieren (Telegram, Matrix)
4. Status-Page erstellen und öffentlich machen

**Ressourcen:**
- RAM: ~100-200 MB
- Disk: ~50 MB
- CPU: Minimal

---

### 4. Reverse Proxy (Traefik/Caddy)

#### Was ist das?

Ein **Reverse Proxy** ist ein Vermittler zwischen eingehenden Anfragen und deinen Backend-Services. Er bietet:
- Automatische SSL-Zertifikate
- Load Balancing
- Request-Routing
- Middleware (Auth, Rate-Limiting, Headers)

```
OHNE REVERSE PROXY:
┌──────────┐
│ Internet │──┬──> :3000 chat-web
│          │  ├──> :3001 auth
│          │  ├──> :3002 chat-backend
│          │  ├──> :5173 dashboard
│          │  └──> :8008 synapse
└──────────┘  (Cloudflare muss jeden Port einzeln routen)

MIT REVERSE PROXY:
┌──────────┐      ┌─────────────────┐      ┌──────────────┐
│ Internet │─────>│    Traefik      │─────>│  Container   │
│          │ :443 │                 │      │              │
│          │      │ chat.mana.how   │──────│ chat-web     │
│          │      │ auth.mana.how   │──────│ auth         │
│          │      │ api.chat.mana.* │──────│ chat-backend │
└──────────┘      └─────────────────┘      └──────────────┘
                         │
                         ├── SSL Termination
                         ├── Rate Limiting
                         ├── Request Logging
                         └── Health Checks
```

#### Warum braucht man das?

**Aktuell:**
- Cloudflare Tunnel macht das Routing
- Funktioniert, aber:
  - Keine lokalen SSL-Zertifikate zwischen Containern
  - Keine einheitliche Request-Logs
  - Kein Rate-Limiting
  - Cloudflare-Konfiguration nötig für jeden neuen Service

**Mit Traefik:**
- Service hinzufügen → automatisch erreichbar
- Einheitliche Logs aller Requests
- Rate-Limiting gegen Missbrauch
- Dashboard mit Traffic-Übersicht

#### Wie würde es integriert?

**Docker-Compose Ergänzung:**

```yaml
services:
  traefik:
    image: traefik:v3.0
    container_name: mana-traefik
    command:
      - "--api.dashboard=true"
      - "--providers.docker=true"
      - "--providers.docker.exposedbydefault=false"
      - "--entrypoints.web.address=:80"
      - "--entrypoints.websecure.address=:443"
      - "--accesslog=true"
      - "--accesslog.filepath=/logs/access.log"
    ports:
      - "80:80"
      - "443:443"
      - "8080:8080"  # Dashboard
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock:ro
      - traefik_logs:/logs
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.dashboard.rule=Host(`traefik.mana.how`)"
      - "traefik.http.routers.dashboard.service=api@internal"

  chat-web:
    labels:
      - "traefik.enable=true"
      - "traefik.http.routers.chat.rule=Host(`chat.mana.how`)"
      - "traefik.http.services.chat.loadbalancer.server.port=3000"
      # Rate Limiting
      - "traefik.http.middlewares.chat-ratelimit.ratelimit.average=100"
      - "traefik.http.middlewares.chat-ratelimit.ratelimit.burst=50"
      - "traefik.http.routers.chat.middlewares=chat-ratelimit"
```

**Alternative: Caddy**

Caddy ist einfacher zu konfigurieren und hat automatisches HTTPS:

```
# Caddyfile
chat.mana.how {
    reverse_proxy chat-web:3000
}

auth.mana.how {
    reverse_proxy mana-auth:3001
}

api.chat.mana.how {
    reverse_proxy chat-backend:3002

    @api path /api/*
    rate_limit @api 100r/m
}
```

**Ressourcen:**
- RAM: ~50-100 MB
- CPU: Minimal
- Disk: Logs

---

## Empfohlene Ergänzungen

### 5. Secrets Management (Vault/Infisical)

#### Was ist das?

**Secrets Management** ist ein System zur sicheren Speicherung und Verteilung von sensiblen Daten wie:
- Datenbank-Passwörter
- API-Keys
- JWT-Secrets
- Verschlüsselungsschlüssel

```
OHNE SECRETS MANAGEMENT:
┌─────────────────────────────────────┐
│  .env Datei auf Disk                │
│                                     │
│  DATABASE_PASSWORD=supersecret123   │  ← Im Klartext!
│  JWT_SECRET=myverysecretkey         │  ← Wer lesen kann, sieht alles
│  OPENAI_API_KEY=sk-abc123...        │  ← Git-History?
└─────────────────────────────────────┘

MIT VAULT:
┌─────────────────────────────────────┐
│  Vault (verschlüsselt)              │
│                                     │
│  ┌─────────────────────────────┐    │
│  │ ████████████████████████    │    │  ← Verschlüsselt
│  │ ████████████████████████    │    │  ← Zugriff nur mit Token
│  │ ████████████████████████    │    │  ← Audit-Log wer was las
│  └─────────────────────────────┘    │
└─────────────────────────────────────┘
         │
         ▼ App startet und fragt Vault
┌─────────────────────────────────────┐
│  Container bekommt Secrets          │
│  nur in den Speicher                │
│  (nie auf Disk)                     │
└─────────────────────────────────────┘
```

#### Warum braucht man das?

| Aspekt | .env Dateien | Vault/Infisical |
|--------|--------------|-----------------|
| **Speicherung** | Klartext auf Disk | Verschlüsselt |
| **Zugriffskontrolle** | Filesystem-Rechte | Policies & Tokens |
| **Audit** | Keins | Wer hat wann was gelesen |
| **Rotation** | Manuell | Automatisch möglich |
| **Git-Sicherheit** | .gitignore kann vergessen werden | Secrets nie in Git |
| **Backup** | Klartext im Backup | Verschlüsselt |

**Szenarien:**

1. **Laptop gestohlen** mit Git-Repo → .env lesbar
2. **Mitarbeiter verlässt Team** → Alle Secrets rotieren?
3. **Security-Audit** → Wer hatte Zugriff auf welche Secrets?
4. **Compliance** → DSGVO verlangt Schutz sensibler Daten

#### Wie würde es integriert?

**Option A: HashiCorp Vault (Enterprise-Grade)**

```yaml
services:
  vault:
    image: hashicorp/vault:1.15
    container_name: mana-vault
    ports:
      - "8200:8200"
    environment:
      VAULT_DEV_ROOT_TOKEN_ID: "dev-token"
      VAULT_DEV_LISTEN_ADDRESS: "0.0.0.0:8200"
    cap_add:
      - IPC_LOCK
    volumes:
      - vault_data:/vault/data
```

**Option B: Infisical (Einfacher, Open-Source)**

```yaml
services:
  infisical:
    image: infisical/infisical:latest
    container_name: mana-infisical
    ports:
      - "8080:8080"
    environment:
      ENCRYPTION_KEY: ${INFISICAL_ENCRYPTION_KEY}
      MONGO_URL: mongodb://mongo:27017/infisical
    depends_on:
      - mongo
```

**Verwendung in Apps:**

```typescript
// Statt process.env.DATABASE_PASSWORD
import { InfisicalClient } from "@infisical/sdk";

const client = new InfisicalClient({
  token: process.env.INFISICAL_TOKEN,
});

const secret = await client.getSecret({
  secretName: "DATABASE_PASSWORD",
  environment: "production",
});
```

---

### 6. API Gateway (Kong)

#### Was ist das?

Ein **API Gateway** ist ein zentraler Eintrittspunkt für alle API-Anfragen. Es bietet:
- Authentifizierung & Autorisierung
- Rate Limiting
- Request/Response Transformation
- Caching
- Analytics

```
┌──────────┐      ┌─────────────────┐      ┌──────────────┐
│  Client  │─────>│   Kong Gateway  │─────>│  Backends    │
│  (App)   │      │                 │      │              │
└──────────┘      │ • Auth prüfen   │      │ chat-backend │
                  │ • Rate Limit    │      │ todo-backend │
                  │ • Transform     │      │ calendar-api │
                  │ • Cache         │      │ etc.         │
                  │ • Log           │      │              │
                  └─────────────────┘      └──────────────┘
```

#### Warum braucht man das?

**Aktuell:**
- Jeder Backend-Service macht eigenes Rate-Limiting
- Auth wird in jedem Service einzeln geprüft
- Keine zentrale API-Übersicht

**Mit Kong:**
- Ein Ort für alle API-Regeln
- Einheitliche Rate-Limits
- API-Key Management
- Plugin-System für Erweiterungen

**Wann sinnvoll:**
- Viele externe API-Consumer
- Verschiedene Rate-Limits für verschiedene User
- API-Monetarisierung (Pläne, Quotas)
- Komplexe Auth-Anforderungen

**Wann NICHT nötig:**
- Nur interne Apps
- Wenige User
- Einfache Auth-Anforderungen

#### Wie würde es integriert?

```yaml
services:
  kong:
    image: kong:3.5
    container_name: mana-kong
    environment:
      KONG_DATABASE: "off"
      KONG_DECLARATIVE_CONFIG: /etc/kong/kong.yml
      KONG_PROXY_ACCESS_LOG: /dev/stdout
      KONG_ADMIN_ACCESS_LOG: /dev/stdout
    ports:
      - "8000:8000"   # Proxy
      - "8001:8001"   # Admin API
      - "8443:8443"   # Proxy SSL
    volumes:
      - ./kong/kong.yml:/etc/kong/kong.yml
```

**Kong Config (kong.yml):**

```yaml
_format_version: "3.0"

services:
  - name: chat-api
    url: http://chat-backend:3002
    routes:
      - name: chat-route
        paths:
          - /api/chat
    plugins:
      - name: rate-limiting
        config:
          minute: 100
          policy: local
      - name: key-auth
        config:
          key_names:
            - X-API-Key
```

---

## Optionale Ergänzungen

### 7. CI/CD Runner

#### Was ist das?

Ein **CI/CD Runner** führt Build- und Deploy-Prozesse aus. Statt auf GitHub's Servern zu bauen, läuft alles lokal.

#### Warum könnte man das brauchen?

| Aspekt | GitHub Actions | Self-Hosted Runner |
|--------|---------------|-------------------|
| **Kosten** | Minuten-Limit (2000/Monat free) | Unbegrenzt |
| **Geschwindigkeit** | Geteilte Ressourcen | Dedizierte Hardware |
| **Secrets** | In GitHub gespeichert | Lokal |
| **Netzwerk** | GitHub → Server (langsam) | Lokal → Lokal |
| **ARM-Builds** | Extra Kosten | M4 native |

#### Wie würde es integriert?

**GitHub Actions Runner:**

```yaml
services:
  github-runner:
    image: myoung34/github-runner:latest
    container_name: mana-github-runner
    environment:
      REPO_URL: https://github.com/your-org/managarten
      RUNNER_TOKEN: ${GITHUB_RUNNER_TOKEN}
      RUNNER_NAME: macmini-runner
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
```

---

### 8. Container Registry

#### Was ist das?

Eine **Container Registry** speichert Docker Images. Statt von Docker Hub zu pullen, hostest du deine eigenen Images.

#### Warum könnte man das brauchen?

- **Unabhängigkeit:** Keine Rate-Limits von Docker Hub
- **Geschwindigkeit:** Images lokal verfügbar
- **Privatsphäre:** Eigene Images nicht öffentlich
- **Kontrolle:** Welche Images wo deployed werden

#### Wie würde es integriert?

```yaml
services:
  registry:
    image: registry:2
    container_name: mana-registry
    ports:
      - "5000:5000"
    volumes:
      - registry_data:/var/lib/registry
```

---

### 9. Speech-to-Text (Whisper)

#### Was ist das?

**Whisper** ist OpenAI's Speech-to-Text Modell, das Audio in Text umwandelt. Es kann lokal laufen (whisper.cpp).

#### Warum könnte man das brauchen?

- **Matrix Clock Bot:** Sprachnachrichten → Zeiterfassung
- **Chat:** Voice Messages transkribieren
- **Meetings:** Aufnahmen transkribieren
- **Privacy:** Daten bleiben lokal

#### Wie würde es integriert?

```yaml
services:
  whisper:
    image: onerahmet/openai-whisper-asr-webservice:latest
    container_name: mana-whisper
    ports:
      - "9000:9000"
    environment:
      ASR_MODEL: small
      ASR_ENGINE: faster_whisper
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: all
              capabilities: [gpu]
```

**Oder nativ auf Mac (Apple Silicon optimiert):**

```bash
brew install whisper-cpp
whisper-cpp --model small.en audio.wav
```

---

## Noch nicht deployed (bereits entwickelt)

Diese Apps existieren bereits im Monorepo, sind aber noch nicht auf dem Server:

| App | Beschreibung | Status | Priorität |
|-----|--------------|--------|-----------|
| **Quotes** | Tägliche Inspirations-Zitate | Backend + Web fertig | Hoch |
| **Picture** | AI-Bildgenerierung | Braucht GPU/API | Mittel |
| **Cards** | Kartenspiel/Deckbuilding | Backend + Web fertig | Niedrig |
| **Planta** | Pflanzenpflege-Tracker | In Entwicklung | Niedrig |

### Telegram Bots (nicht deployed)

| Bot | Beschreibung | Code vorhanden |
|-----|--------------|---------------|
| `telegram-todo-bot` | Todo-Management via Telegram | ✓ |
| `telegram-food-bot` | Ernährung loggen via Telegram | ✓ |
| `telegram-quotes-bot` | Tägliche Zitate via Telegram | ✓ |
| `telegram-project-doc-bot` | Projekt-Dokumentation | ✓ |

---

## Priorisierte Roadmap

### Phase 1: Kritisch (Diese Woche)

```
1. ✅ Backup-Lösung einrichten
   └── PostgreSQL + MinIO → Hetzner Storage Box
   └── Täglich 3:00 Uhr
   └── 7 Tage Daily, 4 Wochen Weekly, 12 Monate Monthly

2. ✅ Loki + Promtail
   └── Alle Container-Logs zentral
   └── Grafana-Integration
   └── 30 Tage Retention
```

### Phase 2: Wichtig (Nächste 2 Wochen)

```
3. 📊 Uptime Kuma (extern)
   └── Auf separatem VPS
   └── Alle öffentlichen URLs überwachen
   └── Telegram-Benachrichtigung

4. 🚀 Quotes deployen
   └── Bereits entwickelt
   └── Backend + Web Container hinzufügen
   └── Cloudflare Tunnel Route
```

### Phase 3: Empfohlen (Nächster Monat)

```
5. 🔐 Secrets Management
   └── Infisical oder Vault
   └── Alle .env migrieren
   └── Rotation einrichten

6. 🤖 Weitere Telegram Bots
   └── todo-bot
   └── quotes-bot
   └── food-bot
```

### Phase 4: Optional (Backlog)

```
7. 🎙️ Whisper STT
   └── Für Matrix Clock Bot
   └── Voice → Zeiterfassung

8. 🏗️ CI/CD Runner
   └── Wenn GitHub Actions Limit erreicht
```

---

## Zusammenfassung

| Service | Kategorie | Aufwand | Nutzen | Empfehlung |
|---------|-----------|---------|--------|------------|
| Backup (restic) | Kritisch | 2h | Datensicherheit | **Sofort** |
| Loki + Promtail | Kritisch | 1h | Debugging | **Sofort** |
| Uptime Kuma | Wichtig | 30min | Externe Überwachung | Diese Woche |
| Quotes | Wichtig | 1h | Bereits entwickelt | Diese Woche |
| Traefik/Caddy | Empfohlen | 2h | Einheitliches Routing | Wenn Zeit |
| Vault/Infisical | Empfohlen | 4h | Security | Wenn Zeit |
| Kong | Optional | 4h | API Management | Bei Bedarf |
| Whisper | Optional | 1h | Voice Features | Bei Bedarf |
| CI Runner | Optional | 2h | Build-Performance | Bei Bedarf |

Die wichtigste Erkenntnis: **Backups sind nicht optional.** Ohne automatisierte Backups ist es nur eine Frage der Zeit, bis Daten verloren gehen.
