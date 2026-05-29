"""
Cost Concentration Service.
Distributes each app's total_annual_cost across its mapped capabilities
proportionally by confidence weight, then aggregates by capability.
"""

import logging
from typing import List, Dict, Any

import pandas as pd

from utils.state import app_state

logger = logging.getLogger(__name__)


class CostService:
    def get_cost_concentration(self) -> List[Dict[str, Any]]:
        results = app_state.mapping_results
        cmdb_df = app_state.cmdb_df

        cost_lookup = self._build_cost_lookup(cmdb_df)
        if not cost_lookup:
            logger.warning("No cost data found in CMDB — returning empty concentration.")

        # Distribute each app's annual cost across capabilities by confidence weight
        cap_data: Dict[str, Dict] = {}

        for result in (results or []):
            app_name = result["application_name"]
            app_cost = cost_lookup.get(app_name, 0.0)
            caps = result.get("mapped_capabilities", [])
            if not caps:
                continue

            total_conf = sum(c["confidence"] for c in caps) or 1.0

            for mc in caps:
                cap_name = mc["capability"]
                vc = mc.get("value_chain", "Unknown")
                weight = mc["confidence"] / total_conf
                allocated = app_cost * weight

                if cap_name not in cap_data:
                    cap_data[cap_name] = {
                        "capability": cap_name,
                        "value_chain": vc,
                        "total_spend": 0.0,
                        "apps": set(),
                    }
                cap_data[cap_name]["total_spend"] += allocated
                cap_data[cap_name]["apps"].add(app_name)

        out = [
            {
                "capability": d["capability"],
                "value_chain": d["value_chain"],
                "total_spend": round(d["total_spend"], 2),
                "app_count": len(d["apps"]),
            }
            for d in cap_data.values()
            if d["total_spend"] > 0
        ]
        out.sort(key=lambda x: x["total_spend"], reverse=True)
        logger.info(f"Cost concentration: {len(out)} capabilities with spend data.")
        return out

    def _build_cost_lookup(self, cmdb_df) -> Dict[str, float]:
        if cmdb_df is None:
            return {}
        lookup = {}
        for _, row in cmdb_df.iterrows():
            name = row.get("application_name", "")
            cost = row.get("total_annual_cost")
            if name and pd.notna(cost):
                try:
                    lookup[name] = float(cost)
                except (TypeError, ValueError):
                    pass
        return lookup
