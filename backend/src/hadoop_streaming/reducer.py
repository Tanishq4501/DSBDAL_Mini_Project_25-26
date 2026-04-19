#!/usr/bin/env python3

"""
Hadoop Streaming reducer for the fraud dataset.

Consumes the sorted key/value stream produced by the mapper and emits:
    class_label\tcount\ttotal_amount\tmean_amount
"""

import sys


def flush(current_class: str, count: int, total_amount: float) -> None:
    if current_class is None:
        return
    mean_amount = total_amount / count if count else 0.0
    print(f"{current_class}\t{count}\t{round(total_amount, 4)}\t{round(mean_amount, 4)}")


def main() -> None:
    current_class = None
    count = 0
    total_amount = 0.0

    for raw_line in sys.stdin:
        line = raw_line.strip()
        if not line:
            continue

        parts = line.split("\t")
        if len(parts) < 3:
            continue

        class_label, amount_text, count_text = parts[0], parts[1], parts[2]

        try:
            amount = float(amount_text)
        except ValueError:
            amount = 0.0

        try:
            row_count = int(float(count_text))
        except ValueError:
            row_count = 1

        if current_class is None:
            current_class = class_label

        if class_label != current_class:
            flush(current_class, count, total_amount)
            current_class = class_label
            count = 0
            total_amount = 0.0

        count += row_count
        total_amount += amount

    flush(current_class, count, total_amount)


if __name__ == "__main__":
    main()