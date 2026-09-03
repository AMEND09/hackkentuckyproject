#!/usr/bin/env bash
set -euo pipefail
host="${1:-localhost}"
port="${2:-5432}"
user="${3:-routewise}"
db="${4:-routewise}"
timeout_s="${5:-60}"
start=$(date +%s)
echo "Waiting for PostgreSQL at ${host}:${port} ..."
run_py() { if command -v py >/dev/null 2>&1; then py -3 "$@"; elif command -v python3 >/dev/null 2>&1; then python3 "$@"; else python "$@"; fi; }
while true; do
  if command -v pg_isready >/dev/null 2>&1; then
    if pg_isready -h "$host" -p "$port" -U "$user" -d "$db" >/dev/null 2>&1; then
      echo "PostgreSQL is ready."
      exit 0
    fi
  elif command -v docker >/dev/null 2>&1; then
    if docker exec routewise-postgres pg_isready -U "$user" -d "$db" >/dev/null 2>&1; then
      echo "PostgreSQL is ready."
      exit 0
    fi
  else
    if run_py - "$host" "$port" <<'PY'
import socket, sys
s = socket.socket()
s.settimeout(2)
try:
    s.connect((sys.argv[1], int(sys.argv[2])))
except Exception:
    sys.exit(1)
finally:
    s.close()
PY
    then
      echo "PostgreSQL port is open."
      exit 0
    fi
  fi
  now=$(date +%s)
  if (( now - start > timeout_s )); then
    echo "Timed out waiting for PostgreSQL after ${timeout_s}s."
    exit 1
  fi
  sleep 2
done
