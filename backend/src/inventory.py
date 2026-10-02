import math


def calculate_inventory_metrics(
    predicted_demand,
    daily_demand_std,
    lead_time_days,
    current_inventory,
    service_level_z=1.65,
):
    avg_daily_demand = predicted_demand / 30
    safety_stock = service_level_z * daily_demand_std * math.sqrt(lead_time_days)
    reorder_point = (avg_daily_demand * lead_time_days) + safety_stock

    recommended_order = max(
        0,
        math.ceil(predicted_demand + safety_stock - current_inventory),
    )

    coverage_days = (
        current_inventory / avg_daily_demand
        if avg_daily_demand > 0
        else 0
    )

    if current_inventory <= safety_stock:
        risk = "High"
        recommendation = "Replenish soon. Inventory is below the safety threshold."
    elif current_inventory <= reorder_point:
        risk = "Medium"
        recommendation = "Review replenishment before inventory reaches the safety threshold."
    else:
        risk = "Low"
        recommendation = "Inventory is above the reorder point for the selected planning horizon."

    return {
        "avg_daily_demand": round(avg_daily_demand, 1),
        "safety_stock": round(safety_stock),
        "reorder_point": round(reorder_point),
        "recommended_order": int(recommended_order),
        "coverage_days": round(coverage_days, 1),
        "risk": risk,
        "recommendation": recommendation,
    }
