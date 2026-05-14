"""
AI Mapping Engine using Ollama + Qwen3.5:4b.
Maps enriched CMDB applications to Level 2 Business Capabilities.
"""

import asyncio
import json
import logging
import re
from typing import Dict, Any, List, Optional

from prompts.mapping_prompt import SYSTEM_PROMPT, build_mapping_prompt
from utils.text_utils import safe_str, clean_text

logger = logging.getLogger(__name__)

try:
    import ollama as ollama_lib
    # Use a client with an explicit HTTP timeout so the thread actually terminates
    # (asyncio.wait_for only cancels the coroutine wrapper, not the underlying thread)
    OLLAMA_CLIENT = ollama_lib.Client(host="http://localhost:11434", timeout=300)
    OLLAMA_AVAILABLE = True
except ImportError:
    ollama_lib = None
    OLLAMA_CLIENT = None
    OLLAMA_AVAILABLE = False
    logger.warning("Ollama client not installed. Using fallback mapping.")

OLLAMA_MODEL = "qwen3.5:4b"
MAX_RETRIES = 1
TOP_CAPS = 15  # pre-filter: only send the N most relevant capabilities


class AIMapper:
    """Uses Qwen3.5:4b via Ollama to map applications to capabilities."""

    def __init__(self):
        self.model = OLLAMA_MODEL
        self._check_ollama()

    def _check_ollama(self):
        if not OLLAMA_AVAILABLE:
            logger.warning("Ollama not available — will use fallback heuristic mapping.")
            return
        try:
            response = OLLAMA_CLIENT.list()
            model_names = [m.model for m in response.models]
            found = any(OLLAMA_MODEL in n for n in model_names)
            if not found:
                logger.warning(
                    f"Model '{OLLAMA_MODEL}' not found in Ollama. "
                    f"Run: ollama pull {OLLAMA_MODEL}"
                )
            else:
                logger.info(f"Ollama ready. Model: {OLLAMA_MODEL}")
        except Exception as e:
            logger.warning(f"Cannot connect to Ollama: {e}")

    def _prefilter_capabilities(
        self,
        enriched_app: Dict[str, Any],
        capabilities: List[str],
    ) -> List[str]:
        """Return top-N capabilities most relevant to this app by keyword overlap."""
        from rapidfuzz import fuzz

        app_text = clean_text(" ".join(filter(None, [
            enriched_app.get("cmdb_description", ""),
            enriched_app.get("enriched_context", ""),
            enriched_app.get("typical_capabilities", ""),
            enriched_app.get("business_use_cases", ""),
            enriched_app.get("keywords", ""),
        ])))

        scored = []
        for cap in capabilities:
            score = fuzz.token_set_ratio(app_text, clean_text(cap)) / 100.0
            scored.append((cap, score))

        scored.sort(key=lambda x: x[1], reverse=True)
        top = [cap for cap, _ in scored[:TOP_CAPS]]
        logger.debug(f"Pre-filtered caps for {enriched_app.get('application_name')}: {top}")
        return top

    async def map_application(
        self,
        enriched_app: Dict[str, Any],
        capabilities: List[str],
    ) -> Dict[str, Any]:
        """Map a single enriched application to capabilities."""
        app_name = enriched_app.get("application_name", "unknown")
        if not capabilities:
            return self._empty_result(app_name)

        # Narrow the capability list before building the prompt
        filtered_caps = self._prefilter_capabilities(enriched_app, capabilities)

        prompt = build_mapping_prompt(
            application_name=app_name,
            vendor=enriched_app.get("vendor", ""),
            cmdb_description=enriched_app.get("cmdb_description", ""),
            enriched_context=enriched_app.get("enriched_context", "")[:1000],
            semantic_score=enriched_app.get("semantic_score", 0.0),
            context_score=enriched_app.get("context_score", 0.0),
            capabilities=filtered_caps,
        )

        logger.info(f"[AI] Mapping: {app_name} ({len(filtered_caps)} caps in prompt)")
        for attempt in range(MAX_RETRIES):
            try:
                # Timeout is enforced by the HTTP client, so the thread terminates cleanly
                result = await self._call_ollama(prompt)
                parsed = self._parse_response(result, app_name, capabilities)
                if parsed:
                    logger.info(
                        f"[AI] Done: {app_name} -> "
                        f"{[c['capability'] for c in parsed['mapped_capabilities']]}"
                    )
                    return parsed
                logger.warning(f"[AI] Attempt {attempt + 1}: bad JSON for {app_name}")
            except Exception as e:
                logger.warning(f"[AI] Attempt {attempt + 1} failed for {app_name}: {e}")

        logger.warning(f"[AI] Falling back to heuristic for {app_name}")
        return self._heuristic_map(enriched_app, capabilities)

    async def _call_ollama(self, prompt: str) -> str:
        if not OLLAMA_AVAILABLE:
            raise RuntimeError("Ollama not installed")

        def _sync_call():
            response = OLLAMA_CLIENT.chat(
                model=self.model,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                format="json",
                options={"temperature": 0.1, "num_predict": 600},
            )
            return response.message.content

        return await asyncio.to_thread(_sync_call)

    def _parse_response(
        self,
        raw: str,
        app_name: str,
        valid_capabilities: List[str],
    ) -> Optional[Dict[str, Any]]:
        """Extract and validate JSON from LLM response."""
        raw = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL).strip()
        logger.warning(f"[RAW] {app_name}: >>>{raw[:500]}<<<")
        json_match = re.search(r"\{.*\}", raw, re.DOTALL)
        if not json_match:
            logger.warning(f"[PARSE] No JSON found for {app_name}")
            return None

        try:
            data = json.loads(json_match.group())
        except json.JSONDecodeError:
            cleaned = json_match.group().replace("\n", " ").replace("\\", "")
            try:
                data = json.loads(cleaned)
            except Exception:
                return None

        mapped = data.get("mapped_capabilities", [])
        valid_caps_lower = {c.lower(): c for c in valid_capabilities}
        validated = []

        for item in mapped:
            cap = safe_str(item.get("capability"))
            actual_cap = valid_caps_lower.get(cap.lower(), "")
            if not actual_cap:
                for lower_cap, orig_cap in valid_caps_lower.items():
                    if cap.lower() in lower_cap or lower_cap in cap.lower():
                        actual_cap = orig_cap
                        break
            if not actual_cap:
                continue

            conf = float(item.get("confidence", 0.5))
            conf = max(0.0, min(1.0, conf))
            validated.append({
                "capability": actual_cap,
                "confidence": round(conf, 3),
                "reasoning": safe_str(item.get("reasoning")),
            })

        if not validated:
            return None

        return {
            "application_name": app_name,
            "mapped_capabilities": validated[:4],
        }

    def _heuristic_map(
        self,
        enriched_app: Dict[str, Any],
        capabilities: List[str],
    ) -> Dict[str, Any]:
        """Fallback keyword-based mapping when Ollama fails or times out."""
        app_text = clean_text(" ".join(filter(None, [
            enriched_app.get("enriched_context", ""),
            enriched_app.get("typical_capabilities", ""),
            enriched_app.get("business_use_cases", ""),
        ])))

        from rapidfuzz import fuzz
        scored = [
            (cap, fuzz.token_set_ratio(app_text, clean_text(cap)) / 100.0)
            for cap in capabilities
        ]
        scored.sort(key=lambda x: x[1], reverse=True)

        return {
            "application_name": enriched_app["application_name"],
            "mapped_capabilities": [
                {
                    "capability": cap,
                    "confidence": round(max(score * 0.75, 0.3), 3),
                    "reasoning": "Heuristic fallback (keyword similarity).",
                }
                for cap, score in scored[:2]
                if score > 0.1
            ],
        }

    def _empty_result(self, app_name: str) -> Dict[str, Any]:
        return {"application_name": app_name, "mapped_capabilities": []}
