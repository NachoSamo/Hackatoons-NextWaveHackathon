"""Probabilidades de aprobación y rechazo para el mundo sintético.

Las funciones aceptan dicts o records simples. Para un replay reproducible, el
generador debe pasar un ``random.Random`` con semilla fija en ``ctx['rng']``.
"""

from __future__ import annotations

import random
from collections.abc import Iterable, Mapping
from typing import Any

from backend.data.world import (
    BASE_APPROVAL_RATES,
    DECLINE_CODES,
    ISSUER_APPROVAL_MULTIPLIERS,
    SLOW_PROVIDERS,
    seasonality,
)


JITTER_SIGMA = 0.012
MIN_APPROVAL_PROBABILITY = 0.02
MAX_APPROVAL_PROBABILITY = 0.995
DEFAULT_APPROVAL_PROBABILITY = 0.85

_FIELD_ALIASES: dict[str, tuple[str, ...]] = {
    "merchant_id": ("merchant_id", "merchant"),
    "merchant": ("merchant", "merchant_id"),
    "provider_id": ("provider_id", "provider"),
    "provider": ("provider", "provider_id"),
    "payment_method": ("payment_method", "method"),
    "method": ("method", "payment_method"),
    "country": ("country",),
    "issuer_bank": ("issuer_bank", "issuer"),
    "issuer": ("issuer", "issuer_bank"),
}
_ALLOWED_FILTER_KEYS = frozenset(_FIELD_ALIASES)

_BASE_DECLINE_WEIGHTS: dict[str, float] = {
    "05": 0.35,
    "51": 0.13,
    "91": 0.11,
    "96": 0.08,
    "61": 0.06,
    "65": 0.04,
    "14": 0.07,
    "54": 0.05,
    "41": 0.04,
    "43": 0.03,
    "N7": 0.04,
}


def _field(source: Any, name: str, default: Any = None) -> Any:
    if isinstance(source, Mapping):
        return source.get(name, default)
    return getattr(source, name, default)


def _first_field(source: Any, names: tuple[str, ...], default: Any = None) -> Any:
    for name in names:
        value = _field(source, name)
        if value is not None:
            return value
    return default


def _context_value(ctx: Any, key: str, default: Any = None) -> Any:
    return _first_field(ctx, _FIELD_ALIASES.get(key, (key,)), default)


def _context_hour(ctx: Any) -> int:
    hour = _first_field(ctx, ("hour_utc", "hour"))
    if hour is not None:
        try:
            return int(hour)
        except (TypeError, ValueError):
            pass

    created_at = _field(ctx, "created_at")
    return getattr(created_at, "hour", 12)


def _context_day_type(ctx: Any) -> str:
    day_type = _field(ctx, "day_type")
    if day_type is not None:
        return str(day_type)

    created_at = _field(ctx, "created_at")
    if getattr(created_at, "weekday", lambda: 0)() >= 5:
        return "weekend"
    return "weekday"


def _rng(ctx: Any) -> Any:
    candidate = _first_field(ctx, ("rng", "random"))
    if candidate is not None and hasattr(candidate, "random"):
        return candidate
    return random


def _jitter_multiplier(ctx: Any) -> float:
    explicit_jitter = _field(ctx, "jitter_multiplier")
    if explicit_jitter is not None:
        try:
            return max(0.01, float(explicit_jitter))
        except (TypeError, ValueError):
            pass

    rng = _rng(ctx)
    if hasattr(rng, "gauss"):
        noise = rng.gauss(0.0, JITTER_SIGMA)
    elif hasattr(rng, "normal"):
        noise = rng.normal(0.0, JITTER_SIGMA)
    else:
        noise = random.gauss(0.0, JITTER_SIGMA)
    return max(0.01, 1.0 + float(noise))


def _incident_is_active(incident: Any) -> bool:
    if _field(incident, "active", True) is False:
        return False
    if _field(incident, "stopped_at") is not None:
        return False

    status = _field(incident, "status")
    return str(status).lower() not in {"stopped", "inactive", "resolved"}


def _incident_matches(ctx: Any, incident: Any) -> bool:
    filters = _field(incident, "filters")
    if not isinstance(filters, Mapping):
        return False

    for key, expected in filters.items():
        filter_key = str(key)
        if filter_key not in _ALLOWED_FILTER_KEYS:
            return False
        if _context_value(ctx, filter_key) != expected:
            return False
    return True


def matching_incidents(ctx: Any, incidents: Iterable[Any] | Mapping[str, Any] | None) -> list[Any]:
    """Devuelve incidentes activos cuyo subconjunto de filtros coincide con ctx."""
    if incidents is None:
        return []
    candidates = [incidents] if isinstance(incidents, Mapping) else incidents
    return [
        incident
        for incident in candidates
        if _incident_is_active(incident) and _incident_matches(ctx, incident)
    ]


def _incident_multiplier(incident: Any) -> float:
    value = _first_field(incident, ("approval_multiplier", "magnitude"), 1.0)
    try:
        return max(0.0, float(value))
    except (TypeError, ValueError):
        return 1.0


def p_approve(ctx: Any, incidents: Iterable[Any] | Mapping[str, Any] | None) -> float:
    """Calcula la probabilidad de aprobación observada para una transacción."""
    merchant_id = _context_value(ctx, "merchant_id", "tiendita")
    provider_id = _context_value(ctx, "provider_id", "adyen")
    payment_method = _context_value(ctx, "payment_method", "card")
    country = _context_value(ctx, "country", "MX")
    issuer_bank = _context_value(ctx, "issuer_bank", "")

    try:
        probability = BASE_APPROVAL_RATES[merchant_id][provider_id][payment_method][country]
    except (KeyError, TypeError):
        probability = DEFAULT_APPROVAL_PROBABILITY

    probability *= ISSUER_APPROVAL_MULTIPLIERS.get(str(issuer_bank), 1.0)
    probability *= seasonality(_context_hour(ctx), _context_day_type(ctx))
    probability *= _jitter_multiplier(ctx)

    for incident in matching_incidents(ctx, incidents):
        probability *= _incident_multiplier(incident)

    return max(MIN_APPROVAL_PROBABILITY, min(MAX_APPROVAL_PROBABILITY, probability))


def _contextual_decline_weights(ctx: Any) -> dict[str, float]:
    weights = dict(_BASE_DECLINE_WEIGHTS)
    if _context_value(ctx, "payment_method") == "cash_oxxo":
        weights["51"] *= 4.0
    if _context_value(ctx, "provider_id") in SLOW_PROVIDERS:
        weights["91"] *= 1.8
        weights["96"] *= 1.8
    return weights


def _normalise(weights: Mapping[str, float]) -> dict[str, float]:
    total = sum(max(0.0, value) for value in weights.values())
    if total <= 0:
        return {"05": 1.0}
    return {code: max(0.0, value) / total for code, value in weights.items()}


def _dominant_incident(incidents: list[Any]) -> Any | None:
    eligible: list[tuple[float, str, str, Any]] = []
    for incident in incidents:
        code = _field(incident, "dominant_decline_code")
        if code in DECLINE_CODES:
            eligible.append(
                (
                    _incident_multiplier(incident),
                    str(code),
                    str(_field(incident, "id", "")),
                    incident,
                )
            )
    if not eligible:
        return None
    return min(eligible, key=lambda item: (item[0], item[1], item[2]))[3]


def _incident_decline_weights(weights: Mapping[str, float], dominant_code: str) -> dict[str, float]:
    remaining = {code: value for code, value in weights.items() if code != dominant_code}
    normalised_remaining = _normalise(remaining)
    incident_weights = {code: value * 0.30 for code, value in normalised_remaining.items()}
    incident_weights[dominant_code] = 0.70
    return incident_weights


def _weighted_choice(weights: Mapping[str, float], rng: Any) -> str:
    threshold = rng.random()
    cumulative = 0.0
    last_code = "05"
    for code, weight in _normalise(weights).items():
        cumulative += weight
        last_code = code
        if threshold <= cumulative:
            return code
    return last_code


def pick_decline_code(ctx: Any, incidents: Iterable[Any] | Mapping[str, Any] | None) -> str:
    """Elige un código ISO 8583 para una transacción rechazada."""
    matching = matching_incidents(ctx, incidents)
    weights = _contextual_decline_weights(ctx)
    dominant_incident = _dominant_incident(matching)
    if dominant_incident is not None:
        weights = _incident_decline_weights(
            weights,
            str(_field(dominant_incident, "dominant_decline_code")),
        )
    return _weighted_choice(weights, _rng(ctx))
