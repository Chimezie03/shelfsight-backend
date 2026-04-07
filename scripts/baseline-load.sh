#!/usr/bin/env bash
# Baseline load test (Task 5). Safe read-only endpoints only.
# Usage: start API locally (npm run dev or npm start), then:
#   chmod +x scripts/baseline-load.sh
#   ./scripts/baseline-load.sh
# Optional: BASE_URL=http://127.0.0.1:3001 CONCURRENCY=20 DURATION_SEC=10 ./scripts/baseline-load.sh

set -euo pipefail

BASE_URL="${BASE_URL:-http://127.0.0.1:3001}"
CONCURRENCY="${CONCURRENCY:-20}"
DURATION_SEC="${DURATION_SEC:-10}"

echo "=== ShelfSight baseline load ==="
echo "BASE_URL=$BASE_URL CONCURRENCY=$CONCURRENCY DURATION_SEC=$DURATION_SEC"
echo

run_cannon() {
  local name="$1"
  local path="$2"
  echo "--- $name ($path) ---"
  npx --yes autocannon@7 -c "$CONCURRENCY" -d "$DURATION_SEC" "${BASE_URL}${path}" || true
  echo
}

run_cannon "health" "/health"
run_cannon "health_ready" "/health/ready"
run_cannon "books_list" "/books?limit=20"

echo "Done. Interpret latency (avg/p99), Req/Sec, and errors from autocannon output above."
