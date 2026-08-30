"""Shared contracts for Centinel's deterministic diagnosis core."""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Any, Iterable, Mapping


DIMENSIONS = ("merchant_id", "provider_id", "payment_method", "country")


class DiagnosisCategory(str, Enum):
    PROVIDER_DEGRADATION = "provider_degradation"
    ISSUER_UNAVAILABLE = "issuer_unavailable"
    ISSUER_OVER_DECLINING = "issuer_over_declining"
    PAYMENT_METHOD_OUTAGE = "payment_method_outage"
    MERCHANT_INTEGRATION_ERROR = "merchant_integration_error"
    MERCHANT_CONFIGURATION = "merchant_configuration"
    INSUFFICIENT_EVIDENCE = "insufficient_evidence"
    UNCLASSIFIED = "unclassified"


class DiagnosisStatus(str, Enum):
    SUPPORTED = "supported"
    INSUFFICIENT_EVIDENCE = "insufficient_evidence"
    UNCLASSIFIED = "unclassified"


class ConfidenceLevel(str, Enum):
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"


class IncidentStatus(str, Enum):
    VALIDATING = "validating"
    DIAGNOSING = "diagnosing"
    DETECTED = "detected"
    INSUFFICIENT_EVIDENCE = "insufficient_evidence"
    RESOLVED = "resolved"


@dataclass(frozen=True, slots=True)
class PaymentEvent:
    created_at: datetime
    merchant_id: str
    provider_id: str
    payment_method: str
    country: str
    issuer_bank: str
    approved: bool
    decline_code: str | None = None
    amount_usd: float = 0.0
    event_id: str | None = None

    @classmethod
    def from_mapping(cls, source: Mapping[str, Any]) -> "PaymentEvent":
        created_at = source.get("created_at", source.get("timestamp"))
        if not isinstance(created_at, datetime):
            raise ValueError("PaymentEvent.created_at must be a datetime")
        decline_code = source.get("decline_code")
        if decline_code is not None and decline_code != decline_code:
            decline_code = None
        return cls(
            event_id=(str(source["event_id"]) if source.get("event_id") else None),
            created_at=created_at,
            merchant_id=str(source["merchant_id"]),
            provider_id=str(source["provider_id"]),
            payment_method=str(source["payment_method"]),
            country=str(source["country"]),
            issuer_bank=str(source.get("issuer_bank", "unknown")),
            amount_usd=float(source.get("amount_usd", source.get("amount", 0.0))),
            approved=bool(source["approved"]),
            decline_code=str(decline_code) if decline_code is not None else None,
        )


@dataclass(frozen=True, slots=True)
class SliceKey:
    merchant_id: str | None = None
    provider_id: str | None = None
    payment_method: str | None = None
    country: str | None = None

    @property
    def dimension_count(self) -> int:
        return sum(getattr(self, dimension) is not None for dimension in DIMENSIONS)

    def to_filters(self) -> dict[str, str]:
        return {
            dimension: value
            for dimension in DIMENSIONS
            if (value := getattr(self, dimension)) is not None
        }

    def to_dict(self) -> dict[str, str | None]:
        return {dimension: getattr(self, dimension) for dimension in DIMENSIONS}

    def matches(self, leaf: "Leaf") -> bool:
        return all(
            getattr(self, dimension) in (None, getattr(leaf, dimension))
            for dimension in DIMENSIONS
        )

    @classmethod
    def from_dimensions(
        cls, leaf: "Leaf", dimensions: Iterable[str]
    ) -> "SliceKey":
        selected = set(dimensions)
        return cls(
            **{
                dimension: getattr(leaf, dimension) if dimension in selected else None
                for dimension in DIMENSIONS
            }
        )


@dataclass(frozen=True, slots=True)
class Leaf:
    merchant_id: str
    provider_id: str
    payment_method: str
    country: str
    attempts: int
    approved: int
    fc_attempts: float
    fc_approved: float
    amount_usd_sum: float = 0.0

    def __post_init__(self) -> None:
        if self.attempts < 0 or self.approved < 0 or self.approved > self.attempts:
            raise ValueError("invalid observed attempts/approved values")
        if (
            self.fc_attempts < 0
            or self.fc_approved < 0
            or self.fc_approved > self.fc_attempts
        ):
            raise ValueError("invalid forecast attempts/approved values")

    @property
    def key(self) -> tuple[str, str, str, str]:
        return (
            self.merchant_id,
            self.provider_id,
            self.payment_method,
            self.country,
        )

    @property
    def expected_rate(self) -> float:
        return self.fc_approved / self.fc_attempts if self.fc_attempts else 0.0

    @property
    def observed_rate(self) -> float:
        return self.approved / self.attempts if self.attempts else 0.0

    @property
    def expected_approved_at_observed_volume(self) -> float:
        return self.attempts * self.expected_rate

    @classmethod
    def from_mapping(cls, source: Mapping[str, Any]) -> "Leaf":
        return cls(
            merchant_id=str(source["merchant_id"]),
            provider_id=str(source["provider_id"]),
            payment_method=str(source["payment_method"]),
            country=str(source["country"]),
            attempts=int(source["attempts"]),
            approved=int(source["approved"]),
            fc_attempts=float(source["fc_attempts"]),
            fc_approved=float(source["fc_approved"]),
            amount_usd_sum=float(source.get("amount_usd_sum", 0.0)),
        )


@dataclass(frozen=True, slots=True)
class LocalizedCandidate:
    slice: SliceKey
    member_keys: frozenset[tuple[str, str, str, str]]
    score: float
    ripple_fit: float
    coverage: float
    confidence_score: float
    attempts: int
    approved: int
    expected_approvals: float
    estimated_lost_approvals: float
    baseline_rate: float
    observed_rate: float
    wilson_ci: tuple[float, float]
    reason_codes: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class Diagnosis:
    category: DiagnosisCategory
    status: DiagnosisStatus
    confidence_score: float
    confidence_level: ConfidenceLevel
    reason_codes: tuple[str, ...]
    alternatives: tuple[tuple[DiagnosisCategory, float], ...] = ()


@dataclass(frozen=True, slots=True)
class IncidentOutput:
    incident_id: str
    incident_status: IncidentStatus
    detected_at: datetime
    estimated_start: datetime
    window_start: datetime
    window_end: datetime
    window_seconds: int
    candidate: LocalizedCandidate
    diagnosis: Diagnosis
    decline_shift: tuple[Mapping[str, Any], ...] = ()
    issuer_evidence: tuple[Mapping[str, Any], ...] = ()
    priority_score: float = 0.0

    def to_dict(self) -> dict[str, Any]:
        return {
            "incident_id": self.incident_id,
            "incident_status": self.incident_status.value,
            "detected_at": self.detected_at.isoformat(),
            "estimated_start": self.estimated_start.isoformat(),
            "window": {
                "start": self.window_start.isoformat(),
                "end": self.window_end.isoformat(),
                "seconds": self.window_seconds,
            },
            "slice": self.candidate.slice.to_dict(),
            "diagnosis_category": self.diagnosis.category.value,
            "diagnosis_status": self.diagnosis.status.value,
            "confidence_score": round(self.diagnosis.confidence_score, 4),
            "confidence_level": self.diagnosis.confidence_level.value,
            "priority_score": round(self.priority_score, 4),
            "baseline_rate": round(self.candidate.baseline_rate, 4),
            "observed_rate": round(self.candidate.observed_rate, 4),
            "sample_size": self.candidate.attempts,
            "wilson_ci": [round(value, 4) for value in self.candidate.wilson_ci],
            "estimated_lost_approvals": {
                "value": round(self.candidate.estimated_lost_approvals, 2),
                "window_seconds": self.window_seconds,
            },
            "decline_shift": [dict(item) for item in self.decline_shift],
            "issuer_evidence": [dict(item) for item in self.issuer_evidence],
            "reason_codes": list(
                dict.fromkeys(
                    (*self.candidate.reason_codes, *self.diagnosis.reason_codes)
                )
            ),
            "alternatives": [
                {
                    "category": category.value,
                    "score": round(score, 4),
                }
                for category, score in self.diagnosis.alternatives
            ],
        }


@dataclass(frozen=True, slots=True)
class EngineOutput:
    incidents: tuple[IncidentOutput, ...] = ()
    errors: tuple[str, ...] = ()

    def to_dict(self) -> dict[str, Any]:
        return {
            "incidents": [incident.to_dict() for incident in self.incidents],
            "errors": list(self.errors),
        }


@dataclass(frozen=True, slots=True)
class EngineConfig:
    window_seconds: int = 60
    minimum_detectable_drop: float = 0.08
    decision_threshold: float = 8.0
    minimum_attempts: int = 30
    minimum_lost_approvals: float = 3.0
    minimum_localization_score: float = 0.50
    validation_windows: int = 2
    diagnosing_windows: int = 1
    recovery_windows: int = 2
    maximum_incidents: int = 3
    incident_match_jaccard: float = 0.70
    weak_signal_drop: float = 0.15
    weak_signal_validation_windows: int = 4
    maximum_wilson_width: float = 0.25

    def __post_init__(self) -> None:
        if self.window_seconds <= 0:
            raise ValueError("window_seconds must be positive")
        if not 0.0 < self.minimum_detectable_drop < 1.0:
            raise ValueError("minimum_detectable_drop must be between 0 and 1")
        if self.decision_threshold <= 0 or self.minimum_attempts <= 0:
            raise ValueError("thresholds and sample sizes must be positive")
        if self.maximum_incidents < 1:
            raise ValueError("maximum_incidents must be positive")
        if self.weak_signal_validation_windows < self.validation_windows:
            raise ValueError("weak signals cannot validate faster than strong signals")


@dataclass(slots=True)
class IncidentTrack:
    incident_id: str
    candidate: LocalizedCandidate
    first_seen: datetime
    detected_at: datetime
    consecutive_windows: int = 1
    recovery_windows: int = 0
    status: IncidentStatus = IncidentStatus.VALIDATING
    last_evidence: Mapping[str, Any] = field(default_factory=dict)
    has_been_emitted: bool = False
