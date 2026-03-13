from datetime import datetime
from zoneinfo import ZoneInfo

from backend.appliances import get_total_active_load
from backend.tariff import get_current_tariff, BASE_TARIFF


def get_current_cost():
    total_units = get_total_active_load()
    tariff_info = get_current_tariff()
    effective_tariff = tariff_info["data"]["effective_tariff"]

    cost_per_hour = total_units * effective_tariff

    return {
        "status": "success",
        "data": {
            "current_time_ist": datetime.now(ZoneInfo("Asia/Kolkata")).isoformat(),
            "total_units_per_hour": round(total_units, 2),
            "effective_tariff": round(effective_tariff, 2),
            "cost_per_hour": round(cost_per_hour, 2),
        },
    }


def get_billing_estimate(monthly_kwh=None):
    active_units_per_hour = get_total_active_load()

    if monthly_kwh is None:
        projected_monthly_kwh = round(active_units_per_hour * 24 * 30, 2)
    else:
        projected_monthly_kwh = round(max(0.0, float(monthly_kwh)), 2)

    current_tariff = get_current_tariff()["data"]["effective_tariff"]

    estimated_bill = round(projected_monthly_kwh * current_tariff, 2)
    baseline_bill = round(projected_monthly_kwh * BASE_TARIFF, 2)
    savings_vs_base = round(baseline_bill - estimated_bill, 2)

    return {
        "status": "success",
        "data": {
            "projected_monthly_kwh": projected_monthly_kwh,
            "tariff_used": round(current_tariff, 2),
            "estimated_monthly_bill": estimated_bill,
            "baseline_flat_tariff_bill": baseline_bill,
            "savings_vs_flat_tariff": savings_vs_base,
        },
    }

