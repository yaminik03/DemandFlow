import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error


FEATURES = [
    "day_of_week",
    "month",
    "day_of_year",
    "lag_7",
    "lag_14",
    "lag_30",
    "rolling_mean_7",
    "rolling_mean_30",
]


def prepare_features(df: pd.DataFrame) -> pd.DataFrame:
    data = df.copy()
    data = data.sort_values(["product", "region", "date"])

    group = data.groupby(["product", "region"])["demand"]

    data["day_of_week"] = data["date"].dt.dayofweek
    data["month"] = data["date"].dt.month
    data["day_of_year"] = data["date"].dt.dayofyear
    data["lag_7"] = group.shift(7)
    data["lag_14"] = group.shift(14)
    data["lag_30"] = group.shift(30)
    data["rolling_mean_7"] = group.transform(lambda s: s.shift(1).rolling(7).mean())
    data["rolling_mean_30"] = group.transform(lambda s: s.shift(1).rolling(30).mean())

    return data.dropna(subset=FEATURES + ["demand"]).reset_index(drop=True)


def train_model(df: pd.DataFrame):
    featured = prepare_features(df)
    featured = featured.sort_values("date")

    split = int(len(featured) * 0.8)
    train = featured.iloc[:split]
    test = featured.iloc[split:]

    model = RandomForestRegressor(
        n_estimators=150,
        max_depth=12,
        random_state=42,
        n_jobs=-1,
    )
    model.fit(train[FEATURES], train["demand"])

    predictions = model.predict(test[FEATURES])
    mae = mean_absolute_error(test["demand"], predictions)
    rmse = np.sqrt(mean_squared_error(test["demand"], predictions))

    return model, {
        "mae": round(float(mae), 2),
        "rmse": round(float(rmse), 2),
        "train_rows": int(len(train)),
        "test_rows": int(len(test)),
    }


def forecast_next_30_days(df: pd.DataFrame, product: str, region: str, model):
    history = (
        df[(df["product"] == product) & (df["region"] == region)]
        .sort_values("date")[["date", "demand"]]
        .copy()
    )

    values = history["demand"].astype(float).tolist()
    last_date = history["date"].max()
    rows = []

    for step in range(1, 31):
        next_date = last_date + pd.Timedelta(days=step)

        row = {
            "day_of_week": next_date.dayofweek,
            "month": next_date.month,
            "day_of_year": next_date.dayofyear,
            "lag_7": values[-7],
            "lag_14": values[-14],
            "lag_30": values[-30],
            "rolling_mean_7": float(np.mean(values[-7:])),
            "rolling_mean_30": float(np.mean(values[-30:])),
        }

        prediction = max(0, float(model.predict(pd.DataFrame([row], columns=FEATURES))[0]))
        values.append(prediction)

        rows.append(
            {
                "date": next_date.strftime("%b %d"),
                "demand": round(prediction, 1),
            }
        )

    return rows


def historical_data(df: pd.DataFrame, product: str, region: str, days: int = 90):
    history = (
        df[(df["product"] == product) & (df["region"] == region)]
        .sort_values("date")
        .tail(days)
    )

    return [
        {"date": row.date.strftime("%b %d"), "units": int(row.demand)}
        for row in history.itertuples()
    ]
