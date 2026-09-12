#!/usr/bin/env bash
# Production entrypoint: wait for Postgres/Redis, migrate, collect static,
# optionally seed demo data + train synthetic ML models, then exec CMD.
set -euo pipefail

parse_url_host() {
  python -c "from urllib.parse import urlparse; import os; print(urlparse(os.environ.get('$1', '')).hostname or '')"
}

parse_url_port() {
  python -c "from urllib.parse import urlparse; import os; print(urlparse(os.environ.get('$1', '')).port or '$2')"
}

wait_tcp() {
  local host="$1" port="$2" name="$3"
  if [ -z "$host" ]; then
    echo "==> Skipping ${name} wait (no host)"
    return 0
  fi
  echo "==> Waiting for ${name} at ${host}:${port}"
  for _ in $(seq 1 60); do
    if python -c "import socket; s=socket.socket(); s.settimeout(2); s.connect(('${host}', int('${port}')))" 2>/dev/null; then
      return 0
    fi
    sleep 1
  done
  echo "==> ${name} not reachable yet; continuing"
}

DB_HOST="${DB_WAIT_HOST:-}"
DB_PORT="${DB_WAIT_PORT:-5432}"
REDIS_HOST="${REDIS_WAIT_HOST:-}"
REDIS_PORT="${REDIS_WAIT_PORT:-6379}"

if [ -n "${DATABASE_URL:-}" ]; then
  DB_HOST="$(parse_url_host DATABASE_URL)"
  DB_PORT="$(parse_url_port DATABASE_URL 5432)"
fi
if [ -n "${REDIS_URL:-}" ]; then
  REDIS_HOST="$(parse_url_host REDIS_URL)"
  REDIS_PORT="$(parse_url_port REDIS_URL 6379)"
fi

wait_tcp "$DB_HOST" "$DB_PORT" "Postgres"
wait_tcp "$REDIS_HOST" "$REDIS_PORT" "Redis"

if [ "${RUN_CELERY_WORKER:-false}" = "true" ]; then
  echo "==> Running migrations (worker)"
  python manage.py migrate --noinput
  echo "==> Starting Celery worker"
  exec celery -A config worker -l info --concurrency="${CELERY_CONCURRENCY:-2}"
fi

echo "==> Running migrations"
python manage.py migrate --noinput

echo "==> Collecting static files"
python manage.py collectstatic --noinput

if [ "${SEED_DEMO:-false}" = "true" ]; then
  echo "==> Seeding demo district (skip-if-exists)"
  python manage.py seed_demo --skip-if-exists || true
fi

if [ "${TRAIN_ML_ON_BOOT:-true}" = "true" ] && [ ! -f "/app/model_artifacts/p50_travel.joblib" ]; then
  echo "==> Training synthetic ML models (first boot only)"
  python manage.py generate_synthetic_ml_data || true
  python manage.py train_travel_models || true
fi

if [ "${1:-}" = "daphne" ]; then
  echo "==> Starting Daphne on port ${PORT:-8000}"
  exec daphne -b 0.0.0.0 -p "${PORT:-8000}" config.asgi:application
fi

echo "==> Starting: $*"
exec "$@"
