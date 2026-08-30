"""Runnable smoke check: python -m backend.explain.selfcheck."""

from __future__ import annotations

import json
from pathlib import Path

from backend.contracts import EngineOutput, Slice
from backend.explain.build import diagnose
from backend.explain.prioritize import score_incidents


FIXTURES = Path(__file__).parents[1] / "fixtures"


def _load(name: str) -> EngineOutput:
    return EngineOutput.model_validate(json.loads((FIXTURES / f"{name}.json").read_text(encoding="utf-8")))


def main() -> None:
    provider_input = _load("engine_output_provider_degradation")
    provider = diagnose(provider_input)
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

    seed = provider_input.incidents[0]
    core_categories = {
        "issuer_over_declining": (
            "escalate_issuer_declines",
            Slice(merchant_id="rappido", country="MX"),
        ),
        "payment_method_outage": (
            "review_payment_method",
            Slice(payment_method="pix", country="BR"),
        ),
        "merchant_integration_error": (
            "inspect_merchant_integration",
            Slice(merchant_id="rappido", country="BR"),
        ),
        "merchant_configuration": (
            "review_merchant_configuration",
            Slice(merchant_id="rappido", country="BR"),
        ),
    }
    for category, (expected_action, slice_) in core_categories.items():
        incident = seed.model_copy(
            update={
                "incident_id": f"CHECK-{category}",
                "diagnosis_category": category,
                "slice": slice_,
            }
        )
        diagnosis = diagnose(EngineOutput(incidents=[incident]))[0]
        assert diagnosis.recommended_action
        assert diagnosis.recommended_action.action_id == expected_action

    print("explain self-check passed\n")
    for label, group in (("PROVIDER", provider), ("DUAL", dual), ("WEAK", weak)):
        for item in group:
            print(f"--- {label} · {item.incident_id} · llm_used={item.llm_used}")
            print(f"  headline:   {item.headline}")
            print(f"  executive:  {item.executive}")
            print()


if __name__ == "__main__":
    main()
