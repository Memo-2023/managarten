#!/bin/bash
#
# Sync the in-repo cloudflared-config.yml onto the Mac Mini and reload
# the tunnel. Run this whenever cloudflared-config.yml changes — it's
# the only step needed to make a new public hostname go live.
#
# Usage:
#   ./scripts/mac-mini/sync-tunnel-config.sh
#
# Requires:
#   - SSH access to the `mana-server` host (configured in ~/.ssh/config)
#   - The launchd plist on the server already started cloudflared with
#     `--config <repo-path>/cloudflared-config.yml run`. If not, run
#     ./scripts/mac-mini/setup-cloudflared-service.sh on the server
#     once first.
#
# Why a kickstart instead of unload+load: launchctl kickstart -k
# preserves the launchd state, doesn't race with KeepAlive, and
# returns when the new process is up. unload/load is the legacy form
# and tends to leave the agent in a stuck state on macOS 14+.

set -e

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
CONFIG_FILE="$REPO_ROOT/cloudflared-config.yml"
REMOTE_HOST="mana-server"
REMOTE_PATH='~/projects/managarten/cloudflared-config.yml'

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

if [ ! -f "$CONFIG_FILE" ]; then
    echo -e "${RED}Error:${NC} $CONFIG_FILE not found"
    exit 1
fi

echo -e "${GREEN}=== Syncing cloudflared-config.yml ===${NC}"
echo ""

# 1. Validate the YAML locally before pushing — cloudflared has a
#    `tunnel ingress validate` subcommand that catches duplicate
#    hostnames, malformed services, and missing tunnel-id. We rely on
#    the server's cloudflared install to do the actual validation
#    after the file lands so we don't need cloudflared on the dev box.

echo -e "${YELLOW}1. Pulling latest from origin (in case the local file is stale)...${NC}"
( cd "$REPO_ROOT" && git fetch --quiet origin main && git diff --quiet origin/main -- cloudflared-config.yml ) || \
    echo -e "${YELLOW}   warning: local cloudflared-config.yml differs from origin/main${NC}"

echo -e "${YELLOW}2. Ensuring repo on the server is up to date...${NC}"
ssh "$REMOTE_HOST" 'cd ~/projects/managarten && git pull --quiet'

echo -e "${YELLOW}3. Validating the config on the server...${NC}"
if ! ssh "$REMOTE_HOST" "/opt/homebrew/bin/cloudflared tunnel --config $REMOTE_PATH ingress validate"; then
    echo -e "${RED}Validation failed — aborting reload.${NC}"
    exit 1
fi

echo -e "${YELLOW}4. Reloading cloudflared via launchctl kickstart...${NC}"
ssh "$REMOTE_HOST" 'launchctl kickstart -k gui/$(id -u)/com.cloudflare.cloudflared'

echo -e "${YELLOW}5. Waiting for the tunnel to register...${NC}"
sleep 5

echo -e "${YELLOW}6. Sanity-checking the tunnel is back up...${NC}"
if curl -sf -o /dev/null https://mana.how; then
    echo -e "${GREEN}✓ https://mana.how is reachable${NC}"
else
    echo -e "${RED}✗ https://mana.how is NOT reachable — check 'tail -f /tmp/cloudflared.log' on the server${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✓ Tunnel config synced and reloaded.${NC}"
echo ""
echo "List currently-loaded routes:"
echo "  ssh $REMOTE_HOST 'grep INF /tmp/cloudflared.log | grep \"Updated to new configuration\" | tail -1'"
