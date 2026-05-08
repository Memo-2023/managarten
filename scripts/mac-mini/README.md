# Mac Mini Server Scripts

Scripts for managing the Mana production environment on Mac Mini.

## Quick Start (After System Update)

```bash
# 1. SSH into Mac Mini (from your local machine)
ssh mac-mini

# 2. Navigate to project
cd ~/projects/managarten

# 3. Setup auto-start (only needed once)
./scripts/mac-mini/setup-autostart.sh

# 4. Check status
./scripts/mac-mini/status.sh
```

## Scripts Overview

| Script | Purpose |
|--------|---------|
| `setup-autostart.sh` | Configure automatic startup on boot (run once) |
| `startup.sh` | Main startup script (called by launchd) |
| `health-check.sh` | Check all services health |
| `status.sh` | Show full system status |
| `restart.sh` | Restart all Docker containers |
| `stop.sh` | Stop all Docker containers |
| `deploy.sh` | Pull latest images and deploy |

## First-Time Setup

### 1. Prerequisites on Mac Mini

```bash
# Install Homebrew
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"

# Install required tools
brew install cloudflared git docker

# Install Docker Desktop
# Download from: https://www.docker.com/products/docker-desktop/
```

### 2. Clone Repository

```bash
mkdir -p ~/projects
cd ~/projects
git clone https://github.com/Memo-2023/managarten.git
cd managarten
```

### 3. Configure Cloudflare Tunnel

```bash
# Login to Cloudflare
cloudflared tunnel login

# The tunnel is already created (ID: bb0ea86d-8253-4a54-838b-107bb7945be9)
# Credentials should be at: ~/.cloudflared/bb0ea86d-8253-4a54-838b-107bb7945be9.json
```

### 4. Configure Environment

```bash
# Copy and edit the environment file
cp .env.macmini.example .env.macmini
nano .env.macmini
```

### 5. Enable Auto-Start

```bash
# This sets up all launchd services
./scripts/mac-mini/setup-autostart.sh
```

### 6. Configure Docker Desktop

Open Docker Desktop and enable:
- **Settings > General > Start Docker Desktop when you sign in**

## Daily Operations

### Check Status

```bash
./scripts/mac-mini/status.sh
```

### Run Health Check

```bash
./scripts/mac-mini/health-check.sh
```

### Restart Services

```bash
# Normal restart
./scripts/mac-mini/restart.sh

# Pull latest images and restart
./scripts/mac-mini/restart.sh --pull

# Force recreate containers
./scripts/mac-mini/restart.sh --force
```

### View Logs

```bash
# Startup log
tail -f /tmp/mana-startup.log

# Health check log
tail -f /tmp/mana-health.log

# Cloudflare tunnel log
tail -f /tmp/cloudflared.log

# Specific container logs
docker logs -f mana-auth
docker logs -f chat-backend
```

### Stop Services

```bash
./scripts/mac-mini/stop.sh
```

## LaunchD Services

Three services are configured to run automatically:

| Service | Label | Purpose |
|---------|-------|---------|
| Cloudflared | `com.cloudflare.cloudflared` | Tunnel to Cloudflare |
| Docker Startup | `com.mana.docker-startup` | Start containers on boot |
| Health Check | `com.mana.health-check` | Check every 5 minutes |
| STT Service | `com.mana.stt` | Speech-to-Text (Whisper + Voxtral) |

### Manual Service Control

```bash
# Check status
launchctl list | grep -E 'cloudflare|mana'

# Restart a service
launchctl kickstart -k gui/$(id -u)/com.mana.docker-startup

# Stop a service
launchctl unload ~/Library/LaunchAgents/com.mana.docker-startup.plist

# Start a service
launchctl load ~/Library/LaunchAgents/com.mana.docker-startup.plist
```

## Troubleshooting

### Docker not starting

```bash
# Check if Docker Desktop is running
docker info

# Start Docker Desktop manually
open -a Docker
```

### Cloudflare tunnel not connecting

```bash
# Check cloudflared status
pgrep -x cloudflared

# View tunnel logs
tail -50 /tmp/cloudflared.log

# Restart tunnel
launchctl kickstart -k gui/$(id -u)/com.cloudflare.cloudflared
```

### Container health check failing

```bash
# Check specific container
docker logs <container-name>

# Restart specific container
docker restart <container-name>

# Check database connectivity
docker exec mana-postgres pg_isready -U postgres
```

### Services not starting on boot

```bash
# Re-run setup
./scripts/mac-mini/setup-autostart.sh

# Check launchd errors
launchctl error <exit-code>

# Verify plist files
plutil ~/Library/LaunchAgents/com.mana.*.plist
```

## Push Notifications (Optional)

To receive notifications when health checks fail:

1. Create a topic at [ntfy.sh](https://ntfy.sh/)
2. Add to your shell profile:
   ```bash
   export NTFY_TOPIC=your-topic-name
   ```
3. Subscribe on your phone using the ntfy app

## URLs

Once running, services are available at:

| Service | URL |
|---------|-----|
| Unified App | https://mana.how |
| Auth API | https://auth.mana.how |
| API Gateway | https://api.mana.how |
| Forgejo (Git) | https://git.mana.how |
| Grafana | https://grafana.mana.how |
| Status Page | https://status.mana.how |
| GlitchTip | https://glitchtip.mana.how |
| Umami | https://stats.mana.how |
| SSH | ssh mac-mini (via cloudflared) |

## Native Services (non-Docker)

### Ollama (LLM)

Ollama runs natively on Mac Mini for LLM inference:

```bash
# Check status
curl http://localhost:11434/api/tags

# List models
ollama list

# Pull a model
ollama pull gemma3:4b
```

### AI Services (STT, TTS, LLM, Image-Gen, Video-Gen)

These have moved off the Mac Mini entirely. They run on the Windows GPU
server (`mana-server-gpu`) as Windows Scheduled Tasks. See
[`docs/WINDOWS_GPU_SERVER_SETUP.md`](../../docs/WINDOWS_GPU_SERVER_SETUP.md)
for setup, and the per-service `services/mana-{stt,tts,llm,image-gen,video-gen}/CLAUDE.md`
files for endpoint details.

Public URLs (proxied via Cloudflare Tunnel + the Mac Mini gpu-proxy):

- `https://gpu-stt.mana.how`
- `https://gpu-tts.mana.how`
- `https://gpu-llm.mana.how`
- `https://gpu-img.mana.how`
- `https://gpu-video.mana.how`
