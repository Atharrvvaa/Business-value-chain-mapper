"""
In-memory application state store.
Designed to be swappable with Neo4j/Postgres in the future.
"""
from typing import Optional, Dict, Any
import pandas as pd


class AppState:
    """Singleton in-memory store for session data."""

    _instance: Optional["AppState"] = None

    def __new__(cls):
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._init()
        return cls._instance

    def _init(self):
        self.capabilities_df: Optional[pd.DataFrame] = None
        self.cmdb_df: Optional[pd.DataFrame] = None
        self.mapping_results: Optional[list] = None
        self.mapping_status: str = "idle"  # idle | running | done | error
        self.mapping_progress: int = 0
        self.mapping_total: int = 0
        self.error_message: Optional[str] = None
        self.metadata: Dict[str, Any] = {}
        self.redundancy_status: str = "idle"  # idle | running | done | error
        self.redundancy_results: Optional[list] = None
        self.redundancy_error: Optional[str] = None

    def reset(self):
        self._init()

    def set_capabilities(self, df: pd.DataFrame):
        self.capabilities_df = df

    def set_cmdb(self, df: pd.DataFrame):
        self.cmdb_df = df

    def set_results(self, results: list):
        self.mapping_results = results
        self.mapping_status = "done"

    def get_capabilities_list(self) -> list:
        if self.capabilities_df is None:
            return []
        return self.capabilities_df["level_2_capability"].dropna().unique().tolist()

    def get_value_chains(self) -> list:
        if self.capabilities_df is None:
            return []
        return self.capabilities_df["level_1_value_chain"].dropna().unique().tolist()


# Module-level singleton
app_state = AppState()
