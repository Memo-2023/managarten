#!/bin/bash
# Mac Mini Server Setup Script
# Kopiere diese Datei auf den Mac Mini und führe aus:
# chmod +x mac-mini-setup.sh && ./mac-mini-setup.sh

echo "=== Mac Mini Server Setup ==="
echo ""

# 1. Cloudflare Tunnel installieren
echo "📦 Installiere cloudflared..."
brew install cloudflared

# 2. Git installieren (falls nicht vorhanden)
echo "📦 Installiere git..."
brew install git

# 3. Verzeichnis erstellen
echo "📁 Erstelle Projekt-Verzeichnis..."
mkdir -p ~/projects
cd ~/projects

# 4. Repository klonen
echo "📥 Klone Repository..."
git clone https://github.com/Memo-2023/managarten.git
cd managarten

echo ""
echo "✅ Basis-Setup abgeschlossen!"
echo ""
echo "=== NÄCHSTE SCHRITTE (manuell) ==="
echo ""
echo "1. Cloudflare Tunnel authentifizieren:"
echo "   cloudflared tunnel login"
echo ""
echo "2. Tunnel erstellen:"
echo "   cloudflared tunnel create mana-server"
echo ""
echo "3. Dann melde dich bei Till/Claude für die nächsten Schritte!"
echo ""
