"""
Mapping Orchestrator.
Coordinates enrichment → AI mapping → result assembly.
"""

import asyncio
import logging
from typing import List, Dict, Any

import pandas as pd

from services.enrichment.enrichment_service import EnrichmentService
from services.enrichment.reference_loader import ReferenceLoader
from services.mapping.ai_mapper import AIMapper
from utils.state import app_state
from utils.text_utils import safe_str

logger = logging.getLogger(__name__)

BATCH_SIZE = 1  # Sequential so each Ollama call gets full CPU (avoids timeouts)


class MappingOrchestrator:
    """Orchestrates the full enrichment + mapping pipeline."""

    def __init__(self, reference_loader: ReferenceLoader):
        self.enrichment_svc = EnrichmentService(reference_loader)
        self.ai_mapper = AIMapper()

    async def run(self) -> List[Dict[str, Any]]:
        """
        Full pipeline:
        1. Read CMDB apps from app_state
        2. Enrich each app
        3. Map to capabilities via AI
        4. Assemble results
        """
        cmdb_df = app_state.cmdb_df
        capabilities_df = app_state.capabilities_df

        if cmdb_df is None or capabilities_df is None:
            raise ValueError("CMDB and Capability data must be uploaded before running mapping.")

        capabilities = app_state.get_capabilities_list()
        cap_map = self._build_capability_map(capabilities_df)

        apps = self._cmdb_to_dicts(cmdb_df)
        total = len(apps)
        app_state.mapping_status = "running"
        app_state.mapping_total = total
        app_state.mapping_progress = 0

        logger.info(f"Starting mapping: {total} applications × {len(capabilities)} capabilities")

        results = []

        # Process in batches
        for batch_start in range(0, total, BATCH_SIZE):
            batch = apps[batch_start: batch_start + BATCH_SIZE]
            batch_results = await self._process_batch(batch, capabilities, cap_map)
            results.extend(batch_results)
            app_state.mapping_progress = min(batch_start + BATCH_SIZE, total)
            logger.info(f"Progress: {app_state.mapping_progress}/{total}")

        app_state.set_results(results)
        logger.info(f"Mapping complete. {len(results)} results.")
        return results

    async def _process_batch(
        self,
        batch: List[Dict],
        capabilities: List[str],
        cap_map: Dict,
    ) -> List[Dict[str, Any]]:
        tasks = []
        for app in batch:
            tasks.append(self._process_single(app, capabilities, cap_map))
        return await asyncio.gather(*tasks, return_exceptions=False)

    async def _process_single(
        self,
        app: Dict,
        capabilities: List[str],
        cap_map: Dict,
    ) -> Dict[str, Any]:
        app_name = app.get("application_name", "?")
        logger.info(f"[ENRICH] {app_name}")
        # Step 1: Enrich
        enriched = await asyncio.to_thread(self.enrichment_svc.enrich_application, app)
        logger.info(f"[ENRICH] {app_name} → tier={enriched['match_tier']} ref={enriched['reference_app']}")

        # Step 2: AI Map
        ai_result = await self.ai_mapper.map_application(enriched, capabilities)

        # Step 3: Attach value chains
        mapped_caps = []
        for mc in ai_result.get("mapped_capabilities", []):
            cap_name = mc["capability"]
            value_chain = cap_map.get(cap_name, "Unknown")
            mapped_caps.append({**mc, "value_chain": value_chain})

        return {
            "application_name": enriched["application_name"],
            "vendor": enriched["vendor"],
            "cmdb_description": enriched["cmdb_description"],
            "enrichment_source": enriched["enrichment_source"],
            "match_tier": enriched["match_tier"],
            "match_score": enriched["match_score"],
            "semantic_score": enriched["semantic_score"],
            "context_score": enriched["context_score"],
            "reference_app": enriched["reference_app"],
            "business_use_cases": enriched["business_use_cases"],
            "mapped_capabilities": mapped_caps,
            "is_mapped": len(mapped_caps) > 0,
        }

    def _build_capability_map(self, cap_df: pd.DataFrame) -> Dict[str, str]:
        """Build {level_2_capability: level_1_value_chain} map."""
        result = {}
        for _, row in cap_df.iterrows():
            cap = safe_str(row.get("level_2_capability"))
            vc = safe_str(row.get("level_1_value_chain"))
            if cap:
                result[cap] = vc
        return result

    def _cmdb_to_dicts(self, cmdb_df: pd.DataFrame) -> List[Dict]:
        records = []
        for _, row in cmdb_df.iterrows():
            records.append({
                "application_name": safe_str(row.get("application_name")),
                "vendor": safe_str(row.get("vendor")),
                "description": safe_str(row.get("description", row.get("app_description", ""))),
                "business_owner": safe_str(row.get("business_owner", row.get("app_ownership", ""))),
                "product_name": safe_str(row.get("product_name", "")),
            })
        return [r for r in records if r["application_name"]]
