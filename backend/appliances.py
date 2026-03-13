# appliances.py

from typing import Dict

APPLIANCES: Dict[str, dict] = {
    "plug_1": {
        "name": "Washing Machine",
        "state": False,
        "units_per_hour": 1.2,
        "flexible": True
    },
    "plug_2": {
        "name": "Air Conditioner",
        "state": False,
        "units_per_hour": 2.0,
        "flexible": True
    },
    "plug_3": {
        "name": "Geyser",
        "state": False,
        "units_per_hour": 2.5,
        "flexible": True
    },
    "plug_4": {
        "name": "Refrigerator",
        "state": True,
        "units_per_hour": 0.3,
        "flexible": False
    },
    "plug_5": {
        "name": "Ceiling Fan",
        "state": True,
        "units_per_hour": 0.075,
        "flexible": False
    },
    "plug_6": {
        "name": "LED Lights",
        "state": True,
        "units_per_hour": 0.06,
        "flexible": False
    },
    "plug_7": {
        "name": "Tube Lights",
        "state": False,
        "units_per_hour": 0.12,
        "flexible": False
    },
    "plug_8": {
        "name": "Air Cooler",
        "state": False,
        "units_per_hour": 0.2,
        "flexible": True
    },
    "plug_9": {
        "name": "Wi-Fi Router",
        "state": True,
        "units_per_hour": 0.015,
        "flexible": False
    },
    "plug_10": {
        "name": "Water Pump",
        "state": False,
        "units_per_hour": 0.75,
        "flexible": True
    },
    "plug_11": {
        "name": "Induction Cooktop",
        "state": False,
        "units_per_hour": 1.8,
        "flexible": True
    },
    "plug_12": {
        "name": "Microwave Oven",
        "state": False,
        "units_per_hour": 1.2,
        "flexible": True
    },
    "plug_13": {
        "name": "Mobile Chargers",
        "state": True,
        "units_per_hour": 0.03,
        "flexible": False
    },
    "plug_14": {
        "name": "Smart TV",
        "state": False,
        "units_per_hour": 0.14,
        "flexible": True
    }
}


def get_all_appliances():
    return APPLIANCES


def update_appliance_state(device_id: str, state: bool):
    if device_id in APPLIANCES:
        APPLIANCES[device_id]["state"] = state
        return True
    return False


def get_total_active_load():
    total = 0.0
    for device in APPLIANCES.values():
        if device["state"]:
            total += device["units_per_hour"]
    return total
