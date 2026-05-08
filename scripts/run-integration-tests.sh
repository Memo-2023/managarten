#!/usr/bin/env bash
#
# Run the auth-flow integration test against a fresh docker-compose.test.yml stack.
#
# Usage:
#   ./scripts/run-integration-tests.sh           # build, run, tear down
#   KEEP_STACK=1 ./scripts/run-integration-tests.sh  # leave stack up after run
#
# In CI, just call this. Locally, useful for both quick reruns and the
# "wait what does Mailpit look like" debugging step (set KEEP_STACK=1 then
# open http://127.0.0.1:8026).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"
COMPOSE_FILE="$REPO_ROOT/docker-compose.test.yml"
TEST_DIR="$REPO_ROOT/tests/integration"

# Pick a docker binary that's actually on PATH. macOS layouts vary.
if command -v docker >/dev/null 2>&1; then
	DOCKER=docker
elif [ -x /opt/homebrew/bin/docker ]; then
	DOCKER=/opt/homebrew/bin/docker
elif [ -x /usr/local/bin/docker ]; then
	DOCKER=/usr/local/bin/docker
else
	echo "error: docker not found in PATH" >&2
	exit 1
fi

cd "$REPO_ROOT"

cleanup() {
	if [ "${KEEP_STACK:-0}" = "1" ]; then
		echo
		echo "==> KEEP_STACK=1, leaving the test stack up."
		echo "    Mailpit UI:  http://127.0.0.1:8026"
		echo "    mana-auth:   http://127.0.0.1:3091"
		echo "    Postgres:    psql postgresql://mana:testpassword@localhost:5443/mana_platform"
		echo "    Tear down:   $DOCKER compose -f $COMPOSE_FILE down -v"
		return
	fi
	echo
	echo "==> Tearing down test stack"
	$DOCKER compose -f "$COMPOSE_FILE" down -v --remove-orphans >/dev/null 2>&1 || true
}
trap cleanup EXIT

echo "==> Building & starting test stack"
$DOCKER compose -f "$COMPOSE_FILE" up -d --build --wait

# Plattform-`mana-auth` lebt seit dem 2026-05-08-Cutover im Schwester-
# Repo `../mana/`. Schema-Push und SQL-Migrationen kommen von dort.
MANA_PLATFORM_DIR="${MANA_PLATFORM_DIR:-$REPO_ROOT/../mana}"

echo "==> Pushing mana-auth Drizzle schema into test postgres"
( cd "$MANA_PLATFORM_DIR" && DATABASE_URL="postgresql://mana:testpassword@localhost:5443/mana_platform" \
	pnpm --filter @mana/auth db:push --force >/dev/null )

echo "==> Applying encryption-vault SQL migrations (002, 003)"
$DOCKER cp "$MANA_PLATFORM_DIR/services/mana-auth/sql/002_encryption_vaults.sql" \
	mana-test-postgres:/tmp/002.sql
$DOCKER cp "$MANA_PLATFORM_DIR/services/mana-auth/sql/003_recovery_wrap.sql" \
	mana-test-postgres:/tmp/003.sql
$DOCKER exec mana-test-postgres psql -U mana -d mana_platform -f /tmp/002.sql >/dev/null
$DOCKER exec mana-test-postgres psql -U mana -d mana_platform -f /tmp/003.sql >/dev/null

echo "==> Restarting mana-auth so it picks up the freshly-created tables"
# mana-auth's connection pool might have been opened against an empty DB. A
# quick restart guarantees a clean cache + schema view.
$DOCKER compose -f "$COMPOSE_FILE" restart mana-auth >/dev/null
$DOCKER compose -f "$COMPOSE_FILE" up -d --wait mana-auth

echo "==> Running integration tests"
cd "$TEST_DIR"
bun test auth-flow.test.ts auth-failures.test.ts

echo
echo "✅ integration tests passed"
