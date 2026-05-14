"""
Application Enrichment Service.

Matches each CMDB application against the synthetic reference DB
using fuzzy + semantic + contextual signals.
"""

import logging
from typing import Dict, Any, Optional, List

import numpy as np
import pandas as pd
from rapidfuzz import fuzz
from sklearn.metrics.pairwise import cosine_similarity

from services.enrichment.reference_loader import ReferenceLoader
from utils.text_utils import clean_text, normalize_vendor, safe_str, extract_keywords

logger = logging.getLogger(__name__)

# Scoring weights
W_FUZZY = 0.15
W_SEMANTIC = 0.50
W_CONTEXT = 0.35

STRONG_MATCH = 0.80
MEDIUM_MATCH = 0.60


class EnrichmentService:
    """Enriches CMDB applications using the synthetic reference corpus."""

    def __init__(self, reference_loader: ReferenceLoader):
        self.loader = reference_loader
        self.ref_df = reference_loader.get_df()
        self.ref_embeddings = reference_loader.get_embeddings()
        self.model = reference_loader.get_model()

    def enrich_application(self, app_row: Dict[str, Any]) -> Dict[str, Any]:
        """
        Enrich a single CMDB application record.
        Returns enriched context dict.
        """
        app_name = safe_str(app_row.get("application_name"))
        vendor = safe_str(app_row.get("vendor"))
        description = safe_str(app_row.get("description"))

        # Build rich query text (description-first)
        query_parts = [description, vendor, app_name]
        query_text = clean_text(" ".join(p for p in query_parts if p))

        if not query_text:
            return self._fallback_cmdb_only(app_row)

        # Compute query embedding
        query_emb = self.model.encode(
            [query_text], normalize_embeddings=True
        )

        # --- Semantic score ---
        sem_scores = cosine_similarity(query_emb, self.ref_embeddings)[0]

        # --- Fuzzy name score ---
        fuzzy_scores = self._compute_fuzzy_scores(app_name, vendor)

        # --- Context score (keyword overlap) ---
        ctx_scores = self._compute_context_scores(query_text)

        # Combine
        final_scores = (
            W_FUZZY * np.array(fuzzy_scores)
            + W_SEMANTIC * sem_scores
            + W_CONTEXT * np.array(ctx_scores)
        )

        best_idx = int(np.argmax(final_scores))
        best_score = float(final_scores[best_idx])
        best_sem = float(sem_scores[best_idx])
        best_ctx = float(ctx_scores[best_idx])

        match_tier = (
            "strong" if best_score >= STRONG_MATCH
            else "medium" if best_score >= MEDIUM_MATCH
            else "weak"
        )

        ref_row = self.ref_df.iloc[best_idx]

        enriched_context = ""
        enrichment_source = "CMDB Only"

        if match_tier in ("strong", "medium"):
            enriched_context = self._build_enriched_context(app_row, ref_row)
            enrichment_source = "Synthetic Reference DB"
        else:
            enriched_context = description
            enrichment_source = "CMDB Only (Weak Match)"

        return {
            "application_name": app_name,
            "vendor": vendor,
            "cmdb_description": description,
            "enriched_context": enriched_context,
            "enrichment_source": enrichment_source,
            "match_tier": match_tier,
            "match_score": round(best_score, 4),
            "semantic_score": round(best_sem, 4),
            "context_score": round(best_ctx, 4),
            "reference_app": safe_str(ref_row.get("reference_application_name")),
            "reference_vendor": safe_str(ref_row.get("vendor")),
            "business_use_cases": safe_str(ref_row.get("business_use_cases")),
            "typical_capabilities": safe_str(ref_row.get("typical_capabilities")),
            "domain_context": safe_str(ref_row.get("domain_context")),
            "keywords": safe_str(ref_row.get("keywords")),
        }

    def _compute_fuzzy_scores(self, app_name: str, vendor: str) -> List[float]:
        scores = []
        norm_vendor = normalize_vendor(vendor)
        norm_name = clean_text(app_name)

        for _, ref_row in self.ref_df.iterrows():
            ref_name = clean_text(safe_str(ref_row.get("reference_application_name")))
            ref_vendor = normalize_vendor(safe_str(ref_row.get("vendor")))
            ref_aliases = clean_text(safe_str(ref_row.get("aliases")))
            ref_keywords = clean_text(safe_str(ref_row.get("keywords")))

            name_score = fuzz.token_set_ratio(norm_name, ref_name) / 100.0
            alias_score = fuzz.partial_ratio(norm_name, ref_aliases) / 100.0
            vendor_score = fuzz.ratio(norm_vendor, ref_vendor) / 100.0
            keyword_score = fuzz.token_set_ratio(norm_name, ref_keywords) / 100.0

            combined = max(name_score, alias_score) * 0.6 + vendor_score * 0.2 + keyword_score * 0.2
            scores.append(combined)
        return scores

    def _compute_context_scores(self, query_text: str) -> List[float]:
        query_keywords = set(extract_keywords(query_text, top_n=20))
        scores = []
        for _, ref_row in self.ref_df.iterrows():
            ref_text = clean_text(
                " ".join([
                    safe_str(ref_row.get("business_use_cases")),
                    safe_str(ref_row.get("typical_capabilities")),
                    safe_str(ref_row.get("domain_context")),
                    safe_str(ref_row.get("keywords")),
                ])
            )
            ref_keywords = set(ref_text.split())
            if not ref_keywords:
                scores.append(0.0)
                continue
            overlap = len(query_keywords & ref_keywords)
            score = overlap / max(len(query_keywords), len(ref_keywords), 1)
            scores.append(min(score * 2.5, 1.0))  # scale up
        return scores

    def _build_enriched_context(self, app_row: Dict, ref_row: pd.Series) -> str:
        parts = [
            f"CMDB Description: {safe_str(app_row.get('description'))}",
            f"Reference Application: {safe_str(ref_row.get('application_description'))}",
            f"Business Use Cases: {safe_str(ref_row.get('business_use_cases'))}",
            f"Typical Capabilities: {safe_str(ref_row.get('typical_capabilities'))}",
            f"Domain Context: {safe_str(ref_row.get('domain_context'))}",
            f"Keywords: {safe_str(ref_row.get('keywords'))}",
        ]
        return "\n".join(p for p in parts if p.split(": ", 1)[-1])

    def _fallback_cmdb_only(self, app_row: Dict) -> Dict[str, Any]:
        return {
            "application_name": safe_str(app_row.get("application_name")),
            "vendor": safe_str(app_row.get("vendor")),
            "cmdb_description": safe_str(app_row.get("description")),
            "enriched_context": safe_str(app_row.get("description")),
            "enrichment_source": "CMDB Only",
            "match_tier": "weak",
            "match_score": 0.0,
            "semantic_score": 0.0,
            "context_score": 0.0,
            "reference_app": "",
            "reference_vendor": "",
            "business_use_cases": "",
            "typical_capabilities": "",
            "domain_context": "",
            "keywords": "",
        }
