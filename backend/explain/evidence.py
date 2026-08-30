"""Human-readable evidence derived only from the engine's structured output."""

from __future__ import annotations

from backend.contracts import IncidentEvidence


def _percent(value: float) -> str:
    return f"{value * 100:.0f}%"


def build_evidence(incident: IncidentEvidence) -> list[str]:
    bullets = [
        f"Approval rate fell from {_percent(incident.baseline_rate)} to {_percent(incident.observed_rate)} in the affected slice (n={incident.sample_size}).",
        f"The 95% Wilson interval for the observed rate is {_percent(incident.wilson_ci[0])}–{_percent(incident.wilson_ci[1])}.",
    ]
    for shift in incident.decline_shift:
        bullets.append(
            f"Code {shift.code} ({shift.label}) rose from {_percent(shift.share_before)} to {_percent(shift.share_after)} of declines in the affected slice."
        )
    for issuer in incident.issuer_evidence:
        bullets.append(
            f"{issuer.issuer_bank} approved {_percent(issuer.approval_rate)} of {issuer.attempts} attempts, {issuer.delta_points:+.0f} points versus baseline."
        )
    for reason in incident.reason_codes:
        bullets.append(f"Signal: {reason.replace('_', ' ').lower()}.")
    return bullets


def build_alternatives(incident: IncidentEvidence) -> list[str]:
    if not incident.alternatives:
        return ["No competing explanation scored strongly enough to list."]
    return [
        f"{item.get('category', 'Unknown alternative').replace('_', ' ')} (score {float(item.get('score', 0)):.2f})."
        for item in incident.alternatives
    ]


def build_missing_data(incident: IncidentEvidence) -> list[str]:
    missing: list[str] = []
    if incident.diagnosis_status != "supported":
        missing.append("More observations are needed before assigning an actionable cause.")
    if incident.sample_size < 30:
        missing.append("The sample is below 30 attempts; monitor the next window.")
    if not incident.decline_shift:
        missing.append("No decline-code shift was available for this slice.")
    if incident.diagnosis_category.startswith("issuer") and not incident.issuer_evidence:
        missing.append("Issuer-level evidence is unavailable.")
    return missing
