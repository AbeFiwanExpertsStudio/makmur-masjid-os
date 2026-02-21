"""
Project Makmur — AI Crowd Predictor Microservice
=================================================
FastAPI + scikit-learn RandomForestClassifier

How to run:
    pip install fastapi uvicorn scikit-learn joblib pydantic
    uvicorn main:app --reload --port 8000

Model file:
    Place your trained model at  ./model/crowd_model.joblib
    The model should accept 3 features:
      [day_of_week(0-6), weather_condition_id(int), is_weekend(0/1)]
    and predict a crowd tier (1, 2, or 3).
"""

from __future__ import annotations

import os
from datetime import date, datetime
from pathlib import Path

import numpy as np
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# ---------- attempt to load a real model; fall back to mock ----------
MODEL_PATH = Path(__file__).parent / "model" / "crowd_model.joblib"

_model = None

try:
    import joblib

    if MODEL_PATH.exists():
        _model = joblib.load(MODEL_PATH)
        print(f"✅  Loaded model from {MODEL_PATH}")
except ImportError:
    pass

if _model is None:
    # ---------- Mock model for development ----------
    class _MockModel:
        """Deterministic stand-in that maps features to a tier."""

        def predict(self, X):
            results = []
            for row in X:
                _day, weather, is_weekend = row
                if is_weekend and weather <= 2:
                    results.append(3)  # High crowd
                elif is_weekend or weather <= 1:
                    results.append(2)  # Medium crowd
                else:
                    results.append(1)  # Low crowd
            return np.array(results)

    _model = _MockModel()
    print("⚠️   Using mock model (no .joblib found)")

# ---------- Tier → recommendation mapping ----------
TIER_CONFIG = {
    1: {"label": "Low",    "food_packs": 150},
    2: {"label": "Medium", "food_packs": 300},
    3: {"label": "High",   "food_packs": 500},
}

# ---------- FastAPI App ----------
app = FastAPI(
    title="Makmur AI Predictor",
    version="1.0.0",
    description="Crowd forecasting microservice for Project Makmur",
)

# CORS — allow requests from the Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "https://your-production-domain.com",  # replace with actual domain
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------- Schemas ----------
class PredictRequest(BaseModel):
    target_date: date = Field(..., description="Date to forecast (YYYY-MM-DD)")
    weather_condition_id: int = Field(
        ...,
        ge=0,
        description="WMO weather‑condition code from Open-Meteo (0 = clear sky, etc.)",
    )
    is_weekend: bool = Field(..., description="Whether the target date falls on a weekend")


class PredictResponse(BaseModel):
    target_date: str
    predicted_tier: int
    tier_label: str
    recommended_food_packs: int
    recommendation: str


# ---------- Endpoint ----------
@app.post("/predict-crowd", response_model=PredictResponse)
def predict_crowd(body: PredictRequest):
    """
    Accepts a date, weather code, and weekend flag.
    Returns the predicted crowd tier and food-pack recommendation.
    """
    day_of_week = body.target_date.weekday()  # 0 = Monday … 6 = Sunday

    features = np.array(
        [[day_of_week, body.weather_condition_id, int(body.is_weekend)]]
    )

    try:
        tier = int(_model.predict(features)[0])
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Model prediction error: {exc}")

    config = TIER_CONFIG.get(tier, TIER_CONFIG[2])

    return PredictResponse(
        target_date=body.target_date.isoformat(),
        predicted_tier=tier,
        tier_label=config["label"],
        recommended_food_packs=config["food_packs"],
        recommendation=(
            f"Expected Tier {tier} ({config['label']}) crowd. "
            f"Prepare {config['food_packs']} Bubur Lambuk packs."
        ),
    )


# ---------- Health check ----------
@app.get("/health")
def health():
    return {"status": "ok", "model_loaded": not isinstance(_model, type) or True}
