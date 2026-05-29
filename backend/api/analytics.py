"""Analytics API routes."""

import asyncio
import logging

from fastapi import APIRouter, HTTPException
from services.analytics.analytics_service import AnalyticsService
from services.cost.cost_service import CostService
from services.redundancy.redundancy_service import RedundancyService
from utils.state import app_state

router = APIRouter()
analytics_svc = AnalyticsService()
cost_svc = CostService()
redundancy_svc = RedundancyService()

logger = logging.getLogger(__name__)


def _check_results():
    if app_state.mapping_results is None:
        raise HTTPException(404, "No mapping results. Run mapping first.")


@router.get("/summary")
async def get_summary():
    _check_results()
    return analytics_svc.get_summary()


@router.get("/heatmap")
async def get_heatmap():
    _check_results()
    return analytics_svc.get_heatmap_data()


@router.get("/unmapped")
async def get_unmapped():
    _check_results()
    return analytics_svc.get_unmapped_applications()


@router.get("/confidence-distribution")
async def get_confidence_distribution():
    _check_results()
    return analytics_svc.get_confidence_distribution()


@router.get("/cost-concentration")
async def get_cost_concentration():
    _check_results()
    return cost_svc.get_cost_concentration()


async def _run_redundancy_task():
    try:
        app_state.redundancy_status = "running"
        app_state.redundancy_results = None
        app_state.redundancy_error = None
        results = await redundancy_svc.analyse()
        app_state.redundancy_results = results
        app_state.redundancy_status = "done"
        logger.info(f"Redundancy analysis complete: {len(results)} groups")
    except Exception as e:
        logger.error(f"Redundancy analysis failed: {e}", exc_info=True)
        app_state.redundancy_status = "error"
        app_state.redundancy_error = str(e)


@router.post("/redundancy")
async def run_redundancy_analysis():
    _check_results()
    if app_state.redundancy_status == "running":
        return {"status": "running", "message": "Analysis already in progress."}
    asyncio.create_task(_run_redundancy_task())
    return {"status": "running", "message": "Redundancy analysis started."}


@router.get("/redundancy/status")
async def get_redundancy_status():
    return {
        "status": app_state.redundancy_status,
        "results": app_state.redundancy_results,
        "error": app_state.redundancy_error,
    }
