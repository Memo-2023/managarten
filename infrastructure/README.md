# Infrastructure Compose Files

Compose-Stacks die nicht direkt am Mac-Mini hängen.

## `docker-compose.gpu-box.yml`

Mana-Stack auf der Windows-GPU-Box (Hostname `mana-server-gpu`, IP `192.168.178.11`)
in WSL2/Docker. Bekam mit Phase 2 (Mai 2026) die nicht-zeitkritischen
Hilfsdienste vom Mini abgegeben — siehe [`docs/PLAN_OPTION_C.md`](../docs/PLAN_OPTION_C.md).

### Was läuft drin

| Service | Port (LAN-internal/external via Tunnel) | Rolle |
|---|---|---|
| `grafana` | `:8000` → `grafana.mana.how` | Dashboards (Phase 2a) |
| `forgejo` | `:3041` → `git.mana.how` | Git-Mirror (Phase 2b) |
| `umami` | `:8010` → `stats.mana.how` | Web-Analytics (Phase 2b) |
| `victoriametrics` | `:9090` (intern) | Metrics-Store (Phase 2c) |
| `loki` | `:3100` (intern) | Log-Store (Phase 2c) |
| `pushgateway`, `blackbox-exporter`, `vmalert`, `alertmanager`, `alert-notifier` | (intern) | Metrics + Alerting (Phase 2c) |
| `gpu-node-exporter`, `gpu-cadvisor`, `gpu-promtail` | (intern) | Self-Monitoring (Phase 2c) |
| `glitchtip` + worker + dedizierte postgres + redis | `:8020` → `glitchtip.mana.how` | Error-Tracking mit eigenem DB-Stack (Phase 2d) |
| `status-page-gen`, `status-nginx` | `:8090` → `status.mana.how` | Status-Seite (Phase 2e) |

Plus der bestehende `photon`-Container (Geocoder), der vor Phase 2 schon
auf der Box existierte und unangetastet blieb.

### Live-Files auf der GPU-Box

```
/srv/mana/
├── docker-compose.gpu-box.yml    ← Diese Datei (live deployment)
├── .env                           ← Secrets, gitignored — Vorlage in .env.gpu-box.example
├── monitoring/                    ← Configs (rsync von Mini bei Phase 2c)
│   ├── prometheus/                ← prometheus.yml mit 192.168.178.131-Targets, alerts.yml
│   ├── grafana/                   ← provisioning + dashboards
│   ├── loki/, blackbox/, alertmanager/, alert-notifier/, promtail-gpu/
├── forgejo-data/                  ← Forgejo /data bind-mount (rsync von Mini bei Phase 2b)
└── source/                        ← Sparse mana-monorepo-clone
                                     für status-page-gen + zukünftige Scripts
                                     git pull stündlich via systemd timer mana-source-pull.timer
```

### Deployment

```bash
# Auf der GPU-Box, in /srv/mana/:
docker compose -f docker-compose.gpu-box.yml up -d
docker compose -f docker-compose.gpu-box.yml ps
```

Repo-File ist Source-of-Truth; Live-Datei in `/srv/mana/` muss synchron
gehalten werden. Aktuell manuell — kein CD-Flow für die GPU-Box.

### Cloudflare-Tunnel

Token-managed Windows-Service `Cloudflared` mit Tunnel
`mana-gpu-server` (UUID `83454e8e-d7f5-4954-b2cb-0307c2dba7a6`).
Ingress-Konfiguration via API + Cloudflare-Dashboard, NICHT in
`config.yml`. Aktuelle Public-Hostnames:
`gpu-stt`, `gpu-tts`, `gpu-llm`, `gpu-img`, `gpu-video`, `gpu-ollama`
(alle für die nativen AI-Scheduled-Tasks) plus
`grafana`, `git`, `stats`, `glitchtip`, `status` (alles `*.mana.how`,
für die Phase-2-Container hier).

Aktive Public-Hostnames (Stand 2026-05-07, config v28):

| Hostname | Service | Zweck |
|---|---|---|
| `gpu-stt.mana.how` | `:3020` | Whisper STT (Scheduled-Task) |
| `gpu-tts.mana.how` | `:3022` | Piper TTS |
| `gpu-llm.mana.how` | `:3025` | LLM Gateway |
| `gpu-img.mana.how` | `:3023` | FLUX image-gen |
| `gpu-video.mana.how` | `:3026` | Video-gen |
| `gpu-ollama.mana.how` | `:11434` | Ollama API |
| `grafana.mana.how` | `:8000` | Phase 2a |
| `git.mana.how` | `:3041` | Forgejo (Phase 2b) |
| `stats.mana.how` | `:8010` | Umami (Phase 2b) |
| `glitchtip.mana.how` | `:8020` | Glitchtip (Phase 2d) |
| `status.mana.how` | `:8090` | Status-Page (Phase 2e) |
| `photon.mana.how` | `:2322` | Photon Geocoder (cross-LAN-Workaround für mana-geocoding's Probe + privacy-local Provider) |
| `npm.mana.how` | `:4873` | Verdaccio @mana/* npm-Registry (Phase 2f-1) |
| `mana-ai.mana.how` | `:3067` | AI Mission Runner (Phase 2f-3) |

API-Update (idempotent):

```python
# ssh mana-server, dann python3 mit dem cf-update-Pattern aus
# docs/PLAN_OPTION_C.md §4
```

### Deps für die Box

- WSL2 mit Ubuntu 24.04
- Docker Engine in WSL2 mit `systemd=true`
- `.wslconfig` mit `memory=24GB processors=12 vmIdleTimeout=-1 networkingMode=mirrored`
- Scheduled Task `MANA_WSL_Keepalive` hält die WSL-VM via `wsl --exec sleep infinity` warm
- Systemd Timer `mana-source-pull.timer` git-pulled `/srv/mana/source/` stündlich
- Windows-Firewall offen für Ports 3100, 9090, 9091 (von Mini-side accessible)
- `netsh interface portproxy` zwischen Windows-LAN-IP und WSL2-localhost für die obigen Ports

Alles dokumentiert in [`docs/WINDOWS_GPU_SERVER_SETUP.md`](../docs/WINDOWS_GPU_SERVER_SETUP.md).
