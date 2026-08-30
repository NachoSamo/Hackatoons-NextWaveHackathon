"""Optional Pydantic AI wording pass. It receives decisions, never makes them."""

from __future__ import annotations

import os
from pathlib import Path
from threading import Event, Thread

from pydantic import BaseModel, Field


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
        return None
    try:
        from pydantic_ai import Agent

        agent = Agent("openai:gpt-4o", output_type=Explanation, system_prompt=SYSTEM_PROMPT, model_settings={"temperature": 0})
        result: list[Explanation | None] = [None]
        done = Event()

        def run() -> None:
            try:
                response = agent.run_sync(str(payload))
                result[0] = response.output
            except Exception:
                result[0] = None
            finally:
                done.set()

        Thread(target=run, daemon=True).start()
        return result[0] if done.wait(10) else None
    except Exception:
        return None
