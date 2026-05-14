"""Upload API — accepts CapabilityModel.xlsx and ClientCMDB.xlsx."""

import logging
from fastapi import APIRouter, UploadFile, File, HTTPException
import pandas as pd
import io

from utils.state import app_state
from utils.text_utils import safe_str

router = APIRouter()
logger = logging.getLogger(__name__)

CAPABILITY_COLUMNS = ["level_1_value_chain", "level_2_capability"]
CMDB_COLUMNS = ["application_name", "vendor", "description"]


@router.post("/capabilities")
async def upload_capabilities(file: UploadFile = File(...)):
    """Upload CapabilityModel.xlsx"""
    if not file.filename.endswith((".xlsx", ".xls", ".csv")):
        raise HTTPException(400, "Only .xlsx / .xls / .csv files accepted.")
    try:
        content = await file.read()
        if file.filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content))
        else:
            df = pd.read_excel(io.BytesIO(content))

        df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

        # Map common column name variants
        col_map = {
            "level_1": "level_1_value_chain",
            "value_chain": "level_1_value_chain",
            "l1": "level_1_value_chain",
            "level_2": "level_2_capability",
            "capability": "level_2_capability",
            "l2": "level_2_capability",
            "level_2_business_capability": "level_2_capability",
            "level_1_business_value_chain": "level_1_value_chain",
        }
        df = df.rename(columns=col_map)

        for col in CAPABILITY_COLUMNS:
            if col not in df.columns:
                raise HTTPException(400, f"Missing column: '{col}'. Found: {list(df.columns)}")

        df = df[CAPABILITY_COLUMNS].dropna(how="all")
        df[CAPABILITY_COLUMNS] = df[CAPABILITY_COLUMNS].map(safe_str)
        df = df[df["level_2_capability"] != ""]

        app_state.set_capabilities(df)
        logger.info(f"Capabilities loaded: {len(df)} rows")

        return {
            "message": "Capability model uploaded successfully.",
            "rows": len(df),
            "value_chains": df["level_1_value_chain"].unique().tolist(),
            "sample_capabilities": df["level_2_capability"].head(5).tolist(),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Capability upload error: {e}", exc_info=True)
        raise HTTPException(500, f"Failed to process file: {str(e)}")


@router.post("/cmdb")
async def upload_cmdb(file: UploadFile = File(...)):
    """Upload ClientCMDB.xlsx"""
    if not file.filename.endswith((".xlsx", ".xls", ".csv")):
        raise HTTPException(400, "Only .xlsx / .xls / .csv files accepted.")
    try:
        content = await file.read()
        if file.filename.endswith(".csv"):
            df = pd.read_csv(io.BytesIO(content))
        else:
            df = pd.read_excel(io.BytesIO(content))

        df.columns = [c.strip().lower().replace(" ", "_") for c in df.columns]

        # Map common column name variants
        col_map = {
            "app_name": "application_name",
            "name": "application_name",
            "application": "application_name",
            "app_description": "description",
            "app_desc": "description",
            "product_description": "description",
            "owner": "business_owner",
            "app_ownership": "business_owner",
            "product_name": "product_name",
        }
        df = df.rename(columns=col_map)

        # Ensure required columns exist
        for col in CMDB_COLUMNS:
            if col not in df.columns:
                if col == "description":
                    df["description"] = ""
                else:
                    raise HTTPException(400, f"Missing required column: '{col}'. Found: {list(df.columns)}")

        # Apply str conversion
        for col in df.columns:
            df[col] = df[col].apply(safe_str)

        df = df[df["application_name"] != ""].drop_duplicates(subset=["application_name"])
        app_state.set_cmdb(df)
        app_state.mapping_results = None
        app_state.mapping_status = "idle"

        logger.info(f"CMDB loaded: {len(df)} applications")

        return {
            "message": "CMDB uploaded successfully.",
            "rows": len(df),
            "sample_applications": df["application_name"].head(5).tolist(),
            "columns": list(df.columns),
        }
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"CMDB upload error: {e}", exc_info=True)
        raise HTTPException(500, f"Failed to process file: {str(e)}")


@router.get("/status")
async def upload_status():
    return {
        "capabilities_loaded": app_state.capabilities_df is not None,
        "cmdb_loaded": app_state.cmdb_df is not None,
        "capabilities_count": len(app_state.get_capabilities_list()),
        "cmdb_count": len(app_state.cmdb_df) if app_state.cmdb_df is not None else 0,
    }
