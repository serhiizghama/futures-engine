#!/usr/bin/env bash
set -euo pipefail

# --- Configuration ---
CONTAINER_NAME="futures-postgres"
POSTGRES_USER="futures"
POSTGRES_PASSWORD="futures"
POSTGRES_DB="futures_engine"
DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:5432/${POSTGRES_DB}"
POSTGRES_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:5432/postgres"
MIGRATION_FILE="$(dirname "$0")/../migrations/0001_init.sql"

echo "🔍 Checking PostgreSQL container status..."

# --- 1. Check if container is running ---
if ! docker ps -q -f name=^/${CONTAINER_NAME}$ | grep -q .; then
    echo "❌ Container '${CONTAINER_NAME}' is not running."
    echo "Please start it with: docker compose up -d"
    exit 1
fi

echo "✅ Container '${CONTAINER_NAME}' is running."

# --- 2. Wait for PostgreSQL to be ready ---
echo "⏳ Waiting for PostgreSQL to be ready..."
export PGPASSWORD="${POSTGRES_PASSWORD}"

COUNTER=0
until docker exec ${CONTAINER_NAME} pg_isready -U ${POSTGRES_USER} >/dev/null 2>&1; do
    ((COUNTER++))
    if [ $COUNTER -gt 30 ]; then
        echo "❌ Timeout: PostgreSQL is not ready after 30 seconds."
        exit 1
    fi
    sleep 1
done

echo "✅ PostgreSQL is ready."

# --- 3. Check if database exists, create if not ---
echo "🔍 Checking if database '${POSTGRES_DB}' exists..."

DB_EXISTS=$(docker exec ${CONTAINER_NAME} psql -U ${POSTGRES_USER} -d postgres -tAc "SELECT 1 FROM pg_database WHERE datname='${POSTGRES_DB}'")

if [ "$DB_EXISTS" != "1" ]; then
    echo "📦 Database '${POSTGRES_DB}' does not exist. Creating..."
    docker exec ${CONTAINER_NAME} psql -U ${POSTGRES_USER} -d postgres -c "CREATE DATABASE ${POSTGRES_DB};"
    echo "✅ Database '${POSTGRES_DB}' created successfully."
else
    echo "✅ Database '${POSTGRES_DB}' already exists."
fi

# --- 4. Check if pgcrypto extension exists ---
echo "🔍 Checking pgcrypto extension..."

EXTENSION_EXISTS=$(docker exec ${CONTAINER_NAME} psql -U ${POSTGRES_USER} -d ${POSTGRES_DB} -tAc "SELECT 1 FROM pg_extension WHERE extname='pgcrypto'")

if [ "$EXTENSION_EXISTS" != "1" ]; then
    echo "📦 Installing pgcrypto extension..."
    docker exec ${CONTAINER_NAME} psql -U ${POSTGRES_USER} -d ${POSTGRES_DB} -c "CREATE EXTENSION IF NOT EXISTS pgcrypto;"
    echo "✅ pgcrypto extension installed."
else
    echo "✅ pgcrypto extension already exists."
fi

# --- 5. Check if migrations already applied ---
echo "🔍 Checking if tables already exist..."

TABLES_EXIST=$(docker exec ${CONTAINER_NAME} psql -U ${POSTGRES_USER} -d ${POSTGRES_DB} -tAc "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('positions', 'position_history')")

if [ "$TABLES_EXIST" = "2" ]; then
    echo "⚠️  Tables already exist. Skipping migration."
    echo "If you want to reapply, drop the database first:"
    echo "  docker exec ${CONTAINER_NAME} psql -U ${POSTGRES_USER} -d postgres -c 'DROP DATABASE ${POSTGRES_DB};'"
else
    echo "📝 Applying migrations from $MIGRATION_FILE..."

    # Apply migrations using psql from host (if available) or via docker exec
    if command -v psql &> /dev/null; then
        psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION_FILE"
    else
        docker exec -i ${CONTAINER_NAME} psql -U ${POSTGRES_USER} -d ${POSTGRES_DB} -v ON_ERROR_STOP=1 < "$MIGRATION_FILE"
    fi

    echo "✅ Migrations successfully applied."
fi

echo "🎉 Database setup complete!"

# Unset the password from environment variables
unset PGPASSWORD