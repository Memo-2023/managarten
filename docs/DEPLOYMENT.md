# Deployment Guide

## Overview

Production runs on a **Mac Mini** accessible via Cloudflare Tunnel at **mana.how**.

```
Push to main → CI builds Docker images → GHCR → Watchtower pulls & restarts
                     (automatic)                    (automatic, ~5 min)
```

**Watchtower** automatically checks for new Docker images every 5 minutes and updates running containers.

## Quick Reference

| Environment | Location | Domain |
|-------------|----------|--------|
| Local Dev | Your machine | localhost |
| Production | Mac Mini | mana.how |

## CI/CD Pipeline

### What happens automatically

1. **Push to main** triggers CI workflow
2. CI detects changed services
3. Docker images are built for changed services
4. Images are pushed to GitHub Container Registry (ghcr.io)

### What happens automatically (Watchtower)

Watchtower runs as a Docker container and:
1. Checks GHCR for new images every 5 minutes
2. Pulls updated images
3. Recreates containers with new images
4. Cleans up old images

No manual action needed for regular deployments.

## Manual Deployment (if needed)

For immediate deployment without waiting for Watchtower:

```bash
ssh mana-server "cd ~/projects/managarten && ./scripts/mac-mini/deploy.sh"
```

## Monitoring

```bash
# Check service status
ssh mana-server "./scripts/mac-mini/status.sh"

# View logs
ssh mana-server "docker logs -f mana-chat-backend"

# Health check
ssh mana-server "./scripts/mac-mini/health-check.sh"
```

## Services & URLs

| Service | URL | Container |
|---------|-----|-----------|
| Dashboard | https://mana.how | mana-web |
| Auth API | https://auth.mana.how | mana-auth |
| Chat | https://chat.mana.how | chat-web |
| Chat API | https://chat-api.mana.how | chat-backend |
| Todo | https://todo.mana.how | todo-web |
| Todo API | https://todo-api.mana.how | todo-backend |
| Calendar | https://calendar.mana.how | calendar-web |
| Calendar API | https://calendar-api.mana.how | calendar-backend |
| Clock | https://clock.mana.how | clock-web |
| Clock API | https://clock-api.mana.how | clock-backend |
| Contacts | https://contacts.mana.how | contacts-web |
| Contacts API | https://contacts-api.mana.how | contacts-backend |

## Rollback

```bash
ssh mana-server
cd ~/projects/managarten

# Rollback to specific image tag
docker compose -f docker-compose.macmini.yml pull <service>:<tag>
docker compose -f docker-compose.macmini.yml up -d <service>
```

## Detailed Documentation

- **[MAC_MINI_SERVER.md](MAC_MINI_SERVER.md)** - Complete server setup, autostart, health checks
- **[LOCAL_DEVELOPMENT.md](LOCAL_DEVELOPMENT.md)** - Local development setup
