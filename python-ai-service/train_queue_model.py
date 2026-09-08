"""Train a portable queue wait-time model from the supplied prediction data."""

import csv
import math
from datetime import datetime
from pathlib import Path

import joblib
import xgboost as xgb


ROOT = Path(__file__).resolve().parent.parent
DATA_PATH = ROOT / "Predictions" / "wait_time_predictions_v2.csv"
MODEL_PATH = ROOT / "ai model" / "smart_queue_model_v2.json"
PICKLE_MODEL_PATH = ROOT / "ai model" / "smart_queue_model_v2_fixed.pkl"


def build_features(row):
    timestamp = datetime.strptime(row["arrival_time"], "%Y-%m-%d %H:%M:%S")
    minutes = timestamp.hour * 60 + timestamp.minute
    radians = minutes / 1440.0 * 2 * math.pi
    queue_length = float(row["queue_length"])
    return [
        float(row["queue_position"]),
        queue_length,
        float(row["historical_service_avg"]),
        minutes,
        math.sin(radians),
        math.cos(radians),
        queue_length,
    ]


def main():
    with DATA_PATH.open(newline="", encoding="utf-8") as data_file:
        rows = list(csv.DictReader(data_file))

    features = [build_features(row) for row in rows]
    targets = [float(row["realistic_wait_time"]) for row in rows]
    model = xgb.XGBRegressor(
        n_estimators=300,
        max_depth=6,
        learning_rate=0.05,
        subsample=0.9,
        colsample_bytree=0.9,
        objective="reg:squarederror",
        random_state=42,
        n_jobs=1,
    )
    model.fit(features, targets)
    MODEL_PATH.parent.mkdir(parents=True, exist_ok=True)
    model.save_model(MODEL_PATH)
    joblib.dump(model, PICKLE_MODEL_PATH)
    print(f"Saved {MODEL_PATH} using {len(rows)} rows and {len(features[0])} features")
    print(f"Saved {PICKLE_MODEL_PATH}")


if __name__ == "__main__":
    main()