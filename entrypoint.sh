#!/bin/bash

echo "🚀 GameTheca container starting up..."

if [[ ! -f /app/gametheca/static/dist/library-grid/library-grid.js ]]; then
    echo "⚠️  Warning: library-grid.js not found — React library grid may not load. Rebuild the Docker image to include the library-grid build stage."
fi

# Inside Docker Compose, Postgres is the sibling service named "db".
# Never wait on localhost/127.0.0.1 (common leftover from non-Docker .env files).
if [[ -f /.dockerenv ]]; then
    export DATABASE_HOST="${DATABASE_HOST:-db}"
    export DATABASE_PORT="${DATABASE_PORT:-5432}"
    export POSTGRES_USER="${POSTGRES_USER:-postgres}"
    export POSTGRES_PASSWORD="${POSTGRES_PASSWORD:-postgres}"
    export POSTGRES_DB="${POSTGRES_DB:-gametheca}"

    if [[ -z "${DATABASE_URL}" \
        || "${DATABASE_URL}" == *"@localhost"* \
        || "${DATABASE_URL}" == *"@127.0.0.1"* \
        || "${DATABASE_URL}" == *"@::1"* ]]; then
        export DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/${POSTGRES_DB}"
        echo "ℹ️  DATABASE_URL forced to Compose service db (was empty/localhost)."
    fi
fi

DB_HOST=${DATABASE_HOST:-db}
DB_USER=${POSTGRES_USER:-postgres}
DB_PORT=${DATABASE_PORT:-5432}

# Prefer parsing host from DATABASE_URL when it is not localhost
if [[ -n "$DATABASE_URL" ]]; then
    PARSED_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:/]*\)[:/].*/\1/p')
    PARSED_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9][0-9]*\)\/.*/\1/p')
    PARSED_USER=$(echo "$DATABASE_URL" | sed -n 's/.*:\/\/\([^:]*\):.*/\1/p')
    if [[ -n "$PARSED_HOST" && "$PARSED_HOST" != "localhost" && "$PARSED_HOST" != "127.0.0.1" ]]; then
        DB_HOST="$PARSED_HOST"
    fi
    if [[ -n "$PARSED_PORT" ]]; then
        DB_PORT="$PARSED_PORT"
    fi
    if [[ -n "$PARSED_USER" ]]; then
        DB_USER="$PARSED_USER"
    fi
fi

wait_for_postgres() {
    echo "🔄 Waiting for PostgreSQL at ${DB_HOST}:${DB_PORT}..."
    echo "   DATABASE_URL host hint: $(echo "${DATABASE_URL}" | sed -E 's#://[^:]+:[^@]+@#://***:***@#')"

    until python3 -c "
import os
import sys
import psycopg2
from urllib.parse import urlparse

host = os.environ.get('DATABASE_HOST', '${DB_HOST}')
port = int(os.environ.get('DATABASE_PORT', '${DB_PORT}') or 5432)
user = os.environ.get('POSTGRES_USER', '${DB_USER}')
password = os.environ.get('POSTGRES_PASSWORD', 'postgres')
database = os.environ.get('POSTGRES_DB', 'gametheca')

url = os.environ.get('DATABASE_URL') or ''
if url:
    parsed = urlparse(url)
    if parsed.hostname and parsed.hostname not in ('localhost', '127.0.0.1', '::1'):
        host = parsed.hostname
        port = parsed.port or port
        user = parsed.username or user
        password = parsed.password or password
        database = (parsed.path or '/gametheca').lstrip('/') or database
    else:
        # Force Compose service when URL still points at loopback
        host = 'db'

try:
    conn = psycopg2.connect(
        host=host,
        port=port,
        user=user,
        password=password,
        database=database,
        connect_timeout=5,
    )
    conn.close()
    print(f'✅ PostgreSQL connection successful ({host}:{port}/{database})')
except Exception as e:
    print(f'❌ Connection failed ({host}:{port}): {e}')
    sys.exit(1)
"; do
        echo "⏳ PostgreSQL not ready yet, waiting 5 seconds..."
        sleep 5
    done
    echo "✅ PostgreSQL is now available!"
}

wait_for_postgres

echo "🎮 Starting GameTheca Docker container..."
/app/startweb-docker.sh "$@"
