# tariff.py
from datetime import datetime, time
from zoneinfo import ZoneInfo
from backend import simulation_state

EMISSION_FACTORS = {
    "off_peak": 0.60,   # Solar-heavy
    "normal": 0.82,     # Average grid
    "peak": 1.00        # Coal-heavy peak
}
BASE_TARIFF = 6.0  # â‚¹/kWh


def get_current_tariff():

    # ðŸ”¹ Use simulated time if set, otherwise real IST time
    if simulation_state.SIMULATED_TIME:
        now_ist = simulation_state.SIMULATED_TIME
    else:
        now_ist = datetime.now(ZoneInfo("Asia/Kolkata"))

    now = now_ist.time()

    # Solar / Off-peak: 04:00 â€“ 10:00 (20% rebate)
    if time(4, 0) <= now < time(10, 0):
        return {
            "status": "success",
            "message": "Solar / Off-peak hours (20% rebate applied)",
            "data": {
                "current_time_ist": now_ist.strftime("%Y-%m-%d %H:%M:%S"),
                "timezone": "Asia/Kolkata (IST)",
                "base_tariff": BASE_TARIFF,
                "effective_tariff": round(BASE_TARIFF * 0.8, 2),
                "adjustment": "-20%",
                "time_window": "04:00 - 10:00",
                "type": "off_peak"
            }
        }

    # Peak: 14:00 â€“ 17:00 (20% surcharge)
    if time(14, 0) <= now < time(17, 0):
        return {
            "status": "success",
            "message": "Peak hours (20% surcharge applied)",
            "data": {
                "current_time_ist": now_ist.strftime("%Y-%m-%d %H:%M:%S"),
                "timezone": "Asia/Kolkata (IST)",
                "base_tariff": BASE_TARIFF,
                "effective_tariff": round(BASE_TARIFF * 1.2, 2),
                "adjustment": "+20%",
                "time_window": "14:00 - 17:00",
                "type": "peak"
            }
        }

    # Peak: 22:00 â€“ 01:00 (20% surcharge)
    if now >= time(22, 0) or now < time(1, 0):
        return {
            "status": "success",
            "message": "Peak hours (20% surcharge applied)",
            "data": {
                "current_time_ist": now_ist.strftime("%Y-%m-%d %H:%M:%S"),
                "timezone": "Asia/Kolkata (IST)",
                "base_tariff": BASE_TARIFF,
                "effective_tariff": round(BASE_TARIFF * 1.2, 2),
                "adjustment": "+20%",
                "time_window": "22:00 - 01:00",
                "type": "peak"
            }
        }

    # Normal hours
    return {
        "status": "success",
        "message": "Normal tariff hours",
        "data": {
            "current_time_ist": now_ist.strftime("%Y-%m-%d %H:%M:%S"),
            "timezone": "Asia/Kolkata (IST)",
            "base_tariff": BASE_TARIFF,
            "effective_tariff": BASE_TARIFF,
            "adjustment": "0%",
            "time_window": "Normal hours",
            "type": "normal"
        }
    }

def get_tariff_for_time(target_datetime):
    now = target_datetime.time()

    if time(4, 0) <= now < time(10, 0):
        return BASE_TARIFF * 0.8

    if time(14, 0) <= now < time(17, 0):
        return BASE_TARIFF * 1.2

    if now >= time(22, 0) or now < time(1, 0):
        return BASE_TARIFF * 1.2

    return BASE_TARIFF

def get_emission_factor_for_time(target_datetime):
    now = target_datetime.time()

    if time(4, 0) <= now < time(10, 0):
        return EMISSION_FACTORS["off_peak"]

    if time(14, 0) <= now < time(17, 0):
        return EMISSION_FACTORS["peak"]

    if now >= time(22, 0) or now < time(1, 0):
        return EMISSION_FACTORS["peak"]

    return EMISSION_FACTORS["normal"]
