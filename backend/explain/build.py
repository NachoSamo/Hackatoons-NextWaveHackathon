"""Assemble deterministic diagnoses and optionally improve their wording with the LLM."""

from __future__ import annotations

from functools import lru_cache
from pathlib import Path
from typing import Any

import yaml
from jinja2 import Environment, FileSystemLoader

from backend.contracts import Diagnosis, EngineOutput, IncidentEvidence, ParamChange, RecommendedAction
from backend.explain.agent import write_explanation
from backend.explain.evidence import build_alternatives, build_evidence, build_missing_data
from backend.explain.money import cost_for
from backend.explain.prioritize import score_incidents


ROOT = Path(__file__).parent
TEMPLATES = Environment(loader=FileSystemLoader(ROOT / "templates"), autoescape=False, trim_blocks=True, lstrip_blocks=True)


@lru_cache(maxsize=1)
def _catalog() -> dict[str, dict[str, Any]]:
    return yaml.safe_load((ROOT / "catalog.yaml").read_text(encoding="utf-8"))["actions"]


def _format(value: Any, context: dict[str, Any]) -> Any:
    if isinstance(value, str):
        return value.format_map(context)
    if isinstance(value, list):
        return [_format(item, context) for item in value]
    if isinstance(value, dict):
        return {key: _format(item, context) for key, item in value.items()}
    return value


def _action(incident: IncidentEvidence) -> RecommendedAction:
    key = "monitor" if incident.diagnosis_status != "supported" else incident.diagnosis_category
    entry = _catalog().get(key, _catalog()["monitor"])
    context = {key: value or "the affected slice" for key, value in incident.slice.model_dump().items()}
    context["issuer_bank"] = incident.issuer_evidence[0].issuer_bank if incident.issuer_evidence else "the affected issuer"
    rendered = _format(entry, context)
    params = [ParamChange(**item) for item in rendered.get("param_template", [])]
    return RecommendedAction(
        action_id=rendered["action_id"], title=rendered["title"], owner=rendered["owner"],
        rationale=rendered["guidance"], params_to_change=params, expected_impact=rendered["expected_impact"],
        reevaluate_after=rendered["reevaluate_after"], simulation_only=True,
    )


def _fallback(incident: IncidentEvidence, action: RecommendedAction, evidence: list[str], cost: Any) -> dict[str, str]:
    template_key = "monitor" if incident.diagnosis_status != "supported" else incident.diagnosis_category
    if not (ROOT / "templates" / f"{template_key}.exec.j2").exists():
        template_key = "monitor"
    context = {"incident": incident, "action": action, "evidence": evidence, "cost": cost}
    where = " / ".join(p for p in (incident.slice.provider_id, incident.slice.country) if p) or "the affected slice"
    label = incident.diagnosis_category.replace("_", " ").title()
    headline = f"{label} in {where} — about ${cost.usd_per_hour:,.0f}/hr at risk" if cost else f"{label} in {where} — evidence still insufficient"
    return {"headline": headline, "executive": TEMPLATES.get_template(f"{template_key}.exec.j2").render(**context).strip(), "operations": TEMPLATES.get_template(f"{template_key}.ops.j2").render(**context).strip()}


def diagnose(engine_output: EngineOutput) -> list[Diagnosis]:
    diagnoses: list[Diagnosis] = []
    for incident in engine_output.incidents:
        action = _action(incident)
        evidence, alternatives, missing = build_evidence(incident), build_alternatives(incident), build_missing_data(incident)
        cost = None if incident.diagnosis_status != "supported" else cost_for(incident.slice, incident.estimated_lost_approvals.window_seconds, incident.estimated_lost_approvals.value)
        fallback = _fallback(incident, action, evidence, cost)
        llm = write_explanation({"incident": incident.model_dump(mode="json"), "action": action.model_dump(), "evidence": evidence, "cost": cost.model_dump() if cost else None, "missing_data": missing})
        if llm:
            action.rationale = llm.action_rationale
        diagnoses.append(Diagnosis(
            incident_id=incident.incident_id, detected_at=incident.detected_at, estimated_start=incident.estimated_start,
            slice=incident.slice, diagnosis_category=incident.diagnosis_category, diagnosis_status=incident.diagnosis_status,
            confidence_level=incident.confidence_level, headline=fallback["headline"],
            executive=llm.executive if llm else fallback["executive"], operations=llm.operations if llm else fallback["operations"],
            evidence=evidence, alternatives=alternatives, missing_data=missing, cost=cost, recommended_action=action, llm_used=llm is not None,
        ))
    return [item.diagnosis for item in score_incidents(diagnoses)]
