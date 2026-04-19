"""
MapReduce simulation module for Credit Card Fraud Detection.

Simulates a classic Hadoop-style MapReduce workflow using Python's
multiprocessing-free, single-process implementation to aggregate
fraud statistics per class from the creditcard.csv dataset.

No actual Spark or Hadoop is required — this is a pedagogical simulation
demonstrating the Map -> Shuffle -> Reduce pattern.
"""

import csv
import logging
from collections import defaultdict
from typing import Dict, Any, Iterator, Tuple, List

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Map phase
# ---------------------------------------------------------------------------

def map_transaction(row: Dict[str, str]) -> Tuple[int, Dict[str, float]]:
    """
    Map function: extract class label and relevant numeric features from one row.

    Emits: (class_label, {amount, is_fraud})

    Args:
        row: Dict representing one CSV row (all values as strings).

    Returns:
        Tuple of (class_label: int, value_dict: dict).
    """
    try:
        class_label = int(float(row.get("Class", 0)))
        amount = float(row.get("Amount", 0.0))
    except (ValueError, TypeError):
        class_label = 0
        amount = 0.0

    return (class_label, {"amount": amount, "count": 1})


def map_phase(filepath: str) -> List[Tuple[int, Dict[str, float]]]:
    """
    Run the Map phase over every row in the CSV.

    Args:
        filepath: Path to creditcard.csv.

    Returns:
        List of (key, value) pairs emitted by the mapper.
    """
    logger.info(f"[MapReduce] Map phase starting on: {filepath}")
    mapped = []
    with open(filepath, newline="", encoding="utf-8") as fh:
        reader = csv.DictReader(fh)
        for row in reader:
            mapped.append(map_transaction(row))
    logger.info(f"[MapReduce] Map phase complete. Emitted {len(mapped)} key-value pairs.")
    return mapped


# ---------------------------------------------------------------------------
# Shuffle phase
# ---------------------------------------------------------------------------

def shuffle_phase(
    mapped: List[Tuple[int, Dict[str, float]]]
) -> Dict[int, List[Dict[str, float]]]:
    """
    Shuffle/group phase: group all values by key (class label).

    Args:
        mapped: Output from map_phase.

    Returns:
        Dict {class_label: [value_dict, ...]}.
    """
    logger.info("[MapReduce] Shuffle phase: grouping by class label.")
    grouped: Dict[int, List[Dict[str, float]]] = defaultdict(list)
    for key, value in mapped:
        grouped[key].append(value)
    logger.info(f"[MapReduce] Shuffle complete. Groups: {list(grouped.keys())}")
    return dict(grouped)


# ---------------------------------------------------------------------------
# Reduce phase
# ---------------------------------------------------------------------------

def reduce_class(
    class_label: int, values: List[Dict[str, float]]
) -> Dict[str, Any]:
    """
    Reduce function: aggregate statistics for a single class.

    Computes:
        - total transaction count
        - total amount
        - mean amount
        - min / max amount

    Args:
        class_label: The class key (0 = legitimate, 1 = fraud).
        values:       List of value dicts from the shuffle phase.

    Returns:
        Aggregated statistics dict.
    """
    total_count = 0
    total_amount = 0.0
    amounts: List[float] = []

    for v in values:
        total_count += int(v.get("count", 1))
        amt = float(v.get("amount", 0.0))
        total_amount += amt
        amounts.append(amt)

    mean_amount = total_amount / total_count if total_count > 0 else 0.0
    min_amount = min(amounts) if amounts else 0.0
    max_amount = max(amounts) if amounts else 0.0

    return {
        "class": class_label,
        "label": "fraud" if class_label == 1 else "legitimate",
        "count": total_count,
        "total_amount": round(total_amount, 4),
        "mean_amount": round(mean_amount, 4),
        "min_amount": round(min_amount, 4),
        "max_amount": round(max_amount, 4),
    }


def reduce_phase(
    grouped: Dict[int, List[Dict[str, float]]]
) -> List[Dict[str, Any]]:
    """
    Run the Reduce phase over all grouped data.

    Args:
        grouped: Output from shuffle_phase.

    Returns:
        List of aggregated stats dicts, sorted by class label.
    """
    logger.info("[MapReduce] Reduce phase: aggregating per-class statistics.")
    results = []
    for class_label, values in sorted(grouped.items()):
        agg = reduce_class(class_label, values)
        results.append(agg)
        logger.info(f"[MapReduce] Class {class_label}: {agg}")
    logger.info("[MapReduce] Reduce phase complete.")
    return results


# ---------------------------------------------------------------------------
# Public entry point
# ---------------------------------------------------------------------------

def run_fraud_mapreduce(filepath: str) -> Dict[str, Any]:
    """
    Execute the full Map -> Shuffle -> Reduce pipeline on the dataset.

    Args:
        filepath: Path to creditcard.csv.

    Returns:
        Dict with:
            - "results": list of per-class aggregated stats
            - "summary": high-level summary dict
            - "pipeline_steps": description of each MapReduce phase
    """
    logger.info("[MapReduce] Starting fraud MapReduce simulation.")

    # Map
    mapped = map_phase(filepath)

    # Shuffle
    grouped = shuffle_phase(mapped)

    # Reduce
    results = reduce_phase(grouped)

    # Build summary
    total_records = sum(r["count"] for r in results)
    fraud_record = next((r for r in results if r["class"] == 1), None)
    legit_record = next((r for r in results if r["class"] == 0), None)

    fraud_count = fraud_record["count"] if fraud_record else 0
    fraud_pct = round((fraud_count / total_records) * 100, 4) if total_records > 0 else 0.0

    summary = {
        "total_records": total_records,
        "fraud_count": fraud_count,
        "legit_count": legit_record["count"] if legit_record else 0,
        "fraud_pct": fraud_pct,
        "fraud_mean_amount": fraud_record["mean_amount"] if fraud_record else 0.0,
        "legit_mean_amount": legit_record["mean_amount"] if legit_record else 0.0,
    }

    pipeline_steps = [
        {
            "step": 1,
            "name": "Map",
            "description": (
                "Each transaction row is mapped to a (class_label, {amount, count}) "
                "key-value pair. This simulates distributing rows across mapper tasks."
            ),
        },
        {
            "step": 2,
            "name": "Shuffle & Sort",
            "description": (
                "Key-value pairs are grouped by class_label (0 or 1), simulating "
                "the shuffle-and-sort phase that routes data to the correct reducer."
            ),
        },
        {
            "step": 3,
            "name": "Reduce",
            "description": (
                "For each class, the reducer aggregates count, total amount, "
                "mean, min, and max — producing per-class fraud statistics."
            ),
        },
    ]

    logger.info(f"[MapReduce] Done. Summary: {summary}")
    return {
        "results": results,
        "summary": summary,
        "pipeline_steps": pipeline_steps,
    }
