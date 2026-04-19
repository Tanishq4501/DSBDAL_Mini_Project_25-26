#!/usr/bin/env bash
set -euo pipefail

# Wait for NameNode HTTP UI to be up (indicates NN is fully started)
echo "[resourcemanager] Waiting for NameNode HTTP (namenode:9870)..."
until bash -c "</dev/tcp/namenode/9870" 2>/dev/null; do
  sleep 3
done
echo "[resourcemanager] NameNode HTTP is reachable."

exec yarn resourcemanager
