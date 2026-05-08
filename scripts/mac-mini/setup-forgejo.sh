#!/bin/bash
# Setup Forgejo on Mac Mini
# Run once after first deployment
set -e

DOCKER="${DOCKER_CMD:-/usr/local/bin/docker}"
COMPOSE="$DOCKER compose -f docker-compose.macmini.yml"

echo "=== 1. Create Forgejo database ==="
$DOCKER exec mana-infra-postgres psql -U postgres -c "CREATE DATABASE forgejo;" 2>/dev/null || echo "Database already exists"

echo ""
echo "=== 2. Create data directories ==="
sudo mkdir -p /Volumes/ManaData/forgejo /Volumes/ManaData/forgejo-runner
sudo chown -R 1000:1000 /Volumes/ManaData/forgejo

echo ""
echo "=== 3. Start Forgejo ==="
$COMPOSE up -d forgejo
echo "Waiting for Forgejo to start..."
sleep 15

echo ""
echo "=== 4. Check Forgejo health ==="
curl -s http://localhost:3041/api/v1/version | python3 -m json.tool

echo ""
echo "=== 5. Create admin user ==="
echo "Run this command to create the admin user:"
echo ""
echo "  $DOCKER exec mana-core-forgejo forgejo admin user create \\"
echo "    --admin --username till --password '<PASSWORD>' \\"
echo "    --email till@mana.how"
echo ""

echo "=== 6. Register Forgejo Runner ==="
echo "After creating the admin user, get a runner token from:"
echo "  https://git.mana.how/-/admin/runners"
echo ""
echo "Then register the runner:"
echo ""
echo "  $DOCKER exec mana-core-forgejo-runner forgejo-runner register \\"
echo "    --instance https://git.mana.how \\"
echo "    --token <RUNNER_TOKEN> \\"
echo "    --name mac-mini \\"
echo "    --labels ubuntu-latest:docker://node:20,go:docker://golang:1.25-alpine"
echo ""
echo "  $COMPOSE restart forgejo-runner"
echo ""

echo "=== 7. Mirror GitHub repo ==="
echo "After login, create a new migration at:"
echo "  https://git.mana.how/repo/migrate"
echo "  - Clone Address: https://github.com/Memo-2023/managarten.git"
echo "  - Mirror: Yes"
echo "  - Repository Name: managarten"
echo ""

echo "=== Setup complete ==="
echo "Forgejo: https://git.mana.how"
echo "Registration: disabled (admin-only)"
echo "SSH: port 2222"
