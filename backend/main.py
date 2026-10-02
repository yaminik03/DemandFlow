from pathlib import Path
import sys

import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

ROOT = Path(__file__).resolve().parent
sys.path.insert(0, str(ROOT))

from src.generate_data import ensure_data
from src.model import train_model, forecast_next_30_days, historical_data
from src.inventory import calculate_inventory_metrics


DATA_PATH = ROOT / "data" / "inventory_sales.csv"

app = FastAPI(
    title="DemandFlow API",
    description="Demand forecasting and inventory planning API.",
    version="1.0.0",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def load_model_data():
    df = ensure_data(DATA_PATH)
    model, performance = train_model(df)
    return df, model, performance


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/options")
def options():
    df = ensure_data(DATA_PATH)

    return {
        "products": sorted(df["product"].unique().tolist()),
        "regions": sorted(df["region"].unique().tolist()),
    }


@app.get("/api/dashboard")
def dashboard(
    product: str = Query("Wireless Headphones"),
    region: str = Query("Florida"),
    current_inventory: int = Query(500, ge=0),
    lead_time_days: int = Query(14, ge=1, le=90),
):
    df, model, performance = load_model_data()

    valid_products = set(df["product"].unique())
    valid_regions = set(df["region"].unique())

    if product not in valid_products:
        raise HTTPException(status_code=400, detail="Unknown product.")
    if region not in valid_regions:
        raise HTTPException(status_code=400, detail="Unknown region.")

    selected = df[
        (df["product"] == product) &
        (df["region"] == region)
    ].sort_values("date")

    if selected.empty:
        raise HTTPException(status_code=404, detail="No data found.")

    forecast = forecast_next_30_days(df, product, region, model)
    history = historical_data(df, product, region, 90)

    predicted_demand = sum(row["demand"] for row in forecast)

    daily_std = float(selected["demand"].tail(90).std())
    metrics = calculate_inventory_metrics(
        predicted_demand=predicted_demand,
        daily_demand_std=daily_std,
        lead_time_days=lead_time_days,
        current_inventory=current_inventory,
    )

    return {
        "product": product,
        "region": region,
        "current_inventory": current_inventory,
        "lead_time_days": lead_time_days,
        "forecast": forecast,
        "history": history,
        "metrics": {
            "thirty_day_demand": round(predicted_demand),
            **metrics,
        },
        "model": {
            "mae": performance["mae"],
            "rmse": performance["rmse"],
            "train_test": "80% / 20%",
        },
    }


@app.get("/api/inventory-status")
def inventory_status():
    df, model, _ = load_model_data()

    rows = []

    defaults = {
        "Florida": 500,
        "Georgia": 630,
        "Texas": 300,
        "North Carolina": 240,
        "Virginia": 210,
    }

    for product in sorted(df["product"].unique()):
        for region in sorted(df["region"].unique()):
            selected = df[
                (df["product"] == product) &
                (df["region"] == region)
            ].sort_values("date")

            forecast = forecast_next_30_days(df, product, region, model)
            predicted_demand = sum(x["demand"] for x in forecast)
            current = defaults.get(region, 250)

            metrics = calculate_inventory_metrics(
                predicted_demand=predicted_demand,
                daily_demand_std=float(selected["demand"].tail(90).std()),
                lead_time_days=14,
                current_inventory=current,
            )

            rows.append({
                "product": product,
                "region": region,
                "stock": current,
                "demand": round(predicted_demand),
                "reorder": metrics["reorder_point"],
                "risk": metrics["risk"],
                "order": metrics["recommended_order"],
            })

    return rows
