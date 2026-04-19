"""
One-time script: converts xgboost_model.pkl → xgboost_model.json
Run from the backend/ directory:
    python fix_xgboost_model.py
"""

import joblib
from pathlib import Path

MODELS_DIR = Path(__file__).parent / "models"
pkl_path  = MODELS_DIR / "xgboost_model.pkl"
json_path = MODELS_DIR / "xgboost_model.json"

if not pkl_path.exists():
    print(f"[ERROR] {pkl_path} not found.")
    raise SystemExit(1)

print(f"[INFO] Loading {pkl_path} ...")
model = joblib.load(pkl_path)          # triggers the warning — that's fine

print(f"[INFO] Saving native XGBoost model → {json_path}")
model.get_booster().save_model(str(json_path))

print("[OK] Done. xgboost_model.json created.")
print("     The WARNING will disappear on next server start.")
