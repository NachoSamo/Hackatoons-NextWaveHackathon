"""Explainable, normalized incident ordering for the command center."""

from __future__ import annotations

from datetime import datetime, timezone

from backend.contracts import Diagnosis, ScoredIncident


MERCHANT_CRITICALITY = {"rappido": 1.0, "streamplus": 0.85, "tiendita": 0.7}
CONFIDENCE = {"high": 1.0, "medium": 0.7, "low": 0.4}


def _components(diagnosis: Diagnosis, max_usd: float) -> dict[str, float]:
    usd = diagnosis.cost.usd_per_hour if diagnosis.cost else 0.0
    impact = (usd / max_usd) if max_usd > 0 else 0.5  # relative to the biggest incident in the batch
    scope = 0.4 + 0.15 * sum(value is None for value in diagnosis.slice.model_dump().values())
    elapsed = max(0.0, (datetime.now(timezone.utc) - diagnosis.estimated_start).total_seconds())
    persistence = min(1.0, 0.35 + elapsed / 300)
    confidence = CONFIDENCE.get(diagnosis.confidence_level.lower(), 0.5)
    merchant = MERCHANT_CRITICALITY.get(diagnosis.slice.merchant_id or "", 0.75)
    return {"impact": impact, "scope": min(1.0, scope), "persistence": persistence, "confidence": confidence, "merchant_criticality": merchant}


def score_incidents(diagnoses: list[Diagnosis]) -> list[ScoredIncident]:
    max_usd = max((d.cost.usd_per_hour for d in diagnoses if d.cost), default=0.0)
    raw = [(diagnosis, _components(diagnosis, max_usd)) for diagnosis in diagnoses]
    values = [
        parts["impact"] * parts["scope"] * parts["persistence"] * parts["confidence"] * parts["merchant_criticality"]
        for _, parts in raw
    ]
    top = max(values, default=1.0) or 1.0
    return sorted(
        [ScoredIncident(diagnosis=diagnosis, score=value / top, components=parts) for (diagnosis, parts), value in zip(raw, values)],
        key=lambda item: item.score,
        reverse=True,
    )
