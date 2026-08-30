"""Shared, framework-free contracts between the engine and explanation layer."""

from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field


class Slice(BaseModel):
    merchant_id: str | None = None
    provider_id: str | None = None
    payment_method: str | None = None
    country: str | None = None


class DeclineShift(BaseModel):
    code: str
    label: str
    kind: str
    count_before: int = 0
    count_after: int = 0
    share_before: float = 0.0
    share_after: float = 0.0


class IssuerEvidence(BaseModel):
    issuer_bank: str
    attempts: int
    approval_rate: float
    delta_points: float


class LostApprovals(BaseModel):
    value: float = 0.0
    window_seconds: int = 60


class IncidentEvidence(BaseModel):
    incident_id: str
    detected_at: datetime
    estimated_start: datetime
    slice: Slice
    diagnosis_category: str
    diagnosis_status: str
    confidence_score: float = Field(ge=0, le=1)
    confidence_level: str
    baseline_rate: float = Field(ge=0, le=1)
    observed_rate: float = Field(ge=0, le=1)
    sample_size: int = Field(ge=0)
    wilson_ci: tuple[float, float]
    estimated_lost_approvals: LostApprovals
    decline_shift: list[DeclineShift] = Field(default_factory=list)
    issuer_evidence: list[IssuerEvidence] = Field(default_factory=list)
    reason_codes: list[str] = Field(default_factory=list)
    alternatives: list[dict[str, Any]] = Field(default_factory=list)


class EngineOutput(BaseModel):
    incidents: list[IncidentEvidence] = Field(default_factory=list)


class CostEstimate(BaseModel):
    usd_per_hour: float
    lost_approvals_window: float
    window_seconds: int
    avg_ticket_usd: float
    assumptions: list[str] = Field(default_factory=list)


class ParamChange(BaseModel):
    name: str
    current: str | int | float | bool | None = None
    proposed: str | int | float | bool | None = None


class RecommendedAction(BaseModel):
    action_id: str
    title: str
    owner: str
    rationale: str
    params_to_change: list[ParamChange] = Field(default_factory=list)
    expected_impact: str
    reevaluate_after: str
    simulation_only: bool = True


class Diagnosis(BaseModel):
    incident_id: str
    detected_at: datetime
    estimated_start: datetime
    slice: Slice
    diagnosis_category: str
    diagnosis_status: str
    confidence_level: str
    headline: str
    executive: str
    operations: str
    evidence: list[str] = Field(default_factory=list)
    alternatives: list[str] = Field(default_factory=list)
    missing_data: list[str] = Field(default_factory=list)
    cost: CostEstimate | None = None
    recommended_action: RecommendedAction | None = None
    llm_used: bool = False


class ScoredIncident(BaseModel):
    diagnosis: Diagnosis
    score: float
    components: dict[str, float]
