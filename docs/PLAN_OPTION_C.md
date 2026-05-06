# Plan — Option C: Workload-Split Mac Mini ↔ Windows-GPU-Box

**Stand:** 2026-05-06
**Ziel:** Nicht-zeitkritische Hilfsdienste (Monitoring, Forgejo, Glitchtip, Umami)
auf die Windows-GPU-Box (64 GB RAM, derzeit 95 % idle System-RAM) verlagern.
Single-Point-of-Failure innerhalb des Standorts entfernen, ohne Geld auszugeben.
Production-Hot-Path bleibt unverändert auf dem Mini.

## Status

| Phase | Stand | Anmerkung |
|---|---|---|
| Phase 0 — Vor-Setup | ✅ | Hardware bestätigt (Ryzen 9 5950X / 64 GB / RTX 3090 / 660 GB frei C:), in `WINDOWS_GPU_SERVER_SETUP.md` dokumentiert |
| Phase 1 — WSL2 + Docker | ✅ | War schon eingerichtet (Ubuntu 24.04, Docker 29.4.1, systemd). `.wslconfig` erweitert um `memory=24GB`, `processors=12`, `swap=8GB`, `vmIdleTimeout=-1` |
| Phase 2a — Grafana auf GPU-Box | ✅ | Container `mana-mon-grafana` läuft auf `:8000`, Cross-Box-Datasources testen erfolgreich (Prometheus/VM, Loki, Business Metrics). DB-Datasources schlagen fehl wegen Pre-existing-Mis-config (DBs heißen `mana_admin`, nicht `mana`; keine `glitchtip` DB) |
| Phase 2b — Umami + Forgejo | ✅ | Beide healthy auf GPU-Box. Glitchtip übersprungen — Mini-Glitchtip ist bereits im Broken-State (DB `glitchtip` existiert nicht in Postgres, läuft nur in Degraded-Mode), Migration würde Bug nicht heilen |
| Phase 2c — VM + Loki + Alerts | ✅ | Komplett auf GPU-Box. 11 Container neu (VM, Loki, Pushgateway, Blackbox, Vmalert, Alertmanager, Alert-notifier, GPU-eigenes Node-Exporter+Cadvisor+Promtail). VM scrapt 76 Targets, **69 UP / 7 DOWN** (DOWN sind alle pre-existing wrong /metrics endpoints auf Mana-Services, nicht durch Migration). Konfig-Pfade: `monitoring/{prometheus,loki,blackbox,alertmanager,alert-notifier}/`. Bekannte Limits siehe unten. |
| Phase 2d — Glitchtip mit dediziertem DB-Stack | ✅ | 4 Container neu (mana-mon-glitchtip + worker + dedizierte glitchtip-postgres + glitchtip-redis). Mini-Postgres scheiterte bei `logs.0001_initial`-Partition-Creation mit OS-level "Permission denied" (macOS-Docker-Storage-Quirk auf externer SSD). Auf der GPU-Box mit Linux-ext4 saubere 333-Tabellen-Migration. Worker enqueuet UND finished Tasks → DB-Writes funktional (vorher hingen sie ewig). Public-Hostname `glitchtip.mana.how` → mana-gpu-server-Tunnel (config v23). |
| Phase 3 — Daten-Migration | n/a | Alle migrierten Apps lesen Mini-Postgres direkt — keine separate Datenmigration |
| Phase 4 — Cloudflare-Cutover | ✅ | API-Approach via `cert.pem` apiToken: PUT `/accounts/.../cfd_tunnel/.../configurations` für GPU-Tunnel, dann `cloudflared tunnel route dns --overwrite-dns`. Kein Dashboard-Klick nötig. 3 Hostnames live (grafana/git/stats) |
| Phase 5 — Mini-Compose aufräumen | ✅ | 3 Blöcke in `cloudflared-config.yml` auskommentiert (Backup angelegt), cloudflared neu geladen, Mini-Container `mana-mon-grafana` + `mana-mon-umami` gestoppt (nicht entfernt — Rollback bleibt möglich) |

### Cloudflare-API-Approach (für nachvollziehbares Re-Run / weitere Cutover)

`~/.cloudflared/cert.pem` ist ein Argo-Tunnel-Token mit eingebettetem `accountID` + `apiToken`. Damit ist Tunnel-Ingress-Management vollständig automatisierbar — kein Dashboard-Klick, kein separater Cloudflare-API-Token nötig:

```python
import json, urllib.request, base64, subprocess
cert = json.loads(subprocess.check_output(
    "awk '/BEGIN ARGO/{f=1;next}/END ARGO/{f=0}f' ~/.cloudflared/cert.pem | tr -d '\\n' | base64 -d", shell=True))
TOKEN, ACCOUNT_ID = cert['apiToken'], cert['accountID']
TUNNEL_ID = '83454e8e-d7f5-4954-b2cb-0307c2dba7a6'  # mana-gpu-server
# GET → modify ingress → PUT
```

Workflow für weitere Migrationen (Phase 2c o. ä.):
1. GET aktuelle Ingress-Liste
2. Lokal mergen (neue Hostnames vor dem `http_status:404`-Catchall)
3. PUT zurück → erhöht `version`
4. `cloudflared tunnel route dns --overwrite-dns <tunnel-id> <hostname>` für jeden neuen Hostname
5. Mini-`cloudflared-config.yml` entsprechend bereinigen + `launchctl kickstart -k gui/501/com.cloudflare.cloudflared`

### Was läuft heute (2026-05-06) auf der GPU-Box

```
WSL2 (Ubuntu 24.04, 24 GB RAM-Limit, 12 vCPU, vmIdleTimeout=-1)
└── Docker (systemd-managed, auto-start)
    ├── photon (eclipse-temurin:21-jre, port 2322) — Geocoder-Backend für Mini-mana-geocoding (Pre-existing)
    ├── Phase 2a — Grafana
    │   └── mana-mon-grafana (grafana:10.4.1, :8000)
    │       ├── volume: mana-grafana-data
    │       └── datasources jetzt LOKAL (victoriametrics:9090, loki:3100, tempo:3200)
    ├── Phase 2b — Apps
    │   ├── mana-core-forgejo (forgejo:11, :3041) — DB → Mini-Postgres
    │   └── mana-mon-umami (umami:2.18.0, :8010) — DB → Mini-Postgres
    ├── Phase 2d — Glitchtip mit eigener DB-Insel
    │   ├── mana-mon-glitchtip (glitchtip:latest, :8020) — DB → glitchtip-postgres
    │   ├── mana-mon-glitchtip-worker — Celery + Beat
    │   ├── mana-mon-glitchtip-postgres (postgres:16-alpine) — eigene DB-Instanz
    │   │   └── volume: glitchtip-pg-data (333 Tabellen, alle Migrationen sauber)
    │   └── mana-mon-glitchtip-redis (redis:7-alpine) — eigene Cache+Queue
    └── Phase 2c — Metrics-Stack
        ├── mana-mon-victoria (VM v1.99.0, :9090) — scrapt Mini-Services via 192.168.178.131:<port>
        │   ├── extra_hosts: host.docker.internal:host-gateway
        │   └── volume: victoriametrics-data
        ├── mana-mon-loki (loki:3.0.0, :3100) — empfängt von gpu-promtail (Mini-side blockiert via LAN)
        ├── mana-mon-gpu-promtail — sammelt GPU-Box-Container-Logs
        ├── mana-mon-pushgateway (:9091)
        ├── mana-mon-blackbox (:9115)
        ├── mana-mon-vmalert (:8880)
        ├── mana-mon-alertmanager (:9093)
        ├── mana-mon-alert-notifier (:9095) — Telegram-Bot, lokal gebaut
        ├── mana-mon-gpu-node-exporter — eigenes Host-Metric-Endpoint
        └── mana-mon-gpu-cadvisor — eigenes Container-Metric-Endpoint
```

### Cloudflare-API-Approach + Tunnel-Routes

| Hostname | Tunnel | Origin |
|---|---|---|
| grafana.mana.how | mana-gpu-server | http://localhost:8000 |
| git.mana.how | mana-gpu-server | http://localhost:3041 |
| stats.mana.how | mana-gpu-server | http://localhost:8010 |
| glitchtip.mana.how | mana-gpu-server | http://localhost:8020 |
| (interne) gpu-box-eigene VM/Loki | – | nur LAN, via Mini-Promtail blockiert |

### Bekannte Limits / Pre-Existing Issues nach Phase 2c

1. **Mini-Container-Logs werden nicht zu GPU-Loki geshipped.** Mini-Promtail kann GPU-Box `192.168.178.11:3100` aus Colima-Container-Network nicht erreichen, obwohl der Mini-Host es kann (Colima-NAT-Routing-Quirk). Ports 3100/9090/9091 sind via Windows-Firewall + `netsh interface portproxy` von der LAN-IP erreichbar. Mini-Promtail war ohnehin schon vor der Migration aus, ist also keine Regression — aktuell sind nur GPU-Box-Logs in Loki. Als Workaround später möglich: Loki-HTTP-Push via Cloudflare-Tunnel.
2. **gpu-* direct scrape jobs deaktiviert.** Aus Docker-Container in WSL2 ist `host.docker.internal:port` (= host-gateway 172.18.0.1) nicht in der Lage, Windows-Host-Services zu erreichen (die binden auf 127.0.0.1). Workaround: blackbox-exporter probt `gpu-stt.mana.how/health` etc. öffentlich → grobe Up/Down-Visibility ist erhalten, nur App-interne Metriken (Token-Counts etc.) fehlen.
3. **7 Pre-Existing-DOWN-Targets:** `mana-auth`, `mana-credits`, `mana-user`, `mana-subscriptions`, `mana-analytics`, `memoro-server`, `uload-server` geben non-2xx auf `/metrics` zurück (entweder kein Endpoint oder Auth-protected). Waren auf dem Mini schon DOWN, nicht durch Migration verursacht.
4. **2 Scrape-Jobs übersprungen:** `mana-mcp` und `mana-crawler` exposen keine Host-Ports (nur Container-internal), daher von der GPU-Box nicht erreichbar. Auskommentiert in prometheus.yml.

### Mac Mini nach Phase 2c

Mini hat nun **46 laufende Container** (von vorher 53). Gestoppt: `mana-mon-{victoria,loki,promtail,vmalert,alertmanager,blackbox,pushgateway,alert-notifier}`. Im Compose drin gelassen für Rollback.

**WSL-Keepalive:** Scheduled Task `MANA_WSL_Keepalive` (Trigger: AtLogOn + AtStartup,
Restart bei Failure) hält `wsl.exe -d Ubuntu-24.04 --exec /bin/sleep infinity`
als langlebigen Windows-Prozess offen → WSL-VM idled nicht aus, Container
überleben SSH-Session-Pausen.

---

## 0. Voraussetzungen

| | |
|---|---|
| Mac Mini SSH | `ssh mana-server` (192.168.178.131, User `mana`) — **OK** |
| GPU-Box SSH | `ssh mana-gpu` (192.168.178.11, User `tills`) — **derzeit offline** |
| GPU-Box muss vor Phase 1 erreichbar sein | Box einschalten, Network-Profile auf "Privat" setzen (Doku §1 in `WINDOWS_GPU_SERVER_SETUP.md`) |
| Live-Tunnel-Config Mac Mini | `/Users/mana/projects/mana-monorepo/cloudflared-config.yml` (geladen via LaunchAgent) |
| Mac-Mini-Tunnel-UUID | `1435166a-0e3f-4222-8de6-744f32cea5c9` |
| GPU-Box-Tunnel-UUID | `83454e8e-d7f5-4954-b2cb-0307c2dba7a6` (Token-managed im Cloudflare-Dashboard) |

## 1. Service-Inventar — was wandert, was bleibt

### Wandert auf GPU-Box (WSL2/Docker)

| Container | Host-Port (Mini) | Image | Daten-Volumen | Anmerkung |
|---|---|---|---|---|
| `grafana` | 8000 | `grafana/grafana:10.4.1` | `mana-grafana-data` (46 MB) | Dashboards + Provisioning aus Repo bind-mount |
| `victoriametrics` | 9090 | `victoriametrics:v1.99.0` | `mana-victoria-data` (988 MB) | Scrapes über LAN auf Mini-Exporter umkonfigurieren |
| `loki` | 3100 | `grafana/loki:3.0.0` | `mana-loki-data` (4 MB) | Promtail auf Mini schickt zu `192.168.178.11:3100` |
| `pushgateway` | 9091 | `prom/pushgateway:v1.7.0` | — | |
| `blackbox-exporter` | 9115 | `prom/blackbox:v0.25.0` | — | Probt von außen — sogar besser, wenn nicht auf der Mini-Box |
| `vmalert` | 8880 | `victoriametrics/vmalert:v1.99.0` | — | Alerts-Dir aus Repo bind-mount |
| `alertmanager` | 9093 | `prom/alertmanager:v0.27.0` | `mana-alertmanager-data` (8 KB) | |
| `alert-notifier` | 9095 | `alert-notifier:local` | — | Lokales Image — auf GPU-Box neu bauen |
| `umami` | 8010 | `umami:postgresql-v2.18.0` | (DB only) | DB `umami` bleibt auf Mini-Postgres, App ruft via 192.168.178.131:5432 |
| `glitchtip` + `worker` | 8020 | `glitchtip:latest` | (DB only) | DB-Name TBD beim Migrieren — wahrscheinlich auch in Mini-Postgres |
| `forgejo` (re-aktivieren) | 3041 | `codeberg.org/forgejo/forgejo:11` | (frisch oder Volume-Restore) | Container läuft heute **nicht**; DB-Tabelle vorhanden |

### Bleibt auf Mac Mini

**Production Hot-Path:** `postgres`, `postgres-backup`, `redis`, `minio`,
`minio-init`, `mana-auth`, `mana-api`, `mana-app-web`, `mana-sync`,
`mana-credits`, `mana-user`, `mana-subscriptions`, `mana-events`,
`mana-geocoding`, `mana-analytics`, `mana-research`, `mana-ai`, `mana-media`,
`mana-crawler`, `mana-notify`, `mana-search`, `mana-landing-builder`,
`api-gateway`, `mana-llm` (Proxy), `mana-app-manavoxel-web`,
`mana-app-uload-server`, `mana-app-llm-playground`, `mana-admin`, `mana-mail`,
`mana-status-gen`, `mana-infra-landings` (nginx), `memoro-server`,
`memoro-audio-server`, `memoro-landing`, `chorportal-app` + `chorportal-prod-postgres`
+ `chorportal-prod-minio`, `news-ingester`, `mana-verdaccio` (npm-Registry,
Migration auf GPU-Box ist späterer Schritt).

**Box-lokale Helpers (laufen auf jeder Box separat):**
- `node-exporter` (Host-Metriken)
- `cadvisor` (lokale Docker-Metriken)
- `promtail` (lokaler Log-Shipper)
- `watchtower` (lokaler Docker-Updater)
- `postgres-exporter` (bleibt nur auf Mini, weil Postgres dort)
- `redis-exporter` (bleibt nur auf Mini)

### Native Prozesse Mini (kein Docker, bleiben unverändert)

`who-server` (PM2), `who-web` (LaunchAgent), `cloudflared` (Mini-Tunnel),
`colima`, GitHub-Runner, `actions.runner.Memo-2023-mana-monorepo.mac-mini`.

## 2. Cloudflare-Routing — Vorher / Nachher

| Hostname | Vorher | Nachher | Tunnel |
|---|---|---|---|
| `grafana.mana.how` | Mini :8000 | GPU-Box :8000 | mana-gpu-server |
| `git.mana.how` | Mini :3041 (heute 502, da Forgejo aus) | GPU-Box :3041 | mana-gpu-server |
| `glitchtip.mana.how` | Mini :8020 | GPU-Box :8020 | mana-gpu-server |
| `stats.mana.how` (Umami) | Mini :8010 | GPU-Box :8010 | mana-gpu-server |
| `status.mana.how` | Mini :4400 (nginx) | **bleibt Mini** (status-page-gen schreibt in landings dir) | mana-server |
| Alle anderen `*.mana.how` | Mini | **unverändert Mini** | mana-server |

Hinzufügen im Cloudflare-Dashboard (Zero Trust → Networks → Tunnels →
`mana-gpu-server` → Public Hostnames):

```
grafana.mana.how    → http://localhost:8000
git.mana.how        → http://localhost:3041
glitchtip.mana.how  → http://localhost:8020
stats.mana.how      → http://localhost:8010
```

DNS-CNAMEs zeigen heute auf den Mini-Tunnel und müssen umgeschwenkt werden:

```sh
ssh mana-server '/opt/homebrew/bin/cloudflared tunnel route dns \
  --overwrite-dns 83454e8e-d7f5-4954-b2cb-0307c2dba7a6 grafana.mana.how'
# … pro Hostname
```

## 3. Phasen

### Phase 0 — Vor-Setup (10 min, kein Risiko)

1. GPU-Box einschalten, Network-Profile auf "Privat" setzen, SSH testen.
   ```sh
   ssh mana-gpu "Get-NetConnectionProfile; Get-Service sshd"
   ```
2. CPU/RAM/Disk dokumentieren in `docs/WINDOWS_GPU_SERVER_SETUP.md`:
   ```sh
   ssh mana-gpu "Get-ComputerInfo | Select-Object CsTotalPhysicalMemory,CsNumberOfLogicalProcessors,WindowsVersion; Get-PSDrive C"
   ```
3. Bestätigen, dass die AI-Scheduled-Tasks ungestört laufen:
   ```sh
   ssh mana-gpu "Get-ScheduledTask -TaskName Mana* | Select-Object TaskName,State"
   curl -s https://gpu-llm.mana.how/health
   ```

### Phase 1 — WSL2 + Docker auf GPU-Box (1 h)

1. WSL2 + Ubuntu 24.04 installieren (falls nicht vorhanden):
   ```powershell
   wsl --install -d Ubuntu-24.04 --no-launch
   wsl --set-default-version 2
   ```
2. `.wslconfig` in `C:\Users\tills\.wslconfig` erstellen — **WSL2 auf 16 GB RAM
   begrenzen**, damit AI-Tasks ihren System-RAM behalten:
   ```ini
   [wsl2]
   memory=16GB
   processors=8
   swap=4GB
   localhostForwarding=true
   ```
3. WSL starten, User anlegen, dann:
   ```sh
   sudo apt update && sudo apt install -y ca-certificates curl
   curl -fsSL https://get.docker.com | sudo sh
   sudo usermod -aG docker $USER
   # systemd in WSL aktivieren:
   sudo tee /etc/wsl.conf >/dev/null <<EOF
   [boot]
   systemd=true
   EOF
   ```
4. WSL neu starten (`wsl --shutdown`, dann erneut starten), Docker testen:
   ```sh
   docker run --rm hello-world
   ```
5. Auto-Start: Scheduled Task anlegen, der bei Boot `wsl -d Ubuntu-24.04 --exec
   /bin/sh -c "true"` ausführt → das hält die WSL-VM warm und damit Docker-Daemon
   am Leben.

**Smoketest:** `ssh mana-gpu "wsl -d Ubuntu-24.04 -- docker ps"` muss leere
Container-Liste zurückgeben.

### Phase 2 — Monitoring-Stack auf GPU-Box hochziehen (parallel zum Mini, 2 h)

1. Im Repo `docker-compose.gpu-box.yml` anlegen — initial nur die Container, die
   keine Daten-Migration brauchen: Grafana, VictoriaMetrics, Loki, Pushgateway,
   Blackbox-Exporter, Vmalert, Alertmanager, Alert-Notifier. Plus
   GPU-Box-lokales `node-exporter`, `cadvisor`, `promtail`, `watchtower`.
2. Configs aus `docker/{prometheus,loki,blackbox,alertmanager,grafana}/` per
   `git clone` auf die GPU-Box → bind-mounten.
3. **Datenquellen für VictoriaMetrics neu konfigurieren:** Scrape-Targets müssen
   `192.168.178.131:9100` (node-exporter Mini), `192.168.178.131:9110`
   (cadvisor Mini), `192.168.178.131:9187` (postgres-exporter), etc. enthalten.
   Plus die GPU-Box-lokalen Exporter.
4. **Grafana-Datenquellen** auf neue VM-URL (`http://victoria:8428` lokal in
   compose) zeigen lassen.
5. `docker compose -f docker-compose.gpu-box.yml up -d` auf GPU-Box.
6. **Parallel-Verifikation:** GPU-Box-Grafana ist intern erreichbar
   (`curl http://192.168.178.11:8000/api/health`), aber noch nicht öffentlich.
   Mini-Grafana läuft weiter — kein Cutover.

### Phase 3 — Daten-Migration (3 h)

#### Glitchtip + Umami

Beide haben *keine* persistenten Container-Volumes — der Zustand liegt komplett
in `mana-infra-postgres`. **Einfachster Weg:** App-Container auf GPU-Box
hochziehen, mit DB-Connection-String auf `192.168.178.131:5432` zeigen lassen.
Daten bleiben auf Mini-Postgres, nur die App-Layer wandert.

Voraussetzung: Mini-Postgres muss von der GPU-Box (LAN) erreichbar sein.
`pg_hba.conf` checken:
```sh
ssh mana-server 'PATH=/Applications/Docker.app/Contents/Resources/bin:$PATH; docker exec mana-infra-postgres cat /var/lib/postgresql/data/pg_hba.conf | grep -v "^#" | grep -v "^$"'
```
Falls nötig: Eintrag für `192.168.178.0/24` ergänzen, Postgres-Reload.

DB-Namen + Credentials aus `docker-compose.macmini.yml` extrahieren (Umami:
`umami` DB, Glitchtip-DB-Name TBD beim Migrieren).

#### Forgejo

Container läuft heute **nicht** (Live-Check 2026-05-06). DB-Tabelle existiert
aber. Zwei Optionen:

- **A — Frisch starten:** Forgejo-Container auf GPU-Box hochziehen, DB neu
  initialisieren, alle Repos frisch von GitHub mirrorn (Mirror-Sync ist
  konfiguriert in `.github/workflows/mirror-to-forgejo.yml`).
- **B — DB übernehmen:** Forgejo-DB aus Mini-Postgres dump'en und auf
  GPU-Box-internem Postgres restoren. Komplizierter, kein Mehrwert für einen
  Mirror-only Forgejo.

→ **Empfehlung: Option A.** Saubere Neuinstallation auf GPU-Box.

#### Grafana / VM / Loki / Alertmanager

- VM-Daten (988 MB): per `docker run --rm -v mana-victoria-data:/d -v $PWD:/o
  alpine tar czf /o/vm.tgz -C /d .` auf Mini, rsync zur GPU-Box, dort in
  Volume reinpacken. Alternativ: einfach neu starten und 14-Tage-Retention
  füllt sich neu — gegen den 988 MB-Verlust spricht nichts Geschäftliches.
- Loki-Daten (4 MB): irrelevant, Logs füllen sich neu.
- Grafana-Daten (46 MB): Dashboards sind im Repo (provisioning), Datenquellen
  konfigurieren wir neu. **Nur User-Settings/Stars** wären verloren — verkraftbar.
- Alertmanager-Daten (8 KB): leer.

→ **Empfehlung: Daten-Migration weglassen.** Container starten frisch, alles
relevante kommt aus dem Repo (Dashboards, Alert-Rules, Configs). Ein
sauberer Re-Start ist hier billiger als jeder rsync-Fehler.

### Phase 4 — Cloudflare-Tunnel-Cutover (30 min)

1. **Im Cloudflare-Dashboard** (Zero Trust → Tunnels → `mana-gpu-server` →
   Public Hostname → Add):
   - `grafana.mana.how` → `http://localhost:8000`
   - `git.mana.how` → `http://localhost:3041`
   - `glitchtip.mana.how` → `http://localhost:8020`
   - `stats.mana.how` → `http://localhost:8010`
2. **DNS umrouten** (atomar, < 60 s Propagation in eigener Zone):
   ```sh
   ssh mana-server '
     for h in grafana git glitchtip stats; do
       /opt/homebrew/bin/cloudflared tunnel route dns \
         --overwrite-dns 83454e8e-d7f5-4954-b2cb-0307c2dba7a6 ${h}.mana.how
     done
   '
   ```
3. **Smoketest pro Hostname:**
   ```sh
   for h in grafana git glitchtip stats; do
     curl -sI https://${h}.mana.how/ | head -2
     echo
   done
   ```
4. **Mini-Tunnel-Einträge entfernen** (im Repo
   `cloudflared-config.yml` die vier Hostnames auskommentieren), dann
   `launchctl kickstart -k gui/501/com.cloudflare.cloudflared`.

### Phase 5 — Aufräumen + Verifikation (1 h)

1. Mini-Container stoppen + auskommentieren (nicht löschen, für schnelles
   Rollback) in `docker-compose.macmini.yml`:
   ```
   grafana, victoriametrics, loki, tempo, pushgateway, blackbox-exporter,
   vmalert, alertmanager, alert-notifier, umami, glitchtip, glitchtip-worker
   ```
2. Sum-of-Limits neu berechnen (`./scripts/mac-mini/memory-baseline.sh`).
   Ziel: ≤ 6 GiB.
3. Mini-Reboot-Test: Box neu starten, alle laufenden Container kommen wieder,
   `pnpm check:status` alle grün.
4. Cross-Box-Health-Check: GPU-Box-Reboot → Mini-Production läuft weiter,
   `mana.how` antwortet, nur Monitoring kurz blind.
5. Build-Test: `./scripts/mac-mini/build-app.sh todo-web` ohne `--force-free`
   muss durchlaufen, ohne Monitoring zu stoppen.

## 4. Rollback-Plan

Bei jedem Phasen-Fehler: keine Mini-Container wurden vorher gestoppt → Rollback
ist trivial.

| Phase | Rollback |
|---|---|
| Phase 1 (WSL2 broken) | WSL2 deinstallieren, GPU-Box bleibt AI-only |
| Phase 2 (Monitoring auf GPU-Box läuft nicht) | GPU-Box-Compose `down`, Mini bleibt SoT — kein Impact |
| Phase 3 (Glitchtip/Umami können Mini-Postgres nicht erreichen) | pg_hba.conf zurück, GPU-Box-Container `down`, Mini-Container weiter — kein Impact |
| Phase 4 (Cutover) | DNS-Route zurück auf Mini-Tunnel + Mini-Container `up -d` (waren ja nur gestoppt) |
| Phase 5 (Mini bricht beim Aufräumen) | `git checkout docker-compose.macmini.yml && docker compose up -d` — Container kommen zurück |

## 5. Risiken + Mitigation

| Risiko | Mitigation |
|---|---|
| WSL2-Networking nach Patch-Tuesday weg | Healthcheck auf Mini probt GPU-Box-Endpoints; manuelles Eingreifen am nächsten Werktag |
| AI-Tasks werden ge-OOM'd | `.wslconfig` begrenzt WSL auf 16 GB → AI-Tasks behalten 48 GB |
| Glitchtip/Umami können Mini-Postgres-IP nicht auflösen | Vorab-Test in Phase 3: `psql -h 192.168.178.131 -U postgres -p 5432 -c '\l'` aus WSL2 |
| Mini-Tunnel führt nach Cutover noch alte Routen, weil DNS-Cache | TTL der Cloudflare-Records ist 60 s; `dig` prüfen vorm Verifizieren |
| Status-Page-Gen findet VM nicht mehr | URL in `scripts/generate-status-page.sh` von `localhost:9090` auf `192.168.178.11:9090` ändern |

## 6. Was der Plan *nicht* leistet

- **Keine geografische Redundanz.** Hausbrand / längerer Stromausfall / FRITZ!Box-Tod
  trifft beide Boxen weiterhin. Dafür ist Hetzner (§5 im Hauptbericht) nötig.
- **Kein Postgres-Failover.** Mini-Postgres bleibt SPOF. Logical-Replication zu
  Hetzner-CX22 ist ein separates Projekt (Option A im Hauptbericht).
- **Kein Verdaccio-Move.** `npm.mana.how` bleibt Mini, weil Build-Pipeline davon
  abhängt — eigener Migrationsschritt später.
- **Kein Stalwart/Mail-Move.** Mail-DNS hängt am Mini-Tunnel-IP — gesonderter
  Schritt.

## 7. Offene Punkte (zu klären während der Migration)

- [ ] Glitchtip-DB-Name + Credentials aus `docker-compose.macmini.yml` extrahieren
- [ ] Forgejo: re-aktivieren (frisch) oder ganz streichen, falls niemand
      wirklich auf `git.mana.how` schaut (GitHub ist eh SoT)
- [ ] `docker/grafana/`, `docker/loki/` (im aktuellen Repo unter
      `manacore-monorepo`-Pfad gemountet — Pfad-Konsistenz prüfen)
- [ ] CPU/RAM-Specs der GPU-Box dokumentieren in
      `docs/WINDOWS_GPU_SERVER_SETUP.md`
- [ ] `scripts/check-status.sh` und `scripts/generate-status-page.sh` auf neue
      VM-URL umstellen (192.168.178.11:9090)

## 8. Zeit-Schätzung

| Phase | Dauer | Risiko |
|---|---|---|
| Phase 0 (Pre-Setup) | 10 min | Niedrig |
| Phase 1 (WSL2/Docker) | 1 h | Niedrig |
| Phase 2 (Monitoring auf GPU-Box) | 2 h | Niedrig (parallel) |
| Phase 3 (Daten-Migration) | 3 h | Mittel (DB-Konnektivität) |
| Phase 4 (Cutover) | 30 min | Mittel (DNS-Propagation) |
| Phase 5 (Aufräumen) | 1 h | Niedrig |
| **Gesamt** | **~7,5 h** | über 1–2 Tage realistisch verteilt |
