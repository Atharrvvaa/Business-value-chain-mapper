"""Analytics API routes."""

from fastapi import APIRouter, HTTPException
from services.analytics.analytics_service import AnalyticsService
from utils.state import app_state

router = APIRouter()
analytics_svc = AnalyticsService()


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
