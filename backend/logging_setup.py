"""Human-readable backend trace.

One line per step of the request pipeline, in plain English, so you can watch and
debug the flow. Default level INFO; set ``CENTINEL_LOG=debug`` for more, ``warning``
for near-silence.

Reads like:

    16:12:41  → POST /api/agent/explain  (fixture "pix_method_outage")
    16:12:41     parsed EngineOutput: 1 incident
    16:12:41     ● INC-PIX-01  payment_method_outage / supported / high  slice=pix/BR
    16:12:41         action: catalog[method_degradation] (alias of payment_method_outage) → review_payment_method  owner=merchant
    16:12:41         evidence 7 bullets · alternatives 1 · missing_data 0
    16:12:41         cost $155,400/hr  (fallback $35 ticket — data layer not wired)
    16:12:47         LLM: gpt-4o ok (6.1s) — executive + operations rewritten
    16:12:47     priority: INC-PIX-01=1.00
    16:12:47  ← 200  1 diagnosis, 1 prioritized  (6.3s)
"""

from __future__ import annotations

import logging
import os
import sys

log = logging.getLogger("centinel")

_DONE = False


def setup() -> None:
    global _DONE
    if _DONE:
        return
    level_name = os.getenv("CENTINEL_LOG", "info").upper()
    level = getattr(logging, level_name, logging.INFO)
    try:  # Windows consoles default to cp1252; make the trace encoding-safe
        sys.stdout.reconfigure(encoding="utf-8", errors="backslashreplace")
    except Exception:
        pass
    handler = logging.StreamHandler(sys.stdout)
    handler.setFormatter(logging.Formatter("%(asctime)s  %(message)s", datefmt="%H:%M:%S"))
    log.handlers.clear()
    log.addHandler(handler)
    log.setLevel(level)
    log.propagate = False
    # keep the http/openai libraries from drowning the trace
    for noisy in ("httpx", "httpcore", "openai", "urllib3", "pydantic_ai"):
        logging.getLogger(noisy).setLevel(logging.WARNING)
    _DONE = True


def slice_str(slice_obj: object) -> str:
    """`{provider_id: adyen, country: BR, ...}` -> `adyen/BR`."""
    data = slice_obj.model_dump() if hasattr(slice_obj, "model_dump") else dict(slice_obj)  # type: ignore[arg-type]
    parts = [str(v) for v in data.values() if v]
    return "/".join(parts) or "*"
