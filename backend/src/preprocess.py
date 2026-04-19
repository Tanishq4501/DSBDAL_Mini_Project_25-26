"""
Preprocessing module for Credit Card Fraud Detection.
Handles data loading, validation, feature scaling, and SMOTE oversampling.
"""

import pandas as pd
import numpy as np
from sklearn.preprocessing import RobustScaler, StandardScaler
from sklearn.model_selection import train_test_split
from imblearn.over_sampling import SMOTE
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def load_and_validate(filepath: str) -> pd.DataFrame:
    """
    Load CSV file and perform basic validation checks.

    Args:
        filepath: Path to the creditcard.csv file.

    Returns:
        Validated pandas DataFrame.

    Raises:
        FileNotFoundError: If the CSV file does not exist.
        ValueError: If required columns are missing.
    """
    logger.info(f"Loading dataset from: {filepath}")
    df = pd.read_csv(filepath)

    # Check required columns
    expected_cols = ["Time", "Amount", "Class"] + [f"V{i}" for i in range(1, 29)]
    missing_cols = [c for c in expected_cols if c not in df.columns]
    if missing_cols:
        raise ValueError(f"Missing required columns: {missing_cols}")

    # Report missing values
    missing_count = df.isnull().sum().sum()
    if missing_count > 0:
        logger.warning(f"Found {missing_count} missing values. Dropping rows with NaN.")
        df = df.dropna()
    else:
        logger.info("No missing values found.")

    # Report and remove duplicates
    dup_count = df.duplicated().sum()
    if dup_count > 0:
        logger.warning(f"Found {dup_count} duplicate rows. Removing duplicates.")
        df = df.drop_duplicates()
    else:
        logger.info("No duplicate rows found.")

    total = len(df)
    fraud = df["Class"].sum()
    legit = total - fraud
    fraud_pct = (fraud / total) * 100

    logger.info(f"Dataset loaded: {total} rows | Fraud: {fraud} ({fraud_pct:.4f}%) | Legit: {legit}")
    return df


def scale_features(df: pd.DataFrame) -> pd.DataFrame:
    """
    Apply RobustScaler to Amount and StandardScaler to Time.
    PCA features V1-V28 are already scaled in the Kaggle dataset.

    Args:
        df: Raw DataFrame with Amount and Time columns.

    Returns:
        DataFrame with scaled Amount and Time columns (in-place copy).
    """
    df = df.copy()

    robust_scaler = RobustScaler()
    df["Amount"] = robust_scaler.fit_transform(df[["Amount"]])

    std_scaler = StandardScaler()
    df["Time"] = std_scaler.fit_transform(df[["Time"]])

    logger.info("Feature scaling applied: RobustScaler(Amount), StandardScaler(Time).")
    return df


def apply_smote(X_train: np.ndarray, y_train: np.ndarray):
    """
    Apply SMOTE oversampling to address class imbalance.

    Args:
        X_train: Training feature matrix.
        y_train: Training labels.

    Returns:
        Tuple (X_resampled, y_resampled) after SMOTE.
    """
    logger.info(f"Before SMOTE — Class distribution: {dict(zip(*np.unique(y_train, return_counts=True)))}")

    smote = SMOTE(random_state=42, sampling_strategy="minority")
    X_resampled, y_resampled = smote.fit_resample(X_train, y_train)

    logger.info(f"After SMOTE  — Class distribution: {dict(zip(*np.unique(y_resampled, return_counts=True)))}")
    return X_resampled, y_resampled


def prepare_data(filepath: str, test_size: float = 0.2, apply_smote_flag: bool = True):
    """
    Full data preparation pipeline.

    Steps:
        1. Load and validate the CSV.
        2. Scale Amount (RobustScaler) and Time (StandardScaler).
        3. Train/test split (stratified).
        4. Optionally apply SMOTE on training set.

    Args:
        filepath:          Path to creditcard.csv.
        test_size:         Fraction of data for the test set (default 0.2).
        apply_smote_flag:  Whether to apply SMOTE oversampling (default True).

    Returns:
        Tuple (X_train, X_test, y_train, y_test) as numpy arrays.
    """
    df = load_and_validate(filepath)
    df = scale_features(df)

    feature_cols = ["Time", "Amount"] + [f"V{i}" for i in range(1, 29)]
    X = df[feature_cols].values
    y = df["Class"].values

    X_train, X_test, y_train, y_test = train_test_split(
        X, y,
        test_size=test_size,
        random_state=42,
        stratify=y
    )
    logger.info(f"Train size: {len(X_train)} | Test size: {len(X_test)}")

    if apply_smote_flag:
        X_train, y_train = apply_smote(X_train, y_train)

    return X_train, X_test, y_train, y_test
