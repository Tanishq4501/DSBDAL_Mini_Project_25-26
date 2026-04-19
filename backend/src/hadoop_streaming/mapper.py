#!/usr/bin/env python3

"""
Hadoop Streaming mapper for the fraud dataset.

Reads CSV rows from stdin and emits tab-separated key/value pairs:
    class_label\tamount\tcount

This is designed to run inside Hadoop Streaming on the NodeManager workers.
"""

import csv
import sys


def main() -> None:
    reader = csv.DictReader(sys.stdin)
    for row in reader:
        try:
            class_label = int(float(row.get("Class", 0)))
        except (TypeError, ValueError):
            class_label = 0

        try:
            amount = float(row.get("Amount", 0.0))
        except (TypeError, ValueError):
            amount = 0.0

        print(f"{class_label}\t{amount}\t1")


if __name__ == "__main__":
    main()