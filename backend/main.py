"""FastAPI façade for Centinel's live replay and explanation layer."""

from __future__ import annotations

import asyncio
import json
import logging
import os
import sys
import time
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, AsyncIterator

from fastapi import Body, FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

from dotenv import load_dotenv

# También permite ``uvicorn main:app`` ejecutado desde ``backend/``.
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

# Carga variables de entorno desde backend/.env y/o raíz
load_dotenv(Path(__file__).resolve().parent / ".env")
load_dotenv(PROJECT_ROOT / ".env")

from backend.contracts import EngineOutput
from backend.data.cube import set_live_rows_source, set_observed_source
from backend.data.injector import active as active_injections
from backend.data.replayer import Replayer, TICK_SECONDS
from backend.data.routes import router as data_router
from backend import diagnosis_loop
from backend.explain.build import diagnose
from backend.explain.prioritize import score_incidents
from backend.logging_setup import log, recent_log, setup

setup()

LOGGER = logging.getLogger(__name__)
REPLAY_RETRY_SECONDS = 1.0
FIXTURES = Path(__file__).with_name("fixtures")
DIAGNOSES: dict[str, Any] = {}


async def _ensure_replayer(app: FastAPI) -> None:
    current = getattr(app.state, "replayer", None)
    if current is not None and current.is_running:
        return
    if current is not None:
        await current.stop()

    try:
        replayer = Replayer()
        replayer.set_incident_source(active_injections)
        set_observed_source(replayer.ring.observed_cube)
        set_live_rows_source(replayer.ring.recent_rows)
        await replayer.start()
    except Exception as exc:
        LOGGER.exception("Replay startup failed; the supervisor will retry")
        if current is not None:
            # Conserva el último ring sano mientras el supervisor reintenta.
            set_observed_source(current.ring.observed_cube)
            set_live_rows_source(current.ring.recent_rows)
            app.state.replayer = current
        else:
            set_observed_source(None)
            set_live_rows_source(None)
            app.state.replayer = None
        app.state.replay_error = str(exc)
    else:
        app.state.replayer = replayer
        app.state.replay_error = None


async def _replay_supervisor(app: FastAPI) -> None:
    while True:
        try:
            await _ensure_replayer(app)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            LOGGER.exception("Replay supervisor recovered from an error")
            app.state.replay_error = str(exc)
        await asyncio.sleep(REPLAY_RETRY_SECONDS)


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    app.state.replayer = None
    app.state.replay_error = None
    supervisor = asyncio.create_task(
        _replay_supervisor(app),
        name="payment-replay-supervisor",
    )
    app.state.replay_supervisor = supervisor
    diag = asyncio.create_task(diagnosis_loop.run(app), name="diagnosis-loop")
    app.state.diagnosis_loop = diag

    try:
        yield
    finally:
        for task in (diag, supervisor):
            task.cancel()
            try:
                await task
            except asyncio.CancelledError:
                pass
        set_observed_source(None)
        set_live_rows_source(None)
        replayer = getattr(app.state, "replayer", None)
        if replayer is not None:
            await replayer.stop()


app = FastAPI(title="Centinel Control Tower", lifespan=lifespan)

# Dev: Vite on :5173. Deploy: set FRONTEND_ORIGIN (e.g. the Vercel URL) for the ngrok backend.
_origins = ["http://localhost:5173", "http://127.0.0.1:5173"]
if os.getenv("FRONTEND_ORIGIN"):
    _origins.append(os.environ["FRONTEND_ORIGIN"])
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)
app.include_router(data_router)


def _unavailable_snapshot() -> dict[str, object]:
    return {
        "ts": datetime.now(timezone.utc).isoformat(),
        "observed_rate": 0.0,
        "expected_rate": 0.0,
        "tx_count": 0,
    }


@app.get("/api/stream")
async def stream(request: Request) -> StreamingResponse:
    """Entrega snapshots SSE; cada cliente lee, nunca mueve el replay."""

    async def events() -> AsyncIterator[str]:
        while True:
            try:
                if await request.is_disconnected():
                    return
                replayer = getattr(request.app.state, "replayer", None)
                payload = (
                    replayer.stream_snapshot()
                    if replayer is not None
                    else _unavailable_snapshot()
                )
                yield f"data: {json.dumps(payload, separators=(',', ':'))}\n\n"
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                LOGGER.exception("SSE snapshot failed")
                error = {"message": f"Stream snapshot unavailable: {exc}"}
                yield f"event: error\ndata: {json.dumps(error)}\n\n"
                yield (
                    f"data: {json.dumps(_unavailable_snapshot(), separators=(',', ':'))}\n\n"
                )
            await asyncio.sleep(TICK_SECONDS)

    return StreamingResponse(
        events(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


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
    source = f'fixture "{payload["fixture"]}"' if payload.get("fixture") else "EngineOutput directo"
    log.info("[API]      → POST /api/agent/explain  (%s)", source)
    started = time.perf_counter()
    try:
        engine_output = _validate(payload)
        log.info("[API]      EngineOutput recibido: %d incidente(s)", len(engine_output.incidents))
        diagnoses = diagnose(engine_output)
        scored = score_incidents(diagnoses)
        DIAGNOSES.update({item.incident_id: item for item in diagnoses})
        log.info(
            "[PRIORIDAD] %s",
            "  ".join(f"{s.diagnosis.incident_id}={s.score:.2f}" for s in scored) or "(ninguno)",
        )
        log.info(
            "[API]      ← 200  %d diagnóstico(s), %d priorizado(s)  (%.1fs)",
            len(diagnoses), len(scored), time.perf_counter() - started,
        )
        return {
            "diagnoses": [item.model_dump(mode="json") for item in diagnoses],
            "prioritized": [item.model_dump(mode="json") for item in scored],
        }
    except Exception as exc:
        log.warning("[API]      ← error tras %.1fs: %s", time.perf_counter() - started, exc)
        return {
            "diagnoses": [],
            "prioritized": [],
            "error": f"Explanation unavailable: {exc}",
        }


@app.get("/api/diagnosis")
def diagnosis() -> dict[str, Any]:
    """Último snapshot del loop de diagnóstico vivo + las últimas líneas del trace."""
    return {**diagnosis_loop.snapshot(), "log_tail": recent_log()}


@app.post("/api/diagnosis/reset")
def diagnosis_reset() -> dict[str, Any]:
    """Motor de diagnóstico nuevo. El frontend lo llama junto con /api/demo/reset."""
    diagnosis_loop.reset()
    return {"ok": True}


@app.get("/api/incidents/{incident_id}/diagnosis")
def incident_diagnosis(incident_id: str) -> dict[str, Any]:
    try:
        diagnosis = DIAGNOSES.get(incident_id)
        if diagnosis is None:
            return {
                "diagnosis": None,
                "error": "Diagnosis not found. Call /api/agent/explain first.",
            }
        return {"diagnosis": diagnosis.model_dump(mode="json")}
    except Exception as exc:
        return {"diagnosis": None, "error": f"Diagnosis unavailable: {exc}"}
