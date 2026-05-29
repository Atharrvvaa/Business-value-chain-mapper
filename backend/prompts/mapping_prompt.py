"""AI prompt templates for capability mapping."""

SYSTEM_PROMPT = """You are an Enterprise Architecture AI. Map applications to business capabilities.
Return ONLY valid JSON. No text outside the JSON. Keep reasoning under 10 words."""


def build_mapping_prompt(
    application_name: str,
    vendor: str,
    cmdb_description: str,
    enriched_context: str,
    semantic_score: float,
    context_score: float,
    capabilities: list,
) -> str:
    caps_str = "\n".join(f"- {c}" for c in capabilities)
    return f"""App: {application_name} | Vendor: {vendor}
Description: {cmdb_description}
Context: {enriched_context}

Capabilities to choose from:
{caps_str}

Pick 1-3 best matches. Return ONLY this JSON (no other text):
{{"application_name":"{application_name}","mapped_capabilities":[{{"capability":"<name>","confidence":<0.0-1.0>,"reasoning":"<10 words max>"}}]}}

/no_think"""
