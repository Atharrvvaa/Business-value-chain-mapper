"""Text cleaning and normalization utilities."""
import re
import string
from typing import List


STOPWORDS = {
    "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
    "being", "have", "has", "had", "do", "does", "did", "will", "would",
    "could", "should", "may", "might", "shall", "can", "need", "dare",
    "ought", "used", "it", "its", "this", "that", "these", "those", "i",
    "we", "you", "he", "she", "they", "me", "us", "him", "her", "them",
    "my", "our", "your", "his", "their", "what", "which", "who", "whom",
    "when", "where", "why", "how", "all", "both", "each", "few", "more",
    "most", "other", "some", "such", "no", "not", "only", "same", "so",
    "than", "too", "very", "just", "as", "if", "then", "because", "while",
    "although", "though", "yet", "since", "until", "unless", "whether",
}


def clean_text(text: str) -> str:
    """Lowercase, remove punctuation, strip stopwords."""
    if not text or not isinstance(text, str):
        return ""
    text = text.lower()
    text = re.sub(r"[^\w\s]", " ", text)
    text = re.sub(r"\s+", " ", text).strip()
    tokens = [w for w in text.split() if w not in STOPWORDS and len(w) > 1]
    return " ".join(tokens)


def extract_keywords(text: str, top_n: int = 15) -> List[str]:
    """Extract meaningful keywords from text."""
    if not text:
        return []
    cleaned = clean_text(text)
    tokens = cleaned.split()
    # Frequency-based simple extraction
    freq: dict = {}
    for t in tokens:
        freq[t] = freq.get(t, 0) + 1
    sorted_tokens = sorted(freq.items(), key=lambda x: x[1], reverse=True)
    return [t for t, _ in sorted_tokens[:top_n]]


def normalize_vendor(vendor: str) -> str:
    """Normalize vendor name for comparison."""
    if not vendor or not isinstance(vendor, str):
        return ""
    vendor = vendor.lower().strip()
    # Remove common suffixes
    for suffix in [" inc", " corp", " ltd", " llc", " ag", " plc", " sa", " nv", "."]:
        vendor = vendor.replace(suffix, "")
    return vendor.strip()


def safe_str(val) -> str:
    """Safely convert any value to string."""
    if val is None:
        return ""
    try:
        s = str(val).strip()
        return s if s.lower() not in ("nan", "none", "null", "") else ""
    except Exception:
        return ""
