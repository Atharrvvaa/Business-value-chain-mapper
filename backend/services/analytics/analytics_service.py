"""Analytics service — computes summary statistics from mapping results."""

from typing import Dict, Any, List
from collections import defaultdict

from utils.state import app_state


class AnalyticsService:

    def get_summary(self) -> Dict[str, Any]:
        results = app_state.mapping_results or []
        total_apps = len(results)
        mapped = [r for r in results if r.get("is_mapped")]
        unmapped = [r for r in results if not r.get("is_mapped")]

        tiers = defaultdict(int)
        for r in results:
            tiers[r.get("match_tier", "unknown")] += 1

        sources = defaultdict(int)
        for r in results:
            sources[r.get("enrichment_source", "Unknown")] += 1

        avg_confidence = 0.0
        cap_counts: Dict[str, int] = defaultdict(int)
        vc_counts: Dict[str, int] = defaultdict(int)
        conf_list = []

        for r in results:
            for mc in r.get("mapped_capabilities", []):
                cap_counts[mc["capability"]] += 1
                vc_counts[mc.get("value_chain", "Unknown")] += 1
                conf_list.append(mc["confidence"])

        if conf_list:
            avg_confidence = round(sum(conf_list) / len(conf_list), 3)

        return {
            "total_applications": total_apps,
            "mapped_count": len(mapped),
            "unmapped_count": len(unmapped),
            "mapping_rate": round(len(mapped) / max(total_apps, 1), 3),
            "average_confidence": avg_confidence,
            "match_tiers": dict(tiers),
            "enrichment_sources": dict(sources),
            "top_capabilities": sorted(cap_counts.items(), key=lambda x: x[1], reverse=True)[:10],
            "value_chain_coverage": dict(vc_counts),
        }

    def get_heatmap_data(self) -> List[Dict[str, Any]]:
        results = app_state.mapping_results or []
        capabilities_df = app_state.capabilities_df

        if capabilities_df is None:
            return []

        # Build {vc: [caps]} structure
        from collections import defaultdict
        vc_caps: Dict[str, List[str]] = defaultdict(list)
        for _, row in capabilities_df.iterrows():
            vc = str(row.get("level_1_value_chain", ""))
            cap = str(row.get("level_2_capability", ""))
            if vc and cap:
                vc_caps[vc].append(cap)

        # Build app count per capability
        cap_app_count: Dict[str, int] = defaultdict(int)
        cap_avg_conf: Dict[str, List[float]] = defaultdict(list)

        for r in results:
            for mc in r.get("mapped_capabilities", []):
                cap = mc["capability"]
                cap_app_count[cap] += 1
                cap_avg_conf[cap].append(mc["confidence"])

        heatmap = []
        for vc, caps in vc_caps.items():
            for cap in caps:
                count = cap_app_count.get(cap, 0)
                confs = cap_avg_conf.get(cap, [])
                avg_conf = round(sum(confs) / len(confs), 3) if confs else 0.0
                heatmap.append({
                    "value_chain": vc,
                    "capability": cap,
                    "app_count": count,
                    "avg_confidence": avg_conf,
                    "coverage": "covered" if count > 0 else "gap",
                })

        return heatmap

    def get_unmapped_applications(self) -> List[Dict[str, Any]]:
        results = app_state.mapping_results or []
        return [
            {
                "application_name": r["application_name"],
                "vendor": r.get("vendor", ""),
                "cmdb_description": r.get("cmdb_description", ""),
                "match_tier": r.get("match_tier", ""),
                "match_score": r.get("match_score", 0.0),
            }
            for r in results if not r.get("is_mapped")
        ]

    def get_confidence_distribution(self) -> List[Dict[str, Any]]:
        results = app_state.mapping_results or []
        buckets = {
            "0.0-0.4": 0, "0.4-0.6": 0, "0.6-0.8": 0, "0.8-1.0": 0
        }
        for r in results:
            for mc in r.get("mapped_capabilities", []):
                c = mc["confidence"]
                if c < 0.4:
                    buckets["0.0-0.4"] += 1
                elif c < 0.6:
                    buckets["0.4-0.6"] += 1
                elif c < 0.8:
                    buckets["0.6-0.8"] += 1
                else:
                    buckets["0.8-1.0"] += 1
        return [{"range": k, "count": v} for k, v in buckets.items()]
