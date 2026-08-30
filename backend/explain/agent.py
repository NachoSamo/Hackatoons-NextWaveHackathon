"""Optional Pydantic AI wording pass. It receives decisions, never makes them."""

from __future__ import annotations

import os
import time
from pathlib import Path
from threading import Event, Thread

from dotenv import load_dotenv
from pydantic import BaseModel, Field

from backend.logging_setup import log

# Carga .env si existe en backend/ o raíz del proyecto
load_dotenv(Path(__file__).resolve().parents[1] / ".env")
load_dotenv(Path(__file__).resolve().parents[2] / ".env")


class Explanation(BaseModel):
    executive: str = Field(
        description="Two short sentences for leadership. What is happening and the money at risk. "
        "Calm and plain. No decline codes, no sample sizes, no jargon."
    )
    operations: str = Field(
        description="Dense readout for an operations analyst, 3 to 5 sentences. Include: the approval-rate "
        "drop with baseline and sample size, the dominant decline-code shift, issuer evidence, whether "
        "peer providers/methods are healthy, and the confidence level. State facts from the supplied "
        "evidence only."
    )
    action_rationale: str = Field(
        description="One or two sentences: why the supplied recommended action fits this evidence. "
        "Do not propose a different action."
    )


RULES_DIR = Path(__file__).with_name("rules")
SYSTEM_PROMPT = (
    "You are a payment-operations writer for the Control Tower. Write concise English. "
    "Say 'the evidence indicates'; never claim proven causality and never say 'the AI discovered'. "
    "You may only phrase the supplied structured evidence, action, cost, and limitations. "
    "You do not choose or change the recommended action, and you never put the action in place of the situation. "
    "'executive' is for leadership (situation + money). 'operations' is the evidence detail for an analyst. "
    "Do not be alarmist: no 'immediate attention required', 'urgent', or 'act now'. State the facts and let them speak. "
    "If no dollar cost is supplied, do not invent one or quantify the impact in the executive line. "
    "When the evidence is not supported, say plainly that it is insufficient for an operational change.\n\n"
) + "\n\n".join(path.read_text(encoding="utf-8") for path in sorted(RULES_DIR.glob("*.md")))


def write_explanation(payload: dict) -> Explanation | None:
    """Returns None on missing credentials, import failure, errors, or a ten-second timeout."""
    if not os.getenv("OPENAI_API_KEY"):
        log.info("[EXPLAIN]    LLM: sin OPENAI_API_KEY → uso plantillas deterministas")
        return None
    try:
        from pydantic_ai import Agent
    except Exception:
        log.info("[EXPLAIN]    LLM: pydantic-ai no instalado → plantillas deterministas")
        return None
    try:
        agent = Agent("openai:gpt-4o", output_type=Explanation, system_prompt=SYSTEM_PROMPT, model_settings={"temperature": 0})
        result: list[Explanation | None] = [None]
        errored: list[str] = []
        done = Event()

        def run() -> None:
            try:
                response = agent.run_sync(str(payload))
                result[0] = response.output
            except Exception as exc:  # noqa: BLE001
                errored.append(str(exc))
            finally:
                done.set()

        started = time.perf_counter()
        Thread(target=run, daemon=True).start()
        if not done.wait(10):
            log.warning("[EXPLAIN]    LLM: gpt-4o cortó por timeout (10s) → fallback determinista")
            return None
        if result[0] is None:
            log.warning("[EXPLAIN]    LLM: gpt-4o falló (%s) → fallback determinista", errored[0] if errored else "desconocido")
            return None
        log.info("[EXPLAIN]    LLM: gpt-4o OK (%.1fs) → redacté executive + operations", time.perf_counter() - started)
        return result[0]
    except Exception as exc:  # noqa: BLE001
        log.warning("[EXPLAIN]    LLM: no pude inicializar (%s) → fallback determinista", exc)
        return None
