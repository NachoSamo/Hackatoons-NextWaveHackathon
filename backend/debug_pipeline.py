"""Pipeline end-to-end SOLO PARA DEBUG (panel /e2e).

NO es la capa de datos de Pena. Carga el cubo sano desde el parquet, aplica
inyecciones en memoria, corre el motor real (detector + localizador + clasificador),
lo pasa por el bridge al contrato de explain, y narra CADA paso de la cadena por
la consola en español. Lo reemplaza el stream + inyector reales de Pena (T4-T8).
"""

from __future__ import annotations

import time
from dataclasses import replace
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any

import pandas as pd

from backend.contracts import EngineOutput as ContractEngineOutput
from backend.core import CentinelEngine, Leaf
from backend.explain.build import diagnose
from backend.explain.prioritize import score_incidents
from backend.logging_setup import log

CUBE_PATH = Path(__file__).parent / "data" / "out" / "cube_sample.parquet"
_EMITTED = ("detected", "insufficient_evidence")

PRESETS: dict[str, dict[str, Any]] = {
    "pix_outage": {
        "filters": {"payment_method": "pix", "country": "BR"},
        "magnitude": 0.73, "decline_code": "96",
        "label": "Método PIX degradado en Brasil (approval ~70%)",
    },
    "provider_br": {
        "filters": {"provider_id": "adyen", "country": "BR"},
        "magnitude": 0.38, "decline_code": "91",
        "label": "Proveedor Adyen degradado en Brasil",
    },
    "issuer_mx": {
        "filters": {"merchant_id": "rappido", "country": "MX"},
        "magnitude": 0.72, "decline_code": "05",
        "label": "Banco emisor sobre-rechazando para Rappido en México",
    },
}


# --- helpers del mundo (copia autocontenida; la capa real de Pena los reemplaza) ---

def _healthy_cube() -> list[Leaf]:
    rows = pd.read_parquet(CUBE_PATH).to_dict("records")
    leaves: list[Leaf] = []
    for row in rows:
        expected = float(row["fc_approved"]) / float(row["fc_attempts"])
        row["approved"] = round(int(row["attempts"]) * expected)
        leaves.append(Leaf.from_mapping(row))
    return leaves


def _matches(leaf: Leaf, filters: dict[str, str]) -> bool:
    return all(getattr(leaf, key) == value for key, value in filters.items())


def _apply(leaves: list[Leaf], injections: list[dict[str, Any]]) -> list[Leaf]:
    out: list[Leaf] = []
    for leaf in leaves:
        multiplier = 1.0
        for inj in injections:
            if _matches(leaf, inj["filters"]):
                multiplier *= inj["magnitude"]
        out.append(replace(leaf, approved=round(leaf.attempts * leaf.expected_rate * multiplier)))
    return out


def _evidence(filters: dict[str, str], _seconds: int) -> dict[str, Any]:
    """Evidencia por slice para la demo. Fuera de estos slices devuelve {} y el
    clasificador cae a las reglas de forma-del-slice + hechos de control."""
    if filters.get("payment_method") == "pix" and filters.get("country") == "BR":
        return {
            "decline_codes": {"before": {"05": 10, "96": 4}, "after": {"05": 13, "96": 96}},
            "issuers": [
                {"issuer_bank": "itau", "attempts": 70, "approval_rate": 0.71, "delta_pts": -25},
                {"issuer_bank": "nubank", "attempts": 64, "approval_rate": 0.69, "delta_pts": -27},
                {"issuer_bank": "bradesco", "attempts": 55, "approval_rate": 0.70, "delta_pts": -26},
            ],
            "sample_size": 284, "wilson_ci": [0.65, 0.75],
        }
    if filters.get("provider_id") == "adyen" and filters.get("country") == "BR":
        return {
            "decline_codes": {"before": {"05": 12, "91": 4}, "after": {"05": 28, "91": 208}},
            "issuers": [
                {"issuer_bank": "itau", "attempts": 180, "approval_rate": 0.41, "delta_pts": -47},
                {"issuer_bank": "nubank", "attempts": 150, "approval_rate": 0.43, "delta_pts": -45},
                {"issuer_bank": "bradesco", "attempts": 100, "approval_rate": 0.46, "delta_pts": -42},
            ],
            "sample_size": 430, "wilson_ci": [0.44, 0.54],
        }
    if filters.get("merchant_id") == "rappido" and filters.get("country") == "MX":
        return {
            "decline_codes": {"before": {"05": 14, "51": 10}, "after": {"05": 132, "51": 12}},
            "issuers": [
                {"issuer_bank": "banorte", "attempts": 180, "approval_rate": 0.53, "delta_pts": -31},
                {"issuer_bank": "bbva_mx", "attempts": 45, "approval_rate": 0.84, "delta_pts": -2},
            ],
            "sample_size": 225, "wilson_ci": [0.54, 0.66],
        }
    return {}


def _fstr(filters: dict[str, str]) -> str:
    return "/".join(f"{k}={v}" for k, v in filters.items()) or "todo-el-mundo"


def _slice_str(slice_obj: Any) -> str:
    data = slice_obj.to_dict() if hasattr(slice_obj, "to_dict") else dict(slice_obj)
    return "/".join(f"{k}={v}" for k, v in data.items() if v) or "*"


class DebugPipeline:
    """Estado del stream de debug: un motor, una lista de inyecciones, un contador de ventanas."""

    def __init__(self) -> None:
        self.reset()

    def reset(self) -> None:
        self.engine = CentinelEngine()
        self.injections: list[dict[str, Any]] = []
        self.window = 0
        self.start = datetime(2026, 8, 30, 14, 0, tzinfo=timezone.utc)
        log.info("")
        log.info("[STREAM]   reset — motor nuevo, cubo sano, sin incidentes")

    def inject(self, preset: str | None = None, **override: Any) -> dict[str, Any]:
        spec = dict(PRESETS[preset]) if preset and preset in PRESETS else {}
        spec.update({k: v for k, v in override.items() if v is not None})
        if not spec.get("filters"):
            raise ValueError("inject: falta 'filters' o un preset válido")
        spec.setdefault("magnitude", 0.5)
        self.injections.append(spec)
        log.info(
            "[INYECTOR] incidente cargado: %s  x%.2f  código=%s  (%s)",
            _fstr(spec["filters"]), spec["magnitude"], spec.get("decline_code") or "—",
            spec.get("label", ""),
        )
        return spec

    def tick(self) -> dict[str, Any]:
        self.window += 1
        steps: list[str] = []

        def emit(msg: str) -> None:
            log.info(msg)
            steps.append(msg.strip())

        window_start = self.start + timedelta(minutes=self.window - 1)
        window_end = window_start + timedelta(seconds=60)
        started = time.perf_counter()

        emit("")
        emit(f"═══ VENTANA {self.window}  (t={window_start:%H:%M:%S}, 60 s) ═══")

        base = _healthy_cube()
        total = sum(l.attempts for l in base)
        emit(
            f"[GENERADOR] cargué 81 celdas del cubo sano desde cube_sample.parquet "
            f"({total:,} intentos, approval global "
            f"{100 * sum(l.approved for l in base) / total:.1f}%)"
        )

        for inj in self.injections:
            affected = [l for l in base if _matches(l, inj["filters"])]
            if not affected:
                emit(f"[INYECTOR] {_fstr(inj['filters'])}: 0 celdas coinciden (sin efecto)")
                continue
            n = sum(l.attempts for l in affected)
            before = sum(l.expected_approved_at_observed_volume for l in affected)
            after = sum(round(l.attempts * l.expected_rate * inj["magnitude"]) for l in affected)
            emit(
                f"[INYECTOR] {_fstr(inj['filters'])}: degradé {len(affected)} celdas, "
                f"approval {100 * before / n:.1f}% → {100 * after / n:.1f}% sobre {n:,} intentos "
                f"(código dominante {inj.get('decline_code') or '—'})"
            )

        leaves = _apply(base, self.injections)
        emit(
            "[MOTOR]    process_cube(81 celdas, ventana 60 s): "
            "detector CUSUM binomial → localizador (ripple + residualización) → clasificador determinístico"
        )

        core_out = self.engine.process_cube(leaves, window_end, evidence_loader=_evidence)
        for err in core_out.errors:
            emit(f"[MOTOR]    aviso: {err}")

        emit(f"[MOTOR]    resultado: {len(core_out.incidents)} incidente(s) en seguimiento")
        for inc in core_out.incidents:
            cand, dx = inc.candidate, inc.diagnosis
            emit(f"[MOTOR]     · {inc.incident_id}  slice={_slice_str(cand.slice)}")
            emit(
                f"[MOTOR]       localizador: score {cand.score:.2f} "
                f"(ripple_fit {cand.ripple_fit:.2f}, coverage {cand.coverage:.2f}) · "
                f"baseline {100 * cand.baseline_rate:.1f}% → observado {100 * cand.observed_rate:.1f}% · "
                f"{cand.attempts:,} intentos · déficit ~{cand.estimated_lost_approvals:.0f} aprobaciones"
            )
            emit(
                f"[MOTOR]       clasificador: {dx.category.value} (confianza {dx.confidence_score:.2f}) · "
                f"señales: {', '.join(dx.reason_codes) or '—'}"
            )
            alts = ", ".join(f"{c.value} ({s:.2f})" for c, s in dx.alternatives) or "ninguna"
            emit(f"[MOTOR]       estado: {inc.incident_status.value} · alternativas: {alts}")

        emitted = [i for i in core_out.to_dict()["incidents"] if i["incident_status"] in _EMITTED]
        emit(
            f"[BRIDGE]   core.EngineOutput → contracts.EngineOutput: "
            f"{len(emitted)} de {len(core_out.incidents)} incidente(s) en estado emitible "
            f"(detected / insufficient_evidence); el resto sigue validando"
        )
        contract = ContractEngineOutput.model_validate({"incidents": emitted})

        # diagnose() y score_incidents() emiten sus propias líneas [EXPLAIN] / [PRIORIDAD]
        diagnoses = diagnose(contract)
        scored = score_incidents(diagnoses)

        elapsed = time.perf_counter() - started
        emit(
            f"═══ RESPUESTA: {len(diagnoses)} diagnóstico(s), {len(scored)} priorizado(s)  "
            f"({elapsed:.1f}s) ═══"
        )

        return {
            "window": self.window,
            "t": window_start.isoformat(),
            "engine_incidents": [
                {"id": i.incident_id, "status": i.incident_status.value,
                 "category": i.diagnosis.category.value, "slice": _slice_str(i.candidate.slice)}
                for i in core_out.incidents
            ],
            "diagnoses": [d.model_dump(mode="json") for d in diagnoses],
            "prioritized": [s.model_dump(mode="json") for s in scored],
            "steps": [s for s in steps if s],
        }


PIPELINE = DebugPipeline()
