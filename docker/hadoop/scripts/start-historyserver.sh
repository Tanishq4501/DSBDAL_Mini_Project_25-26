#!/usr/bin/env bash
set -euo pipefail

# Wait for HDFS to be writable before creating history dirs
echo "[historyserver] Waiting for HDFS to become available..."
until hdfs dfs -mkdir -p /mr-history/done /mr-history/tmp > /dev/null 2>&1; do
  sleep 5
done
echo "[historyserver] History dirs created in HDFS."

exec mapred historyserver
