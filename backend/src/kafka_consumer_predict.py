"""
Kafka consumer utilities for the fraud-detection demo.

This module supports:
1. A lightweight Python consumer for the Docker Compose Kafka broker.
2. Exporting a Spark Structured Streaming example aligned to the same schema.
"""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

import joblib
import numpy as np


FEATURE_COLS = ["Time", "Amount"] + [f"V{i}" for i in range(1, 29)]
DEFAULT_TOPIC = "fraud-transactions"
DEFAULT_BOOTSTRAP = "localhost:29092"
DEFAULT_MODEL_PATH = "models/random_forest.pkl"


def _load_model(model_path: str) -> Any:
    path = Path(model_path)
    if path.exists():
        model = joblib.load(path)
        print(f"[INFO] Loaded model from {path}")
        return model

    print("[WARN] No saved model found; using mock predictions.")
    return None


def _predict_transaction(transaction: dict[str, Any], model: Any) -> dict[str, float]:
    if model is None:
        probability = float(np.random.beta(0.5, 50))
        return {"prediction": int(probability > 0.5), "probability": round(probability, 4)}

    features = np.array([[float(transaction.get(column, 0.0)) for column in FEATURE_COLS]])
    prediction = int(model.predict(features)[0])
    probability = (
        float(model.predict_proba(features)[0][1])
        if hasattr(model, "predict_proba")
        else float(prediction)
    )
    return {"prediction": prediction, "probability": round(probability, 4)}


def run_python_consumer(
    topic: str = DEFAULT_TOPIC,
    bootstrap_servers: str = DEFAULT_BOOTSTRAP,
    model_path: str = DEFAULT_MODEL_PATH,
    max_messages: int = 100,
) -> None:
    """
    Consume Kafka messages and predict fraud with a saved sklearn model.

    Falls back to a mock stream if Kafka is unavailable.
    """

    model = _load_model(model_path)

    try:
        from kafka import KafkaConsumer

        consumer = KafkaConsumer(
            topic,
            bootstrap_servers=bootstrap_servers,
            value_deserializer=lambda value: json.loads(value.decode("utf-8")),
            auto_offset_reset="latest",
            group_id="fraud-detector-group",
        )
        print(f"[INFO] Connected to Kafka. Consuming from '{topic}'...")

        processed = 0
        for message in consumer:
            transaction = message.value or {}
            result = _predict_transaction(transaction, model)
            label = "FRAUD" if result["prediction"] == 1 else "LEGIT"
            print(
                f"[{label}] TX={transaction.get('transaction_id', '?')} | "
                f"Amount={transaction.get('Amount', 0):.2f} | "
                f"FraudProb={result['probability']:.4f}"
            )
            processed += 1
            if processed >= max_messages:
                break

        consumer.close()

    except ImportError:
        print("[WARN] kafka-python is not installed. Install with: pip install kafka-python")
    except Exception as exc:
        print(f"[ERROR] Kafka not available: {exc}")
        print("[INFO] Running mock consumer demo instead...\n")
        _run_mock_consumer(model, max_messages)


def _run_mock_consumer(model: Any, count: int = 20) -> None:
    """Simulate a live transaction stream without Kafka."""
    from src.kafka_producer import generate_transaction

    print("[MOCK] Simulating live transaction stream...\n")
    fraud_count = 0

    for _ in range(count):
        transaction = generate_transaction()
        result = _predict_transaction(transaction, model)
        label = "FRAUD" if result["prediction"] == 1 else "LEGIT"
        if result["prediction"] == 1:
            fraud_count += 1

        print(
            f"[{label}] TX={transaction['transaction_id']} | "
            f"Amount={transaction['Amount']:.2f} | "
            f"FraudProb={result['probability']:.4f}"
        )
        time.sleep(0.1)

    rate = (fraud_count / count * 100) if count else 0.0
    print(f"\n[SUMMARY] Processed: {count} | Fraud Detected: {fraud_count} | Rate: {rate:.2f}%")


SPARK_CONSUMER_CODE = f"""
from pyspark.ml import PipelineModel
from pyspark.sql import SparkSession
from pyspark.sql import functions as F
from pyspark.sql.types import DoubleType, IntegerType, StringType, StructField, StructType


def run_streaming_fraud_detection():
    spark = (
        SparkSession.builder
        .appName("FraudDetection-Streaming")
        .config("spark.sql.streaming.checkpointLocation", "/tmp/fraud_checkpoint")
        .getOrCreate()
    )
    spark.sparkContext.setLogLevel("WARN")

    schema = StructType([
        StructField("transaction_id", StringType(), True),
        StructField("Time", DoubleType(), True),
        *[StructField(f"V{{i}}", DoubleType(), True) for i in range(1, 29)],
        StructField("Amount", DoubleType(), True),
        StructField("Class", IntegerType(), True),
        StructField("timestamp", StringType(), True),
    ])

    raw_stream = (
        spark.readStream
        .format("kafka")
        .option("kafka.bootstrap.servers", "{DEFAULT_BOOTSTRAP}")
        .option("subscribe", "{DEFAULT_TOPIC}")
        .option("startingOffsets", "latest")
        .load()
    )

    parsed = (
        raw_stream
        .select(F.from_json(F.col("value").cast("string"), schema).alias("data"))
        .select("data.*")
    )

    try:
        model = PipelineModel.load("hdfs:///user/fraud/models/rf_pipeline")
        predictions = model.transform(parsed)
    except Exception:
        predictions = parsed.withColumn(
            "prediction",
            F.when(F.col("Amount") > 5000, 1.0).otherwise(0.0),
        )

    query = (
        predictions
        .select("transaction_id", "Amount", "prediction", "timestamp")
        .writeStream
        .outputMode("append")
        .format("console")
        .option("truncate", False)
        .trigger(processingTime="5 seconds")
        .start()
    )

    print("[STREAMING] Fraud detection pipeline running. Press Ctrl+C to stop.")
    query.awaitTermination()


if __name__ == "__main__":
    run_streaming_fraud_detection()
"""


def save_spark_consumer(output_path: str = "src/kafka_spark_stream.py") -> None:
    """Write the Spark Structured Streaming example to disk."""
    Path(output_path).write_text(SPARK_CONSUMER_CODE.lstrip(), encoding="utf-8")
    print(f"[INFO] Spark streaming script saved to {output_path}")


if __name__ == "__main__":
    run_python_consumer(max_messages=30)
