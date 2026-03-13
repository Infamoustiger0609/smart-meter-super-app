from backend.services.data_seeder import seed_development_data
from backend.database.memory_store import store


def initialize_demo_state() -> None:
    # Populate rich simulated operational data when state is empty/sparse.
    if len(store.users) < 10 or len(store.bills) < 20 or len(store.consumption_records) < 100:
        seed_development_data()

