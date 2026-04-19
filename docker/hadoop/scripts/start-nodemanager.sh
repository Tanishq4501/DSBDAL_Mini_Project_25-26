#!/usr/bin/env bash
set -euo pipefail

mkdir -p /hadoop/yarn/local /hadoop/yarn/logs

# Wait for ResourceManager scheduler port
echo "[nodemanager] Waiting for ResourceManager (resourcemanager:8032)..."
until bash -c "</dev/tcp/resourcemanager/8032" 2>/dev/null; do
  sleep 3
done
echo "[nodemanager] ResourceManager is reachable."

exec yarn nodemanager
