#!/bin/bash
# Build all landing pages and copy dist/ to the shared nginx volume
# Run on the Mac Mini after git pull
#
# Usage: ./scripts/mac-mini/build-landings.sh

set -e

PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
OUTPUT_DIR="/Volumes/ManaData/landings"

echo "=== Building Landing Pages ==="
echo "Output: $OUTPUT_DIR"
echo ""

mkdir -p "$OUTPUT_DIR"

# Landing pages to build (filter name → dist path → output name)
declare -A LANDINGS=(
    ["it"]="services/it-landing"
    ["chat"]="apps/chat/apps/landing"
    ["picture"]="apps/picture/apps/landing"
    ["quotes"]="apps/quotes/apps/landing"
    ["presi"]="apps/presi/apps/landing"
    ["clock"]="apps/clock/apps/landing"
    ["cards"]="apps/cards/apps/landing"
)

cd "$PROJECT_ROOT"

for name in "${!LANDINGS[@]}"; do
    dir="${LANDINGS[$name]}"
    if [ -d "$dir" ]; then
        echo "Building $name ($dir)..."
        pnpm --filter "./$dir" build 2>&1 | tail -3

        # Copy dist to output
        if [ -d "$dir/dist" ]; then
            rm -rf "$OUTPUT_DIR/$name"
            cp -r "$dir/dist" "$OUTPUT_DIR/$name"
            echo "  → $OUTPUT_DIR/$name ($(du -sh "$OUTPUT_DIR/$name" | cut -f1))"
        else
            echo "  ⚠ No dist/ found for $name"
        fi
    else
        echo "  ⚠ Directory not found: $dir"
    fi
    echo ""
done

echo "=== Done ==="
echo ""
echo "Restart nginx to pick up changes:"
echo "  docker restart mana-infra-landings"
