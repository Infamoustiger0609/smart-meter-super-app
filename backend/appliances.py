# appliances.py

from typing import Dict

APPLIANCES: Dict[str, dict] = {
    "plug_1": {
        "name": "Washing Machine",
        "state": False,
        "units_per_hour": 0.5,
        "flexible": True
    },
    "plug_2": {
        "name": "Air Conditioner",
        "state": False,
        "units_per_hour": 1.5,
        "flexible": True
    },
    "plug_3": {
        "name": "Geyser",
        "state": False,
        "units_per_hour": 2.0,
        "flexible": True
    },
    "plug_4": {
        "name": "Refrigerator",
        "state": True,
        "units_per_hour": 0.15,
        "flexible": False
    },
    "plug_5": {
        "name": "Ceiling Fan",
        "state": False,
        "units_per_hour": 0.075,
        "flexible": False
    },
    "plug_6": {
        "name": "LED Lights",
        "state": True,
        "units_per_hour": 0.04,
        "flexible": False
    },
    "plug_7": {
        "name": "Tube Lights",
        "state": False,
        "units_per_hour": 0.04,
        "flexible": False
    },
    "plug_8": {
        "name": "Air Cooler",
        "state": False,
        "units_per_hour": 0.18,
        "flexible": True
    },
    "plug_9": {
        "name": "Wi-Fi Router",
        "state": False,
        "units_per_hour": 0.01,
        "flexible": False
    },
    "plug_10": {
        "name": "Water Pump",
        "state": False,
        "units_per_hour": 0.5,
        "flexible": True
    },
    "plug_11": {
        "name": "Induction Cooktop",
        "state": False,
        "units_per_hour": 1.5,
        "flexible": True
    },
    "plug_12": {
        "name": "Microwave Oven",
        "state": False,
        "units_per_hour": 0.9,
        "flexible": True
    },
    "plug_13": {
        "name": "Mobile Chargers",
        "state": False,
        "units_per_hour": 0.02,
        "flexible": False
    },
    "plug_14": {
        "name": "Smart TV",
        "state": False,
        "units_per_hour": 0.1,
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
