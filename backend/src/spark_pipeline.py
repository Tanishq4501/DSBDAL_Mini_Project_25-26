"""
PySpark pipeline module for Credit Card Fraud Detection.
Creates a Spark ML pipeline with VectorAssembler and StandardScaler stages.
Falls back to a local pandas-based analysis when HDFS is not available.
"""

import logging
from typing import List, Optional, Dict, Any

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def create_spark_session(app_name: str = "FraudDetection"):
    """
    Create and return a SparkSession.

    Args:
        app_name: Spark application name.

    Returns:
        SparkSession object.

    Raises:
        ImportError: If PySpark is not installed.
        RuntimeError: If Spark cannot be initialised (e.g. no JVM).
    """
    try:
        from pyspark.sql import SparkSession

        spark = (
            SparkSession.builder.appName(app_name)
            .config("spark.driver.memory", "2g")
            .config("spark.executor.memory", "2g")
            .config("spark.sql.shuffle.partitions", "4")
            .getOrCreate()
        )
        spark.sparkContext.setLogLevel("WARN")
        logger.info(f"SparkSession created: {app_name}")
        return spark
    except Exception as exc:
        logger.error(f"Failed to create SparkSession: {exc}")
        raise


def load_from_hdfs(spark, path: str):
    """
    Load a CSV file from HDFS into a Spark DataFrame.

    Args:
        spark: Active SparkSession.
        path:  HDFS path (e.g. 'hdfs://namenode:9000/data/creditcard.csv').

    Returns:
        Spark DataFrame with inferred schema.
    """
    logger.info(f"Loading data from HDFS: {path}")
    df = (
        spark.read.format("csv")
        .option("header", "true")
        .option("inferSchema", "true")
        .load(path)
    )
    logger.info(f"Loaded {df.count()} rows from HDFS.")
    return df


def build_spark_pipeline(feature_cols: List[str]):
    """
    Build a Spark ML Pipeline with:
        1. VectorAssembler — combines feature columns into a single vector.
        2. StandardScaler  — standardises the assembled feature vector.

    Args:
        feature_cols: List of column names to use as features.

    Returns:
        pyspark.ml.Pipeline object (not yet fitted).

    Raises:
        ImportError: If PySpark ML is not available.
    """
    from pyspark.ml import Pipeline
    from pyspark.ml.feature import VectorAssembler, StandardScaler

    assembler = VectorAssembler(inputCols=feature_cols, outputCol="raw_features")
    scaler = StandardScaler(
        inputCol="raw_features",
        outputCol="features",
        withStd=True,
        withMean=True,
    )
    pipeline = Pipeline(stages=[assembler, scaler])
    logger.info(f"Spark ML Pipeline built with {len(feature_cols)} features.")
    return pipeline


def _local_fallback_analysis(csv_path: str) -> Dict[str, Any]:
    """
    Perform a local pandas-based fraud analysis when HDFS/Spark is unavailable.

    Args:
        csv_path: Local path to creditcard.csv.

    Returns:
        Dict with fraud stats summary.
    """
    import pandas as pd

    logger.info(f"Running local fallback analysis on: {csv_path}")
    df = pd.read_csv(csv_path)

    total = len(df)
    fraud_count = int(df["Class"].sum())
    legit_count = total - fraud_count
    fraud_pct = round((fraud_count / total) * 100, 4)

    fraud_amount_mean = round(float(df[df["Class"] == 1]["Amount"].mean()), 4)
    legit_amount_mean = round(float(df[df["Class"] == 0]["Amount"].mean()), 4)

    return {
        "engine": "pandas_local_fallback",
        "total_records": total,
        "fraud_count": fraud_count,
        "legit_count": legit_count,
        "fraud_pct": fraud_pct,
        "fraud_amount_mean": fraud_amount_mean,
        "legit_amount_mean": legit_amount_mean,
    }


def run_spark_analysis(csv_path: Optional[str] = None) -> Dict[str, Any]:
    """
    Run the full Spark analysis pipeline.

    Attempts to connect to Spark. If no HDFS path is provided or Spark/HDFS
    is unavailable, falls back to a local pandas analysis.

    Args:
        csv_path: Local path to creditcard.csv (used for fallback and as local
                  Spark input when HDFS is not configured).

    Returns:
        Dict with analysis results including counts, percentages, and amount stats.
    """
    feature_cols = ["Time", "Amount"] + [f"V{i}" for i in range(1, 29)]

    # --- Try Spark path ---
    try:
        spark = create_spark_session()

        if csv_path:
            logger.info(f"Loading local CSV into Spark: {csv_path}")
            sdf = (
                spark.read.format("csv")
                .option("header", "true")
                .option("inferSchema", "true")
                .load(csv_path)
            )
        else:
            raise RuntimeError("No CSV path provided; cannot load data into Spark.")

        total = sdf.count()
        logger.info(f"Spark DataFrame loaded: {total} rows.")

        # Cast Class to integer for aggregation
        from pyspark.sql.functions import col, avg, count
        sdf = sdf.withColumn("Class", col("Class").cast("int"))

        class_counts = (
            sdf.groupBy("Class")
            .agg(count("*").alias("count"), avg("Amount").alias("avg_amount"))
            .collect()
        )

        stats = {"engine": "spark", "total_records": total}
        for row in class_counts:
            label = "fraud" if row["Class"] == 1 else "legit"
            stats[f"{label}_count"] = int(row["count"])
            stats[f"{label}_amount_mean"] = round(float(row["avg_amount"]), 4)

        fraud_count = stats.get("fraud_count", 0)
        stats["fraud_pct"] = round((fraud_count / total) * 100, 4)

        # Build and fit the preprocessing pipeline
        pipeline = build_spark_pipeline(feature_cols)
        fitted_pipeline = pipeline.fit(sdf)
        transformed = fitted_pipeline.transform(sdf)
        logger.info(f"Spark pipeline fitted and transformed {transformed.count()} rows.")

        spark.stop()
        return stats

    except Exception as exc:
        logger.warning(f"Spark analysis failed ({exc}). Falling back to local pandas analysis.")

        if csv_path:
            try:
                return _local_fallback_analysis(csv_path)
            except Exception as fallback_exc:
                logger.error(f"Local fallback also failed: {fallback_exc}")

        # Return mock stats if neither path works
        return {
            "engine": "mock",
            "total_records": 284807,
            "fraud_count": 492,
            "legit_count": 284315,
            "fraud_pct": 0.1727,
            "fraud_amount_mean": 122.21,
            "legit_amount_mean": 88.29,
            "note": "Mock data — no dataset or Spark available.",
        }
