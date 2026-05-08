#!/bin/bash
# Setup Cloudflared as a launchd service on macOS
# Run this script once on the Mac Mini to enable auto-start

set -e

TUNNEL_ID="bb0ea86d-8253-4a54-838b-107bb7945be9"
CONFIG_FILE="$HOME/projects/managarten/cloudflared-config.yml"
CREDENTIALS_FILE="$HOME/.cloudflared/${TUNNEL_ID}.json"
PLIST_FILE="$HOME/Library/LaunchAgents/com.cloudflare.cloudflared.plist"

echo "=== Cloudflared Service Setup ==="
echo ""

# Check if credentials exist
if [ ! -f "$CREDENTIALS_FILE" ]; then
    echo "Error: Credentials file not found: $CREDENTIALS_FILE"
    echo "Run 'cloudflared tunnel login' first"
    exit 1
fi

# Check if config exists
if [ ! -f "$CONFIG_FILE" ]; then
    echo "Error: Config file not found: $CONFIG_FILE"
    exit 1
fi

# Create LaunchAgents directory if needed
mkdir -p ~/Library/LaunchAgents

# Create the plist file
cat > "$PLIST_FILE" << EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>Label</key>
    <string>com.cloudflare.cloudflared</string>
    <key>ProgramArguments</key>
    <array>
        <string>/opt/homebrew/bin/cloudflared</string>
        <string>tunnel</string>
        <string>--config</string>
        <string>${CONFIG_FILE}</string>
        <string>run</string>
    </array>
    <key>RunAtLoad</key>
    <true/>
    <key>KeepAlive</key>
    <true/>
    <key>StandardOutPath</key>
    <string>/tmp/cloudflared.log</string>
    <key>StandardErrorPath</key>
    <string>/tmp/cloudflared.error.log</string>
</dict>
</plist>
EOF

echo "Created plist: $PLIST_FILE"

# Unload if already loaded
launchctl unload "$PLIST_FILE" 2>/dev/null || true

# Load the service
launchctl load "$PLIST_FILE"

echo ""
echo "=== Service Status ==="
launchctl list | grep cloudflared || echo "Service loaded"

echo ""
echo "Cloudflared is now running as a service."
echo ""
echo "Useful commands:"
echo "  Check status:  launchctl list | grep cloudflared"
echo "  View logs:     tail -f /tmp/cloudflared.log"
echo "  Stop service:  launchctl unload $PLIST_FILE"
echo "  Start service: launchctl load $PLIST_FILE"
echo ""
