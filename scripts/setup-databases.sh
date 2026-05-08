#!/bin/bash

# Setup script for creating databases and pushing schemas
# Usage: ./scripts/setup-databases.sh [service]
# Examples:
#   ./scripts/setup-databases.sh        # Setup all
#   ./scripts/setup-databases.sh auth   # Setup only auth schema
#
# Architecture: 2 databases (mana_platform + mana_sync)
# All service schemas live in mana_platform as separate PostgreSQL schemas.

set -e

# Database connection details (from .env.development)
DB_HOST="${DB_HOST:-localhost}"
DB_PORT="${DB_PORT:-5432}"
DB_USER="${POSTGRES_USER:-mana}"
DB_PASSWORD="${POSTGRES_PASSWORD:-devpassword}"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

echo -e "${GREEN}Database Setup Script${NC}"
echo "======================================"

# Function to create database if it doesn't exist
create_db_if_not_exists() {
    local db_name=$1
    echo -e "${YELLOW}Checking database: ${db_name}${NC}"

    if PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -tc \
        "SELECT 1 FROM pg_database WHERE datname = '$db_name'" | grep -q 1; then
        echo -e "  ${GREEN}✓ Exists${NC}"
    else
        echo -e "  Creating database ${db_name}..."
        PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "CREATE DATABASE $db_name;" > /dev/null
        PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d postgres -c "GRANT ALL PRIVILEGES ON DATABASE $db_name TO $DB_USER;" > /dev/null
        echo -e "  ${GREEN}✓ Created${NC}"
    fi
}

# Function to create schema within a database
create_schema_if_not_exists() {
    local db_name=$1
    local schema_name=$2
    PGPASSWORD=$DB_PASSWORD psql -h $DB_HOST -p $DB_PORT -U $DB_USER -d $db_name -c \
        "CREATE SCHEMA IF NOT EXISTS $schema_name;" > /dev/null 2>&1
}

# Function to push schema for a service
push_schema() {
    local filter=$1
    local name=$2
    local script=${3:-db:push}
    echo -e "${YELLOW}Pushing schema for ${name}...${NC}"
    local output
    output=$(pnpm --filter "$filter" "$script" --force 2>&1)
    local exit_code=$?
    if echo "$output" | grep -q "No projects matched the filters\|None of the selected packages has"; then
        echo -e "  ${YELLOW}⊘ Skipped (no db:push script for ${filter})${NC}"
    elif [ $exit_code -eq 0 ]; then
        echo -e "  ${GREEN}✓ Schema pushed${NC}"
    else
        # Real failure (push script exists but exit ≠ 0). Surface the last
        # lines of drizzle-kit output so the root cause is visible without
        # re-running by hand. Common cases: interactive rename prompt on
        # stdin-less invocation, or pre-existing public-schema enums the
        # service's schemaFilter hides.
        echo -e "  ${RED}✗ Schema push failed (exit ${exit_code})${NC}"
        echo "$output" | tail -5 | sed 's/^/    /'
    fi
}

# All schemas in mana_platform
PLATFORM_SCHEMAS=(
    "auth"
    "credits"
    "gifts"
    "subscriptions"
    "feedback"
    "usr"
    "media"
    "todo"
    "traces"
    "presi"
    "uload"
    "cards"
    "events"
    "news"
    "mail"
)

# Check if specific service requested
SERVICE_FILTER=${1:-""}

setup_service() {
    local service=$1

    case $service in
        auth|mana-auth)
            push_schema "@mana/auth" "mana-auth"
            ;;
        credits|mana-credits)
            push_schema "@mana/credits" "mana-credits"
            ;;
        user|mana-user)
            push_schema "@mana/user" "mana-user"
            ;;
        subscriptions|mana-subscriptions)
            push_schema "@mana/subscriptions" "mana-subscriptions"
            ;;
        analytics|mana-analytics)
            push_schema "@mana/analytics" "mana-analytics"
            ;;
        media|mana-media)
            push_schema "@mana/media" "mana-media"
            ;;
        todo)
            push_schema "@todo/server" "todo"
            ;;
        traces)
            push_schema "@traces/server" "traces"
            ;;
        presi)
            push_schema "@mana/api" "presi" "db:push:presi"
            ;;
        uload)
            push_schema "@mana/uload-database" "uload"
            ;;
        cards)
            push_schema "@mana/cards-server" "cards"
            ;;
        events|mana-events)
            push_schema "@mana/events" "mana-events"
            ;;
        news|news-ingester)
            push_schema "@mana/news-ingester" "news-ingester"
            ;;
        mail|mana-mail)
            push_schema "@mana/mail-service" "mana-mail"
            ;;
        *)
            echo -e "${RED}Unknown service: $service${NC}"
            echo "Available services: auth, credits, user, subscriptions, analytics, media, todo, traces, presi, uload, cards, events, news, mail"
            exit 1
            ;;
    esac
}

if [ -n "$SERVICE_FILTER" ]; then
    echo -e "Setting up for service: ${SERVICE_FILTER}"
    setup_service "$SERVICE_FILTER"
    echo -e "\n${GREEN}✓ Setup complete!${NC}"
    exit 0
fi

# Setup all databases
echo -e "\n${GREEN}Step 1: Creating databases${NC}"
echo "--------------------------------------"
create_db_if_not_exists "mana_platform"
create_db_if_not_exists "mana_sync"
# mana-notify (Go) and mana-credits (legacy schema-filter still uses
# mana_platform but the runtime config can point at mana_credits) each
# get their own database. Without these, dev:cardecky:full crashes
# both services on boot with "database does not exist" / SASL auth
# fallback errors.
create_db_if_not_exists "mana_notify"
create_db_if_not_exists "mana_credits"

echo -e "\n${GREEN}Step 2: Creating schemas in mana_platform${NC}"
echo "--------------------------------------"
for schema in "${PLATFORM_SCHEMAS[@]}"; do
    echo -e "  ${YELLOW}Creating schema: ${schema}${NC}"
    create_schema_if_not_exists "mana_platform" "$schema"
    echo -e "  ${GREEN}✓ ${schema}${NC}"
done

echo -e "\n${GREEN}Step 3: Pushing schemas${NC}"
echo "--------------------------------------"

for service in auth credits user subscriptions analytics media todo traces presi uload cards events news; do
    setup_service "$service" 2>/dev/null || true
done

echo -e "\n${GREEN}✓ Database setup complete!${NC}"
