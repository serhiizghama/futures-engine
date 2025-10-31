#!/usr/bin/env bash
set -euo pipefail

# --- Configuration ---
# The container name we will use
CONTAINER_NAME="futures-db"
# Login parameters (also used for creating the container)
POSTGRES_USER="futures"
POSTGRES_PASSWORD="futures"
POSTGRES_DB="futures"
DATABASE_URL="postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@localhost:5432/${POSTGRES_DB}"
MIGRATION_FILE="$(dirname "$0")/../migrations/0001_init.sql"

# --- 1. Start the container ---

# Check if the container is already running
# We use ^/ for an exact name match
if ! docker ps -q -f name=^/${CONTAINER_NAME}$ >/dev/null; then
    # Container is not running. Check if it exists but is stopped
    if ! docker ps -aq -f name=^/${CONTAINER_NAME}$ >/dev/null; then
        # Container does not exist. Creating it.
        echo "🚀 Creating and starting a new container '${CONTAINER_NAME}'..."
        docker run -d \
            --name ${CONTAINER_NAME} \
            -e POSTGRES_USER=${POSTGRES_USER} \
            -e POSTGRES_PASSWORD=${POSTGRES_PASSWORD} \
            -e POSTGRES_DB=${POSTGRES_DB} \
            -p 5432:5432 \
            -v ${CONTAINER_NAME}_data:/var/lib/postgresql/data \
            --restart always \
            postgres
    else
        # Container exists but is stopped. Starting it.
        echo "Container '${CONTAINER_NAME}' is stopped. Starting..."
        docker start ${CONTAINER_NAME}
    fi
else
    echo "Container '${CONTAINER_NAME}' is already running."
fi

# --- 2. Wait for the DB to be ready ---
echo "⏳ Waiting for the database to be ready at $DATABASE_URL..."

# psql can use PG... environment variables instead of a URL,
# so we explicitly export PGPASSWORD to avoid a password prompt.
export PGPASSWORD="${POSTGRES_PASSWORD}"

COUNTER=0
# We use `psql -c "\q"` as a health check.
# It will return 0 (success) once the connection is established.
until psql "$DATABASE_URL" -c "\q" >/dev/null 2>&1; do
    ((COUNTER++))
    if [ $COUNTER -gt 30 ]; then
        echo "❌ Timeout: Database is not ready after 30 seconds."
        exit 1
    fi
    echo "Waiting... (attempt $COUNTER)"
    sleep 1
done

echo "✅ Database is ready."

# --- 3. Apply migrations ---
echo "Applying migrations from $MIGRATION_FILE..."

# Your original command
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$MIGRATION_FILE"

echo "🎉 Migrations successfully applied to $DATABASE_URL"

# Unset the password from environment variables
unset PGPASSWORD