#!/usr/bin/env bash
set -euo pipefail

mkdir -p /hadoop/dfs/name /hadoop/tmp

if [ ! -f /hadoop/dfs/name/current/VERSION ]; then
  hdfs namenode -format -force -nonInteractive fraudshield
fi

exec hdfs namenode
