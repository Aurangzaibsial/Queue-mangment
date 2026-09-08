"""Load and run the trained queue wait-time model."""

import logging
import os
from pathlib import Path
from typing import Optional

import joblib
import numpy as np
import xgboost as xgb

logger = logging.getLogger(__name__)

FEATURE_NAMES = (
    "queue_position",
    "queue_length",
    "historical_service_avg",
    "minutes_since_midnight",
    "time_sin",
    "time_cos",
    "queue_pressure",
)
DEFAULT_MODEL_PATH = (
    Path(__file__).resolve().parent.parent
    / "ai model"
    / "smart_queue_model_v2_colab.json"
)

_model = None
_model_error: Optional[str] = None


def _load_model():
    global _model, _model_error
    if _model is not None or _model_error is not None:
        return _model

    model_path = Path(os.getenv("QUEUE_ML_MODEL_PATH", str(DEFAULT_MODEL_PATH)))
    try:
        if model_path.suffix.lower() == ".json":
            loaded_model = xgb.XGBRegressor()
            loaded_model.load_model(model_path)
        else:
            loaded_model = joblib.load(model_path)
        expected_features = getattr(loaded_model, "n_features_in_", len(FEATURE_NAMES))
        if expected_features != len(FEATURE_NAMES):
            raise ValueError(
                f"expected {len(FEATURE_NAMES)} features, model expects {expected_features}"
            )
        _model = loaded_model
        logger.info("Loaded queue ML model from %s", model_path)
    except Exception as exc:
        _model_error = f"{type(exc).__name__}: {exc}"
        logger.warning("Queue ML model unavailable at %s: %s", model_path, _model_error)

    return _model


def model_status() -> dict:
    model = _load_model()
    return {
        "loaded": model is not None,
        "path": os.getenv("QUEUE_ML_MODEL_PATH", str(DEFAULT_MODEL_PATH)),
        "features": list(FEATURE_NAMES),
        "error": _model_error,
    }


def predict_wait_time(
    queue_position: int,
    queue_length: int,
    historical_service_avg: float,
    minutes_since_midnight: int,
    queue_pressure: float,
) -> Optional[float]:
    model = _load_model()
    if model is None:
        return None

    time_radians = (minutes_since_midnight / 1440.0) * 2 * np.pi
    features = np.array([[
        queue_position,
        queue_length,
        historical_service_avg,
        minutes_since_midnight,
        np.sin(time_radians),
        np.cos(time_radians),
        queue_pressure,
    ]], dtype=float)
    prediction = float(np.asarray(model.predict(features)).reshape(-1)[0])
    return max(0.5, round(prediction, 1))
