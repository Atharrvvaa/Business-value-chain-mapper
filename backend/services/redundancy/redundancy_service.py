"""
Redundancy Analysis Service.
Groups mapped applications by capability, then uses the Qwen LLM to identify
functional overlap and generate consolidation recommendations.

Each capability group gets its own LLM call (sequential) — mirrors the mapping
pipeline's approach and avoids the empty-response issue that occurs when the
prompt is too large for Qwen's JSON mode.
"""

import asyncio
import json
import logging
import re
from typing import List, Dict, Any, Optional

import pandas as pd

from utils.state import app_state
from utils.text_utils import safe_str

logger = logging.getLogger(__name__)

try:
    import ollama as ollama_lib
    OLLAMA_CLIENT = ollama_lib.Client(host="http://localhost:11434", timeout=90)
    OLLAMA_AVAILABLE = True
except ImportError:
    OLLAMA_CLIENT = None
    OLLAMA_AVAILABLE = False

OLLAMA_MODEL = "qwen3.5:4b"

SYSTEM_PROMPT = (
    "You are a senior Enterprise Architect specialising in application portfolio rationalisation. "
    "Your job is to identify functional redundancy between software applications — "
    "cases where two or more applications serve the same day-to-day business purpose "
    "for the same users, making one potentially replaceable by another. "
    "Think deeply about actual business use cases, not just category labels. "
    "Return ONLY valid JSON with no markdown, no code fences, no extra text."
)


def _build_group_prompt(group: Dict) -> str:
    cap = group["capability"]
    vc = group["value_chain"]
    apps = group["apps"]

    app_lines = []
    for i, app in enumerate(apps, 1):
        desc = (app.get("description") or "").strip()[:300]
        vendor = (app.get("vendor") or "Unknown vendor")
        app_lines.append(
            f'{i}. {app["name"]} ({vendor})\n'
            f'   Description: {desc if desc else "No description available."}'
        )

    apps_block = "\n\n".join(app_lines)
    app_names = [a["name"] for a in apps]

    return f"""Analyse functional redundancy for capability "{cap}" ({vc}).

Apps:
{apps_block}

Do these apps perform the SAME core business transactions for the SAME users day-to-day?
Could one replace another without losing critical function?

Overlap: "high"=one can replace another | "medium"=partial overlap | "low"=distinct purposes
Keep the most modern/cloud-native app. List retirement candidates in replace_apps.

Valid names: {json.dumps(app_names)}

Return ONLY JSON (no markdown):
{{"overlap_level":"high|medium|low","overlap_reason":"<2 sentences>","keep_app":"<name>","replace_apps":["<name>"],"consolidation_suggestion":"<2 sentences>"}}

/no_think"""


class RedundancyService:

    async def analyse(self) -> List[Dict[str, Any]]:
        results = app_state.mapping_results
        cmdb_df = app_state.cmdb_df

        if not results:
            return []

        cost_lookup, billing_lookup, vendor_lookup, desc_lookup = self._build_cmdb_lookups(cmdb_df)

        # Group apps by capability
        cap_groups: Dict[str, Dict] = {}
        for result in results:
            app_name = result["application_name"]
            for mc in result.get("mapped_capabilities", []):
                cap = mc["capability"]
                vc = mc.get("value_chain", "Unknown")
                if cap not in cap_groups:
                    cap_groups[cap] = {"capability": cap, "value_chain": vc, "apps": {}}
                if app_name not in cap_groups[cap]["apps"]:
                    cap_groups[cap]["apps"][app_name] = {
                        "name": app_name,
                        "vendor": vendor_lookup.get(app_name, result.get("vendor", "")),
                        "description": desc_lookup.get(
                            app_name,
                            result.get("cmdb_description", result.get("business_use_cases", ""))
                        ),
                        "cost": cost_lookup.get(app_name),
                        "billing_cycle": billing_lookup.get(app_name),
                    }

        # Only capabilities with 2+ apps; prioritise most-overlapping, cap at 12
        overlapping = [g for g in cap_groups.values() if len(g["apps"]) >= 2]
        overlapping.sort(key=lambda g: len(g["apps"]), reverse=True)
        overlapping = overlapping[:12]

        if not overlapping:
            logger.info("No capabilities with 2+ apps — nothing to analyse.")
            return []

        logger.info(f"Analysing redundancy for {len(overlapping)} capability groups in parallel.")

        groups_with_apps = []
        for g in overlapping:
            apps_list = list(g["apps"].values())
            groups_with_apps.append({
                "capability": g["capability"],
                "value_chain": g["value_chain"],
                "apps": apps_list,
            })

        # Run all LLM calls concurrently — Ollama serialises internally,
        # but total wall-clock time ≈ max(individual) not sum(individual).
        llm_results = await asyncio.gather(
            *[self._analyse_group(gd) for gd in groups_with_apps],
            return_exceptions=True,
        )

        out = []
        for group_data, llm_result in zip(groups_with_apps, llm_results):
            apps_list = group_data["apps"]
            if isinstance(llm_result, Exception):
                logger.error(f"[REDUNDANCY] {group_data['capability']}: gather error — {llm_result}")
                llm_result = self._heuristic_single(group_data)

            total_cap_spend = sum(a["cost"] for a in apps_list if a.get("cost") is not None)
            replace_apps = llm_result.get("replace_apps", [])
            estimated_savings = sum(
                a["cost"] for a in apps_list
                if a.get("cost") is not None and a["name"] in replace_apps
            )

            out.append({
                "capability": group_data["capability"],
                "value_chain": group_data["value_chain"],
                "overlap_level": llm_result.get("overlap_level", "medium"),
                "overlap_reason": llm_result.get("overlap_reason", ""),
                "keep_app": llm_result.get("keep_app", apps_list[0]["name"] if apps_list else ""),
                "replace_apps": replace_apps,
                "consolidation_suggestion": llm_result.get("consolidation_suggestion", ""),
                "estimated_savings": round(estimated_savings, 2) if estimated_savings else None,
                "total_capability_spend": round(total_cap_spend, 2) if total_cap_spend else None,
                "apps": [
                    {
                        "name": a["name"],
                        "vendor": a["vendor"],
                        "cost": a["cost"],
                        "billing_cycle": a["billing_cycle"],
                    }
                    for a in apps_list
                ],
            })

        return out

    async def _analyse_group(self, group: Dict) -> Dict:
        """Run LLM analysis for a single capability group."""
        cap = group["capability"]
        apps = group["apps"]
        valid_names = {a["name"] for a in apps}

        if not OLLAMA_AVAILABLE:
            return self._heuristic_single(group)

        prompt = _build_group_prompt(group)

        def _sync_call():
            response = OLLAMA_CLIENT.chat(
                model=OLLAMA_MODEL,
                messages=[
                    {"role": "system", "content": SYSTEM_PROMPT},
                    {"role": "user", "content": prompt},
                ],
                options={"temperature": 0.2, "num_predict": 250},
            )
            return response.message.content

        try:
            raw = await asyncio.wait_for(
                asyncio.to_thread(_sync_call),
                timeout=120.0,
            )
            logger.info(f"[REDUNDANCY] {cap}: raw={raw[:200]!r}")
            parsed = self._parse_group_response(raw, valid_names)
            if parsed:
                return parsed
            logger.warning(f"[REDUNDANCY] {cap}: parse failed, using heuristic")
        except asyncio.TimeoutError:
            logger.warning(f"[REDUNDANCY] {cap}: LLM timed out after 120s, using heuristic")
        except Exception as e:
            logger.error(f"[REDUNDANCY] {cap}: LLM error — {e}")

        return self._heuristic_single(group)

    def _parse_group_response(self, raw: str, valid_names: set) -> Optional[Dict]:
        # Strip thinking tags (Qwen sometimes emits them even without /think)
        raw = re.sub(r"<think>.*?</think>", "", raw, flags=re.DOTALL).strip()

        json_match = re.search(r"\{.*\}", raw, re.DOTALL)
        if not json_match:
            return None

        try:
            data = json.loads(json_match.group())
        except json.JSONDecodeError:
            try:
                data = json.loads(json_match.group().replace("\n", " "))
            except Exception:
                return None

        overlap = data.get("overlap_level", "medium").lower()
        if overlap not in ("high", "medium", "low"):
            overlap = "medium"

        # Validate app names — fuzzy-accept if LLM got close
        keep = self._resolve_name(data.get("keep_app", ""), valid_names)
        replace_raw = data.get("replace_apps", [])
        replace = [self._resolve_name(n, valid_names) for n in replace_raw]
        replace = [n for n in replace if n and n != keep]

        return {
            "overlap_level": overlap,
            "overlap_reason": str(data.get("overlap_reason", "")).strip(),
            "keep_app": keep,
            "replace_apps": replace,
            "consolidation_suggestion": str(data.get("consolidation_suggestion", "")).strip(),
        }

    def _resolve_name(self, name: str, valid_names: set) -> str:
        """Return exact match if found; otherwise try case-insensitive / substring match."""
        if not name:
            return ""
        if name in valid_names:
            return name
        lower = name.lower()
        for vn in valid_names:
            if vn.lower() == lower:
                return vn
        for vn in valid_names:
            if lower in vn.lower() or vn.lower() in lower:
                return vn
        return ""

    def _heuristic_single(self, group: Dict) -> Dict:
        apps = group["apps"]
        return {
            "overlap_level": "medium",
            "overlap_reason": (
                f"{len(apps)} applications are mapped to this capability. "
                "Manual review is recommended to assess functional overlap."
            ),
            "keep_app": apps[0]["name"] if apps else "",
            "replace_apps": [a["name"] for a in apps[1:]],
            "consolidation_suggestion": (
                "Review the functional scope of each application against this capability. "
                "Identify which application provides the broadest coverage and retire the others after migration."
            ),
        }

    def _build_cmdb_lookups(self, cmdb_df):
        cost_lookup: Dict[str, Optional[float]] = {}
        billing_lookup: Dict[str, Optional[str]] = {}
        vendor_lookup: Dict[str, str] = {}
        desc_lookup: Dict[str, str] = {}

        if cmdb_df is None:
            return cost_lookup, billing_lookup, vendor_lookup, desc_lookup

        for _, row in cmdb_df.iterrows():
            name = safe_str(row.get("application_name", ""))
            if not name:
                continue
            vendor_lookup[name] = safe_str(row.get("vendor", ""))
            desc_lookup[name] = safe_str(row.get("description", ""))

            cost = row.get("total_annual_cost")
            if pd.notna(cost):
                try:
                    cost_lookup[name] = float(cost)
                except (TypeError, ValueError):
                    cost_lookup[name] = None
            else:
                cost_lookup[name] = None

            billing = row.get("billing_cycle")
            billing_lookup[name] = safe_str(billing) if pd.notna(billing) else None

        return cost_lookup, billing_lookup, vendor_lookup, desc_lookup
