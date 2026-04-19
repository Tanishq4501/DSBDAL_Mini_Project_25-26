#!/usr/bin/env bash
set -euo pipefail

# Wait for NameNode RPC port before joining the cluster
echo "[datanode] Waiting for NameNode RPC (namenode:9000)..."
until bash -c "</dev/tcp/namenode/9000" 2>/dev/null; do
  sleep 3
done
echo "[datanode] NameNode is reachable."

mkdir -p /hadoop/dfs/data
exec hdfs datanode
