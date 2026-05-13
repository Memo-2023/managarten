#!/bin/bash
# Mana Database Backup Script
# Creates daily backups of all PostgreSQL databases with rotation.
#
# Retention policy:
# - Daily backups: keep last 7 days
# - Weekly backups: keep last 4 weeks (Sundays)
#
# Covers ALL postgres-Container that match `*postgres*` (ohne exporter
# /backup). Pro Container werden alle Datenbanken (außer Templates +
# `postgres`) gedumpt. Dump-Datei-Pattern:
#   ${CONTAINER}_${DB}_${DATE}.sql.gz
# damit Cards-und-Manaspur-DBs mit gleichem Schema-Namen nicht
# überschreiben.
#
# Container-spezifischer DB-User: per-Container ENV-Override
#   BACKUP_USER_<CONTAINER_UPPER>=username (Default: postgres)
# z.B. BACKUP_USER_CARDS_POSTGRES=cards (Cards-Container heißt
# cards-postgres → cards-User).
#
# Run via LaunchD daily at 3 AM.

# NOTE: bewusst KEIN `set -e` global — wir wollen, dass ein Fehler
# in einem Container nicht den Rest abbricht. Failures werden via
# `FAILED_DBS` gesammelt und am Ende reported.

# Ensure PATH includes docker
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
BACKUP_DIR="/Volumes/ManaData/backups/postgres"
LOG_FILE="/tmp/mana-backup.log"
DATE=$(date +%Y-%m-%d)
DAY_OF_WEEK=$(date +%u)  # 1=Monday, 7=Sunday

# .env.macmini ist im DOTENV-Format (Werte enthalten Spaces, BEGIN/END-
# Marker etc.) — kann nicht via `source` in bash geladen werden. Wir
# brauchen aus diesem File auch nichts; Telegram-Tokens kommen aus
# .env.notifications separat.

log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

# Load notification config if exists
if [ -f "$PROJECT_ROOT/.env.notifications" ]; then
    source "$PROJECT_ROOT/.env.notifications"
fi

send_notification() {
    local message="$1"
    local priority="${2:-default}"

    if [ -n "$TELEGRAM_BOT_TOKEN" ] && [ -n "$TELEGRAM_CHAT_ID" ]; then
        curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
            -d "chat_id=${TELEGRAM_CHAT_ID}" \
            -d "text=${message}" \
            -d "parse_mode=HTML" \
            >/dev/null 2>&1 || true
    fi
}

# Default-DB-User pro Container. Greenfield-Apps (cards, manaspur,
# nutriphi, zitare) nutzen den App-eigenen User; mana-infra-postgres
# läuft als `postgres`-Superuser.
db_user_for_container() {
    case "$1" in
        cards-postgres)            echo "cards" ;;
        manaspur-postgres)         echo "manaspur" ;;
        nutriphi-postgres)         echo "nutriphi" ;;
        zitare-postgres)           echo "zitare" ;;
        chorportal-prod-postgres)  echo "chorportal" ;;
        mana-infra-postgres)       echo "postgres" ;;
        *)                         echo "postgres" ;;
    esac
}

# Create backup directories
mkdir -p "$BACKUP_DIR/daily"
mkdir -p "$BACKUP_DIR/weekly"

log "=== Mana Database Backup ==="

# Alle Postgres-Container finden (heuristic: name endet auf `postgres`
# oder enthält `-postgres`; ignoriere exporter/backup-Varianten).
CONTAINERS=$(docker ps --format '{{.Names}}' | grep -E 'postgres$|-postgres$' | grep -vE 'exporter|^mana-infra-postgres-backup$')

if [ -z "$CONTAINERS" ]; then
    log "ERROR: no postgres container found"
    send_notification "🚨 <b>Backup Failed</b>\n\nNo postgres container running" "high"
    exit 1
fi

log "Containers: $(echo $CONTAINERS | tr '\n' ' ')"

BACKUP_COUNT=0
BACKUP_SIZE=0
FAILED_DBS=""

for CONTAINER in $CONTAINERS; do
    USER=$(db_user_for_container "$CONTAINER")
    log "--- Container: $CONTAINER (user: $USER) ---"

    # DB-Liste in diesem Container
    if ! DB_LIST=$(docker exec "$CONTAINER" psql -U "$USER" -t -c "SELECT datname FROM pg_database WHERE datistemplate = false AND datname != 'postgres';" 2>/dev/null | tr -d ' ' | grep -v "^$"); then
        log "  FAILED to list databases in $CONTAINER (user $USER) — skipping"
        FAILED_DBS="$FAILED_DBS ${CONTAINER}:list"
        continue
    fi

    for DB in $DB_LIST; do
        BACKUP_FILE="$BACKUP_DIR/daily/${CONTAINER}_${DB}_${DATE}.sql.gz"
        if docker exec "$CONTAINER" pg_dump -U "$USER" "$DB" 2>/dev/null | gzip > "$BACKUP_FILE"; then
            SIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')
            log "  OK: ${CONTAINER}/${DB} ($SIZE)"
            BACKUP_COUNT=$((BACKUP_COUNT + 1))
            BACKUP_SIZE=$((BACKUP_SIZE + $(stat -f%z "$BACKUP_FILE" 2>/dev/null || stat -c%s "$BACKUP_FILE" 2>/dev/null)))
        else
            log "  FAILED: ${CONTAINER}/${DB}"
            FAILED_DBS="$FAILED_DBS ${CONTAINER}:${DB}"
            rm -f "$BACKUP_FILE"
        fi
    done
done

# On Sunday, create weekly backup (Sonntag = 7 in date +%u)
if [ "$DAY_OF_WEEK" -eq 7 ]; then
    log "Creating weekly backup (Sunday)..."
    WEEKLY_DIR="$BACKUP_DIR/weekly/$DATE"
    mkdir -p "$WEEKLY_DIR"
    # Alle daily-Dumps für heute kopieren (Pattern enthält jetzt CONTAINER
    # vorne, deshalb `*_${DATE}.sql.gz` greift weiterhin).
    cp "$BACKUP_DIR/daily/"*"_${DATE}.sql.gz" "$WEEKLY_DIR/" 2>/dev/null || true
    log "Weekly backup created in $WEEKLY_DIR"
fi

# Rotate daily backups (keep last 7 days)
log "Rotating daily backups (keeping 7 days)..."
find "$BACKUP_DIR/daily" -name "*.sql.gz" -mtime +7 -delete 2>/dev/null || true

# Rotate weekly backups (keep last 4 weeks)
log "Rotating weekly backups (keeping 4 weeks)..."
find "$BACKUP_DIR/weekly" -mindepth 1 -maxdepth 1 -type d -mtime +28 -exec rm -rf {} \; 2>/dev/null || true

# Calculate total backup size
TOTAL_SIZE=$(du -sh "$BACKUP_DIR" 2>/dev/null | awk '{print $1}')

log "=== Backup Summary ==="
log "Databases backed up: $BACKUP_COUNT"
log "Total backup size: $TOTAL_SIZE"

if [ -n "$FAILED_DBS" ]; then
    log "FAILED databases:$FAILED_DBS"
    send_notification "⚠️ <b>Backup Partially Failed</b>\n\nFailed:$FAILED_DBS\nSuccessful: $BACKUP_COUNT databases" "high"
    exit 1
else
    log "All backups successful!"
    # Only send notification on Sundays (weekly summary)
    if [ "$DAY_OF_WEEK" -eq 7 ]; then
        send_notification "💾 <b>Weekly Backup Complete</b>\n\n$BACKUP_COUNT databases backed up\nTotal size: $TOTAL_SIZE"
    fi
fi
