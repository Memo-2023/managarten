#!/bin/bash
# Move Colima VM datadisk from internal SSD to external ManaData SSD
#
# The Colima VM datadisk lives at ~/.colima/_lima/_disks/colima/datadisk
# and can grow to 200GB (sparse). Moving it to the 3.6TB external SSD
# prevents the internal SSD from filling up and crashing the server.
#
# Usage: bash scripts/mac-mini/move-colima-to-external-ssd.sh
# Run on the Mac Mini server, NOT via Claude Code.

set -e
export PATH="/usr/local/bin:/opt/homebrew/bin:$PATH"

COLIMA_DISK_SRC="/Users/mana/.colima/_lima/_disks/colima"
COLIMA_DISK_DST="/Volumes/ManaData/colima-disk"
LOG="/tmp/move-colima.log"

log() { echo "[$(date '+%H:%M:%S')] $1" | tee -a "$LOG"; }

# Pre-flight checks
if [ ! -d "/Volumes/ManaData" ]; then
    echo "ERROR: /Volumes/ManaData not mounted. Plug in the external SSD first."
    exit 1
fi

if [ -L "$COLIMA_DISK_SRC" ]; then
    echo "Colima disk is already a symlink — already moved. Current target:"
    readlink "$COLIMA_DISK_SRC"
    exit 0
fi

AVAIL_GB=$(df -g /Volumes/ManaData 2>/dev/null | awk 'NR==2 {print $4}')
DISK_GB=$(du -sg "$COLIMA_DISK_SRC" 2>/dev/null | awk '{print $1}')
log "Colima disk size: ~${DISK_GB}GB  |  ManaData free: ${AVAIL_GB}GB"

if [ "${DISK_GB:-0}" -ge "${AVAIL_GB:-0}" ]; then
    echo "ERROR: Not enough space on ManaData (need ${DISK_GB}GB, have ${AVAIL_GB}GB)"
    exit 1
fi

echo ""
echo "This will:"
echo "  1. Stop Colima (all Docker containers will stop)"
echo "  2. Copy ${COLIMA_DISK_SRC} → ${COLIMA_DISK_DST}"
echo "  3. Replace original with symlink"
echo "  4. Restart Colima"
echo "  5. Restart all Docker containers"
echo ""
echo "Estimated copy time: ~5-15 minutes depending on actual disk usage."
echo ""
read -p "Continue? (yes/no): " confirm
[ "$confirm" = "yes" ] || { echo "Aborted."; exit 0; }

# Step 1: Stop Colima
log "Step 1: Stopping Colima..."
colima stop 2>&1 | tee -a "$LOG"
log "Colima stopped."

# Step 2: Copy disk directory to external SSD
log "Step 2: Copying disk to /Volumes/ManaData/colima-disk ..."
mkdir -p "$COLIMA_DISK_DST"
# Use cp -c for APFS clone-copy (fast) or rsync as fallback
if cp -c -r "$COLIMA_DISK_SRC/." "$COLIMA_DISK_DST/" 2>/dev/null; then
    log "Copied via APFS clone (fast)."
else
    log "APFS clone not available (cross-volume), using rsync..."
    rsync -ah --progress "$COLIMA_DISK_SRC/" "$COLIMA_DISK_DST/" 2>&1 | tee -a "$LOG"
fi
log "Copy complete."

# Step 3: Replace with symlink
log "Step 3: Replacing original with symlink..."
mv "$COLIMA_DISK_SRC" "${COLIMA_DISK_SRC}.backup-$(date +%Y%m%d)"
ln -s "$COLIMA_DISK_DST" "$COLIMA_DISK_SRC"
log "Symlink created: $COLIMA_DISK_SRC → $COLIMA_DISK_DST"

# Step 4: Start Colima
log "Step 4: Starting Colima..."
colima start 2>&1 | tee -a "$LOG"
log "Colima started."

# Step 5: Wait for Docker, then start containers
log "Step 5: Starting Docker containers..."
for i in $(seq 1 12); do
    docker info >/dev/null 2>&1 && break
    log "Waiting for Docker... ($i/12)"
    sleep 5
done

cd ~/projects/managarten
docker compose -f docker-compose.macmini.yml up -d 2>&1 | tail -5 | tee -a "$LOG"
log "Containers started."

# Cleanup
log "Step 6: Verifying symlink..."
ls -lah "$COLIMA_DISK_SRC"
df -h /Volumes/ManaData | tail -1
df -h / | tail -1

echo ""
echo "Done. Old disk backed up at: ${COLIMA_DISK_SRC}.backup-$(date +%Y%m%d)"
echo "Once you've verified everything works, delete the backup:"
echo "  rm -rf ${COLIMA_DISK_SRC}.backup-*"
echo ""
echo "Log: $LOG"
