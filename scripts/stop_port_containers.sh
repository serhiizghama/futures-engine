#!/usr/bin/env bash
# stop_port_containers.sh
# Stops Docker containers that expose the specified host ports.
# By default -- only stops containers. To remove them as well, set REMOVE=true.

set -euo pipefail

# If you want to remove containers after stopping them - set REMOVE=true
REMOVE=${REMOVE:-false}

# List of host ports to check
PORTS=(9092 9093 2181 6379 5432)

# Function: log with timestamp
log() {
  echo "[$(date +'%Y-%m-%d %H:%M:%S')] $*"
}

# Check if Docker is available
if ! command -v docker >/dev/null 2>&1; then
  echo "Error: docker not found in PATH."
  exit 1
fi

log "Starting port check: ${PORTS[*]}"
for PORT in "${PORTS[@]}"; do
  log "Checking port $PORT ..."

  # Look for docker ps lines containing ":<PORT>->" (format of published ports in docker ps)
  # Line format: "<ID> <NAMES> <PORTS...>"
  matches=$(docker ps --format '{{.ID}} {{.Names}} {{.Ports}}' | grep -E ":${PORT}->" || true)

  if [ -n "$matches" ]; then
    log "Found docker container(s) exposing port $PORT:"
    echo "$matches"
    # Get container IDs (first field of each line)
    ids=$(echo "$matches" | awk '{print $1}')

    for id in $ids; do
      name=$(docker ps --filter "id=$id" --format '{{.Names}}' || echo "$id")
      log "Stopping container $name ($id) ..."
      if docker stop "$id"; then
        log "Container $name ($id) stopped successfully."
        if [ "$REMOVE" = "true" ]; then
          log "Removing container $name ($id) along with its volumes..."
          if docker rm -v "$id"; then
            log "Container $name ($id) removed."
          else
            log "Failed to remove container $name ($id)."
          fi
        fi
      else
        log "Failed to stop container $name ($id)."
      fi
    done
  else
    # If no docker containers found, check if the port is used by any other process
    if command -v lsof >/dev/null 2>&1; then
      proc=$(sudo lsof -i :"$PORT" -sTCP:LISTEN -Pn 2>/dev/null || true)
      if [ -n "$proc" ]; then
        log "Port $PORT is occupied by a non-docker process (lsof output):"
        echo "$proc"
      else
        log "Port $PORT is free (no docker containers or listening processes found)."
      fi
    else
      log "Command lsof not found — cannot check non-docker processes. Install lsof for detailed output."
    fi
  fi

  echo # empty line for readability
done

log "Done."
