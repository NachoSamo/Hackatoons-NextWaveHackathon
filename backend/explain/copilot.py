"""Optional LLM pass that answers questions about one already-resolved diagnosis.

Sibling of `agent.py`, same contract with the rest of the system: the model may only
rephrase and connect the evidence bundle it receives. It does not re-run detection, does
not change the diagnosis, the category or the recommended action, and it never invents a
number. When the question goes past the bundle, it says so instead of guessing.

Never raises: any failure (no key, no pydantic-ai, API error, timeout) returns None and
the caller keeps the deterministic answer it already rendered.
"""

from __future__ import annotations

import json
import os
import time
from threading import Event, Thread

from pydantic import BaseModel, Field

from backend.explain.agent import DOMAIN_RULES
from backend.logging_setup import log

MODEL = "openai:gpt-4o-mini"  # parafrasea evidencia ya resuelta: no necesita más
TIMEOUT_S = 6.0


class CopilotAnswer(BaseModel):
    answer: str = Field(
        description="Two to four sentences answering the question using ONLY the supplied "
        "evidence bundle. Plain English for a payment operations analyst. Cite concrete "
        "numbers from the bundle when they support the answer."
    )
    out_of_scope: bool = Field(
        description="True when the question cannot be answered from the supplied bundle. "
        "In that case 'answer' must say so in one sentence and then list what can be "
        "answered about this incident."
    )


SYSTEM_PROMPT = (
    "You are the Centinel Copilot for a payment operations control tower. An operator is asking "
    "about ONE incident that a deterministic engine already detected, localized and classified. "
    "Write concise English.\n"
    "You may ONLY use the supplied evidence bundle: the diagnosis, its evidence bullets, "
    "alternatives, missing data, cost and recommended action. Never use outside knowledge about "
    "real companies, banks or providers.\n"
    "You do NOT re-run detection, and you never change the diagnosis, the category, the confidence "
    "or the recommended action. They were decided deterministically upstream and are not yours to "
    "revise. If the operator asserts something the bundle contradicts, correct it from the bundle.\n"
    "Never invent a number. Every figure you state must appear in the bundle. If no dollar cost is "
    "supplied, do not quantify the impact.\n"
    "Say 'the evidence indicates'; never claim proven causality and never say 'the AI discovered'. "
    "Do not be alarmist.\n"
    "If the question cannot be answered from the bundle — it asks about billing, other time ranges, "
    "other incidents, or anything not present — set out_of_scope true, say in one sentence that it "
    "is outside this evidence bundle, and then say what you CAN answer about this incident.\n\n"
) + DOMAIN_RULES


def _bundle(diagnosis: dict) -> str:
    """Only the fields the model is allowed to reason over."""
    keep = (
        "incident_id", "diagnosis_category", "diagnosis_status", "confidence_level",
        "slice", "headline", "executive", "operations", "evidence", "alternatives",
        "missing_data", "cost", "recommended_action", "estimated_start", "detected_at",
    )
    return json.dumps({key: diagnosis.get(key) for key in keep}, default=str)


def answer_question(diagnosis: dict, question: str) -> CopilotAnswer | None:
    """Returns None on missing credentials, import failure, errors, or the timeout."""
    if not question.strip():
        return None
    if not os.getenv("OPENAI_API_KEY"):
        log.info("[COPILOT]  sin OPENAI_API_KEY → el frontend deja la respuesta determinista")
        return None
    try:
        from pydantic_ai import Agent
    except Exception:
        log.info("[COPILOT]  pydantic-ai no instalado → respuesta determinista")
        return None
    try:
        agent = Agent(MODEL, output_type=CopilotAnswer, system_prompt=SYSTEM_PROMPT, model_settings={"temperature": 0})
        result: list[CopilotAnswer | None] = [None]
        errored: list[str] = []
        done = Event()

        def run() -> None:
            try:
                prompt = f"Evidence bundle:\n{_bundle(diagnosis)}\n\nOperator question: {question}"
                result[0] = agent.run_sync(prompt).output
            except Exception as exc:  # noqa: BLE001
                errored.append(str(exc))
            finally:
                done.set()

        started = time.perf_counter()
        Thread(target=run, daemon=True).start()
        if not done.wait(TIMEOUT_S):
            log.warning("[COPILOT]  timeout (%.0fs) → respuesta determinista", TIMEOUT_S)
            return None
        if result[0] is None:
            log.warning("[COPILOT]  falló (%s) → respuesta determinista", errored[0] if errored else "desconocido")
            return None
        log.info(
            "[COPILOT]  %s OK (%.1fs) · fuera_de_alcance=%s · \"%s\"",
            MODEL, time.perf_counter() - started, result[0].out_of_scope, question[:60],
        )
        return result[0]
    except Exception as exc:  # noqa: BLE001
        log.warning("[COPILOT]  no pude inicializar (%s) → respuesta determinista", exc)
        return None


def _demo() -> None:
    """Runnable check: `python -m backend.explain.copilot`. No network."""
    import backend.explain.copilot as module

    fixture = {
        "incident_id": "INC-0001", "diagnosis_category": "provider_degradation",
        "diagnosis_status": "supported", "confidence_level": "high",
        "slice": {"provider_id": "adyen", "country": "BR"},
        "headline": "Provider Degradation in adyen / BR", "evidence": ["Approval rate fell."],
        "alternatives": [], "missing_data": [], "cost": None, "recommended_action": None,
    }

    previous = os.environ.pop("OPENAI_API_KEY", None)
    try:
        assert answer_question(fixture, "why?") is None, "sin API key debe devolver None"

        os.environ["OPENAI_API_KEY"] = "test-key"
        assert answer_question(fixture, "   ") is None, "una pregunta vacía no llama al modelo"

        # Stub del Agent: valida el camino feliz sin tocar la red.
        calls: list[str] = []

        class _FakeAgent:
            def __init__(self, *args, **kwargs):
                pass

            def run_sync(self, prompt: str):
                calls.append(prompt)
                class _R:
                    output = CopilotAnswer(answer="The evidence indicates a provider drop.", out_of_scope=False)
                return _R()

        import sys, types
        fake_module = types.ModuleType("pydantic_ai")
        fake_module.Agent = _FakeAgent  # type: ignore[attr-defined]
        real = sys.modules.get("pydantic_ai")
        sys.modules["pydantic_ai"] = fake_module
        try:
            answer = module.answer_question(fixture, "why is adyen the owner?")
        finally:
            if real is None:
                sys.modules.pop("pydantic_ai", None)
            else:
                sys.modules["pydantic_ai"] = real

        assert answer is not None, "con el stub debe devolver una respuesta"
        assert answer.out_of_scope is False
        assert "provider drop" in answer.answer
        assert len(calls) == 1 and "Operator question: why is adyen the owner?" in calls[0]
        assert "INC-0001" in calls[0], "el bundle viaja en el prompt"
        assert "log_tail" not in calls[0], "sólo viajan los campos permitidos"
    finally:
        if previous is None:
            os.environ.pop("OPENAI_API_KEY", None)
        else:
            os.environ["OPENAI_API_KEY"] = previous

    print("copilot self-check passed")


if __name__ == "__main__":
    _demo()
