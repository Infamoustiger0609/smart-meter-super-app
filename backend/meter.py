from backend.appliances import get_total_active_load
from datetime import datetime
from zoneinfo import ZoneInfo


def get_live_meter_reading():
    units = get_total_active_load()

    return {
        "status": "success",
        "data": {
            "timestamp": datetime.now(ZoneInfo("Asia/Kolkata")).isoformat(),
            "units_kwh": units
        }
    }
