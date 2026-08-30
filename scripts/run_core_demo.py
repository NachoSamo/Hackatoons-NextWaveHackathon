"""Deterministic acceptance scenario for the Centinel diagnosis core."""

from __future__ import annotations

import argparse
import json
import sys
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from pathlib import Path
from time import perf_counter
from typing import Any

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import pandas as pd

from backend.core import (
    CentinelEngine,
    DiagnosisCategory,
    IncidentStatus,
    Leaf,
    PaymentEvent,
)


CUBE_PATH = PROJECT_ROOT / "backend" / "data" / "out" / "cube_sample.parquet"
FIXTURE_PATH = PROJECT_ROOT / "backend" / "data" / "out" / "fixture.parquet"
DIMENSIONS = ("merchant_id", "provider_id", "payment_method", "country")


def healthy_cube() -> list[Leaf]:
    rows = pd.read_parquet(CUBE_PATH).to_dict("records")
    leaves: list[Leaf] = []
    for row in rows:
        expected_rate = float(row["fc_approved"]) / float(row["fc_attempts"])
        row["approved"] = round(int(row["attempts"]) * expected_rate)
        leaves.append(Leaf.from_mapping(row))
    return leaves


def inject(
    leaves: list[Leaf],
    incidents: list[tuple[dict[str, str], float]],
) -> list[Leaf]:
    output: list[Leaf] = []
    for leaf in leaves:
        multiplier = 1.0
        for filters, incident_multiplier in incidents:
            if all(getattr(leaf, name) == value for name, value in filters.items()):
                multiplier *= incident_multiplier
        output.append(
            replace(
                leaf,
                approved=round(
                    leaf.attempts * leaf.expected_rate * multiplier
                ),
            )
        )
    return output


def evidence(filters: dict[str, str], _: int) -> dict[str, Any]:
    if filters.get("provider_id") == "adyen" and filters.get("country") == "BR":
        return {
            "decline_codes": {
                "before": {"05": 12, "91": 4},
                "after": {"05": 28, "91": 208},
            },
            "issuers": [
                {
                    "issuer_bank": "itau",
                    "attempts": 180,
                    "approval_rate": 0.41,
                    "delta_pts": -47,
                },
                {
                    "issuer_bank": "nubank",
                    "attempts": 150,
                    "approval_rate": 0.43,
                    "delta_pts": -45,
                },
                {
                    "issuer_bank": "bradesco",
                    "attempts": 100,
                    "approval_rate": 0.46,
                    "delta_pts": -42,
                },
            ],
            "sample_size": 430,
            "wilson_ci": [0.44, 0.54],
        }
    if filters.get("merchant_id") == "rappido" and filters.get("country") == "MX":
        return {
            "decline_codes": {
                "before": {"05": 14, "51": 10},
                "after": {"05": 132, "51": 12},
            },
            "issuers": [
                {
                    "issuer_bank": "banorte",
                    "attempts": 180,
                    "approval_rate": 0.53,
                    "delta_pts": -31,
                },
                {
                    "issuer_bank": "bbva_mx",
                    "attempts": 45,
                    "approval_rate": 0.84,
                    "delta_pts": -2,
                },
            ],
            "sample_size": 225,
            "wilson_ci": [0.54, 0.66],
        }
    if filters.get("provider_id") == "dlocal" and filters.get("country") == "CO":
        return {
            "decline_codes": {
                "before": {"05": 18, "96": 2},
                "after": {"05": 21, "96": 154},
            },
            "issuers": [
                {"issuer_bank": "bancolombia", "attempts": 90, "delta_pts": -38},
                {"issuer_bank": "davivienda", "attempts": 75, "delta_pts": -40},
            ],
            "sample_size": 165,
            "wilson_ci": [0.43, 0.57],
        }
    if filters.get("merchant_id") == "rappido" and filters.get("country") == "BR":
        return {
            "decline_codes": {
                "before": {"14": 2, "05": 18},
                "after": {"14": 142, "05": 20},
            },
            "issuers": [],
            "sample_size": 300,
            "wilson_ci": [0.48, 0.59],
        }
    return {}


def incident_signature(result: Any) -> set[tuple[str, tuple[tuple[str, str], ...]]]:
    return {
        (
            incident.diagnosis.category.value,
            tuple(sorted(incident.candidate.slice.to_filters().items())),
        )
        for incident in result.incidents
        if incident.incident_status == IncidentStatus.DETECTED
    }


def run_main_scenario(base: list[Leaf]) -> dict[str, Any]:
    engine = CentinelEngine()
    start = datetime(2026, 8, 30, 14, 0, tzinfo=timezone.utc)

    for minute in range(3):
        result = engine.process_cube(base, start + timedelta(minutes=minute))
        assert not result.incidents, "healthy traffic must remain silent"

    simultaneous = inject(
        base,
        [
            ({"provider_id": "adyen", "country": "BR"}, 0.38),
            ({"merchant_id": "rappido", "country": "MX"}, 0.72),
        ],
    )
    identities: dict[tuple[tuple[str, str], ...], str] = {}
    result = None
    elapsed = 0.0
    for offset in range(3, 6):
        tick = perf_counter()
        result = engine.process_cube(
            simultaneous,
            start + timedelta(minutes=offset),
            evidence_loader=evidence,
        )
        elapsed = max(elapsed, perf_counter() - tick)
        for incident in result.incidents:
            key = tuple(sorted(incident.candidate.slice.to_filters().items()))
            previous = identities.setdefault(key, incident.incident_id)
            assert previous == incident.incident_id, "incident IDs must remain stable"

    assert result is not None
    expected = {
        (
            DiagnosisCategory.PROVIDER_DEGRADATION.value,
            (("country", "BR"), ("provider_id", "adyen")),
        ),
        (
            DiagnosisCategory.ISSUER_OVER_DECLINING.value,
            (("country", "MX"), ("merchant_id", "rappido")),
        ),
    }
    assert incident_signature(result) == expected

    mx_only = inject(
        base, [({"merchant_id": "rappido", "country": "MX"}, 0.72)]
    )
    resolved_br = False
    for offset in range(6, 8):
        result = engine.process_cube(
            mx_only,
            start + timedelta(minutes=offset),
            evidence_loader=evidence,
        )
        resolved_br |= any(
            incident.incident_status == IncidentStatus.RESOLVED
            and incident.candidate.slice.provider_id == "adyen"
            for incident in result.incidents
        )
    assert resolved_br, "BR must resolve independently while MX remains detected"
    assert any(
        incident.incident_status == IncidentStatus.DETECTED
        and incident.candidate.slice.country == "MX"
        for incident in result.incidents
    )

    resolved_mx = False
    for offset in range(8, 10):
        result = engine.process_cube(
            base,
            start + timedelta(minutes=offset),
            evidence_loader=evidence,
        )
        resolved_mx |= any(
            incident.incident_status == IncidentStatus.RESOLVED
            and incident.candidate.slice.country == "MX"
            for incident in result.incidents
        )
    assert resolved_mx
    assert elapsed < 1.0, f"one cube took too long: {elapsed:.3f}s"

    return {
        "maximum_window_latency_ms": round(elapsed * 1000, 2),
        "stable_incident_ids": sorted(identities.values()),
    }


def run_overlap_scenario(base: list[Leaf]) -> list[dict[str, str]]:
    engine = CentinelEngine()
    overlapping = inject(
        base,
        [
            ({"provider_id": "adyen", "country": "BR"}, 0.42),
            ({"merchant_id": "rappido", "country": "BR"}, 0.62),
        ],
    )
    result = None
    for minute in range(3):
        result = engine.process_cube(
            overlapping,
            datetime(2026, 8, 30, 15, minute, tzinfo=timezone.utc),
            evidence_loader=evidence,
        )
    assert result is not None
    slices = [
        incident.candidate.slice.to_filters()
        for incident in result.incidents
        if incident.incident_status == IncidentStatus.DETECTED
    ]
    assert {tuple(sorted(item.items())) for item in slices} == {
        (("country", "BR"), ("provider_id", "adyen")),
        (("country", "BR"), ("merchant_id", "rappido")),
    }, "residualization must separate overlapping incidents in the same country"
    return slices


def run_unseen_and_weak_scenarios(base: list[Leaf]) -> dict[str, Any]:
    unseen_engine = CentinelEngine()
    unseen = inject(base, [({"provider_id": "dlocal", "country": "CO"}, 0.45)])
    result = None
    for minute in range(3):
        result = unseen_engine.process_cube(
            unseen,
            datetime(2026, 8, 30, 16, minute, tzinfo=timezone.utc),
            evidence_loader=evidence,
        )
    assert result is not None
    assert (
        DiagnosisCategory.PROVIDER_DEGRADATION.value,
        (("country", "CO"), ("provider_id", "dlocal")),
    ) in incident_signature(result), "unseen provider-country combinations must generalize"

    weak_target = min(base, key=lambda leaf: leaf.attempts)
    weak_cube = [
        replace(leaf, approved=0) if leaf.key == weak_target.key else leaf
        for leaf in base
    ]
    weak_engine = CentinelEngine()
    weak_result = None
    for minute in range(weak_engine.config.weak_signal_validation_windows):
        weak_result = weak_engine.process_cube(
            weak_cube, datetime(2026, 8, 30, 17, minute, tzinfo=timezone.utc)
        )
        if minute + 1 < weak_engine.config.weak_signal_validation_windows:
            assert not weak_result.incidents, "transient low-volume noise must stay silent"
    assert weak_result is not None
    weak_incidents = [
        incident
        for incident in weak_result.incidents
        if incident.incident_status == IncidentStatus.INSUFFICIENT_EVIDENCE
    ]
    assert weak_incidents, "low-volume anomalies must be explicit, not silently dropped"
    return {
        "unseen_category": DiagnosisCategory.PROVIDER_DEGRADATION.value,
        "weak_signal_status": weak_incidents[0].incident_status.value,
    }


def run_raw_adapter_smoke() -> dict[str, Any]:
    fixture = pd.read_parquet(FIXTURE_PATH)
    start = fixture["created_at"].min()
    baseline_end = start + timedelta(minutes=12)
    window_end = baseline_end + timedelta(minutes=1)
    baseline_frame = fixture[fixture["created_at"] < baseline_end]
    window_frame = fixture[
        (fixture["created_at"] >= baseline_end)
        & (fixture["created_at"] < window_end)
    ]
    baseline_events = [
        PaymentEvent.from_mapping(row)
        for row in baseline_frame.to_dict("records")
    ]
    window_events = [
        PaymentEvent.from_mapping(row)
        for row in window_frame.to_dict("records")
    ]
    engine = CentinelEngine()
    engine.fit_baseline(baseline_events)
    result = engine.process_events(window_events, observed_at=window_end.to_pydatetime())
    assert not result.errors
    return {
        "baseline_events": len(baseline_events),
        "window_events": len(window_events),
        "engine_errors": list(result.errors),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--raw-smoke",
        action="store_true",
        help="also exercise the optional raw-event adapter against fixture.parquet",
    )
    args = parser.parse_args()
    base = healthy_cube()
    report = {
        "main": run_main_scenario(base),
        "overlap": run_overlap_scenario(base),
        "edge_cases": run_unseen_and_weak_scenarios(base),
    }
    if args.raw_smoke:
        report["raw_adapter"] = run_raw_adapter_smoke()
    print(json.dumps(report, indent=2, sort_keys=True))
    print("CORE DEMO: PASS")


if __name__ == "__main__":
    main()
