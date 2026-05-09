---
title: 'CD Pipeline mit Self-Hosted GitHub Actions Runner'
description: 'Continuous Deployment Pipeline mit self-hosted GitHub Actions Runner auf dem Mac Mini, Auto-Deploy bei Push auf main und Docker-Fixes.'
date: 2026-03-11
author: 'Till Schneider'
category: 'infrastructure'
tags: ['ci-cd', 'github-actions', 'mac-mini', 'self-hosted-runner', 'docker', 'deployment']
featured: false
commits: 6
readTime: 5
stats:
  filesChanged: 42
  linesAdded: 680
  linesRemoved: 190
contributors:
  - name: 'Till Schneider'
    handle: 'Till-JS'
    commits: 6
workingHours:
  start: '2026-03-11T11:00'
  end: '2026-03-12T11:00'
---

> **Legacy-Format.** Dieser Eintrag stammt aus dem Session-basierten Devlog vor der Umstellung auf das Tages-Modell (Cutover 2026-05-09). Bestand bleibt erhalten und unverändert; neue Einträge folgen der Tages-Konvention mit `spieler.md` + `macher.md` pro 06–06-Bucket. Spec: [`mana/docs/DEVLOG.md`](https://github.com/mana-ev/mana/blob/main/docs/DEVLOG.md).

Infrastruktur-Tag mit **6 Commits** für die Deployment-Pipeline:

- **CD Pipeline** - GitHub Actions mit self-hosted Runner
- **Auto-Deploy** - Automatisches Deployment bei Push auf main
- **SSH Setup** - Dokumentation für Mac Mini Runner
- **Docker Fixes** - PATH und Dockerfile-Korrekturen

---

## CD Pipeline: Self-Hosted GitHub Actions Runner

Continuous Deployment direkt auf dem Mac Mini Production Server via self-hosted GitHub Actions Runner.

### Architektur

```
┌──────────────────────────────────────────────────────┐
│  GitHub Repository                                    │
│  Push to main                                         │
└──────────────────────┬───────────────────────────────┘
                       │ Webhook
                       ▼
┌──────────────────────────────────────────────────────┐
│  Mac Mini (mana.how)                                  │
│                                                       │
│  ┌─────────────────────────────────┐                 │
│  │  GitHub Actions Runner          │                 │
│  │  (self-hosted, always-on)       │                 │
│  └────────────────┬────────────────┘                 │
│                   │                                   │
│                   ▼                                   │
│  ┌─────────────────────────────────┐                 │
│  │  Deploy Script                  │                 │
│  │  1. git pull                    │                 │
│  │  2. pnpm install                │                 │
│  │  3. docker compose build        │                 │
│  │  4. docker compose up -d        │                 │
│  │  5. health check                │                 │
│  └─────────────────────────────────┘                 │
│                                                       │
│  ┌─────────────────────────────────┐                 │
│  │  Docker Services                │                 │
│  │  matrix, mana-core-auth,        │                 │
│  │  bots, web-apps, ...            │                 │
│  └─────────────────────────────────┘                 │
│                                                       │
└──────────────────────────────────────────────────────┘
```

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy to Mac Mini

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: self-hosted
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Pull latest changes
        run: git pull origin main

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Build & Deploy
        run: |
          docker compose -f docker-compose.macmini.yml build
          docker compose -f docker-compose.macmini.yml up -d

      - name: Health Check
        run: ./scripts/mac-mini/health-check.sh
```

---

## Auto-Deploy bei Push auf main

Jeder Push auf `main` löst automatisch ein Deployment aus.

### Deploy-Flow

| Schritt          | Dauer | Beschreibung              |
| ---------------- | ----- | ------------------------- |
| **Checkout**     | ~2s   | Repository auschecken     |
| **Pull**         | ~5s   | Neueste Änderungen ziehen |
| **Install**      | ~30s  | Dependencies installieren |
| **Build**        | ~2min | Docker Images bauen       |
| **Deploy**       | ~30s  | Container neu starten     |
| **Health Check** | ~10s  | Services überprüfen       |
| **Gesamt**       | ~3min | End-to-End Deployment     |

### Notifications

```yaml
- name: Notify on failure
  if: failure()
  run: |
    curl -X POST "$MATRIX_WEBHOOK_URL" \
      -H "Content-Type: application/json" \
      -d '{"body": "❌ Deployment failed: ${{ github.sha }}"}'
```

---

## SSH Setup Dokumentation

Dokumentation für die Einrichtung des GitHub Actions Runners auf dem Mac Mini.

### Runner Installation

```bash
# Auf dem Mac Mini
mkdir ~/actions-runner && cd ~/actions-runner
curl -o actions-runner.tar.gz -L https://github.com/actions/runner/releases/download/v2.321.0/actions-runner-osx-arm64-2.321.0.tar.gz
tar xzf actions-runner.tar.gz

# Runner konfigurieren
./config.sh --url https://github.com/your-org/manacore-monorepo \
            --token YOUR_TOKEN \
            --labels self-hosted,macOS,ARM64

# Als Service installieren
./svc.sh install
./svc.sh start
```

### LaunchDaemon

```xml
<!-- ~/Library/LaunchAgents/com.github.actions-runner.plist -->
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.github.actions-runner</string>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>WorkingDirectory</key>
    <string>/Users/till/actions-runner</string>
    <key>ProgramArguments</key>
    <array>
        <string>./runsvc.sh</string>
    </array>
</dict>
</plist>
```

---

## Docker PATH Fix

Der GitHub Actions Runner hatte keinen Zugriff auf Docker im PATH.

### Problem

```
Error: docker: command not found
```

### Lösung

```bash
# .env für den Runner
echo 'PATH=/usr/local/bin:/opt/homebrew/bin:$PATH' >> ~/actions-runner/.env
```

---

## matrix-web Dockerfile Fix

Das matrix-web Dockerfile fehlte die `shared-pwa` Package Dependency.

### Problem

```
ERROR: Could not resolve @manacore/shared-pwa
Build failed during Docker multi-stage build
```

### Lösung

```dockerfile
# Dockerfile - shared-pwa Package mit kopieren
COPY packages/shared-pwa ./packages/shared-pwa
```

---

## Mac Mini Docs Update

Dokumentation mit aktivem Runner-Status aktualisiert.

### Neue Sektion

```markdown
## GitHub Actions Runner

Status: ✅ Aktiv
Labels: self-hosted, macOS, ARM64
Auto-Start: Ja (LaunchDaemon)
```

---

## Zusammenfassung

| Bereich           | Commits | Highlights                 |
| ----------------- | ------- | -------------------------- |
| **CD Pipeline**   | 2       | Workflow + Auto-Deploy     |
| **SSH Docs**      | 1       | Runner Setup Dokumentation |
| **Docker PATH**   | 1       | Runner Environment Fix     |
| **Dockerfile**    | 1       | shared-pwa Dependency Fix  |
| **Mac Mini Docs** | 1       | Runner Status Update       |

---

## Nächste Schritte

1. **Staging Environment** - Preview Deployments für PRs
2. **Rollback** - Automatisches Rollback bei Health-Check-Failure
3. **Build Cache** - Docker Layer Caching optimieren
4. **Monitoring** - Deployment-Metriken in Grafana
