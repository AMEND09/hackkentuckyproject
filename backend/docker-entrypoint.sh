#!/usr/bin/env bash
# Production entrypoint: wait for Postgres/Redis, migrate, collect static,
# optionally seed demo data + train synthetic ML models, then exec CMD.
set -euo pipefail

# Extract host/port from DATABASE_URL (postgres://user:pass@host:port/db)
DB_HOST="${DB_WAIT_HOST:-postgres}"
DB_PORT="${DB_WAIT_PORT:-5432}"
REDIS_HOST="${REDIS_WAIT_HOST:-redis}"
REDIS_PORT="${REDIS_WAIT_PORT:-6379}"

echo "==> Waiting for Postgres at ${DB_HOST}:${DB_PORT}"
for _ in $(seq 1 60); do
  if python -c "import socket,sys; s=socket.socket(); s.settimeout(2); s.connect(('${DB_HOST}', ${DB_PORT}))" 2>/dev/null; then
    break
  fi
  sleep 1
done

echo "==> Waiting for Redis at ${REDIS_HOST}:${REDIS_PORT}"
for _ in $(seq 1 60); do
  if python -c "import socket,sys; s=socket.socket(); s.settimeout(2); s.connect(('${REDIS_HOST}', ${REDIS_PORT}))" 2>/dev/null; then
    break
  fi
  sleep 1
done

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

echo "==> Starting: $*"
exec "$@"
