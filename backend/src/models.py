"""
ML model training module for Credit Card Fraud Detection.
Trains Logistic Regression, Random Forest, XGBoost, and Isolation Forest.
"""

import os
import logging
import numpy as np
import joblib
from pathlib import Path

from sklearn.linear_model import LogisticRegression
from sklearn.ensemble import RandomForestClassifier, IsolationForest
from xgboost import XGBClassifier

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def train_logistic_regression(X_train: np.ndarray, y_train: np.ndarray) -> LogisticRegression:
    """
    Train a Logistic Regression classifier with class_weight='balanced'.

    Args:
        X_train: Training feature matrix.
        y_train: Training labels.

    Returns:
        Fitted LogisticRegression model.
    """
    logger.info("Training Logistic Regression...")
    model = LogisticRegression(
        class_weight="balanced",
        max_iter=1000,
        random_state=42,
        solver="lbfgs",
        n_jobs=-1,
    )
    model.fit(X_train, y_train)
    logger.info("Logistic Regression training complete.")
    return model


def train_random_forest(X_train: np.ndarray, y_train: np.ndarray) -> RandomForestClassifier:
    """
    Train a Random Forest classifier with 100 estimators.

    Args:
        X_train: Training feature matrix.
        y_train: Training labels.

    Returns:
        Fitted RandomForestClassifier model.
    """
    logger.info("Training Random Forest (100 estimators)...")
    model = RandomForestClassifier(
        n_estimators=100,
        class_weight="balanced",
        random_state=42,
        n_jobs=-1,
        max_depth=None,
        min_samples_split=2,
        min_samples_leaf=1,
    )
    model.fit(X_train, y_train)
    logger.info("Random Forest training complete.")
    return model


def train_xgboost(X_train: np.ndarray, y_train: np.ndarray) -> XGBClassifier:
    """
    Train an XGBoost classifier with scale_pos_weight to handle imbalance.

    Args:
        X_train: Training feature matrix.
        y_train: Training labels.

    Returns:
        Fitted XGBClassifier model.
    """
    logger.info("Training XGBoost...")
    # scale_pos_weight = ratio of negatives to positives
    neg_count = int(np.sum(y_train == 0))
    pos_count = int(np.sum(y_train == 1))
    scale_pos_weight = neg_count / max(pos_count, 1)

    model = XGBClassifier(
        n_estimators=100,
        scale_pos_weight=scale_pos_weight,
        max_depth=6,
        learning_rate=0.1,
        subsample=0.8,
        colsample_bytree=0.8,
        use_label_encoder=False,
        eval_metric="logloss",
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_train, y_train)
    logger.info("XGBoost training complete.")
    return model


def train_isolation_forest(X_train: np.ndarray) -> IsolationForest:
    """
    Train an Isolation Forest anomaly detector.
    Uses contamination matching the Kaggle dataset's fraud rate (~0.17%).

    Args:
        X_train: Training feature matrix (labels not used).

    Returns:
        Fitted IsolationForest model.
    """
    logger.info("Training Isolation Forest (anomaly detection)...")
    model = IsolationForest(
        n_estimators=100,
        contamination=0.001727,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(X_train)
    logger.info("Isolation Forest training complete.")
    return model


def train_all_models(
    X_train: np.ndarray,
    y_train: np.ndarray,
    models_dir: str,
) -> dict:
    """
    Train all four models and save each to disk using joblib.

    Args:
        X_train:    Training feature matrix.
        y_train:    Training labels.
        models_dir: Directory path where model files will be saved.

    Returns:
        Dict mapping model name -> fitted model object.
    """
    models_path = Path(models_dir)
    models_path.mkdir(parents=True, exist_ok=True)

    trained = {}

    # Logistic Regression
    lr = train_logistic_regression(X_train, y_train)
    joblib.dump(lr, models_path / "logistic_regression.joblib")
    trained["logistic_regression"] = lr
    logger.info("Saved logistic_regression.joblib")

    # Random Forest
    rf = train_random_forest(X_train, y_train)
    joblib.dump(rf, models_path / "random_forest.joblib")
    trained["random_forest"] = rf
    logger.info("Saved random_forest.joblib")

    # XGBoost
    xgb = train_xgboost(X_train, y_train)
    joblib.dump(xgb, models_path / "xgboost.joblib")
    trained["xgboost"] = xgb
    logger.info("Saved xgboost.joblib")

    # Isolation Forest (unsupervised — trained on X only)
    iso = train_isolation_forest(X_train)
    joblib.dump(iso, models_path / "isolation_forest.joblib")
    trained["isolation_forest"] = iso
    logger.info("Saved isolation_forest.joblib")

    logger.info(f"All models saved to: {models_path}")
    return trained
