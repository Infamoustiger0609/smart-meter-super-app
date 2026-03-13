from datetime import datetime
from zoneinfo import ZoneInfo

from backend.appliances import get_all_appliances
from backend.tariff import get_current_tariff

BASE_TARIFF = 6.0
BEST_TARIFF = round(BASE_TARIFF * 0.8, 2)


def get_optimized_savings():
    now_ist = datetime.now(ZoneInfo("Asia/Kolkata"))

    tariff_info = get_current_tariff()
    current_tariff = tariff_info["data"]["effective_tariff"]

    appliances = get_all_appliances()

    flexible_on_devices = []
    total_units = 0.0

    for device_id, device in appliances.items():
        if device["state"] and device["flexible"]:
            flexible_on_devices.append(
                {
                    "device_id": device_id,
                    "name": device["name"],
                    "units_per_hour": device["units_per_hour"],
                }
            )
            total_units += device["units_per_hour"]

    total_units = round(total_units, 2)

    current_cost = round(total_units * current_tariff, 2)
    optimized_cost = round(total_units * BEST_TARIFF, 2)
    savings = round(current_cost - optimized_cost, 2)

    return {
        "status": "success",
        "data": {
            "timestamp": now_ist.isoformat(),
            "active_flexible_devices": flexible_on_devices,
            "total_flexible_units_per_hour": total_units,
            "current_tariff": current_tariff,
            "best_possible_tariff": BEST_TARIFF,
            "current_cost_per_hour": current_cost,
            "optimized_cost_per_hour": optimized_cost,
            "savings_per_hour": savings,
            "message": (
                "Already optimized"
                if savings <= 0
                else "Shift flexible load to 04:00-10:00 for best savings"
            ),
        },
    }

