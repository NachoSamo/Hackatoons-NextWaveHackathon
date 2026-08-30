"""Inyector paramétrico y determinístico de incidentes de demo."""

from __future__ import annotations

import threading
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any, Mapping

from backend.data.world import (
    COUNTRIES,
    DECLINE_CODES,
    ISSUERS_BY_COUNTRY,
    MERCHANTS,
    METHODS_BY_COUNTRY,
    PROVIDERS,
)


FILTER_FIELDS = frozenset(
    {"merchant_id", "provider_id", "payment_method", "country", "issuer_bank"}
)
MAGNITUDE_MIN = 0.05
MAGNITUDE_MAX = 0.95
MAGNITUDE_STEP = 0.01
ACTION_RAMP_SECONDS = 20

PRESETS: dict[str, dict[str, Any]] = {
    "provider_br": {
        "filters": {"provider_id": "adyen", "country": "BR"},
        "magnitude": 0.38,
        "decline_code": "91",
        "label": "Adyen Brazil degradation",
    },
    "issuer_mx": {
        "filters": {
            "merchant_id": "rappido",
            "country": "MX",
            "issuer_bank": "banorte",
        },
        "magnitude": 0.32,
        "decline_code": "05",
        "label": "Banorte issuer degradation",
    },
    "weak_signal": {
        "filters": {
            "merchant_id": "streamplus",
            "payment_method": "cash_oxxo",
            "country": "MX",
        },
        "magnitude": 0.55,
        "decline_code": "51",
        "label": "Low-volume OXXO weak signal",
    },
}


def _utc_now() -> datetime:
    return datetime.now(timezone.utc)


def _utc(value: datetime | None) -> datetime:
    if value is None:
        return _utc_now()
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


@dataclass
class Incident:
    """Un multiplicador activo que el replayer puede consultar por atributo."""

    incident_id: str
    filters: dict[str, str]
    magnitude: float
    dominant_decline_code: str
    started_at: datetime
    duration_s: int | None = None
    label: str = ""
    stopped_at: datetime | None = None
    mitigated_at: datetime | None = None

    def is_active(self, now: datetime | None = None) -> bool:
        current = _utc(now)
        if self.stopped_at is not None:
            return False
        if self.duration_s is not None and current >= self.started_at + timedelta(
            seconds=self.duration_s
        ):
            return False
        if self.mitigated_at is not None and current >= self.mitigated_at + timedelta(
            seconds=ACTION_RAMP_SECONDS
        ):
            return False
        return True

    @property
    def active(self) -> bool:
        return self.is_active()

    def multiplier_at(self, now: datetime | None = None) -> float:
        current = _utc(now)
        if not self.is_active(current):
            return 1.0
        if self.mitigated_at is None:
            return self.magnitude
        elapsed = max(0.0, (current - self.mitigated_at).total_seconds())
        progress = min(1.0, elapsed / ACTION_RAMP_SECONDS)
        return self.magnitude + (1.0 - self.magnitude) * progress

    @property
    def approval_multiplier(self) -> float:
        return self.multiplier_at()

    def status(self, now: datetime | None = None) -> str:
        current = _utc(now)
        if self.stopped_at is not None:
            return "stopped"
        if self.duration_s is not None and current >= self.started_at + timedelta(
            seconds=self.duration_s
        ):
            return "expired"
        if self.mitigated_at is not None:
            if current >= self.mitigated_at + timedelta(seconds=ACTION_RAMP_SECONDS):
                return "mitigated"
            return "mitigating"
        return "active"

    def to_dict(self, now: datetime | None = None) -> dict[str, Any]:
        current = _utc(now)
        return {
            "incident_id": self.incident_id,
            "filters": dict(self.filters),
            "magnitude": self.magnitude,
            "current_multiplier": round(self.multiplier_at(current), 6),
            "decline_code": self.dominant_decline_code,
            "label": self.label,
            "started_at": self.started_at.isoformat(),
            "duration_s": self.duration_s,
            "status": self.status(current),
            "active": self.is_active(current),
            "stopped_at": self.stopped_at.isoformat() if self.stopped_at else None,
            "mitigated_at": self.mitigated_at.isoformat() if self.mitigated_at else None,
            "simulation_only": True,
        }


_lock = threading.RLock()
_incidents: dict[str, Incident] = {}
_next_incident_number = 0


def _valid_values() -> dict[str, set[str]]:
    return {
        "merchant_id": set(MERCHANTS),
        "provider_id": set(PROVIDERS),
        "payment_method": {
            payment_method
            for methods in METHODS_BY_COUNTRY.values()
            for payment_method in methods
        },
        "country": set(COUNTRIES),
        "issuer_bank": {
            issuer_bank
            for issuers in ISSUERS_BY_COUNTRY.values()
            for issuer_bank in issuers
        },
    }


def validate_filters(filters: Mapping[str, Any] | None) -> dict[str, str]:
    """Normaliza un subconjunto válido de las cinco dimensiones inyectables."""
    if filters is None:
        return {}
    if not isinstance(filters, Mapping):
        raise ValueError("filters debe ser un objeto")

    unknown = set(filters) - FILTER_FIELDS
    if unknown:
        raise ValueError(f"Filtros no soportados: {', '.join(sorted(unknown))}")

    valid_values = _valid_values()
    selected = {
        str(name): str(value)
        for name, value in filters.items()
        if value is not None and str(value) != ""
    }
    for name, value in selected.items():
        if value not in valid_values[name]:
            raise ValueError(f"Valor inválido para {name}: {value}")

    country = selected.get("country")
    if country and "payment_method" in selected:
        if selected["payment_method"] not in METHODS_BY_COUNTRY[country]:
            raise ValueError("payment_method no es válido para el país seleccionado")
    if country and "issuer_bank" in selected:
        if selected["issuer_bank"] not in ISSUERS_BY_COUNTRY[country]:
            raise ValueError("issuer_bank no es válido para el país seleccionado")
    return selected


def _validate_magnitude(value: Any) -> float:
    try:
        magnitude = float(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("magnitude debe ser un multiplicador numérico") from exc
    if not MAGNITUDE_MIN <= magnitude <= MAGNITUDE_MAX:
        raise ValueError(
            f"magnitude debe estar entre {MAGNITUDE_MIN} y {MAGNITUDE_MAX}"
        )
    return round(magnitude, 4)


def _validate_duration(value: Any) -> int | None:
    if value is None:
        return None
    try:
        duration_s = int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("duration_s debe ser un entero positivo") from exc
    if duration_s <= 0:
        raise ValueError("duration_s debe ser un entero positivo")
    return duration_s


def inject(
    filters: Mapping[str, Any] | None,
    magnitude: float,
    decline_code: str,
    duration_s: int | None = None,
    label: str = "",
) -> Incident:
    """Crea un incidente que degrada p(approve) sólo en el slice indicado."""
    selected = validate_filters(filters)
    multiplier = _validate_magnitude(magnitude)
    code = str(decline_code)
    if code not in DECLINE_CODES:
        raise ValueError(f"decline_code no soportado: {code}")
    duration = _validate_duration(duration_s)

    global _next_incident_number
    with _lock:
        _next_incident_number += 1
        incident = Incident(
            incident_id=f"INJ-{_next_incident_number:04d}",
            filters=selected,
            magnitude=multiplier,
            dominant_decline_code=code,
            started_at=_utc_now(),
            duration_s=duration,
            label=str(label).strip(),
        )
        _incidents[incident.incident_id] = incident
        return incident


def get(incident_id: str) -> Incident | None:
    with _lock:
        return _incidents.get(str(incident_id))


def stop(incident_id: str) -> None:
    with _lock:
        incident = _incidents.get(str(incident_id))
        if incident is None:
            raise ValueError(f"Incidente desconocido: {incident_id}")
        if incident.stopped_at is None:
            incident.stopped_at = _utc_now()


def apply_action(incident_id: str) -> None:
    """Simula una mitigación sin tocar ningún proveedor real."""
    with _lock:
        incident = _incidents.get(str(incident_id))
        if incident is None:
            raise ValueError(f"Incidente desconocido: {incident_id}")
        if not incident.is_active():
            raise ValueError(f"El incidente no está activo: {incident_id}")
        if incident.mitigated_at is None:
            incident.mitigated_at = _utc_now()


def active() -> list[Incident]:
    with _lock:
        return [incident for incident in _incidents.values() if incident.is_active()]


def stop_all() -> None:
    with _lock:
        now = _utc_now()
        for incident in _incidents.values():
            if incident.stopped_at is None:
                incident.stopped_at = now


def preset(preset_id: str) -> Incident:
    entry = PRESETS.get(str(preset_id))
    if entry is None:
        raise ValueError(f"Preset desconocido: {preset_id}")
    return inject(**entry)


def options() -> dict[str, Any]:
    """Contrato para dropdowns: sólo valores y combinaciones permitidas."""
    return {
        "filter_fields": sorted(FILTER_FIELDS),
        "merchants": MERCHANTS,
        "providers": PROVIDERS,
        "countries": COUNTRIES,
        "methods_by_country": METHODS_BY_COUNTRY,
        "issuers_by_country": ISSUERS_BY_COUNTRY,
        "decline_codes": [
            {"code": code, **details} for code, details in DECLINE_CODES.items()
        ],
        "magnitude": {
            "min": MAGNITUDE_MIN,
            "max": MAGNITUDE_MAX,
            "step": MAGNITUDE_STEP,
            "meaning": "approval probability multiplier",
        },
        "presets": {
            preset_id: dict(value) for preset_id, value in PRESETS.items()
        },
        "simulation_only": True,
    }
