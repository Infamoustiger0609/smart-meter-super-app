from datetime import datetime
from zoneinfo import ZoneInfo
from backend import simulation_state
from backend.appliances import update_appliance_state

scheduled_tasks = []

def add_schedule(device_id, run_time):
    scheduled_tasks.append({
        "device_id": device_id,
        "run_time": run_time
    })
    return {"status": "scheduled", "device_id": device_id, "run_time": run_time}


def get_schedules():
    return scheduled_tasks


def remove_schedule(device_id=None, run_time=None):
    global scheduled_tasks
    before = len(scheduled_tasks)
    filtered = []
    for task in scheduled_tasks:
        match_device = (device_id is None) or (task["device_id"] == device_id)
        match_time = (run_time is None) or (task["run_time"] == run_time)
        if match_device and match_time:
            continue
        filtered.append(task)
    scheduled_tasks = filtered
    return before - len(scheduled_tasks)


def run_schedules():
    # Get current time (simulation-aware)
    current_time = simulation_state.SIMULATED_TIME or datetime.now(ZoneInfo("Asia/Kolkata"))
    current_time_str = current_time.strftime("%H:%M")

    executed = []

    for task in scheduled_tasks:
        if task["run_time"] == current_time_str:
            update_appliance_state(task["device_id"], True)
            executed.append(task["device_id"])

    return executed


def clear_all_schedules():
    global scheduled_tasks
    count = len(scheduled_tasks)
    scheduled_tasks = []
    return count

