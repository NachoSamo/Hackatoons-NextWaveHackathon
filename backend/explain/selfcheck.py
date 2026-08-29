"""Runnable smoke check: python -m backend.explain.selfcheck."""

from __future__ import annotations

import json
from pathlib import Path

from backend.contracts import EngineOutput
from backend.explain.build import diagnose
from backend.explain.prioritize import score_incidents


FIXTURES = Path(__file__).parents[1] / "fixtures"


def _load(name: str) -> EngineOutput:
    return EngineOutput.model_validate(json.loads((FIXTURES / f"{name}.json").read_text(encoding="utf-8")))


def main() -> None:
    provider = diagnose(_load("engine_output_provider_degradation"))
    assert len(provider) == 1
    d = provider[0]
    assert d.recommended_action and d.recommended_action.action_id == "reroute_provider_slice"
    assert d.cost and d.cost.usd_per_hour > 0
    assert d.llm_used in (True, False)
    assert len(d.evidence) >= 4
    assert not d.missing_data

    dual = diagnose(_load("engine_output_dual_incident"))
    assert len(dual) == 2
    scored = score_incidents(dual)
    assert scored[0].score == 1.0
    assert scored[0].diagnosis.cost.usd_per_hour >= scored[1].diagnosis.cost.usd_per_hour, "higher-money incident must rank first"

    weak = diagnose(_load("engine_output_weak_signal"))
    assert weak[0].cost is None
    assert weak[0].recommended_action and weak[0].recommended_action.action_id == "monitor_for_evidence"
    assert weak[0].missing_data, "insufficient-evidence incident must list missing data"

    print("explain self-check passed\n")
    for label, group in (("PROVIDER", provider), ("DUAL", dual), ("WEAK", weak)):
        for item in group:
            print(f"--- {label} · {item.incident_id} · llm_used={item.llm_used}")
            print(f"  headline:   {item.headline}")
            print(f"  executive:  {item.executive}")
            print()


if __name__ == "__main__":
    main()
