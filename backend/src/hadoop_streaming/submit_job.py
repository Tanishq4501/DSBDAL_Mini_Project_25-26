"""
Container entrypoint for submitting a real Hadoop Streaming job.

The job copies the dataset into HDFS, runs the mapper and reducer on the
YARN cluster, and writes the output back to HDFS and a mounted local folder.
"""

from __future__ import annotations

import os
import subprocess
import sys
import time
import json
from urllib.error import URLError
from urllib.request import urlopen
from pathlib import Path


BASE_DIR = Path(__file__).resolve().parents[2]
DATA_PATH = Path(os.getenv("HADOOP_INPUT_CSV", "/app/data/creditcard.csv"))
OUTPUT_DIR = os.getenv("HADOOP_OUTPUT_DIR", "/app/hadoop-output")
HDFS_INPUT_DIR = os.getenv("HADOOP_HDFS_INPUT_DIR", "/fraud/input")
HDFS_OUTPUT_DIR = os.getenv("HADOOP_HDFS_OUTPUT_DIR", "/fraud/output")
HADOOP_HOME = os.getenv("HADOOP_HOME", "/opt/hadoop")


def run(command: list[str], check: bool = True) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, check=check, text=True, capture_output=True)


def hdfs(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    return run(["hdfs", "dfs", *args], check=check)


def hadoop(*args: str, check: bool = True) -> subprocess.CompletedProcess[str]:
    return run(["hadoop", *args], check=check)


def wait_for_http(url: str, timeout_seconds: int = 180) -> None:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        try:
            with urlopen(url, timeout=3):
                return
        except (URLError, TimeoutError, OSError):
            time.sleep(3)
    raise TimeoutError(f"Timed out waiting for {url}")


def wait_for_hdfs(timeout_seconds: int = 180) -> None:
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        result = hdfs("-ls", "/", check=False)
        if result.returncode == 0:
            return
        time.sleep(3)
    raise TimeoutError("Timed out waiting for HDFS to become available")


def wait_for_yarn_nodes(timeout_seconds: int = 180) -> None:
    deadline = time.time() + timeout_seconds
    url = "http://resourcemanager:8088/ws/v1/cluster/nodes"

    while time.time() < deadline:
        try:
            with urlopen(url, timeout=3) as response:
                payload = json.loads(response.read().decode("utf-8"))
        except (URLError, json.JSONDecodeError):
            time.sleep(3)
            continue

        nodes = payload.get("nodes", {}).get("node", []) or []
        running_nodes = [node for node in nodes if node.get("state") == "RUNNING"]
        if running_nodes:
            return
        time.sleep(3)

    raise TimeoutError("Timed out waiting for active YARN NodeManagers")


def find_streaming_jar() -> str:
    candidates = [
        f"{HADOOP_HOME}/share/hadoop/tools/lib/hadoop-streaming-*.jar",
        "/opt/hadoop/share/hadoop/tools/lib/hadoop-streaming-*.jar",
    ]
    for candidate in candidates:
        result = subprocess.run(
            ["bash", "-lc", f"ls {candidate} 2>/dev/null | head -n 1"],
            check=False,
            text=True,
            capture_output=True,
        )
        path = result.stdout.strip()
        if path:
            return path
    raise FileNotFoundError("Could not locate hadoop-streaming jar")


def main() -> int:
    if not DATA_PATH.exists():
        print(
            f"[streaming] Dataset not found at {DATA_PATH}. "
            "Place creditcard.csv in backend/data/ to run the MapReduce job. "
            "Skipping — this does not affect the rest of the stack.",
            file=sys.stderr,
        )
        return 0

    print("[streaming] Waiting for Hadoop services")
    wait_for_http("http://namenode:9870")
    wait_for_http("http://resourcemanager:8088")
    wait_for_hdfs()
    wait_for_yarn_nodes()

    mapper = BASE_DIR / "src" / "hadoop_streaming" / "mapper.py"
    reducer = BASE_DIR / "src" / "hadoop_streaming" / "reducer.py"
    output_dir = Path(OUTPUT_DIR)
    output_dir.mkdir(parents=True, exist_ok=True)
    local_result = output_dir / "results.txt"
    if local_result.exists():
        local_result.unlink()

    print("[streaming] Preparing HDFS input directory")
    hdfs("-mkdir", "-p", HDFS_INPUT_DIR)
    hdfs("-mkdir", "-p", HDFS_OUTPUT_DIR, check=False)
    hdfs("-rm", "-r", "-f", HDFS_OUTPUT_DIR, check=False)
    hdfs("-put", "-f", str(DATA_PATH), f"{HDFS_INPUT_DIR}/creditcard.csv")

    streaming_jar = find_streaming_jar()
    print(f"[streaming] Using jar: {streaming_jar}")

    cmd = [
        "hadoop",
        "jar",
        streaming_jar,
        "-D",
        "mapreduce.job.reduces=2",
        "-files",
        f"{mapper},{reducer}",
        "-input",
        f"{HDFS_INPUT_DIR}/creditcard.csv",
        "-output",
        HDFS_OUTPUT_DIR,
        "-mapper",
        "python3 mapper.py",
        "-reducer",
        "python3 reducer.py",
    ]

    print("[streaming] Submitting Hadoop Streaming job")
    completed = subprocess.run(cmd, text=True)
    if completed.returncode != 0:
        print("[streaming] Hadoop Streaming job failed", file=sys.stderr)
        return completed.returncode

    print("[streaming] Job completed successfully")

    print("[streaming] Fetching results from HDFS")
    try:
        hdfs("-getmerge", HDFS_OUTPUT_DIR, str(local_result), check=True)
    except subprocess.CalledProcessError:
        print("[streaming] Could not copy part-00000 locally; check HDFS output directory")

    print("[streaming] Done")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
