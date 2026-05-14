"""
Business Capability ↔ IT Landscape Mapper — Phase 2
FastAPI Backend Entry Point
"""

import logging
import asyncio
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api import upload, mapping, analytics, export
from services.enrichment.reference_loader import ReferenceLoader
from utils.logger import setup_logging

# Setup structured logging
setup_logging()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan: startup and shutdown."""
    logger.info("=== Starting Business Capability Mapper Phase 2 ===")

    # Load synthetic reference data at startup
    try:
        loader = ReferenceLoader()
        await loader.initialize()
        app.state.reference_loader = loader
        logger.info("Reference data loaded and embeddings computed.")
    except Exception as e:
        logger.error(f"Failed to load reference data: {e}")
        raise

    yield

    logger.info("=== Shutting down ===")


app = FastAPI(
    title="Business Capability ↔ IT Landscape Mapper",
    description="Phase 2: AI-driven enterprise application to capability mapping",
    version="2.0.0",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Routers
app.include_router(upload.router, prefix="/upload", tags=["Upload"])
app.include_router(mapping.router, prefix="/mapping", tags=["Mapping"])
app.include_router(analytics.router, prefix="/analytics", tags=["Analytics"])
app.include_router(export.router, prefix="/export", tags=["Export"])


@app.get("/health")
async def health():
    return {"status": "ok", "version": "2.0.0"}


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(status_code=500, content={"detail": str(exc)})
