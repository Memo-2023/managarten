#!/bin/bash
# Mana Mac Mini Status Overview
# Shows the current state of all services

# Ensure PATH includes docker
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
COMPOSE_FILE="$PROJECT_ROOT/docker-compose.macmini.yml"
ENV_FILE="$PROJECT_ROOT/.env.macmini"

# Colors
BOLD='\033[1m'
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo -e "${BOLD}=========================================="
echo -e "  Mana Mac Mini Status"
echo -e "==========================================${NC}"
echo ""
echo -e "${BLUE}Time:${NC} $(date)"
echo -e "${BLUE}Hostname:${NC} $(hostname)"
echo -e "${BLUE}Uptime:${NC} $(uptime | sed 's/.*up //' | sed 's/,.*//')"
echo ""

# ============================================
# LaunchD Services
# ============================================
echo -e "${BOLD}LaunchD Services:${NC}"

check_launchd() {
    local label=$1
    local name=$2
    if launchctl list | grep -q "$label"; then
        echo -e "  ${GREEN}[Running]${NC} $name"
    else
        echo -e "  ${RED}[Stopped]${NC} $name"
    fi
}

check_launchd "com.cloudflare.cloudflared" "Cloudflared Tunnel"
check_launchd "com.mana.docker-startup" "Docker Startup"
check_launchd "com.mana.health-check" "Health Check (5min)"

# ============================================
# Docker Status
# ============================================
echo ""
echo -e "${BOLD}Docker Status:${NC}"

if docker info >/dev/null 2>&1; then
    echo -e "  ${GREEN}[Running]${NC} Docker Desktop"

    # Container count
    RUNNING=$(docker ps -q | wc -l | tr -d ' ')
    TOTAL=$(docker ps -aq | wc -l | tr -d ' ')
    echo -e "  ${BLUE}Containers:${NC} $RUNNING running / $TOTAL total"

    # ────────────────────────────────────────
    # Compose vs Running diff
    # ────────────────────────────────────────
    # The "X running / Y total" line above only counts containers Docker
    # already knows about. Containers that are *defined* in the compose
    # file but were never started (e.g. after `docker compose down`, or
    # after a fresh checkout that hasn't run `up -d` yet) do not show up
    # at all — they look healthy when they are actually missing entirely.
    #
    # The 2026-04-07 outage was exactly this case: mana-core-sync and
    # mana-api-gateway were declared in compose, never started, and
    # status.sh reported "37/42 running" without flagging the gap.
    #
    # The diff below catches that: list every service in compose, list
    # every running container, and report any compose service whose
    # container_name is not currently up.
    if [ -f "$COMPOSE_FILE" ]; then
        DEFINED=$(docker compose -p "${COMPOSE_PROJECT_NAME:-managarten}" \
            -f "$COMPOSE_FILE" config --format json 2>/dev/null \
            | python3 -c '
import sys, json
try:
    cfg = json.load(sys.stdin)
    for name, svc in (cfg.get("services") or {}).items():
        cn = svc.get("container_name") or name
        print(f"{name}\t{cn}")
except Exception:
    pass
' 2>/dev/null)

        if [ -n "$DEFINED" ]; then
            RUNNING_NAMES=$(docker ps --format '{{.Names}}' | sort -u)
            MISSING=""
            while IFS=$'\t' read -r svc cn; do
                if ! echo "$RUNNING_NAMES" | grep -qx "$cn"; then
                    MISSING="${MISSING}    - ${svc} (${cn})\n"
                fi
            done <<< "$DEFINED"

            if [ -n "$MISSING" ]; then
                echo -e "  ${RED}[Missing compose services]${NC}"
                printf "$MISSING"
            else
                echo -e "  ${GREEN}[All compose services running]${NC}"
            fi
        fi
    fi
else
    echo -e "  ${RED}[Stopped]${NC} Docker Desktop"
fi

# ============================================
# Container Details
# ============================================
echo ""
echo -e "${BOLD}Containers:${NC}"

if docker info >/dev/null 2>&1; then
    # Format: NAME | STATUS | PORTS
    docker ps -a --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}" | while read line; do
        if echo "$line" | grep -q "Up"; then
            echo -e "  ${GREEN}$line${NC}"
        elif echo "$line" | grep -q "NAMES"; then
            echo -e "  ${BOLD}$line${NC}"
        else
            echo -e "  ${RED}$line${NC}"
        fi
    done
fi

# ============================================
# GPU Server (192.168.178.11)
# ============================================
echo ""
echo -e "${BOLD}GPU Server (192.168.178.11):${NC}"

check_gpu_service() {
    local name=$1
    local url=$2
    if curl -s --max-time 3 "$url" >/dev/null 2>&1; then
        echo -e "  ${GREEN}[Running]${NC} $name"
    else
        echo -e "  ${YELLOW}[Offline]${NC} $name"
    fi
}

check_gpu_service "Ollama (LLM)" "http://192.168.178.11:11434/api/version"
check_gpu_service "STT (Whisper)" "http://192.168.178.11:3020/health"
check_gpu_service "TTS" "http://192.168.178.11:3022/health"
check_gpu_service "Image Gen (FLUX)" "http://192.168.178.11:3023/health"
check_gpu_service "Video Gen (LTX)" "http://192.168.178.11:3026/health"

# ============================================
# Network/Tunnel Status
# ============================================
echo ""
echo -e "${BOLD}Network:${NC}"

if pgrep -x "cloudflared" >/dev/null; then
    echo -e "  ${GREEN}[Connected]${NC} Cloudflare Tunnel"

    # Check external connectivity
    if curl -s --max-time 3 https://mana.how >/dev/null 2>&1; then
        echo -e "  ${GREEN}[Reachable]${NC} https://mana.how"
    else
        echo -e "  ${YELLOW}[Unknown]${NC} https://mana.how (check from external)"
    fi
else
    echo -e "  ${RED}[Disconnected]${NC} Cloudflare Tunnel"
fi

# ============================================
# Disk Usage
# ============================================
echo ""
echo -e "${BOLD}Disk Usage:${NC}"
df -h / | tail -1 | awk '{print "  System: " $3 " used / " $2 " total (" $5 " full)"}'

if docker info >/dev/null 2>&1; then
    DOCKER_DISK=$(docker system df --format "{{.Size}}" 2>/dev/null | head -1)
    echo "  Docker: $DOCKER_DISK"
fi

# ============================================
# Recent Logs
# ============================================
echo ""
echo -e "${BOLD}Recent Activity:${NC}"
if [ -f /tmp/mana-health.log ]; then
    echo "  Last health check:"
    tail -3 /tmp/mana-health.log | sed 's/^/    /'
fi

echo ""
echo -e "${BLUE}Commands:${NC}"
echo "  Health check:  ./scripts/mac-mini/health-check.sh"
echo "  Restart all:   ./scripts/mac-mini/restart.sh"
echo "  View logs:     tail -f /tmp/mana-startup.log"
echo ""
