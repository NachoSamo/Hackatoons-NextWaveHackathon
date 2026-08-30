"""FastAPI mínimo para el stream operativo de Centinel."""

from __future__ import annotations

import asyncio
import json
import logging
import sys
from contextlib import asynccontextmanager
from datetime import datetime, timezone
from pathlib import Path
from typing import AsyncIterator

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse

# También permite ``uvicorn main:app`` ejecutado desde ``backend/``.
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.data.cube import set_observed_source
from backend.data.replayer import Replayer, TICK_SECONDS


LOGGER = logging.getLogger(__name__)
REPLAY_RETRY_SECONDS = 1.0


async def _ensure_replayer(app: FastAPI) -> None:
    current = getattr(app.state, "replayer", None)
    if current is not None and current.is_running:
        return
    if current is not None:
        await current.stop()

    try:
        replayer = Replayer()
        set_observed_source(replayer.ring.observed_cube)
        await replayer.start()
    except Exception as exc:
        LOGGER.exception("Replay startup failed; the supervisor will retry")
        if current is not None:
            # Conserva el último ring sano mientras el supervisor reintenta.
            set_observed_source(current.ring.observed_cube)
            app.state.replayer = current
        else:
            set_observed_source(None)
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

    try:
        yield
    finally:
        supervisor.cancel()
        try:
            await supervisor
        except asyncio.CancelledError:
            pass
        set_observed_source(None)
        replayer = getattr(app.state, "replayer", None)
        if replayer is not None:
            await replayer.stop()


app = FastAPI(title="Centinel Control Tower", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://127.0.0.1:5173"],
    allow_credentials=False,
    allow_methods=["GET", "POST", "OPTIONS"],
    allow_headers=["*"],
)


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
