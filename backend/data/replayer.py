"""Replay determinístico del fixture hacia memoria, SSE y PostgreSQL.

El reloj de ``created_at`` avanza de forma monótona para que las filas ``live``
sean más recientes que el seed. Cada fila conserva además ``simulation_at``
solamente dentro del ring buffer: es el contexto horario original del fixture
que el forecast repite en cada vuelta, hasta que T9 lo re-ancla.
"""

from __future__ import annotations

import asyncio
import random
import threading
from collections import defaultdict, deque
from collections.abc import Callable, Iterable, Sequence
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, AsyncIterator

import pandas as pd

from backend.data.gen_baseline import STREAM_TX_PER_SECOND
from backend.data.probability import matching_incidents, p_approve, pick_decline_code
from backend.db import TRANSACTION_COLUMNS, connect


TICK_SECONDS = 0.25
STREAM_WINDOW_SECONDS = 60
RING_BUFFER_SECONDS = 30 * 60
RING_BUFFER_MAX_ROWS = STREAM_TX_PER_SECOND * RING_BUFFER_SECONDS
COPY_QUEUE_MAX_BATCHES = 5
COPY_RETRY_SECONDS = 1.0
COPY_CONNECT_TIMEOUT_SECONDS = 1
COPY_STATEMENT_TIMEOUT_MS = 1_500
REPLAY_SEED = 20260830

DATA_DIR = Path(__file__).resolve().parent / "out"
FIXTURE_PATH = DATA_DIR / "fixture.parquet"
BASELINE_PATH = DATA_DIR / "baseline_profile.parquet"

CellKey = tuple[str, str, str, str]
ObservedCell = tuple[int, int, float]
ObservedSnapshot = tuple[datetime, dict[CellKey, ObservedCell]]
CopySink = Callable[[list[dict[str, Any]]], None]
IncidentSource = Callable[[], Iterable[Any]]


def _utc(value: datetime | pd.Timestamp) -> datetime:
    timestamp = value.to_pydatetime() if isinstance(value, pd.Timestamp) else value
    if timestamp.tzinfo is None:
        return timestamp.replace(tzinfo=timezone.utc)
    return timestamp.astimezone(timezone.utc)


class RingBuffer:
    """Últimos 30 minutos del stream, con una lectura breve y atómica."""

    def __init__(
        self,
        max_rows: int = RING_BUFFER_MAX_ROWS,
        empty_anchor: datetime | None = None,
    ) -> None:
        self._rows: deque[dict[str, Any]] = deque(maxlen=max_rows)
        self._lock = threading.Lock()
        self._empty_anchor = _utc(empty_anchor or datetime.now(timezone.utc))

    def append_many(self, rows: Sequence[dict[str, Any]]) -> None:
        with self._lock:
            self._rows.extend(rows)

    def clear(self) -> None:
        with self._lock:
            self._rows.clear()

    def __len__(self) -> int:
        with self._lock:
            return len(self._rows)

    def recent_rows(self, window_s: int) -> list[dict[str, Any]]:
        """Devuelve ``(end - window_s, end]`` sin recorrer el buffer completo."""
        with self._lock:
            if not self._rows:
                return []
            end = _utc(self._rows[-1]["created_at"])
            start = end - timedelta(seconds=window_s)
            rows: list[dict[str, Any]] = []
            for row in reversed(self._rows):
                if _utc(row["created_at"]) <= start:
                    break
                rows.append(row)
            rows.reverse()
            return rows

    def observed_cube(self, window_s: int) -> ObservedSnapshot:
        """Agrega las hojas observadas para que ``cube.py`` no consulte SQL."""
        rows = self.recent_rows(window_s)
        if not rows:
            return self._empty_anchor, {}

        cube: dict[CellKey, list[float]] = defaultdict(lambda: [0, 0, 0.0])
        for row in rows:
            key = (
                str(row["merchant_id"]),
                str(row["provider_id"]),
                str(row["payment_method"]),
                str(row["country"]),
            )
            cube[key][0] += 1
            cube[key][1] += int(bool(row["approved"]))
            cube[key][2] += float(row["amount_usd"])

        observed = {
            key: (int(values[0]), int(values[1]), float(values[2]))
            for key, values in cube.items()
        }
        return _utc(rows[-1]["simulation_at"]), observed


class Replayer:
    """Emite el fixture a 65 tx/s y mantiene a Postgres fuera del hot path."""

    def __init__(
        self,
        fixture_path: Path = FIXTURE_PATH,
        baseline_path: Path = BASELINE_PATH,
        copy_sink: CopySink | None = None,
        incident_source: IncidentSource | None = None,
        session_anchor: datetime | None = None,
    ) -> None:
        self.fixture = pd.read_parquet(fixture_path)
        if self.fixture.empty:
            raise ValueError("El fixture no contiene transacciones para reproducir")
        self.fixture["created_at"] = pd.to_datetime(
            self.fixture["created_at"], utc=True
        )
        self._expected_rates = self._load_expected_rates(baseline_path)
        self.ring = RingBuffer(empty_anchor=_utc(self.fixture.iloc[0]["created_at"]))
        self._copy_sink = copy_sink or self._copy_to_postgres
        self._incident_source = incident_source or (lambda: ())
        self._session_anchor = _utc(session_anchor or datetime.now(timezone.utc))
        self._last_live_at = self._session_anchor - timedelta(microseconds=1)
        self._cursor = 0
        self._tick_index = 0
        self._emitted_count = 0
        self._rng = random.Random(REPLAY_SEED)
        self._pending_copy: list[dict[str, Any]] = []
        self._copy_queue: deque[list[dict[str, Any]]] = deque()
        self._copy_in_flight: list[dict[str, Any]] | None = None
        self._copy_task: asyncio.Task[None] | None = None
        self._copy_retry_after = 0.0
        self._state_lock = asyncio.Lock()
        self._reset_lock = asyncio.Lock()
        self._run_gate = asyncio.Event()
        self._run_gate.set()
        self._reschedule_ticks = False
        self._running = False
        self._task: asyncio.Task[None] | None = None
        self.last_error: str | None = None
        self.last_copy_error: str | None = None

    @staticmethod
    def _load_expected_rates(baseline_path: Path) -> dict[tuple[int, str], float]:
        baseline = pd.read_parquet(baseline_path)
        grouped = baseline.groupby(["hour_utc", "day_type"], sort=False)[
            ["attempts", "approved"]
        ].sum()
        return {
            (int(hour_utc), str(day_type)): float(row["approved"])
            / float(row["attempts"])
            for (hour_utc, day_type), row in grouped.iterrows()
            if float(row["attempts"]) > 0
        }

    def set_incident_source(self, incident_source: IncidentSource) -> None:
        """T7 conecta aquí el inyector sin acoplar el replay a su implementación."""
        self._incident_source = incident_source

    def _next_batch_size(self) -> int:
        previous_total = (self._tick_index * STREAM_TX_PER_SECOND) // 4
        self._tick_index += 1
        next_total = (self._tick_index * STREAM_TX_PER_SECOND) // 4
        return next_total - previous_total

    def _next_fixture_rows(self, count: int) -> list[dict[str, Any]]:
        rows: list[dict[str, Any]] = []
        while len(rows) < count:
            remaining = len(self.fixture) - self._cursor
            take = min(count - len(rows), remaining)
            batch = self.fixture.iloc[self._cursor : self._cursor + take].to_dict("records")
            rows.extend(batch)
            self._cursor += take
            if self._cursor == len(self.fixture):
                self._cursor = 0
        return rows

    def _active_incidents(self) -> list[Any]:
        try:
            return list(self._incident_source())
        except Exception as exc:
            self.last_error = f"Incident source unavailable: {exc}"
            return []

    @staticmethod
    def _decline_code(value: Any) -> str | None:
        return None if value is None or pd.isna(value) else str(value)

    def _live_row(self, source: dict[str, Any], incidents: list[Any]) -> dict[str, Any]:
        # El fixture vuelve a empezar con su mismo contexto horario. Así el
        # tráfico sano y el baseline siguen hablando de la misma hora/día.
        simulation_at = _utc(source["created_at"])
        live_at = self._session_anchor + timedelta(
            microseconds=(self._emitted_count * 1_000_000) // STREAM_TX_PER_SECOND
        )
        self._emitted_count += 1
        self._last_live_at = live_at
        context = {
            "merchant_id": str(source["merchant_id"]),
            "provider_id": str(source["provider_id"]),
            "payment_method": str(source["payment_method"]),
            "country": str(source["country"]),
            "issuer_bank": str(source["issuer_bank"]),
            "created_at": simulation_at,
            "rng": self._rng,
        }
        matching = matching_incidents(context, incidents)
        approved = bool(source["approved"])
        decline_code = self._decline_code(source["decline_code"])
        if matching:
            approved = self._rng.random() < p_approve(context, matching)
            decline_code = None if approved else pick_decline_code(context, matching)

        return {
            "created_at": live_at,
            "merchant_id": context["merchant_id"],
            "provider_id": context["provider_id"],
            "payment_method": context["payment_method"],
            "country": context["country"],
            "issuer_bank": context["issuer_bank"],
            "amount_usd": float(source["amount_usd"]),
            "approved": approved,
            "decline_code": decline_code,
            "latency_ms": int(source["latency_ms"]),
            "source": "live",
            "simulation_at": simulation_at,
        }

    def tick(self) -> int:
        """Emite una tanda de 16, 16, 16 o 17 transacciones."""
        source_rows = self._next_fixture_rows(self._next_batch_size())
        incidents = self._active_incidents()
        live_rows = [self._live_row(source, incidents) for source in source_rows]
        self.ring.append_many(live_rows)
        self._pending_copy.extend(live_rows)
        return len(live_rows)

    @staticmethod
    def _copy_to_postgres(rows: list[dict[str, Any]]) -> None:
        columns = ", ".join(TRANSACTION_COLUMNS)
        with connect(connect_timeout=COPY_CONNECT_TIMEOUT_SECONDS) as connection:
            with connection.cursor() as cursor:
                # Limita un COPY trabado sin convertir el reloj de replay en
                # dependiente de PostgreSQL. El retry queda a cargo de la cola.
                cursor.execute(
                    f"SET LOCAL statement_timeout = '{COPY_STATEMENT_TIMEOUT_MS}ms'"
                )
                with cursor.copy(f"COPY transactions ({columns}) FROM STDIN") as copy:
                    for row in rows:
                        copy.write_row(tuple(row[column] for column in TRANSACTION_COLUMNS))

    def _enqueue_copy_batches(self) -> None:
        while len(self._pending_copy) >= STREAM_TX_PER_SECOND:
            rows = self._pending_copy[:STREAM_TX_PER_SECOND]
            del self._pending_copy[:STREAM_TX_PER_SECOND]
            if len(self._copy_queue) >= COPY_QUEUE_MAX_BATCHES:
                self._copy_queue.popleft()
                self.last_copy_error = "PostgreSQL COPY backlog capped; oldest batch dropped"
            self._copy_queue.append(rows)

    async def _copy_batch(self, rows: list[dict[str, Any]]) -> None:
        try:
            await asyncio.to_thread(self._copy_sink, rows)
        except asyncio.CancelledError:
            raise
        except Exception as exc:
            if len(self._copy_queue) >= COPY_QUEUE_MAX_BATCHES:
                self._copy_queue.pop()
            self._copy_queue.appendleft(rows)
            self.last_copy_error = f"PostgreSQL COPY unavailable: {exc}"
            self._copy_retry_after = (
                asyncio.get_running_loop().time() + COPY_RETRY_SECONDS
            )
        else:
            self.last_copy_error = None
            self._copy_retry_after = 0.0
        finally:
            self._copy_in_flight = None

    async def _drain_copy_task(self) -> None:
        """Drena el único COPY activo antes de reiniciar o detener el replay."""
        task = self._copy_task
        if task is None:
            return
        try:
            # _copy_to_postgres acota connect y statement timeout; no cancelamos
            # asyncio.to_thread porque eso no detiene un COPY real a mitad de vuelo.
            await asyncio.shield(task)
        finally:
            if task.done() and self._copy_task is task:
                self._copy_task = None
                self._copy_in_flight = None

    def _start_copy_if_ready(self) -> bool:
        if self._copy_task is not None:
            if not self._copy_task.done():
                return False
            self._copy_task = None
        if not self._copy_queue:
            return False
        if asyncio.get_running_loop().time() < self._copy_retry_after:
            return False

        self._copy_in_flight = self._copy_queue.popleft()
        self._copy_task = asyncio.create_task(
            self._copy_batch(self._copy_in_flight),
            name="payment-copy",
        )
        return True

    async def flush_copy(self) -> None:
        """Encola lotes de 65 y deja un único COPY fuera del reloj de ticks."""
        self._enqueue_copy_batches()
        if self._start_copy_if_ready():
            await asyncio.sleep(0)

    def _expected_rate(self, simulation_at: datetime) -> float:
        day_type = "weekend" if simulation_at.weekday() >= 5 else "weekday"
        return self._expected_rates.get((simulation_at.hour, day_type), 0.0)

    def stream_snapshot(self) -> dict[str, Any]:
        """Snapshot liviano: el endpoint SSE nunca avanza el cursor del fixture."""
        rows = self.ring.recent_rows(STREAM_WINDOW_SECONDS)
        if not rows:
            return {
                "ts": self._session_anchor.isoformat(),
                "observed_rate": 0.0,
                "expected_rate": 0.0,
                "tx_count": self._emitted_count,
            }

        attempts = len(rows)
        observed_rate = sum(int(bool(row["approved"])) for row in rows) / attempts
        expected_rate = sum(
            self._expected_rate(_utc(row["simulation_at"])) for row in rows
        ) / attempts
        return {
            "ts": _utc(rows[-1]["created_at"]).isoformat(),
            "observed_rate": round(observed_rate, 6),
            "expected_rate": round(expected_rate, 6),
            "tx_count": self._emitted_count,
        }

    def _reset_state(self) -> None:
        next_anchor = _utc(datetime.now(timezone.utc))
        if next_anchor <= self._last_live_at:
            next_anchor = self._last_live_at + timedelta(microseconds=1)
        self._session_anchor = next_anchor
        self._last_live_at = next_anchor - timedelta(microseconds=1)
        self._cursor = 0
        self._tick_index = 0
        self._emitted_count = 0
        self._rng = random.Random(REPLAY_SEED)
        self._pending_copy.clear()
        self._copy_queue.clear()
        self._copy_in_flight = None
        self._copy_task = None
        self._copy_retry_after = 0.0
        self.ring.clear()
        self.last_error = None
        self.last_copy_error = None

    @asynccontextmanager
    async def reset_window(self) -> AsyncIterator[None]:
        """Pausa ticks y COPYs mientras T8 borra las filas ``live``."""
        async with self._reset_lock:
            self._run_gate.clear()
            async with self._state_lock:
                self._reschedule_ticks = True
                await self._drain_copy_task()
                self._reset_state()
                try:
                    yield
                finally:
                    self._run_gate.set()

    async def reset(self) -> None:
        """Reinicia memoria; T8 puede usar ``reset_window`` para incluir su DELETE."""
        async with self.reset_window():
            pass

    async def run_forever(self) -> None:
        """Mantiene el replay vivo aun cuando una tanda puntual falle."""
        self._running = True
        loop = asyncio.get_running_loop()
        next_tick = loop.time()
        while self._running:
            await self._run_gate.wait()
            next_tick += TICK_SECONDS
            await asyncio.sleep(max(0.0, next_tick - loop.time()))
            try:
                async with self._state_lock:
                    if self._reschedule_ticks:
                        self._reschedule_ticks = False
                        next_tick = loop.time()
                        continue
                    if not self._run_gate.is_set():
                        next_tick = loop.time()
                        continue
                    self.tick()
                    await self.flush_copy()
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                self.last_error = f"Replay recovered after error: {exc}"

    async def start(self) -> None:
        self._run_gate.set()
        if self._task is None or self._task.done():
            self._task = asyncio.create_task(self.run_forever(), name="payment-replayer")

    @property
    def is_running(self) -> bool:
        return self._task is not None and not self._task.done()

    async def stop(self) -> None:
        self._running = False
        self._run_gate.clear()
        if self._task is not None:
            self._task.cancel()
            try:
                await self._task
            except asyncio.CancelledError:
                pass
            except Exception as exc:
                self.last_error = f"Replay task stopped after error: {exc}"
            self._task = None
        async with self._state_lock:
            await self._drain_copy_task()
