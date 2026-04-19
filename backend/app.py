"""
FraudShield API — FastAPI application for Credit Card Fraud Detection.

Run with:
    uvicorn app:app --reload --port 8000

All endpoints degrade gracefully when creditcard.csv or trained models
are not present, returning realistic mock data so the frontend always works.
"""

import asyncio
import json
import logging
import os
import random
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

import joblib
import numpy as np
import pandas as pd
from fastapi import BackgroundTasks, FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# App setup
# ---------------------------------------------------------------------------

app = FastAPI(
    title="FraudShield API",
    description="Credit Card Fraud Detection backend using ML models.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

BASE_DIR = Path(__file__).parent
DATA_PATH = BASE_DIR / "data" / "creditcard.csv"
MODELS_DIR = BASE_DIR / "models"
KAFKA_BOOTSTRAP_SERVERS = os.getenv("KAFKA_BOOTSTRAP_SERVERS", "").strip()
KAFKA_STREAM_TOPIC = os.getenv("KAFKA_STREAM_TOPIC", "fraud-transactions").strip()
KAFKA_STREAM_MAX_MESSAGES = int(os.getenv("KAFKA_STREAM_MAX_MESSAGES", "50"))
KAFKA_STREAM_IDLE_SECONDS = float(os.getenv("KAFKA_STREAM_IDLE_SECONDS", "8"))

# ---------------------------------------------------------------------------
# Helper: load dataset (returns None if not available)
# ---------------------------------------------------------------------------

def _load_df() -> Optional[pd.DataFrame]:
    """Load the creditcard.csv dataset if it exists."""
    if DATA_PATH.exists():
        try:
            return pd.read_csv(DATA_PATH)
        except Exception as exc:
            logger.warning(f"Could not read dataset: {exc}")
    return None


# ---------------------------------------------------------------------------
# Scalers — fitted once, cached for the lifetime of the process.
#
# The models were trained with:
#   Amount → RobustScaler  (center=median, scale=IQR)
#   Time   → StandardScaler(mean, std)
#   V1-V28 → already zero-centred PCA components, no additional scaling
#
# Raw values MUST be transformed before inference, otherwise the model's
# learned decision boundaries (calibrated on scaled data) are meaningless.
# ---------------------------------------------------------------------------

_SCALER_CACHE: Optional[Dict[str, Any]] = None


def _get_scalers() -> Dict[str, Any]:
    """
    Return (and lazily build) the Amount/Time scalers used during training.

    Priority:
      1. Return cached scalers if already built this process.
      2. Fit from creditcard.csv (most accurate — exact same data as training).
      3. Fall back to hardcoded Kaggle dataset statistics.
    """
    global _SCALER_CACHE
    if _SCALER_CACHE is not None:
        return _SCALER_CACHE

    from sklearn.preprocessing import RobustScaler, StandardScaler

    if DATA_PATH.exists():
        try:
            # Read only the two columns we need — avoids loading 31 cols × 284k rows
            cols = pd.read_csv(DATA_PATH, usecols=["Amount", "Time"])
            amount_scaler = RobustScaler()
            time_scaler   = StandardScaler()
            amount_scaler.fit(cols[["Amount"]])
            time_scaler.fit(cols[["Time"]])
            _SCALER_CACHE = {"amount": amount_scaler, "time": time_scaler}
            logger.info("Scalers fitted from creditcard.csv and cached.")
            return _SCALER_CACHE
        except Exception as exc:
            logger.warning(f"Could not fit scalers from CSV: {exc}. Using hardcoded Kaggle stats.")

    # ── Hardcoded fallback (Kaggle creditcard.csv statistics) ────────────────
    # RobustScaler stores center_ and scale_ (IQR).
    # Kaggle Amount: median≈22.0, Q1≈5.60, Q3≈77.165  → IQR≈71.565
    # StandardScaler stores mean_ and scale_ (std).
    # Kaggle Time:   mean≈94813.86, std≈47488.15
    amount_scaler = RobustScaler()
    amount_scaler.center_ = np.array([22.0])
    amount_scaler.scale_  = np.array([71.565])
    amount_scaler.n_features_in_ = 1
    amount_scaler.feature_names_in_ = None

    time_scaler = StandardScaler()
    time_scaler.mean_  = np.array([94813.86])
    time_scaler.scale_ = np.array([47488.15])
    time_scaler.var_   = np.array([47488.15 ** 2])
    time_scaler.n_features_in_ = 1
    time_scaler.n_samples_seen_ = 284807

    _SCALER_CACHE = {"amount": amount_scaler, "time": time_scaler}
    logger.info("Scalers initialised from hardcoded Kaggle dataset statistics.")
    return _SCALER_CACHE


def _scale_features(X: np.ndarray) -> np.ndarray:
    """
    Apply Amount and Time scaling to a feature row.

    Feature order (matches training): [Time, Amount, V1, V2, ..., V28]
    Index 0 = Time  → StandardScaler
    Index 1 = Amount → RobustScaler
    V1-V28 (indices 2-29) are PCA components — no scaling needed.
    """
    scalers = _get_scalers()
    X = X.copy().astype(float)
    X[:, 0] = scalers["time"].transform(X[:, [0]]).ravel()    # Time
    X[:, 1] = scalers["amount"].transform(X[:, [1]]).ravel()  # Amount
    return X


# ---------------------------------------------------------------------------
# Helper: load best available trained model
# ---------------------------------------------------------------------------

def _load_best_model():
    """
    Try to load the best trained model from disk.
    Priority: xgboost > random_forest > logistic_regression > isolation_forest.
    Checks both .pkl (Colab/joblib) and .joblib extensions.
    Returns (model_object, model_name) or (None, None).
    """
    # XGBoost: try native .json first (no version warning), then fall back to .pkl
    xgb_json = MODELS_DIR / "xgboost_model.json"
    if xgb_json.exists():
        try:
            import xgboost as xgb_lib
            model = xgb_lib.XGBClassifier()
            model.load_model(str(xgb_json))
            logger.info(f"Loaded model: xgboost (native json) from {xgb_json}")
            return model, "xgboost"
        except Exception as exc:
            logger.warning(f"Could not load xgboost_model.json: {exc}")

    priority = [
        ("xgboost",             ["xgboost_model.pkl", "xgboost.pkl", "xgboost.joblib"]),
        ("random_forest",       ["random_forest.pkl", "random_forest.joblib"]),
        ("logistic_regression", ["logistic_regression.pkl", "logistic_regression.joblib"]),
        ("isolation_forest",    ["isolation_forest.pkl", "isolation_forest.joblib"]),
    ]
    for name, filenames in priority:
        for filename in filenames:
            path = MODELS_DIR / filename
            if path.exists():
                try:
                    model = joblib.load(path)
                    logger.info(f"Loaded model: {name} from {path}")
                    return model, name
                except Exception as exc:
                    logger.warning(f"Could not load {filename}: {exc}")
    return None, None


def _score_stream_transaction(tx: Dict[str, Any], model: Any) -> tuple[int, float]:
    # Feature order must match training: [Time, Amount, V1..V28]
    feature_cols = ["Time", "Amount"] + [f"V{i}" for i in range(1, 29)]

    if model is not None:
        try:
            from sklearn.ensemble import IsolationForest as _IsoForest

            features = [float(tx.get(col, 0.0)) for col in feature_cols]
            X = np.array(features).reshape(1, -1)

            # ── Apply the same scalers used during training ──────────────────
            # Models were trained on RobustScaler(Amount) + StandardScaler(Time).
            # Without this step the model's decision boundaries are calibrated for
            # scaled values so raw inputs produce almost all-legitimate predictions.
            X = _scale_features(X)

            if isinstance(model, _IsoForest):
                raw = model.predict(X)
                is_fraud = int(1 if raw[0] == -1 else 0)
                score = float(-model.decision_function(X)[0])
                probability = round(min(max(score, 0.0), 1.0), 4)
            else:
                is_fraud = int(model.predict(X)[0])
                if hasattr(model, "predict_proba"):
                    probability = round(float(model.predict_proba(X)[0][1]), 4)
                else:
                    probability = float(is_fraud)
            return is_fraud, probability
        except Exception as exc:
            logger.warning(f"Model scoring failed: {exc}; falling back to Class label")

    # ── Fallback: use the Class label embedded in the Kafka message ──────────
    # The generator sets Class=1 for simulated fraud, so this is reliable.
    is_fraud = int(tx.get("Class", 0))
    if is_fraud:
        probability = round(random.uniform(0.72, 0.99), 4)
    else:
        probability = round(random.uniform(0.001, 0.08), 4)
    return is_fraud, probability


async def _try_stream_from_kafka(websocket: WebSocket, model: Any, total: int) -> int:
    if not KAFKA_BOOTSTRAP_SERVERS:
        return 0

    try:
        from kafka import KafkaConsumer
    except Exception as exc:
        logger.info(f"Kafka consumer unavailable: {exc}")
        return 0

    try:
        consumer = KafkaConsumer(
            KAFKA_STREAM_TOPIC,
            bootstrap_servers=[server.strip() for server in KAFKA_BOOTSTRAP_SERVERS.split(",") if server.strip()],
            auto_offset_reset="latest",
            enable_auto_commit=True,
            consumer_timeout_ms=1000,
            group_id=f"fraudshield-stream-{uuid.uuid4().hex[:8]}",
            value_deserializer=lambda value: json.loads(value.decode("utf-8")),
        )
    except Exception as exc:
        logger.warning(f"Could not connect Kafka consumer: {exc}")
        return 0

    received = 0
    idle_since = asyncio.get_running_loop().time()

    try:
        while received < total:
            records = await asyncio.to_thread(consumer.poll, timeout_ms=1000, max_records=1)
            if not records:
                if asyncio.get_running_loop().time() - idle_since >= KAFKA_STREAM_IDLE_SECONDS:
                    break
                continue

            idle_since = asyncio.get_running_loop().time()
            for batch in records.values():
                for record in batch:
                    tx = record.value or {}
                    is_fraud, probability = _score_stream_transaction(tx, model)
                    message = {
                        "transaction_id": tx.get("transaction_id", str(uuid.uuid4())),
                        "Amount": tx.get("Amount", 0.0),
                        "is_fraud": is_fraud,
                        "fraud_probability": probability,
                        "risk_level": "high" if probability >= 0.7 else ("medium" if probability >= 0.4 else "low"),
                        "timestamp": tx.get("timestamp", datetime.now(timezone.utc).isoformat()),
                        "sequence": received + 1,
                        "total": total,
                    }
                    await websocket.send_text(json.dumps(message))
                    received += 1
                    if received >= total:
                        break
                if received >= total:
                    break
    finally:
        try:
            consumer.close()
        except Exception:
            pass

    return received


# ---------------------------------------------------------------------------
# Mock / fallback data constants
# ---------------------------------------------------------------------------

MOCK_DATASET_INFO = {
    "total_rows": 284807,
    "fraud_count": 492,
    "legit_count": 284315,
    "fraud_pct": 0.1727,
    "features": ["Time"] + [f"V{i}" for i in range(1, 29)] + ["Amount"],
    "source": "mock",
}

MOCK_MODEL_METRICS: List[Dict[str, Any]] = [
    {
        "model_name": "Logistic Regression",
        "precision": 0.87,
        "recall": 0.76,
        "f1": 0.81,
        "roc_auc": 0.977,
        "pr_auc": 0.72,
        "confusion_matrix": {"tp": 87, "tn": 56820, "fp": 13, "fn": 27},
        "source": "mock",
    },
    {
        "model_name": "Random Forest",
        "precision": 0.96,
        "recall": 0.82,
        "f1": 0.88,
        "roc_auc": 0.985,
        "pr_auc": 0.84,
        "confusion_matrix": {"tp": 94, "tn": 56829, "fp": 4, "fn": 20},
        "source": "mock",
    },
    {
        "model_name": "XGBoost",
        "precision": 0.94,
        "recall": 0.84,
        "f1": 0.89,
        "roc_auc": 0.987,
        "pr_auc": 0.86,
        "confusion_matrix": {"tp": 96, "tn": 56827, "fp": 6, "fn": 18},
        "source": "mock",
    },
    {
        "model_name": "Isolation Forest",
        "precision": 0.34,
        "recall": 0.28,
        "f1": 0.31,
        "roc_auc": 0.633,
        "pr_auc": 0.21,
        "confusion_matrix": {"tp": 32, "tn": 56716, "fp": 62, "fn": 82},
        "source": "mock",
    },
]

# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------

@app.get("/api/health", tags=["System"])
async def health_check():
    """Returns server health status."""
    return {"status": "ok", "timestamp": datetime.now(timezone.utc).isoformat()}


@app.get("/api/dataset/info", tags=["Dataset"])
async def dataset_info():
    """
    Returns basic statistics about the loaded dataset.
    Falls back to realistic mock stats if creditcard.csv is not present.
    """
    df = _load_df()
    if df is None:
        return MOCK_DATASET_INFO

    total = len(df)
    fraud = int(df["Class"].sum())
    legit = total - fraud
    fraud_pct = round((fraud / total) * 100, 4)
    features = [c for c in df.columns if c != "Class"]

    return {
        "total_rows": total,
        "fraud_count": fraud,
        "legit_count": legit,
        "fraud_pct": fraud_pct,
        "features": features,
        "source": "live",
    }


@app.get("/api/eda/class-distribution", tags=["EDA"])
async def class_distribution():
    """
    Returns class distribution counts and fraud percentage.
    """
    df = _load_df()
    if df is None:
        return {"legitimate": 284315, "fraud": 492, "fraud_pct": 0.1727, "source": "mock"}

    total = len(df)
    fraud = int(df["Class"].sum())
    legit = total - fraud
    fraud_pct = round((fraud / total) * 100, 4)
    return {"legitimate": legit, "fraud": fraud, "fraud_pct": fraud_pct, "source": "live"}


@app.get("/api/eda/amount-stats", tags=["EDA"])
async def amount_stats():
    """
    Returns Amount statistics (mean, median, std, max) grouped by class.
    """
    df = _load_df()

    if df is None:
        return {
            "legitimate": {
                "mean": 88.29,
                "median": 22.0,
                "std": 250.11,
                "max": 25691.16,
                "min": 0.0,
            },
            "fraud": {
                "mean": 122.21,
                "median": 9.25,
                "std": 256.68,
                "max": 2125.87,
                "min": 0.0,
            },
            "source": "mock",
        }

    def _stats(series: pd.Series) -> dict:
        return {
            "mean": round(float(series.mean()), 4),
            "median": round(float(series.median()), 4),
            "std": round(float(series.std()), 4),
            "max": round(float(series.max()), 4),
            "min": round(float(series.min()), 4),
        }

    return {
        "legitimate": _stats(df[df["Class"] == 0]["Amount"]),
        "fraud": _stats(df[df["Class"] == 1]["Amount"]),
        "source": "live",
    }


@app.get("/api/eda/feature-correlations", tags=["EDA"])
async def feature_correlations():
    """
    Returns the top 15 feature correlations with the Class column.
    """
    df = _load_df()

    if df is None:
        # Realistic mock correlations based on the Kaggle dataset
        mock_corrs = [
            {"feature": "V17", "correlation": -0.3265},
            {"feature": "V14", "correlation": -0.3026},
            {"feature": "V12", "correlation": -0.2605},
            {"feature": "V10", "correlation": -0.2165},
            {"feature": "V16", "correlation": -0.1965},
            {"feature": "V3",  "correlation": -0.1929},
            {"feature": "V7",  "correlation": -0.1876},
            {"feature": "V11", "correlation":  0.1546},
            {"feature": "V4",  "correlation":  0.1331},
            {"feature": "V2",  "correlation":  0.0915},
            {"feature": "V21", "correlation":  0.0865},
            {"feature": "V6",  "correlation": -0.0743},
            {"feature": "V5",  "correlation": -0.0948},
            {"feature": "Amount", "correlation": 0.0057},
            {"feature": "Time",   "correlation": -0.0124},
        ]
        return {"correlations": mock_corrs, "source": "mock"}

    feature_cols = [c for c in df.columns if c != "Class"]
    corr_series = df[feature_cols + ["Class"]].corr()["Class"].drop("Class")
    top15 = corr_series.abs().nlargest(15).index.tolist()

    correlations = [
        {"feature": feat, "correlation": round(float(corr_series[feat]), 4)}
        for feat in top15
    ]
    return {"correlations": correlations, "source": "live"}


@app.get("/api/models/metrics", tags=["Models"])
async def model_metrics():
    """
    Returns performance metrics for all trained models.
    Falls back to realistic mock metrics if models have not been trained.
    """
    # Try to load and evaluate actual models
    metrics = []
    # Check both .pkl (from Colab) and .joblib naming
    def _find_model_path(candidates):
        for c in candidates:
            p = MODELS_DIR / c
            if p.exists():
                return p
        return None

    model_files = {
        "Logistic Regression": _find_model_path(["logistic_regression.pkl", "logistic_regression.joblib"]),
        "Random Forest":       _find_model_path(["random_forest.pkl", "random_forest.joblib"]),
        "XGBoost":             _find_model_path(["xgboost_model.pkl", "xgboost.pkl", "xgboost.joblib"]),
        "Isolation Forest":    _find_model_path(["isolation_forest.pkl", "isolation_forest.joblib"]),
    }
    model_files = {k: v for k, v in model_files.items() if v is not None}

    # Also check for metrics.json saved by Colab notebook
    metrics_json = MODELS_DIR / "metrics.json"
    if metrics_json.exists():
        try:
            with open(metrics_json) as f:
                saved = json.load(f)
            # Normalize keys to match frontend expectations
            for m in saved:
                if "model" in m and "model_name" not in m:
                    m["model_name"] = m.pop("model")
                m.setdefault("source", "colab")
                if "confusion_matrix" not in m:
                    m["confusion_matrix"] = {"tp": m.pop("tp", 0), "tn": m.pop("tn", 0),
                                              "fp": m.pop("fp", 0), "fn": m.pop("fn", 0)}
            return {"metrics": saved, "source": "colab_metrics"}
        except Exception as exc:
            logger.warning(f"Could not load metrics.json: {exc}")

    any_found = bool(model_files)
    if not any_found:
        return {"metrics": MOCK_MODEL_METRICS, "source": "mock"}

    # Models exist — try real evaluation if dataset is available
    df = _load_df()
    if df is None:
        return {"metrics": MOCK_MODEL_METRICS, "source": "mock_models_no_data"}

    try:
        import sys
        sys.path.insert(0, str(BASE_DIR / "src"))
        from preprocess import scale_features
        from evaluate import compare_models
        from sklearn.model_selection import train_test_split

        df_scaled = scale_features(df)
        feature_cols = ["Time", "Amount"] + [f"V{i}" for i in range(1, 29)]
        X = df_scaled[feature_cols].values
        y = df_scaled["Class"].values
        _, X_test, _, y_test = train_test_split(X, y, test_size=0.2, random_state=42, stratify=y)

        models_dict = {}
        for display_name, path in model_files.items():
            if path.exists():
                try:
                    models_dict[display_name] = joblib.load(path)
                except Exception:
                    pass

        if models_dict:
            results = compare_models(models_dict, X_test, y_test)
            return {"metrics": results, "source": "live"}
    except Exception as exc:
        logger.warning(f"Live evaluation failed: {exc}. Returning mock metrics.")

    return {"metrics": MOCK_MODEL_METRICS, "source": "mock"}


@app.post("/api/predict", tags=["Prediction"])
async def predict_transaction(transaction: Dict[str, Any]):
    """
    Predict whether a transaction is fraudulent.

    Accepts a JSON body containing transaction features:
        Time, V1-V28, Amount

    Returns:
        prediction (0=legit, 1=fraud), probability, model_used, risk_level.
    """
    feature_cols = ["Time", "Amount"] + [f"V{i}" for i in range(1, 29)]

    model, model_name = _load_best_model()

    if model is None:
        # Mock prediction
        prob = round(random.uniform(0.0, 0.15), 4)
        # Occasionally simulate a fraud for demo purposes
        if random.random() < 0.05:
            prob = round(random.uniform(0.6, 0.99), 4)
        prediction = 1 if prob >= 0.5 else 0
        risk_level = "high" if prob >= 0.7 else ("medium" if prob >= 0.4 else "low")
        return {
            "prediction": prediction,
            "probability": prob,
            "model_used": "mock",
            "risk_level": risk_level,
            "note": "No trained model found; using mock prediction.",
        }

    try:
        # Build feature vector — order matches training: [Time, Amount, V1..V28]
        features = []
        for col in feature_cols:
            val = transaction.get(col, 0.0)
            features.append(float(val))
        X = np.array(features).reshape(1, -1)

        # Apply the same scalers used during training before inference
        X = _scale_features(X)

        from sklearn.ensemble import IsolationForest as _IsoForest
        if isinstance(model, _IsoForest):
            raw = model.predict(X)
            prediction = int(1 if raw[0] == -1 else 0)
            score = float(-model.decision_function(X)[0])
            prob = round(min(max(score, 0.0), 1.0), 4)
        else:
            prediction = int(model.predict(X)[0])
            if hasattr(model, "predict_proba"):
                prob = round(float(model.predict_proba(X)[0][1]), 4)
            else:
                prob = float(prediction)

        risk_level = "high" if prob >= 0.7 else ("medium" if prob >= 0.4 else "low")

        return {
            "prediction": prediction,
            "probability": prob,
            "model_used": model_name,
            "risk_level": risk_level,
        }

    except Exception as exc:
        logger.error(f"Prediction error: {exc}")
        return {
            "prediction": 0,
            "probability": 0.0,
            "model_used": "error",
            "risk_level": "low",
            "error": str(exc),
        }


@app.get("/api/train", tags=["Training"])
async def trigger_training(background_tasks: BackgroundTasks):
    """
    Trigger model training in the background if creditcard.csv is available.
    Returns immediately with a status message.
    """
    if not DATA_PATH.exists():
        return {
            "status": "skipped",
            "message": (
                f"Dataset not found at {DATA_PATH}. "
                "Place creditcard.csv in backend/data/ and retry."
            ),
        }

    def _train():
        import sys
        sys.path.insert(0, str(BASE_DIR / "src"))
        try:
            from preprocess import prepare_data
            from models import train_all_models

            logger.info("Background training started.")
            X_train, X_test, y_train, y_test = prepare_data(str(DATA_PATH))
            train_all_models(X_train, y_train, str(MODELS_DIR))
            logger.info("Background training complete.")
        except Exception as exc:
            logger.error(f"Background training failed: {exc}")

    background_tasks.add_task(_train)
    return {
        "status": "started",
        "message": "Model training started in the background. Check server logs for progress.",
    }


@app.post("/api/models/train", tags=["Training"])
async def trigger_training_post(background_tasks: BackgroundTasks):
    """Compatibility alias used by the frontend API helper."""
    return await trigger_training(background_tasks)


# ---------------------------------------------------------------------------
# WebSocket: live transaction stream
# ---------------------------------------------------------------------------

@app.websocket("/ws/stream")
async def websocket_stream(websocket: WebSocket):
    """
    Stream 50 mock transactions to the WebSocket client, one every 0.5 seconds.
    Each message is a JSON object with:
        transaction_id, Amount, is_fraud, fraud_probability, timestamp
    """
    await websocket.accept()
    logger.info("WebSocket client connected to /ws/stream")

    import sys
    sys.path.insert(0, str(BASE_DIR / "src"))

    model, _model_name = _load_best_model()

    try:
        received = await _try_stream_from_kafka(websocket, model, KAFKA_STREAM_MAX_MESSAGES)
        if received > 0:
            await websocket.send_text(json.dumps({"event": "stream_end", "total_sent": received, "source": "kafka"}))
            return

        from kafka_producer import generate_transaction, _DEMO_FRAUD_RATE

        time_offset = random.uniform(0, 86400)
        # Use demo fraud rate (8 %) so fraud events are visible in the dashboard.
        # The real Kaggle rate (0.17 %) would produce ~0 fraud in 50 transactions.
        mock_fraud_rate = float(os.getenv("TX_GENERATOR_FRAUD_RATE", str(_DEMO_FRAUD_RATE)))

        for i in range(KAFKA_STREAM_MAX_MESSAGES):
            time_offset += random.uniform(10, 300)
            tx = generate_transaction(time_offset=time_offset, fraud_rate=mock_fraud_rate)
            is_fraud, prob = _score_stream_transaction(tx, model)

            message = {
                "transaction_id": tx["transaction_id"],
                "Amount": tx["Amount"],
                "is_fraud": is_fraud,
                "fraud_probability": prob,
                "risk_level": "high" if prob >= 0.7 else ("medium" if prob >= 0.4 else "low"),
                "timestamp": tx["timestamp"],
                "sequence": i + 1,
                "total": 50,
            }

            await websocket.send_text(json.dumps(message))
            await asyncio.sleep(0.5)

        # Signal stream end
        await websocket.send_text(
            json.dumps(
                {
                    "event": "stream_end",
                    "total_sent": KAFKA_STREAM_MAX_MESSAGES,
                    "source": "mock",
                }
            )
        )

    except WebSocketDisconnect:
        logger.info("WebSocket client disconnected from /ws/stream")
    except Exception as exc:
        logger.error(f"WebSocket stream error: {exc}")
        try:
            await websocket.send_text(json.dumps({"event": "error", "message": str(exc)}))
        except Exception:
            pass
    finally:
        try:
            await websocket.close()
        except Exception:
            pass
        logger.info("WebSocket /ws/stream closed.")


# ---------------------------------------------------------------------------
# Entry point (for running directly with python app.py)
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app:app", host="0.0.0.0", port=8000, reload=True)
