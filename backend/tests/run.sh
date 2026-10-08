#!/usr/bin/env bash
# Runs the end-to-end API suite against a throw-away `cafe_test` database.
set -euo pipefail
cd "$(dirname "$0")/.."

PHP="${PHP:-$(command -v php || echo /opt/lampp/bin/php)}"
PORT="${TEST_PORT:-8001}"
export DB_DATABASE="${TEST_DB_DATABASE:-cafe_test}"
export API="http://127.0.0.1:${PORT}"

"$PHP" database/install.php --fresh >/dev/null
"$PHP" -S "127.0.0.1:${PORT}" -t public public/index.php >/dev/null 2>&1 &
SERVER=$!
trap 'kill $SERVER 2>/dev/null' EXIT
sleep 1

"$PHP" tests/api_test.php
