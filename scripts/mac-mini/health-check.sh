#!/bin/bash
# Mana Health Check Script
# Checks all services and sends notifications on failure
#
# Notification channels (configure via environment or .env.notifications):
#   - Telegram: TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID
#   - Email: EMAIL_TO + EMAIL_FROM + SMTP_* settings
#   - ntfy: NTFY_TOPIC

# Ensure PATH includes docker
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

# Load notification config if exists
if [ -f "$PROJECT_ROOT/.env.notifications" ]; then
    source "$PROJECT_ROOT/.env.notifications"
fi

# Colors for terminal output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Track failures
FAILURES=()

# ============================================
# Notification Functions
# ============================================

send_telegram() {
    local message="$1"

    if [ -z "$TELEGRAM_BOT_TOKEN" ] || [ -z "$TELEGRAM_CHAT_ID" ]; then
        return 0
    fi

    curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
        -d "chat_id=${TELEGRAM_CHAT_ID}" \
        -d "text=${message}" \
        -d "parse_mode=HTML" \
        >/dev/null 2>&1

    if [ $? -eq 0 ]; then
        echo "  [Telegram] Notification sent"
    else
        echo "  [Telegram] Failed to send"
    fi
}

send_email() {
    local subject="$1"
    local body="$2"

    if [ -z "$EMAIL_TO" ]; then
        return 0
    fi

    # Use msmtp if available, otherwise try mail command
    if command -v msmtp &> /dev/null; then
        echo -e "Subject: ${subject}\nFrom: ${EMAIL_FROM:-mana@localhost}\nTo: ${EMAIL_TO}\n\n${body}" | \
            msmtp -a default "$EMAIL_TO" 2>/dev/null
    elif command -v mail &> /dev/null; then
        echo "$body" | mail -s "$subject" "$EMAIL_TO" 2>/dev/null
    elif command -v sendmail &> /dev/null; then
        echo -e "Subject: ${subject}\nFrom: ${EMAIL_FROM:-mana@localhost}\nTo: ${EMAIL_TO}\n\n${body}" | \
            sendmail "$EMAIL_TO" 2>/dev/null
    else
        echo "  [Email] No mail client available (install msmtp)"
        return 1
    fi

    if [ $? -eq 0 ]; then
        echo "  [Email] Notification sent to $EMAIL_TO"
    else
        echo "  [Email] Failed to send"
    fi
}

send_ntfy() {
    local message="$1"

    if [ -z "$NTFY_TOPIC" ]; then
        return 0
    fi

    curl -s -d "$message" \
        -H "Title: Mac Mini Alert" \
        -H "Priority: high" \
        -H "Tags: warning" \
        "https://ntfy.sh/$NTFY_TOPIC" >/dev/null 2>&1

    if [ $? -eq 0 ]; then
        echo "  [ntfy] Notification sent"
    else
        echo "  [ntfy] Failed to send"
    fi
}

send_all_notifications() {
    local failed_services="$1"
    local timestamp=$(date '+%Y-%m-%d %H:%M:%S')

    # Telegram message (HTML format)
    local telegram_msg="🚨 <b>Mana Health Check Failed</b>

<b>Time:</b> ${timestamp}
<b>Host:</b> $(hostname)

<b>Failed Services:</b>
${failed_services}

Check logs: <code>ssh mac-mini</code>"

    # Email message
    local email_subject="[ALERT] Mana Health Check Failed"
    local email_body="Mana Health Check Failed
=============================

Time: ${timestamp}
Host: $(hostname)

Failed Services:
${failed_services}

To investigate:
  ssh mac-mini
  cd ~/projects/managarten
  ./scripts/mac-mini/status.sh
  docker logs <container-name>"

    # Plain text for ntfy
    local ntfy_msg="Mana Failed: ${failed_services}"

    echo ""
    echo "Sending notifications..."
    send_telegram "$telegram_msg"
    send_email "$email_subject" "$email_body"
    send_ntfy "$ntfy_msg"
}

# ============================================
# Health Check Functions
# ============================================

check_service() {
    local name=$1
    local url=$2
    local timeout=${3:-5}

    local status=$(curl -s -o /dev/null -w "%{http_code}" --max-time "$timeout" "$url" 2>/dev/null)

    if [ "$status" = "200" ]; then
        echo -e "  ${GREEN}[OK]${NC} $name"
        return 0
    else
        echo -e "  ${RED}[FAIL]${NC} $name (HTTP $status)"
        FAILURES+=("$name")
        return 1
    fi
}

# ============================================
# Main Health Check
# ============================================

echo ""
echo "=== Mana Health Check ==="
echo "Time: $(date)"
echo ""

echo "Infrastructure:"
# Check postgres via docker
if docker exec mana-infra-postgres pg_isready -U postgres >/dev/null 2>&1; then
    echo -e "  ${GREEN}[OK]${NC} PostgreSQL"
else
    echo -e "  ${RED}[FAIL]${NC} PostgreSQL"
    FAILURES+=("PostgreSQL")
fi

# Check redis via docker
if docker exec mana-infra-redis redis-cli ping >/dev/null 2>&1; then
    echo -e "  ${GREEN}[OK]${NC} Redis"
else
    echo -e "  ${RED}[FAIL]${NC} Redis"
    FAILURES+=("Redis")
fi

# Check for stuck containers (Created/Exited status). The only exclusion
# is *-init containers, which are one-shot init pods by design — Exit 0
# is success and the container intentionally never re-runs.
STUCK_CONTAINERS=$(docker ps -a --filter "status=created" --filter "status=exited" --format "{{.Names}}" \
    | grep "^mana-" \
    | grep -vE -- "-init$" \
    || true)
if [ -n "$STUCK_CONTAINERS" ]; then
    echo -e "  ${RED}[FAIL]${NC} Stuck containers detected:"
    echo "$STUCK_CONTAINERS" | while read c; do echo "         - $c"; done
    FAILURES+=("Stuck containers: $(echo $STUCK_CONTAINERS | tr '\n' ' ')")
fi

echo ""
echo "Local services (auth + unified web):"
check_service "Auth API"      "http://localhost:3001/health"
check_service "Unified Web"   "http://localhost:5000/health"

# ────────────────────────────────────────────────────────────
# Public hostnames via Cloudflare Tunnel
# ────────────────────────────────────────────────────────────
# Walk every `hostname:` entry in cloudflared's ingress config and
# probe the live public URL. This catches the failure modes that the
# old port-by-port probes missed:
#
#   - Tunnel ingress points at a port that no container listens on (502)
#   - DNS CNAME for a tunnel hostname is missing (530 / NXDOMAIN)
#   - Cloudflared is misrouted or stale on a different config
#   - The container is healthy on LAN but unreachable from the public side
#
# A 200/204/301/302/308 from the public hostname is OK; anything else
# (including 404/502/530/timeout) is reported as a failure.
#
# Hostnames matching the patterns in TUNNEL_INGRESS_SKIP are excluded
# (typically internal-only routes or things we know don't expose
# /health, like raw IMAP / SSH ingress).

CLOUDFLARED_CONFIG="${HOME}/.cloudflared/config.yml"
TUNNEL_INGRESS_SKIP_REGEX='^(ssh|smtp|imap|pop3)\.'

check_public_hostname() {
    local host=$1
    local timeout=${2:-8}

    # Resolve via Cloudflare's public DNS (1.1.1.1) instead of the local
    # resolver. The Mac Mini's home-router DNS keeps a negative cache
    # for hostnames that didn't exist when first queried — newly added
    # CNAMEs like the 2026-04-07 sync/media records take hours to clear
    # there, even though they resolve fine for external users. Asking
    # 1.1.1.1 directly gives us the same view the public internet has.
    local ip
    ip=$(dig +short "$host" @1.1.1.1 2>/dev/null | head -1)
    if [ -z "$ip" ]; then
        echo -e "  ${RED}[FAIL]${NC} ${host} (no DNS record on Cloudflare zone)"
        FAILURES+=("${host} (no DNS)")
        return 1
    fi

    # Try /health, accept anything <500. We use --resolve to bypass any
    # local DNS cache and pin the lookup to the IP we just got back.
    local status
    status=$(curl -sk -o /dev/null -w "%{http_code}" --max-time "$timeout" \
        --resolve "${host}:443:${ip}" \
        "https://${host}/health" 2>/dev/null)
    if [ -z "$status" ] || [ "$status" = "000" ]; then
        echo -e "  ${RED}[FAIL]${NC} ${host} (no response — tunnel timeout?)"
        FAILURES+=("${host} (no response)")
        return 1
    fi
    case "$status" in
        2*|3*|404)
            # 404 is OK for hostnames whose backend has no /health route
            # but the tunnel + DNS are working.
            echo -e "  ${GREEN}[OK]${NC} ${host} (HTTP ${status})"
            return 0
            ;;
        5*)
            echo -e "  ${RED}[FAIL]${NC} ${host} (HTTP ${status} — origin / tunnel)"
            FAILURES+=("${host} (HTTP ${status})")
            return 1
            ;;
        *)
            echo -e "  ${YELLOW}[WARN]${NC} ${host} (HTTP ${status})"
            return 0
            ;;
    esac
}

if [ -f "$CLOUDFLARED_CONFIG" ]; then
    echo ""
    echo "Public hostnames (Cloudflare Tunnel ingress):"
    HOSTNAMES=$(awk '/^[[:space:]]*-[[:space:]]*hostname:/{print $3}' "$CLOUDFLARED_CONFIG" \
        | grep -vE "$TUNNEL_INGRESS_SKIP_REGEX" \
        | sort -u)
    for host in $HOSTNAMES; do
        check_public_hostname "$host"
    done
else
    echo ""
    echo -e "  ${YELLOW}[SKIP]${NC} cloudflared config not found at $CLOUDFLARED_CONFIG"
fi

echo ""
echo "GPU Server (192.168.178.11, LAN-only probe):"
# Direct LAN check — catches GPU box being down even when the public
# tunnel hostnames in the ingress walk above happen to time out or
# return cached errors.
check_service "GPU Ollama" "http://192.168.178.11:11434/api/version" 3
check_service "GPU STT" "http://192.168.178.11:3020/health" 3
check_service "GPU TTS" "http://192.168.178.11:3022/health" 3
check_service "GPU Image Gen" "http://192.168.178.11:3023/health" 3
# GPU Video Gen (LTX) is intentionally not probed — it's planned but
# not deployed yet, so its absence is expected and shouldn't page.

echo ""
echo "Monitoring (LAN, not exposed via tunnel):"
check_service "VictoriaMetrics" "http://localhost:9090/health"

echo ""
echo "Alerting:"
check_service "vmalert" "http://localhost:8880/health"
check_service "Alertmanager" "http://localhost:9093/-/healthy"
check_service "Alert Notifier" "http://localhost:9095/health"

echo ""
echo "Disk Space:"
check_disk() {
    local name=$1
    local path=$2
    local warn_pct=${3:-80}
    local crit_pct=${4:-90}

    if [ ! -d "$path" ]; then
        echo -e "  ${YELLOW}[SKIP]${NC} $name ($path not found)"
        return 0
    fi

    local usage_pct=$(df "$path" | tail -1 | awk '{gsub(/%/,""); print $5}')
    local avail=$(df -h "$path" | tail -1 | awk '{print $4}')

    if [ "$usage_pct" -ge "$crit_pct" ]; then
        echo -e "  ${RED}[CRIT]${NC} $name: ${usage_pct}% used ($avail free)"
        FAILURES+=("Disk $name: ${usage_pct}% (critical)")
    elif [ "$usage_pct" -ge "$warn_pct" ]; then
        echo -e "  ${YELLOW}[WARN]${NC} $name: ${usage_pct}% used ($avail free)"
        FAILURES+=("Disk $name: ${usage_pct}% (warning)")
    else
        echo -e "  ${GREEN}[OK]${NC} $name: ${usage_pct}% used ($avail free)"
    fi
}

check_disk "System (/)" "/"
check_disk "ManaData" "/Volumes/ManaData"

echo ""
echo "Cloudflare Tunnel:"
if pgrep -x "cloudflared" >/dev/null; then
    echo -e "  ${GREEN}[OK]${NC} cloudflared running"
else
    echo -e "  ${RED}[FAIL]${NC} cloudflared not running"
    FAILURES+=("cloudflared")
fi

echo ""
echo "=== Summary ==="

if [ ${#FAILURES[@]} -eq 0 ]; then
    echo -e "${GREEN}All services healthy!${NC}"
    exit 0
else
    echo -e "${RED}Failed services (${#FAILURES[@]}):${NC}"
    FAILED_LIST=""
    for f in "${FAILURES[@]}"; do
        echo "  - $f"
        FAILED_LIST="${FAILED_LIST}- ${f}\n"
    done

    # Send notifications
    send_all_notifications "$(echo -e "$FAILED_LIST")"

    exit 1
fi
