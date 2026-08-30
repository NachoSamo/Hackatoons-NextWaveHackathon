"""Rutas FastAPI de la capa de datos y del inyector de demo."""

from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, Body, Request
from fastapi.responses import JSONResponse

from backend.data.cube import get_cube, get_evidence, money_lost
from backend.data.injector import (
    FILTER_FIELDS,
    active,
    apply_action,
    get,
    inject,
    options,
    preset,
    stop,
    stop_all,
    validate_filters,
)
from backend.db import delete_live_transactions


router = APIRouter(prefix="/api")


def _error(message: str, status_code: int = 400) -> JSONResponse:
    return JSONResponse(status_code=status_code, content={"error": message})


def _window_seconds(value: Any) -> int:
    try:
        seconds = int(value)
    except (TypeError, ValueError) as exc:
        raise ValueError("window_s debe ser un entero positivo") from exc
    if seconds <= 0:
        raise ValueError("window_s debe ser un entero positivo")
    return seconds


def _query_filters(request: Request) -> dict[str, str]:
    raw = {
        key: value
        for key, value in request.query_params.items()
        if key in FILTER_FIELDS
    }
    return validate_filters(raw)


@router.get("/overview")
def overview(request: Request, window_s: int = 60) -> Any:
    try:
        seconds = _window_seconds(window_s)
        replayer = getattr(request.app.state, "replayer", None)
        snapshot = replayer.stream_snapshot() if replayer is not None else None
        leaves = get_cube(seconds)
        attempts = sum(int(leaf["attempts"]) for leaf in leaves)
        approved = sum(int(leaf["approved"]) for leaf in leaves)
        fc_attempts = sum(float(leaf["fc_attempts"]) for leaf in leaves)
        fc_approved = sum(float(leaf["fc_approved"]) for leaf in leaves)
        return {
            "window_s": seconds,
            "stream": snapshot,
            "attempts": attempts,
            "approved": approved,
            "observed_rate": round(approved / attempts, 6) if attempts else 0.0,
            "expected_rate": round(fc_approved / fc_attempts, 6)
            if fc_attempts
            else 0.0,
            "active_incidents": [incident.to_dict() for incident in active()],
            "replay_error": getattr(request.app.state, "replay_error", None),
            "copy_error": getattr(replayer, "last_copy_error", None),
            "simulation_only": True,
        }
    except Exception as exc:
        return _error(f"Overview unavailable: {exc}", 503)


@router.get("/cube")
def cube(window_s: int = 60) -> Any:
    try:
        seconds = _window_seconds(window_s)
        return {"window_s": seconds, "leaves": get_cube(seconds)}
    except Exception as exc:
        return _error(f"Cube unavailable: {exc}", 503)


@router.get("/evidence")
def evidence(request: Request, window_s: int = 60) -> Any:
    try:
        seconds = _window_seconds(window_s)
        filters = _query_filters(request)
        return {"window_s": seconds, "filters": filters, **get_evidence(filters, seconds)}
    except Exception as exc:
        return _error(f"Evidence unavailable: {exc}", 503)


@router.get("/inject/options")
def inject_options() -> dict[str, Any]:
    return options()


@router.post("/inject")
def create_injection(payload: dict[str, Any] = Body(...)) -> Any:
    try:
        if payload.get("preset_id"):
            incident = preset(str(payload["preset_id"]))
        else:
            incident = inject(
                filters=payload.get("filters", {}),
                magnitude=payload.get("magnitude"),
                decline_code=payload.get("decline_code"),
                duration_s=payload.get("duration_s"),
                label=payload.get("label", ""),
            )
        return {"incident_id": incident.incident_id, "incident": incident.to_dict()}
    except Exception as exc:
        return _error(f"Injection rejected: {exc}")


@router.post("/inject/{incident_id}/stop")
def stop_injection(incident_id: str) -> Any:
    try:
        stop(incident_id)
        incident = get(incident_id)
        return {"incident_id": incident_id, "incident": incident.to_dict() if incident else None}
    except Exception as exc:
        return _error(f"Stop rejected: {exc}")


@router.get("/incidents/active")
def active_incidents() -> dict[str, Any]:
    return {"incidents": [incident.to_dict() for incident in active()]}


@router.post("/actions/apply")
def apply_simulated_action(
    payload: dict[str, Any] = Body(...),
) -> Any:
    try:
        incident_id = str(payload.get("incident_id", ""))
        if not incident_id:
            raise ValueError("incident_id es requerido")
        apply_action(incident_id)
        incident = get(incident_id)
        return {
            "incident_id": incident_id,
            "incident": incident.to_dict() if incident else None,
            "simulation_only": True,
            "message": "Mitigation ramp started; no provider was changed.",
        }
    except Exception as exc:
        return _error(f"Action rejected: {exc}")


@router.post("/demo/reset")
async def demo_reset(request: Request) -> Any:
    replayer = getattr(request.app.state, "replayer", None)
    if replayer is None:
        stop_all()
        return _error("Replay unavailable; incidents were stopped.", 503)

    try:
        async with replayer.reset_window():
            stop_all()
            try:
                deleted = await asyncio.to_thread(delete_live_transactions)
                persistence_error = None
            except Exception as exc:
                deleted = None
                persistence_error = str(exc)
        return {
            "reset": True,
            "deleted_live_transactions": deleted,
            "persistence_error": persistence_error,
            "active_incidents": [],
            "simulation_only": True,
        }
    except Exception as exc:
        return _error(f"Reset unavailable: {exc}", 503)
