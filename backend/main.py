"""Small API façade for the explanation layer and the data routes owned elsewhere."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

from fastapi import Body, FastAPI

from backend.contracts import EngineOutput
from backend.explain.build import diagnose
from backend.explain.prioritize import score_incidents


app = FastAPI(title="Centinel Control Tower")
FIXTURES = Path(__file__).with_name("fixtures")
DIAGNOSES: dict[str, Any] = {}


def _validate(payload: dict[str, Any]) -> EngineOutput:
    fixture = payload.get("fixture")
    if fixture:
        name = str(fixture).removesuffix(".json")
        if not name.startswith("engine_output_"):
            name = f"engine_output_{name}"
        if "/" in name or "\\" in name or ".." in name:
            raise ValueError("Unknown fixture")
        path = FIXTURES / f"{name}.json"
        if not path.exists():
            raise ValueError(f"Unknown fixture: {fixture}")
        payload = json.loads(path.read_text(encoding="utf-8"))
    return EngineOutput.model_validate(payload)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}


@app.post("/api/agent/explain")
def explain(payload: dict[str, Any] = Body(...)) -> dict[str, Any]:
    try:
        diagnoses = diagnose(_validate(payload))
        DIAGNOSES.update({item.incident_id: item for item in diagnoses})
        return {"diagnoses": [item.model_dump(mode="json") for item in diagnoses], "prioritized": [item.model_dump(mode="json") for item in score_incidents(diagnoses)]}
    except Exception as exc:
        return {"diagnoses": [], "prioritized": [], "error": f"Explanation unavailable: {exc}"}


@app.get("/api/incidents/{incident_id}/diagnosis")
def incident_diagnosis(incident_id: str) -> dict[str, Any]:
    try:
        diagnosis = DIAGNOSES.get(incident_id)
        if diagnosis is None:
            return {"diagnosis": None, "error": "Diagnosis not found. Call /api/agent/explain first."}
        return {"diagnosis": diagnosis.model_dump(mode="json")}
    except Exception as exc:
        return {"diagnosis": None, "error": f"Diagnosis unavailable: {exc}"}
