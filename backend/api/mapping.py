"""Mapping API routes — trigger and retrieve mapping results."""

import asyncio
import logging
from fastapi import APIRouter, HTTPException, BackgroundTasks, Request

from services.mapping.mapping_orchestrator import MappingOrchestrator
from utils.state import app_state

router = APIRouter()
logger = logging.getLogger(__name__)

_mapping_lock = asyncio.Lock()


@router.post("/run")
async def run_mapping(background_tasks: BackgroundTasks, request: Request):
    """Trigger the full mapping pipeline asynchronously."""
    if app_state.capabilities_df is None:
        raise HTTPException(400, "Capability model not uploaded.")
    if app_state.cmdb_df is None:
        raise HTTPException(400, "CMDB not uploaded.")
    if app_state.mapping_status == "running":
        raise HTTPException(409, "Mapping is already in progress.")

    app_state.mapping_status = "running"
    app_state.mapping_progress = 0
    app_state.mapping_total = len(app_state.cmdb_df)
    app_state.error_message = None

    reference_loader = request.app.state.reference_loader

    async def run_task():
        async with _mapping_lock:
            try:
                orchestrator = MappingOrchestrator(reference_loader)
                await orchestrator.run()
            except Exception as e:
                logger.error(f"Mapping failed: {e}", exc_info=True)
                app_state.mapping_status = "error"
                app_state.error_message = str(e)

    background_tasks.add_task(run_task)

    return {
        "message": "Mapping started.",
        "total": len(app_state.cmdb_df),
    }


@router.get("/status")
async def mapping_status():
    return {
        "status": app_state.mapping_status,
        "progress": app_state.mapping_progress,
        "total": app_state.mapping_total,
        "error": app_state.error_message,
    }


@router.get("/results")
async def get_results():
    if app_state.mapping_results is None:
        raise HTTPException(404, "No mapping results available. Run mapping first.")
    return {
        "count": len(app_state.mapping_results),
        "results": app_state.mapping_results,
    }


@router.get("/results/by-capability")
async def get_results_by_capability():
    """Group results by value chain → capability → applications."""
    if app_state.mapping_results is None:
        raise HTTPException(404, "No mapping results available.")

    from collections import defaultdict
    tree: dict = defaultdict(lambda: defaultdict(list))

    for r in app_state.mapping_results:
        for mc in r.get("mapped_capabilities", []):
            vc = mc.get("value_chain", "Unknown")
            cap = mc["capability"]
            tree[vc][cap].append({
                "application_name": r["application_name"],
                "vendor": r.get("vendor", ""),
                "confidence": mc["confidence"],
                "reasoning": mc.get("reasoning", ""),
                "enrichment_source": r.get("enrichment_source", ""),
                "match_tier": r.get("match_tier", ""),
            })

    # Convert to serializable structure
    result = []
    for vc, caps in tree.items():
        vc_entry = {"value_chain": vc, "capabilities": []}
        for cap, apps in caps.items():
            apps_sorted = sorted(apps, key=lambda x: x["confidence"], reverse=True)
            vc_entry["capabilities"].append({
                "capability": cap,
                "app_count": len(apps),
                "applications": apps_sorted,
            })
        vc_entry["capabilities"].sort(key=lambda x: x["app_count"], reverse=True)
        result.append(vc_entry)

    result.sort(key=lambda x: sum(c["app_count"] for c in x["capabilities"]), reverse=True)
    return result
