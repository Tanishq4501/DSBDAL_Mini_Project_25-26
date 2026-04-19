"""
Kafka simulation module for Credit Card Fraud Detection.

Generates realistic mock credit-card transactions for streaming demos.
No actual Kafka broker is required — stream_transactions_mock() returns
a plain Python list that the FastAPI WebSocket endpoint can iterate over.

If a real Kafka broker IS available, use KafkaProducerClient to publish
transactions to a Kafka topic.
"""

import random
import uuid
import time
import json
import logging
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Kaggle dataset statistics used to generate realistic transactions
_FRAUD_RATE = 0.001727       # real dataset rate — overridden by TX_GENERATOR_FRAUD_RATE in Docker
_DEMO_FRAUD_RATE = 0.08      # 8 % — used when running inside Docker for visible demo fraud

_AMOUNT_LEGIT_MEAN = 88.29
_AMOUNT_LEGIT_STD = 250.12
# Fraud amounts: real Kaggle median is ~$9, mean ~$122; keep realistic spread
_AMOUNT_FRAUD_MEAN = 65.0
_AMOUNT_FRAUD_STD  = 80.0

_V_FEATURE_MEANS = [0.0] * 28    # PCA components are zero-centred
_V_FEATURE_STDS  = [1.5] * 28    # typical std in the Kaggle dataset

# ---------------------------------------------------------------------------
# Feature offsets derived from the Kaggle EDA for the top fraud indicators.
# Fraudulent transactions strongly deviate on these PCA components:
#   Strongly negative: V14, V17, V12, V10, V16, V3
#   Strongly positive: V4, V11
# Injecting these offsets makes the XGBoost model actually fire on fraud txns.
# ---------------------------------------------------------------------------
_FRAUD_V_OFFSETS: Dict[str, float] = {
    "V14": -7.5,   # most discriminative feature (corr –0.30 with Class)
    "V17": -6.5,
    "V12": -5.5,
    "V10": -4.5,
    "V16": -3.5,
    "V3":  -3.0,
    "V7":  -2.5,
    "V4":  +3.5,   # positively correlated with fraud
    "V11": +3.0,
}


def _make_fraud_v_features() -> Dict[str, float]:
    """Return V1–V28 values with realistic fraud-like PCA patterns."""
    features = {
        f"V{i + 1}": round(random.gauss(0.0, 1.0), 6)
        for i in range(28)
    }
    for key, offset in _FRAUD_V_OFFSETS.items():
        features[key] = round(random.gauss(offset, 1.2), 6)
    return features


def generate_transaction(
    time_offset: Optional[float] = None,
    fraud_rate: float = _FRAUD_RATE,
) -> Dict[str, Any]:
    """
    Generate a single realistic fake credit-card transaction.

    Fields match the Kaggle Credit Card Fraud Detection schema:
        transaction_id, Time, V1-V28, Amount, Class, timestamp

    For fraud transactions the V-features are skewed to match real fraud
    patterns so that a model trained on the Kaggle dataset actually fires.

    Args:
        time_offset: Value for the "Time" field (seconds elapsed since first
                     transaction). If None, a random value in [0, 172800] is used.
        fraud_rate:  Probability of generating a fraudulent transaction.
                     Use _DEMO_FRAUD_RATE (0.08) for visible demo output.

    Returns:
        Dict representing one transaction.
    """
    is_fraud = random.random() < fraud_rate
    class_label = 1 if is_fraud else 0

    if time_offset is None:
        time_offset = random.uniform(0, 172800)

    if is_fraud:
        # Fraud amounts skew small (median ~$9 in Kaggle), with some larger outliers
        amount = max(0.50, random.gauss(_AMOUNT_FRAUD_MEAN, _AMOUNT_FRAUD_STD))
        v_features = _make_fraud_v_features()
    else:
        amount = max(0.01, random.gauss(_AMOUNT_LEGIT_MEAN, _AMOUNT_LEGIT_STD))
        v_features = {
            f"V{i + 1}": round(random.gauss(_V_FEATURE_MEANS[i], _V_FEATURE_STDS[i]), 6)
            for i in range(28)
        }

    transaction = {
        "transaction_id": str(uuid.uuid4()),
        "Time": round(time_offset, 2),
        **v_features,
        "Amount": round(amount, 2),
        "Class": class_label,
        "timestamp": datetime.now(timezone.utc).isoformat(),
    }
    return transaction


def stream_transactions_mock(n: int = 20) -> List[Dict[str, Any]]:
    """
    Generate a list of n mock transactions (no Kafka needed).

    Useful for REST demos and WebSocket streaming without a real broker.

    Args:
        n: Number of transactions to generate.

    Returns:
        List of transaction dicts, with Time values incrementing realistically.
    """
    transactions = []
    time_offset = random.uniform(0, 86400)   # start at a random hour

    for i in range(n):
        time_offset += random.uniform(10, 300)   # 10s – 5 min between transactions
        tx = generate_transaction(time_offset=time_offset)
        transactions.append(tx)

    fraud_count = sum(1 for t in transactions if t["Class"] == 1)
    logger.info(
        f"Generated {n} mock transactions: {fraud_count} fraud, {n - fraud_count} legit."
    )
    return transactions


# ---------------------------------------------------------------------------
# Optional real Kafka producer (requires a running broker)
# ---------------------------------------------------------------------------

class KafkaProducerClient:
    """
    Thin wrapper around kafka-python's KafkaProducer.

    Usage:
        client = KafkaProducerClient(bootstrap_servers="localhost:9092")
        client.send_transaction(generate_transaction())
        client.close()
    """

    def __init__(
        self,
        bootstrap_servers: str = "localhost:9092",
        topic: str = "fraud-transactions",
    ):
        self.topic = topic
        self._producer = None

        try:
            from kafka import KafkaProducer

            self._producer = KafkaProducer(
                bootstrap_servers=bootstrap_servers,
                value_serializer=lambda v: json.dumps(v).encode("utf-8"),
                acks="all",
                retries=3,
            )
            logger.info(f"KafkaProducer connected to {bootstrap_servers}, topic={topic}")
        except Exception as exc:
            logger.warning(
                f"Could not connect to Kafka at {bootstrap_servers}: {exc}. "
                "Use stream_transactions_mock() for demo mode."
            )

    def send_transaction(self, transaction: Dict[str, Any]) -> bool:
        """
        Publish a transaction dict to the Kafka topic.

        Args:
            transaction: Transaction dict (from generate_transaction()).

        Returns:
            True if sent successfully, False otherwise.
        """
        if self._producer is None:
            logger.warning("Kafka producer not available. Transaction not sent.")
            return False
        try:
            self._producer.send(self.topic, value=transaction)
            self._producer.flush()
            return True
        except Exception as exc:
            logger.error(f"Failed to send transaction to Kafka: {exc}")
            return False

    def stream_n_transactions(self, n: int = 100, delay: float = 0.5) -> int:
        """
        Generate and stream n transactions to Kafka with a configurable delay.

        Args:
            n:     Number of transactions to stream.
            delay: Seconds to sleep between publishes (default 0.5).

        Returns:
            Count of successfully published transactions.
        """
        sent = 0
        time_offset = random.uniform(0, 86400)
        for i in range(n):
            time_offset += random.uniform(10, 300)
            tx = generate_transaction(time_offset=time_offset)
            if self.send_transaction(tx):
                sent += 1
            if delay > 0:
                time.sleep(delay)
        logger.info(f"Streamed {sent}/{n} transactions to Kafka topic '{self.topic}'.")
        return sent

    def close(self):
        """Close the underlying Kafka producer connection."""
        if self._producer:
            self._producer.close()
            logger.info("KafkaProducer closed.")
