"""Structured logging setup."""
import logging
import sys
import io


def setup_logging(level: str = "INFO"):
    log_level = getattr(logging, level.upper(), logging.INFO)
    fmt = "%(asctime)s | %(levelname)-8s | %(name)s | %(message)s"

    # Wrap stdout in UTF-8 so emoji/unicode in log messages don't crash on Windows
    utf8_stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace", line_buffering=True)
    handler = logging.StreamHandler(utf8_stdout)
    handler.setLevel(log_level)
    handler.setFormatter(logging.Formatter(fmt, datefmt="%H:%M:%S"))

    # force=True overrides uvicorn's own basicConfig so our format wins
    logging.basicConfig(level=log_level, handlers=[handler], force=True)

    for name in ("api", "services", "utils", "prompts", "__main__"):
        logging.getLogger(name).setLevel(log_level)

    for noisy in ("httpx", "httpcore", "sentence_transformers", "torch"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
