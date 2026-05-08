#!/bin/bash
#
# Rebuild the Mac Mini Cloudflare tunnel as a locally-managed tunnel.
#
# WHY:
#   The original `mana-server` tunnel was created via the Cloudflare
#   dashboard, which makes it remotely-managed: cloudflared loads its
#   ingress rules from Cloudflare's API and ignores the local config
#   file's `ingress:` section. There is no documented way to convert
#   a remotely-managed tunnel to locally-managed (cloudflared#843
#   has been open for years), so the only path to single-source-of-
#   truth file management is to delete and recreate the tunnel.
#
# WHAT THIS DOES (in order):
#   1. Snapshot baseline HTTP statuses for every hostname currently
#      in cloudflared-config.yml — for an after/before diff at the end
#   2. Backup the existing credentials .json (cannot be restored after
#      delete since the cloud config also goes away, but useful for
#      cross-referencing the old tunnel ID)
#   3. Delete the existing tunnel via `cloudflared tunnel delete -f`
#   4. Create a new tunnel with the same name `mana-server`. Cloudflare
#      generates a new UUID and writes a new credentials .json
#   5. Patch the new tunnel ID + credentials path into both
#      ~/projects/managarten/cloudflared-config.yml AND
#      ~/.cloudflared/config.yml
#   6. For each hostname in the config file, run
#      `cloudflared tunnel route dns -f mana-server <hostname>` so the
#      Cloudflare DNS CNAME for the hostname re-points at the new tunnel
#   7. launchctl kickstart -k cloudflared to pick up the new credentials
#   8. Wait for the tunnel to register, then HTTP-probe every hostname
#      and report any that didn't come back up
#
# DOWNTIME:
#   ~30-90 seconds total. Step 3 (delete) immediately blackholes ALL
#   public mana.how URLs. Steps 4-6 take ~30-60s. Step 7 brings the
#   tunnel back up. After that DNS edge propagation may add another
#   10-30s for some Cloudflare PoPs.
#
# ROLLBACK:
#   The old tunnel is gone forever after step 3. There is no rollback
#   to the old tunnel ID. If something breaks during this script, the
#   recovery path is to re-run this same script (it's idempotent for
#   already-routed hostnames thanks to the -f flag on the dns command).
#
# RUN ON: the mana-server itself, NOT from a dev box. The cloudflared
# CLI needs the cert.pem from `cloudflared tunnel login` which lives in
# ~/.cloudflared/ on the server.

set -euo pipefail

# ─── Configuration ─────────────────────────────────────────

CLOUDFLARED=/opt/homebrew/bin/cloudflared
TUNNEL_NAME="mana-server"
REPO_CONFIG="$HOME/projects/managarten/cloudflared-config.yml"
CLOUDFLARED_DIR="$HOME/.cloudflared"
LOCAL_CONFIG="$CLOUDFLARED_DIR/config.yml"
PLIST_FILE="$HOME/Library/LaunchAgents/com.cloudflare.cloudflared.plist"
TIMESTAMP=$(date +%s)
BACKUP_DIR="$CLOUDFLARED_DIR/rebuild-backup-$TIMESTAMP"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log() { echo -e "${GREEN}[$(date +%H:%M:%S)]${NC} $*"; }
warn() { echo -e "${YELLOW}[$(date +%H:%M:%S)] WARN${NC} $*"; }
err() { echo -e "${RED}[$(date +%H:%M:%S)] ERROR${NC} $*"; }

# ─── HTTP probe helpers ────────────────────────────────────
#
# A naive `curl /` check produces tons of false positives because
# many backend services don't have a root handler — mana-credits,
# mana-llm, media etc. all return 404 at `/` but are perfectly
# healthy at `/health`. The grafana installation has `/api/health`
# instead of `/health`. Forgejo (git) has neither and serves the
# repo browser at root.
#
# `probe_host` tries `/health` first — that's the convention for
# every Mana service that has one — and falls back to `/` if /health
# returns a 4xx. The combined "best" status is returned.
#
# `probe_is_down` decides what counts as a real failure: only 5xx
# Cloudflare/origin errors and the libcurl 000 (couldn't connect /
# DNS error / timeout) count as down. Anything in the 1xx-4xx range
# means the request reached the origin and got a structured reply,
# which is what we care about for "the tunnel is routing correctly".
#
# `probe_label` formats a one-word health summary for the verify log
# so the output reads "200 ok" / "401 auth" / "404 routed" / etc.
probe_host() {
    local host=$1
    local code
    code=$(curl -s -o /dev/null -m 6 -w "%{http_code}" "https://$host/health" 2>/dev/null || echo "000")
    if [ "$code" -ge 400 ] 2>/dev/null && [ "$code" -lt 500 ]; then
        # /health returned 4xx — probably no /health handler. Fall back to /
        local code_root
        code_root=$(curl -s -o /dev/null -m 6 -w "%{http_code}" "https://$host" 2>/dev/null || echo "000")
        # Prefer the root probe if it returned a 2xx/3xx (real success)
        case "$code_root" in
            2*|3*) code=$code_root ;;
        esac
    fi
    echo "$code"
}

probe_is_down() {
    local code=$1
    case "$code" in
        000|5*) return 0 ;;   # 000 = curl error, 5xx = server/tunnel error
        *) return 1 ;;        # everything else = reached the origin
    esac
}

probe_label() {
    local code=$1
    case "$code" in
        200|204) echo "ok" ;;
        301|302|307|308) echo "redirect (auth gate)" ;;
        401) echo "auth required" ;;
        403) echo "forbidden" ;;
        404) echo "routed (no handler)" ;;
        4*) echo "client error" ;;
        502) echo "bad gateway (origin down)" ;;
        503) echo "unavailable" ;;
        530) echo "tunnel error" ;;
        5*) echo "server error" ;;
        000) echo "unreachable" ;;
        *) echo "?" ;;
    esac
}

# ─── Apex DNS via Cloudflare API ───────────────────────────
#
# `cloudflared tunnel route dns` cannot route the apex of a zone
# (e.g. `mana.how`) because Cloudflare requires the apex to be a
# CNAME and refuses to create one when A/AAAA records already exist
# (error code 1003). The CLI has no command to delete those records.
#
# Workaround: if $CLOUDFLARE_API_TOKEN is set, this function uses the
# Cloudflare REST API to:
#   1. Resolve the zone id by name
#   2. Find any existing A / AAAA / CNAME records for the hostname
#   3. Delete them
#   4. Create a fresh proxied CNAME pointing at the tunnel's
#      `<id>.cfargotunnel.com` target
#
# The token needs `Zone:DNS:Edit` permission for the target zone.
# Cloudflare's CNAME flattening at the apex makes this work
# transparently — the apex resolves to Cloudflare anycast IPs as
# usual, but is internally a CNAME that follows the tunnel.
#
# Returns 0 on success, 1 if no token / non-apex / API error.
apex_route_via_api() {
    local hostname=$1
    local tunnel_id=$2

    # Apex check: exactly one dot in the hostname (e.g. mana.how, not
    # chat.mana.how). cloudflared handles non-apex hostnames fine via
    # `tunnel route dns` so we never need to call the API for those.
    local dot_count=$(echo "$hostname" | tr -cd '.' | wc -c | tr -d ' ')
    [ "$dot_count" = "1" ] || return 1

    [ -n "${CLOUDFLARE_API_TOKEN:-}" ] || return 1

    local api="https://api.cloudflare.com/client/v4"
    local auth="Authorization: Bearer $CLOUDFLARE_API_TOKEN"

    local zone_id
    zone_id=$(curl -sf -H "$auth" "$api/zones?name=$hostname" 2>/dev/null \
        | jq -r '.result[0].id // empty')
    [ -n "$zone_id" ] || { warn "  apex API: zone not found for $hostname"; return 1; }

    # Delete any existing A / AAAA / CNAME records on the apex
    local existing_ids
    existing_ids=$(curl -sf -H "$auth" "$api/zones/$zone_id/dns_records?name=$hostname" 2>/dev/null \
        | jq -r '.result[] | select(.type == "A" or .type == "AAAA" or .type == "CNAME") | .id')

    for rid in $existing_ids; do
        curl -sf -X DELETE -H "$auth" "$api/zones/$zone_id/dns_records/$rid" >/dev/null 2>&1 \
            || { warn "  apex API: delete of record $rid failed"; return 1; }
    done

    # Create a fresh proxied CNAME at the apex pointing at the tunnel
    local target="$tunnel_id.cfargotunnel.com"
    local resp
    resp=$(curl -sf -X POST -H "$auth" -H "Content-Type: application/json" \
        "$api/zones/$zone_id/dns_records" \
        -d "{\"type\":\"CNAME\",\"name\":\"$hostname\",\"content\":\"$target\",\"proxied\":true,\"ttl\":1}" 2>/dev/null)
    [ -n "$resp" ] || { warn "  apex API: create CNAME failed"; return 1; }
    return 0
}

# ─── Pre-flight checks ─────────────────────────────────────

[ -x "$CLOUDFLARED" ] || { err "$CLOUDFLARED not found or not executable"; exit 1; }
[ -f "$REPO_CONFIG" ] || { err "$REPO_CONFIG not found — pull repo first"; exit 1; }
[ -f "$CLOUDFLARED_DIR/cert.pem" ] || { err "$CLOUDFLARED_DIR/cert.pem missing — run 'cloudflared tunnel login' first"; exit 1; }
command -v jq >/dev/null || { err "jq is required"; exit 1; }

OLD_TUNNEL_ID=$($CLOUDFLARED tunnel list -o json 2>/dev/null | jq -r ".[] | select(.name==\"$TUNNEL_NAME\") | .id")
if [ -z "$OLD_TUNNEL_ID" ]; then
    err "No tunnel named '$TUNNEL_NAME' found. Aborting."
    exit 1
fi

log "Old tunnel ID: $OLD_TUNNEL_ID"

# Extract hostname list from the repo config
HOSTNAMES=$(grep -E "^\s+- hostname:" "$REPO_CONFIG" | awk '{print $3}')
HOSTNAME_COUNT=$(echo "$HOSTNAMES" | wc -l | tr -d ' ')
log "Repo config has $HOSTNAME_COUNT hostnames"

# ─── Confirmation ──────────────────────────────────────────

if [ "${1:-}" != "--yes" ]; then
    echo ""
    warn "This will:"
    warn "  - DELETE the existing tunnel '$TUNNEL_NAME' (ID: $OLD_TUNNEL_ID)"
    warn "  - Take ALL $HOSTNAME_COUNT public mana.how URLs offline for ~30-90s"
    warn "  - Recreate the tunnel as locally-managed"
    warn "  - Re-route every hostname's DNS CNAME at the new tunnel"
    echo ""
    read -r -p "Type 'rebuild' to proceed: " CONFIRM
    if [ "$CONFIRM" != "rebuild" ]; then
        log "Aborted by user."
        exit 0
    fi
fi

mkdir -p "$BACKUP_DIR"
log "Backups will be written to $BACKUP_DIR"

# ─── Step 1: Baseline HTTP probe ───────────────────────────

log "Step 1/8: Probing baseline HTTP statuses for all hostnames..."
BASELINE_FILE="$BACKUP_DIR/baseline-http-statuses.txt"
: > "$BASELINE_FILE"
for host in $HOSTNAMES; do
    [ "$host" = "ssh.mana.how" ] && continue   # SSH-only, no HTTP
    code=$(probe_host "$host")
    printf "%-35s %s\n" "$host" "$code" | tee -a "$BASELINE_FILE"
done

# ─── Step 2: Backup credentials ────────────────────────────

log "Step 2/8: Backing up existing credentials and config files..."
cp "$CLOUDFLARED_DIR/$OLD_TUNNEL_ID.json" "$BACKUP_DIR/old-credentials.json"
cp "$LOCAL_CONFIG" "$BACKUP_DIR/old-local-config.yml" 2>/dev/null || true
cp "$REPO_CONFIG" "$BACKUP_DIR/old-repo-config.yml"
log "  ✓ backed up credentials + configs"

# ─── Step 3: Delete the old tunnel ─────────────────────────

log "Step 3/8: Deleting old tunnel (force, all connections drop now)..."
$CLOUDFLARED tunnel delete -f "$TUNNEL_NAME"
log "  ✓ tunnel $OLD_TUNNEL_ID deleted"

# ─── Step 4: Create new tunnel ─────────────────────────────

log "Step 4/8: Creating new tunnel '$TUNNEL_NAME'..."
CREATE_OUT=$($CLOUDFLARED tunnel create "$TUNNEL_NAME" 2>&1)
echo "$CREATE_OUT"
NEW_TUNNEL_ID=$(echo "$CREATE_OUT" | grep -oE "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}" | head -1)
if [ -z "$NEW_TUNNEL_ID" ]; then
    NEW_TUNNEL_ID=$($CLOUDFLARED tunnel list -o json | jq -r ".[] | select(.name==\"$TUNNEL_NAME\") | .id")
fi
[ -n "$NEW_TUNNEL_ID" ] || { err "could not determine new tunnel ID"; exit 1; }
log "  ✓ new tunnel ID: $NEW_TUNNEL_ID"

NEW_CREDS="$CLOUDFLARED_DIR/$NEW_TUNNEL_ID.json"
[ -f "$NEW_CREDS" ] || { err "expected credentials file $NEW_CREDS not found"; exit 1; }

# ─── Step 5: Patch config files with the new tunnel id ────

log "Step 5/8: Patching cloudflared-config.yml with the new tunnel ID..."
sed -i.bak "s|$OLD_TUNNEL_ID|$NEW_TUNNEL_ID|g" "$REPO_CONFIG"
rm -f "$REPO_CONFIG.bak"

# Mirror to ~/.cloudflared/config.yml as a defensive copy so anything
# that defaults to that path also sees the new tunnel id.
cp "$REPO_CONFIG" "$LOCAL_CONFIG"
log "  ✓ both config files now reference $NEW_TUNNEL_ID"

# Validate the new config syntactically before continuing
$CLOUDFLARED tunnel --config "$REPO_CONFIG" ingress validate
log "  ✓ ingress validate passed"

# ─── Step 6: DNS routes ────────────────────────────────────

log "Step 6/8: Routing $HOSTNAME_COUNT hostnames at the new tunnel..."
if [ -z "${CLOUDFLARE_API_TOKEN:-}" ]; then
    warn "  CLOUDFLARE_API_TOKEN not set — apex domains (e.g. mana.how) cannot be auto-fixed"
    warn "  Set it before running the script for fully unattended apex routing."
fi
ROUTE_FAILS=0
for host in $HOSTNAMES; do
    [ "$host" = "ssh.mana.how" ] && continue   # cloudflared tunnel route dns is for HTTP/TCP, ssh is special
    if $CLOUDFLARED tunnel route dns -f "$TUNNEL_NAME" "$host" 2>/dev/null; then
        printf "  ✓ %s\n" "$host"
    elif apex_route_via_api "$host" "$NEW_TUNNEL_ID"; then
        printf "  ✓ %s (via Cloudflare API — apex)\n" "$host"
    else
        printf "  ✗ %s (route failed)\n" "$host"
        ROUTE_FAILS=$((ROUTE_FAILS + 1))
    fi
done

# ssh.mana.how is special — needs `cloudflared tunnel route` with the TCP variant.
# Try it but don't fail the whole script if it doesn't work; the user can re-add manually.
if $CLOUDFLARED tunnel route dns -f "$TUNNEL_NAME" "ssh.mana.how" 2>/dev/null; then
    log "  ✓ ssh.mana.how"
else
    warn "  ssh.mana.how DNS route failed — re-add manually if SSH-via-Cloudflare is needed"
fi

if [ "$ROUTE_FAILS" -gt 0 ]; then
    warn "$ROUTE_FAILS DNS routes failed. Continuing — they can be re-tried after the tunnel is up."
fi

# ─── Step 7: Restart cloudflared ───────────────────────────

log "Step 7/8: Restarting cloudflared via launchctl kickstart..."
launchctl kickstart -k "gui/$(id -u)/com.cloudflare.cloudflared"
log "  waiting 8s for tunnel to register..."
sleep 8

# ─── Step 8: Verification ──────────────────────────────────

log "Step 8/8: Verifying every hostname comes back up..."
VERIFY_FILE="$BACKUP_DIR/post-rebuild-http-statuses.txt"
: > "$VERIFY_FILE"
DOWN_COUNT=0
for host in $HOSTNAMES; do
    [ "$host" = "ssh.mana.how" ] && continue
    code=$(probe_host "$host")
    label=$(probe_label "$code")
    printf "%-35s %s  %s\n" "$host" "$code" "$label" | tee -a "$VERIFY_FILE"
    if probe_is_down "$code"; then
        DOWN_COUNT=$((DOWN_COUNT + 1))
    fi
done

echo ""
log "=== Summary ==="
log "Old tunnel:    $OLD_TUNNEL_ID (deleted)"
log "New tunnel:    $NEW_TUNNEL_ID (locally-managed)"
log "Backup dir:    $BACKUP_DIR"
log "Hostnames:     $HOSTNAME_COUNT"
log "DNS failures:  $ROUTE_FAILS"
if [ "$DOWN_COUNT" -gt 0 ]; then
    warn "Hosts still down (404/000): $DOWN_COUNT — see $VERIFY_FILE for details"
    warn "Compare with $BASELINE_FILE to identify regressions."
else
    log "All hosts responding ✓"
fi
echo ""
log "Next steps:"
log "  1. From your dev box: cd ~/projects/managarten && git diff cloudflared-config.yml"
log "     -> review the tunnel-id change, then commit + push"
log "  2. Smoke-test the apps in your browser"
