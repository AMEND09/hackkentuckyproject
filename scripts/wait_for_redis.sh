#!/usr/bin/env bash
set -euo pipefail
host="${1:-localhost}"
port="${2:-6379}"
timeout_s="${3:-60}"
start=$(date +%s)
echo "Waiting for Redis at ${host}:${port} ..."
while true; do
  if command -v redis-cli >/dev/null 2>&1; then
    if redis-cli -h "$host" -p "$port" ping >/dev/null 2>&1; then
      echo "Redis is ready."
      exit 0
    fi
  elif command -v docker >/dev/null 2>&1; then
    if docker exec routewise-redis redis-cli ping >/dev/null 2>&1; then
      echo "Redis is ready."
      exit 0
    fi
  else
    python - <<PY
import socket, sys
s = socket.socket()
s.settimeout(2)
try:
    s.connect(("${host}", int("${port}")))
except Exception:
    sys.exit(1)
finally:
    s.close()
PY
    echo "Redis port is open."
    exit 0
  fi
  now=$(date +%s)
  if (( now - start > timeout_s )); then
    echo "Timed out waiting for Redis after ${timeout_s}s."
    exit 1
  fi
  sleep 2
done
