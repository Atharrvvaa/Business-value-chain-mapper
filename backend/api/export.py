"""Export API — Excel, CSV, JSON exports."""

import io
import json
import logging
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
import pandas as pd

from utils.state import app_state

router = APIRouter()
logger = logging.getLogger(__name__)


def _get_results_df() -> pd.DataFrame:
    if not app_state.mapping_results:
        raise HTTPException(404, "No results to export.")

    rows = []
    for r in app_state.mapping_results:
        base = {
            "Application Name": r.get("application_name", ""),
            "Vendor": r.get("vendor", ""),
            "CMDB Description": r.get("cmdb_description", ""),
            "Enrichment Source": r.get("enrichment_source", ""),
            "Match Tier": r.get("match_tier", ""),
            "Match Score": r.get("match_score", 0.0),
            "Semantic Score": r.get("semantic_score", 0.0),
            "Reference App": r.get("reference_app", ""),
        }
        caps = r.get("mapped_capabilities", [])
        if caps:
            for i, mc in enumerate(caps[:4], 1):
                base[f"Capability {i}"] = mc.get("capability", "")
                base[f"Capability {i} Value Chain"] = mc.get("value_chain", "")
                base[f"Capability {i} Confidence"] = mc.get("confidence", 0.0)
                base[f"Capability {i} Reasoning"] = mc.get("reasoning", "")
        else:
            base["Capability 1"] = "UNMAPPED"
        rows.append(base)

    return pd.DataFrame(rows)


@router.get("/excel")
async def export_excel():
    df = _get_results_df()
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="Mapping Results")
        # Summary sheet
        from services.analytics.analytics_service import AnalyticsService
        svc = AnalyticsService()
        summary = svc.get_summary()
        summary_data = {
            "Metric": list(summary.keys()),
            "Value": [str(v) for v in summary.values()],
        }
        pd.DataFrame(summary_data).to_excel(writer, index=False, sheet_name="Summary")

    buf.seek(0)
    return StreamingResponse(
        buf,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": "attachment; filename=capability_mapping_results.xlsx"},
    )


@router.get("/csv")
async def export_csv():
    df = _get_results_df()
    buf = io.StringIO()
    df.to_csv(buf, index=False)
    buf.seek(0)
    return StreamingResponse(
        io.BytesIO(buf.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=capability_mapping_results.csv"},
    )


@router.get("/json")
async def export_json():
    if not app_state.mapping_results:
        raise HTTPException(404, "No results to export.")
    payload = json.dumps(app_state.mapping_results, indent=2)
    return StreamingResponse(
        io.BytesIO(payload.encode()),
        media_type="application/json",
        headers={"Content-Disposition": "attachment; filename=capability_mapping_results.json"},
    )
