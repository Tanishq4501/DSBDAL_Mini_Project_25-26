"""
Evaluation module for Credit Card Fraud Detection models.
Computes precision, recall, F1, ROC-AUC, PR-AUC, confusion matrix,
classification report, and feature importances.
"""

import logging
import numpy as np
from typing import Optional, List, Dict, Any

from sklearn.metrics import (
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    average_precision_score,
    confusion_matrix,
    classification_report,
)
from sklearn.ensemble import RandomForestClassifier, IsolationForest
from sklearn.linear_model import LogisticRegression

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def evaluate_model(
    model_name: str,
    y_true: np.ndarray,
    y_pred: np.ndarray,
    y_prob: Optional[np.ndarray] = None,
) -> Dict[str, Any]:
    """
    Compute evaluation metrics for a single model.

    Args:
        model_name: Human-readable model name (used as dict key).
        y_true:     Ground-truth binary labels.
        y_pred:     Predicted binary labels.
        y_prob:     Predicted probabilities for the positive class (optional).

    Returns:
        Dict containing:
            model_name, precision, recall, f1, roc_auc, pr_auc,
            confusion_matrix {tn, fp, fn, tp}, classification_report (str).
    """
    precision = float(precision_score(y_true, y_pred, zero_division=0))
    recall = float(recall_score(y_true, y_pred, zero_division=0))
    f1 = float(f1_score(y_true, y_pred, zero_division=0))

    roc_auc = None
    pr_auc = None
    if y_prob is not None:
        try:
            roc_auc = float(roc_auc_score(y_true, y_prob))
            pr_auc = float(average_precision_score(y_true, y_prob))
        except ValueError as exc:
            logger.warning(f"Could not compute AUC scores for {model_name}: {exc}")

    cm = confusion_matrix(y_true, y_pred)
    tn, fp, fn, tp = (int(cm[0, 0]), int(cm[0, 1]), int(cm[1, 0]), int(cm[1, 1]))

    report = classification_report(y_true, y_pred, zero_division=0)

    result = {
        "model_name": model_name,
        "precision": round(precision, 4),
        "recall": round(recall, 4),
        "f1": round(f1, 4),
        "roc_auc": round(roc_auc, 4) if roc_auc is not None else None,
        "pr_auc": round(pr_auc, 4) if pr_auc is not None else None,
        "confusion_matrix": {"tn": tn, "fp": fp, "fn": fn, "tp": tp},
        "classification_report": report,
    }

    logger.info(
        f"{model_name} — Precision: {precision:.4f}, Recall: {recall:.4f}, "
        f"F1: {f1:.4f}, ROC-AUC: {roc_auc}, PR-AUC: {pr_auc}"
    )
    return result


def compare_models(
    models_dict: Dict[str, Any],
    X_test: np.ndarray,
    y_test: np.ndarray,
) -> List[Dict[str, Any]]:
    """
    Evaluate multiple models and return a list of metric dicts.

    Args:
        models_dict: Dict mapping model_name -> fitted model object.
        X_test:      Test feature matrix.
        y_test:      Test labels.

    Returns:
        List of evaluation result dicts (one per model), sorted by F1 descending.
    """
    results = []

    for name, model in models_dict.items():
        logger.info(f"Evaluating {name}...")

        if isinstance(model, IsolationForest):
            # IsolationForest returns -1 (anomaly) or 1 (normal)
            raw_pred = model.predict(X_test)
            y_pred = np.where(raw_pred == -1, 1, 0)
            # Use decision_function scores (lower = more anomalous)
            scores = -model.decision_function(X_test)
            # Normalise to [0, 1] range for probability proxy
            s_min, s_max = scores.min(), scores.max()
            y_prob = (scores - s_min) / (s_max - s_min + 1e-9)
        else:
            y_pred = model.predict(X_test)
            if hasattr(model, "predict_proba"):
                y_prob = model.predict_proba(X_test)[:, 1]
            elif hasattr(model, "decision_function"):
                df_scores = model.decision_function(X_test)
                y_prob = (df_scores - df_scores.min()) / (df_scores.max() - df_scores.min() + 1e-9)
            else:
                y_prob = None

        result = evaluate_model(name, y_test, y_pred, y_prob)
        results.append(result)

    results.sort(key=lambda r: r["f1"] if r["f1"] is not None else 0, reverse=True)
    return results


def get_feature_importance(
    model: Any,
    feature_names: List[str],
    model_type: str,
) -> List[Dict[str, Any]]:
    """
    Extract and return the top 15 feature importances for a given model.

    Supported model types: 'random_forest', 'xgboost', 'logistic_regression'.
    Isolation Forest does not have feature importances; returns an empty list.

    Args:
        model:         Fitted model object.
        feature_names: List of feature column names.
        model_type:    One of 'random_forest', 'xgboost', 'logistic_regression',
                       'isolation_forest'.

    Returns:
        List of dicts [{"feature": str, "importance": float}, ...] (top 15, sorted desc).
    """
    importances = None

    if model_type in ("random_forest", "xgboost"):
        if hasattr(model, "feature_importances_"):
            importances = model.feature_importances_

    elif model_type == "logistic_regression":
        if hasattr(model, "coef_"):
            importances = np.abs(model.coef_[0])

    if importances is None:
        logger.warning(f"Feature importances not available for model_type='{model_type}'.")
        return []

    if len(importances) != len(feature_names):
        logger.warning(
            f"Length mismatch: importances={len(importances)}, features={len(feature_names)}."
        )
        min_len = min(len(importances), len(feature_names))
        importances = importances[:min_len]
        feature_names = feature_names[:min_len]

    sorted_idx = np.argsort(importances)[::-1][:15]
    result = [
        {
            "feature": feature_names[i],
            "importance": round(float(importances[i]), 6),
        }
        for i in sorted_idx
    ]
    return result
