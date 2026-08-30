"""Loop de diagnóstico vivo: motor real sobre el cubo del replayer + explain.

Cada ~5 s toma el cubo de 60 s que sirve el ring buffer de Pena, lo pasa por
``CentinelEngine`` (detector → localizador → clasificador), lo convierte al
contrato de explain y redacta el diagnóstico. Guarda el último snapshot en memoria
(`GET /api/diagnosis`) y narra la cadena completa en español por la consola.

Se monta en el ``lifespan`` de ``backend/main.py`` al lado del supervisor del replay.
"""

from __future__ import annotations

import asyncio
import threading
from datetime import datetime, timezone
from typing import Any

from backend.contracts import EngineOutput as ContractEngineOutput
from backend.core import CentinelEngine
from backend.data.cube import get_cube, get_evidence
from backend.data.injector import active as active_injections
from backend.explain.build import diagnose
from backend.explain.prioritize import score_incidents
from backend.logging_setup import log
from backend import notify_slack

DIAGNOSIS_INTERVAL_S = 5.0
WINDOW_SECONDS = 60
_EMITTED = ("detected", "insufficient_evidence")

_engine = CentinelEngine()
_lock = threading.Lock()
_window = 0
_state: dict[str, Any] = {
    "window": 0,
    "ts": None,
    "engine_incidents": [],
    "diagnoses": [],
    "prioritized": [],
    "active_injections": [],
    "slack_alerts": [],
    "error": None,
}


def reset() -> None:
    """Motor nuevo + contador a cero. Lo llama `POST /api/demo/reset`."""
    global _window
    with _lock:
        _engine.reset()
        _window = 0
        _state.update(
            window=0, ts=None, engine_incidents=[], diagnoses=[],
            prioritized=[], active_injections=[], slack_alerts=[], error=None,
        )
    notify_slack.reset()  # los incident_id vuelven a INC-0001; sin esto quedarían "ya notificados"
    log.info("[LOOP]     reset — motor de diagnóstico nuevo")


def snapshot() -> dict[str, Any]:
    with _lock:
        return dict(_state)


def _evidence(filters: dict[str, str], seconds: int) -> dict[str, Any]:
    try:
        return get_evidence(dict(filters), seconds)
    except Exception as exc:  # noqa: BLE001
        log.warning("[MOTOR]    evidencia no disponible para %s: %s", filters, exc)
        return {}


def _slice_str(slice_obj: Any) -> str:
    data = slice_obj.to_dict() if hasattr(slice_obj, "to_dict") else dict(slice_obj)
    return "/".join(f"{k}={v}" for k, v in data.items() if v) or "*"


def _tick() -> None:
    global _window
    _window += 1
    now = datetime.now(timezone.utc)
    injections = active_injections()

    log.info("")
    log.info("═══ VENTANA %d  (%s, %d s)  ═══", _window, now.strftime("%H:%M:%S"), WINDOW_SECONDS)

    leaves = get_cube(WINDOW_SECONDS)
    total = sum(int(leaf["attempts"]) for leaf in leaves)
    approved = sum(int(leaf["approved"]) for leaf in leaves)
    rate = (100 * approved / total) if total else 0.0
    log.info(
        "[GENERADOR] cubo vivo: 81 celdas del ring buffer (%d intentos en 60 s, approval global %.1f%%)",
        total, rate,
    )

    for inj in injections:
        data = inj.to_dict(now)
        filters = "/".join(f"{k}={v}" for k, v in data.get("filters", {}).items()) or "todo-el-mundo"
        log.info(
            "[INYECTOR] activo: %s  x%.2f  código=%s  estado=%s",
            filters, data.get("approval_multiplier", data.get("magnitude", 1.0)),
            data.get("dominant_decline_code", "—"), data.get("status", "active"),
        )

    log.info(
        "[MOTOR]    process_cube(81 celdas): detector CUSUM → localizador (ripple) → clasificador determinístico"
    )
    core_out = _engine.process_cube(leaves, now, evidence_loader=_evidence)
    for err in core_out.errors:
        log.warning("[MOTOR]    aviso: %s", err)

    log.info("[MOTOR]    resultado: %d incidente(s) en seguimiento", len(core_out.incidents))
    for inc in core_out.incidents:
        cand, dx = inc.candidate, inc.diagnosis
        log.info("[MOTOR]     · %s  slice=%s", inc.incident_id, _slice_str(cand.slice))
        log.info(
            "[MOTOR]       localizador: score %.2f (ripple_fit %.2f, coverage %.2f) · "
            "baseline %.1f%% → observado %.1f%% · %d intentos · déficit ~%.0f aprob.",
            cand.score, cand.ripple_fit, cand.coverage,
            100 * cand.baseline_rate, 100 * cand.observed_rate,
            cand.attempts, cand.estimated_lost_approvals,
        )
        alts = ", ".join(f"{c.value} ({s:.2f})" for c, s in dx.alternatives) or "ninguna"
        log.info(
            "[MOTOR]       clasificador: %s (confianza %.2f) · señales: %s",
            dx.category.value, dx.confidence_score, ", ".join(dx.reason_codes) or "—",
        )
        log.info("[MOTOR]       estado: %s · alternativas: %s", inc.incident_status.value, alts)

    emitted = [
        item for item in core_out.to_dict()["incidents"]
        if item["incident_status"] in _EMITTED
    ]
    log.info(
        "[BRIDGE]   core.EngineOutput → contracts.EngineOutput: %d de %d en estado emitible; el resto valida",
        len(emitted), len(core_out.incidents),
    )
    contract = ContractEngineOutput.model_validate({"incidents": emitted})

    diagnoses = diagnose(contract)  # emite las líneas [EXPLAIN]
    for d in diagnoses:
        notify_slack.notify(d)  # no-op sin SLACK_WEBHOOK_URL; dedup por incident_id
    scored = score_incidents(diagnoses)

    with _lock:
        _state.update(
            window=_window,
            ts=now.isoformat(),
            engine_incidents=[
                {
                    "id": inc.incident_id,
                    "status": inc.incident_status.value,
                    "category": inc.diagnosis.category.value,
                    "slice": inc.candidate.slice.to_dict(),
                    "slice_label": _slice_str(inc.candidate.slice),
                    "baseline_rate": round(inc.candidate.baseline_rate, 4),
                    "observed_rate": round(inc.candidate.observed_rate, 4),
                    "delta_pp": round((inc.candidate.observed_rate - inc.candidate.baseline_rate) * 100, 1),
                    "sample_size": inc.candidate.attempts,
                    "estimated_lost_approvals": round(inc.candidate.estimated_lost_approvals, 1),
                    "dominant_code": (inc.decline_shift[0].get("code") if inc.decline_shift else None),
                    "detected_at": inc.detected_at.isoformat(),
                    "priority_score": round(inc.priority_score, 3),
                }
                for inc in core_out.incidents
            ],
            diagnoses=[d.model_dump(mode="json") for d in diagnoses],
            prioritized=[s.model_dump(mode="json") for s in scored],
            active_injections=[inj.to_dict(now) for inj in injections],
            slack_alerts=notify_slack.recent(),
            error=None,
        )


async def run(app: Any) -> None:
    """Loop de fondo. Espera a que el replayer esté vivo antes de la primera ventana."""
    log.info("[LOOP]     arrancando (intervalo %.0f s)", DIAGNOSIS_INTERVAL_S)
    while True:
        try:
            replayer = getattr(app.state, "replayer", None)
            if replayer is None or not getattr(replayer, "is_running", False):
                await asyncio.sleep(1.0)
                continue
            await asyncio.to_thread(_tick)
        except asyncio.CancelledError:
            raise
        except Exception as exc:  # noqa: BLE001
            log.warning("[LOOP]     la ventana falló: %s", exc)
            with _lock:
                _state["error"] = str(exc)
        await asyncio.sleep(DIAGNOSIS_INTERVAL_S)
