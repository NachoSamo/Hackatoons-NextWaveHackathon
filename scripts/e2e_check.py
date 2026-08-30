"""End-to-end check WITHOUT HTTP: core -> contract bridge -> explain -> Diagnosis.

Proves the link that today only the hand-written fixtures cover. Reuses the cube
loader, injector and evidence stub from ``run_core_demo``. No Postgres, no server,
no dependency on Pena's data layer.

Run: ``python scripts/e2e_check.py``
"""

from __future__ import annotations

import json
import sys
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from pathlib import Path

PROJECT_ROOT = Path(__file__).resolve().parents[1]
for extra in (PROJECT_ROOT, PROJECT_ROOT / "scripts"):
    if str(extra) not in sys.path:
        sys.path.insert(0, str(extra))

from run_core_demo import evidence, healthy_cube, inject  # noqa: E402

from backend.contracts import EngineOutput as ContractEngineOutput  # noqa: E402
from backend.core import CentinelEngine  # noqa: E402
from backend.core.models import EngineOutput as CoreEngineOutput  # noqa: E402
from backend.explain.build import diagnose  # noqa: E402
from backend.explain.prioritize import score_incidents  # noqa: E402
from backend.logging_setup import setup  # noqa: E402

setup()  # show the explain-layer trace while debugging


EMITTED = ("detected", "insufficient_evidence")


def to_contract(core_output: CoreEngineOutput) -> ContractEngineOutput:
    """The bridge. `IncidentOutput.to_dict()` already matches `IncidentEvidence`;
    pydantic drops the extra keys. Only emit incidents the engine actually stands behind."""
    incidents = [
        incident
        for incident in core_output.to_dict()["incidents"]
        if incident["incident_status"] in EMITTED
    ]
    return ContractEngineOutput.model_validate({"incidents": incidents})


SCENARIOS: dict[str, list[tuple[dict[str, str], float]]] = {
    "healthy": [],
    "provider_br": [({"provider_id": "adyen", "country": "BR"}, 0.38)],
    "dual": [
        ({"provider_id": "adyen", "country": "BR"}, 0.38),
        ({"merchant_id": "rappido", "country": "MX"}, 0.72),
    ],
    "overlap": [
        ({"provider_id": "adyen", "country": "BR"}, 0.42),
        ({"merchant_id": "rappido", "country": "BR"}, 0.62),
    ],
    "unseen": [({"provider_id": "dlocal", "country": "CO"}, 0.45)],
    "pix_br": [({"payment_method": "pix", "country": "BR"}, 0.73)],
}


def run_scenario(name: str, base: list) -> dict:
    engine = CentinelEngine()
    start = datetime(2026, 8, 30, 14, 0, tzinfo=timezone.utc)

    if name == "weak":
        target = min(base, key=lambda leaf: leaf.attempts)
        cube = [replace(leaf, approved=0) if leaf.key == target.key else leaf for leaf in base]
        windows = engine.config.weak_signal_validation_windows + 1
    else:
        cube = inject(base, SCENARIOS[name])
        windows = 5

    core_output = CoreEngineOutput()
    for minute in range(windows):
        core_output = engine.process_cube(
            cube, start + timedelta(minutes=minute), evidence_loader=evidence
        )

    contract = to_contract(core_output)
    diagnoses = diagnose(contract)
    scored = score_incidents(diagnoses)

    return {
        "engine_incidents": [
            f'{i["incident_status"]}:{i["diagnosis_category"]}@{_slice(i["slice"])}'
            for i in core_output.to_dict()["incidents"]
        ],
        "diagnoses": [
            {
                "headline": d.headline,
                "category": d.diagnosis_category,
                "status": d.diagnosis_status,
                "action": d.recommended_action.action_id if d.recommended_action else None,
                "cost_usd_h": round(d.cost.usd_per_hour) if d.cost else None,
                "llm_used": d.llm_used,
                "missing_data": len(d.missing_data),
            }
            for d in diagnoses
        ],
        "priority": [
            {"id": s.diagnosis.incident_id, "score": round(s.score, 3)} for s in scored
        ],
    }


def _slice(slc: dict) -> str:
    return "/".join(f"{k}={v}" for k, v in slc.items() if v) or "*"


def main() -> None:
    base = healthy_cube()
    report: dict[str, dict] = {}
    for name in (*SCENARIOS, "weak"):
        report[name] = run_scenario(name, base)

    print(json.dumps(report, indent=2))

    # assertions: the pipeline connected and produced sane output
    assert not report["healthy"]["diagnoses"], "healthy traffic must produce no diagnosis"

    dual = report["dual"]["diagnoses"]
    assert len(dual) == 2, f"dual scenario must yield 2 diagnoses, got {len(dual)}"
    assert {d["category"] for d in dual} == {"provider_degradation", "issuer_over_declining"}
    top = report["dual"]["priority"][0]["id"]
    assert report["dual"]["priority"][0]["score"] == 1.0

    weak = report["weak"]["diagnoses"]
    assert weak and weak[0]["status"] != "supported"
    assert weak[0]["action"] == "monitor_for_evidence"
    assert weak[0]["missing_data"] > 0

    for name in ("provider_br", "overlap", "unseen"):
        assert report[name]["diagnoses"], f"{name}: expected at least one diagnosis"

    print("\nE2E CHECK: PASS")


if __name__ == "__main__":
    main()
