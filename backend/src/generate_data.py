import numpy as np
import pandas as pd
from pathlib import Path


PRODUCTS = {
    "Wireless Headphones": 35,
    "Mechanical Keyboard": 25,
    "Wireless Mouse": 45,
    "Laptop Stand": 20,
    "USB-C Hub": 30,
    "Webcam HD": 18,
    "Monitor 24-inch": 15,
    "Laptop Backpack": 22,
}

REGIONS = {
    "Florida": 1.15,
    "Georgia": 0.90,
    "Texas": 1.05,
    "North Carolina": 0.85,
    "Virginia": 0.75,
}


def generate_inventory_data(
    start_date="2025-01-01",
    end_date="2026-09-28",
    seed=42,
):
    rng = np.random.default_rng(seed)
    dates = pd.date_range(start_date, end_date, freq="D")
    rows = []

    for product, base_demand in PRODUCTS.items():
        for region, region_multiplier in REGIONS.items():
            for date in dates:
                weekly = 1.12 if date.dayofweek < 5 else 0.82
                month = date.month
                seasonal = 1.0 + 0.12 * np.sin((month - 1) / 12 * 2 * np.pi)
                holiday = 1.18 if month in (11, 12) else 1.0
                noise = rng.normal(1.0, 0.12)

                demand = max(
                    1,
                    int(round(base_demand * region_multiplier * weekly * seasonal * holiday * noise))
                )

                rows.append(
                    {
                        "date": date,
                        "product": product,
                        "region": region,
                        "demand": demand,
                    }
                )

    return pd.DataFrame(rows)


def ensure_data(path="data/inventory_sales.csv"):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)

    if not path.exists():
        df = generate_inventory_data()
        df.to_csv(path, index=False)

    return pd.read_csv(path, parse_dates=["date"])


if __name__ == "__main__":
    ensure_data()
    print("Inventory data created.")
