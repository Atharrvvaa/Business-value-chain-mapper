"""
Synthetic Enterprise Application Reference Loader.

Loads backend/data/synthetic_app_reference.xlsx at startup,
computes and caches embeddings for fast semantic matching.
"""

import logging
import os
import pickle
from pathlib import Path
from typing import Optional

import numpy as np
import pandas as pd
from sentence_transformers import SentenceTransformer

from utils.text_utils import clean_text, safe_str

logger = logging.getLogger(__name__)

REFERENCE_PATH = Path(__file__).parent.parent.parent / "data" / "synthetic_app_reference.xlsx"
CACHE_PATH = Path(__file__).parent.parent.parent / "cache" / "reference_embeddings.pkl"

MODEL_NAME = "sentence-transformers/all-MiniLM-L6-v2"


class ReferenceLoader:
    """Loads and caches the synthetic application reference data."""

    def __init__(self):
        self.df: Optional[pd.DataFrame] = None
        self.embeddings: Optional[np.ndarray] = None
        self.combined_texts: list = []
        self.model: Optional[SentenceTransformer] = None
        self._initialized = False

    async def initialize(self):
        """Load reference file, model, and compute/restore embeddings."""
        if self._initialized:
            return

        logger.info(f"Loading synthetic reference from: {REFERENCE_PATH}")
        if not REFERENCE_PATH.exists():
            raise FileNotFoundError(f"Synthetic reference file not found: {REFERENCE_PATH}")

        self.df = pd.read_excel(REFERENCE_PATH)
        self._validate_and_clean()

        logger.info(f"Loaded {len(self.df)} reference applications.")
        logger.info("Loading sentence-transformer model...")
        self.model = SentenceTransformer(MODEL_NAME)

        self._build_combined_texts()
        self._load_or_compute_embeddings()

        self._initialized = True
        logger.info("ReferenceLoader initialized successfully.")

    def _validate_and_clean(self):
        required = [
            "reference_application_name", "vendor", "application_description",
            "business_use_cases", "typical_capabilities", "keywords",
            "aliases", "domain_context",
        ]
        for col in required:
            if col not in self.df.columns:
                self.df[col] = ""
        # Ensure all string columns
        for col in required:
            self.df[col] = self.df[col].apply(safe_str)

    def _build_combined_texts(self):
        """Build rich combined text for each reference application."""
        self.combined_texts = []
        for _, row in self.df.iterrows():
            parts = [
                row.get("application_description", ""),
                row.get("business_use_cases", ""),
                row.get("typical_capabilities", ""),
                row.get("domain_context", ""),
                row.get("keywords", ""),
            ]
            combined = " | ".join(p for p in parts if p)
            self.combined_texts.append(clean_text(combined))

    def _load_or_compute_embeddings(self):
        CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
        if CACHE_PATH.exists():
            try:
                with open(CACHE_PATH, "rb") as f:
                    cached = pickle.load(f)
                if cached.get("n") == len(self.df):
                    self.embeddings = cached["embeddings"]
                    logger.info("Loaded embeddings from cache.")
                    return
            except Exception as e:
                logger.warning(f"Cache load failed: {e}. Recomputing...")

        logger.info("Computing embeddings for reference data...")
        self.embeddings = self.model.encode(
            self.combined_texts,
            batch_size=64,
            show_progress_bar=True,
            normalize_embeddings=True,
        )
        with open(CACHE_PATH, "wb") as f:
            pickle.dump({"n": len(self.df), "embeddings": self.embeddings}, f)
        logger.info("Embeddings computed and cached.")

    def get_model(self) -> SentenceTransformer:
        return self.model

    def get_df(self) -> pd.DataFrame:
        return self.df

    def get_embeddings(self) -> np.ndarray:
        return self.embeddings

    def get_combined_texts(self) -> list:
        return self.combined_texts
