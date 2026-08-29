"""Consultas del cubo operativo, su forecast y la evidencia contextual.

El cubo conserva los cuatro ejes de búsqueda acordados. Banco emisor y código
de rechazo se consultan solamente como evidencia del slice, no como ejes
adicionales del localizador.
"""

from __future__ import annotations

import math
import sys
from collections.abc import Mapping
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, TypedDict

# Permite ejecutar el módulo directo durante una verificación manual.
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.data.gen_baseline import (
    DAYS_BY_TYPE,
    SECONDS_PER_HOUR,
    STREAM_TX_PER_SECOND,
)
from backend.db import connect


class Leaf(TypedDict):
    merchant_id: str
    provider_id: str
    payment_method: str
    country: str
    attempts: int
    approved: int
    fc_attempts: float
    fc_approved: float
    amount_usd_sum: float


DIMENSION_COLUMNS = (
    "merchant_id",
    "provider_id",
    "payment_method",
    "country",
)
FILTER_COLUMNS = frozenset((*DIMENSION_COLUMNS, "issuer_bank"))


def _window_seconds(window_s: int) -> int:
    try:
        seconds = int(window_s)
    except (TypeError, ValueError) as exc:
        raise ValueError("window_s debe ser un entero positivo") from exc
    if seconds <= 0:
        raise ValueError("window_s debe ser un entero positivo")
    return seconds


def _filters(filters: Mapping[str, Any] | None) -> dict[str, Any]:
    if filters is None:
        return {}
    if not isinstance(filters, Mapping):
        raise ValueError("filters debe ser un diccionario")

    unknown = set(filters) - FILTER_COLUMNS
    if unknown:
        names = ", ".join(sorted(str(name) for name in unknown))
        raise ValueError(f"Filtros no soportados: {names}")
    return {str(column): value for column, value in filters.items() if value is not None}


def _utc(value: datetime | None) -> datetime:
    if value is None:
        return datetime.now(timezone.utc)
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


def _day_type(timestamp: datetime) -> str:
    return "weekend" if timestamp.weekday() >= 5 else "weekday"


def _anchor_time(connection: Any) -> datetime:
    """Usa el último evento disponible como reloj del fixture o del replay."""
    with connection.cursor() as cursor:
        cursor.execute("SELECT max(created_at) FROM transactions")
        latest = cursor.fetchone()[0]
    return _utc(latest)


def _window_bounds(connection: Any, window_s: int) -> tuple[datetime, datetime]:
    end = _anchor_time(connection)
    return end - timedelta(seconds=window_s), end


def _transaction_where(
    start: datetime,
    end: datetime,
    filters: Mapping[str, Any],
) -> tuple[str, list[Any]]:
    clauses = ["created_at > %s", "created_at <= %s"]
    values: list[Any] = [start, end]
    for column, value in filters.items():
        clauses.append(f"{column} = %s")
        values.append(value)
    return " AND ".join(clauses), values


def _baseline_where(filters: Mapping[str, Any]) -> tuple[str, list[Any]]:
    clauses: list[str] = []
    values: list[Any] = []
    for column in DIMENSION_COLUMNS:
        if column in filters:
            clauses.append(f"{column} = %s")
            values.append(filters[column])
    return " AND ".join(clauses), values


def _read_baseline_profiles(connection: Any, anchor: datetime) -> list[tuple[Any, ...]]:
    """Obtiene los 81 perfiles para la hora y el tipo de día del stream."""
    with connection.cursor() as cursor:
        cursor.execute(
            """
            SELECT merchant_id, provider_id, payment_method, country, attempts, approved
            FROM baseline_profile
            WHERE hour_utc = %s AND day_type = %s
            ORDER BY merchant_id, provider_id, payment_method, country
            """,
            (anchor.hour, _day_type(anchor)),
        )
        return cursor.fetchall()


def _read_observed_cube(
    connection: Any,
    start: datetime,
    end: datetime,
) -> dict[tuple[str, str, str, str], tuple[int, int, float]]:
    """Fuente observable intercambiable por el ring buffer en T6."""
    where, values = _transaction_where(start, end, {})
    with connection.cursor() as cursor:
        cursor.execute(
            f"""
            SELECT merchant_id, provider_id, payment_method, country,
                   count(*) AS attempts,
                   count(*) FILTER (WHERE approved) AS approved,
                   COALESCE(sum(amount_usd), 0) AS amount_usd_sum
            FROM transactions
            WHERE {where}
            GROUP BY merchant_id, provider_id, payment_method, country
            """,
            values,
        )
        rows = cursor.fetchall()

    return {
        (merchant_id, provider_id, payment_method, country): (
            int(attempts),
            int(approved),
            float(amount_usd_sum),
        )
        for merchant_id, provider_id, payment_method, country, attempts, approved, amount_usd_sum in rows
    }


def _cube_observed_source(
    connection: Any,
    window_s: int,
) -> tuple[datetime, dict[tuple[str, str, str, str], tuple[int, int, float]]]:
    """Costura de la fuente observable; T6 podrá sustituirla por ring buffer."""
    start, end = _window_bounds(connection, window_s)
    return end, _read_observed_cube(connection, start, end)


def _forecast_factor(profiles: list[tuple[Any, ...]], day_type: str) -> float:
    """Lleva el agregado histórico de la hora a 65 transacciones por segundo.

    Primero normaliza los 10 días hábiles o 4 de fin de semana acumulados en
    ``baseline_profile`` y luego lleva ese total diario a una hora de stream.
    """
    historic_days = DAYS_BY_TYPE[day_type]
    historic_hour_attempts = sum(float(profile[4]) for profile in profiles)
    per_day_hour_attempts = historic_hour_attempts / historic_days
    if per_day_hour_attempts <= 0:
        return 0.0
    live_volume_factor = (
        STREAM_TX_PER_SECOND * SECONDS_PER_HOUR
    ) / per_day_hour_attempts
    return live_volume_factor / historic_days


def get_cube(window_s: int = 60) -> list[Leaf]:
    """Devuelve observado y forecast aditivo para las 81 hojas del cubo."""
    seconds = _window_seconds(window_s)
    with connect() as connection:
        end, observed = _cube_observed_source(connection, seconds)
        profiles = _read_baseline_profiles(connection, end)

    volume_factor = _forecast_factor(profiles, _day_type(end))
    time_factor = seconds / SECONDS_PER_HOUR
    leaves: list[Leaf] = []
    for merchant_id, provider_id, payment_method, country, attempts, approved in profiles:
        observed_attempts, observed_approved, amount_usd_sum = observed.get(
            (merchant_id, provider_id, payment_method, country),
            (0, 0, 0.0),
        )
        leaves.append(
            {
                "merchant_id": merchant_id,
                "provider_id": provider_id,
                "payment_method": payment_method,
                "country": country,
                "attempts": observed_attempts,
                "approved": observed_approved,
                "fc_attempts": float(attempts) * time_factor * volume_factor,
                "fc_approved": float(approved) * time_factor * volume_factor,
                "amount_usd_sum": amount_usd_sum,
            }
        )
    return leaves


def _decline_counts(
    connection: Any,
    start: datetime,
    end: datetime,
    filters: Mapping[str, Any],
) -> dict[str, int]:
    where, values = _transaction_where(start, end, filters)
    with connection.cursor() as cursor:
        cursor.execute(
            f"""
            SELECT decline_code, count(*)
            FROM transactions
            WHERE {where} AND approved = false AND decline_code IS NOT NULL
            GROUP BY decline_code
            ORDER BY decline_code
            """,
            values,
        )
        return {str(code): int(count) for code, count in cursor.fetchall()}


def _issuer_rollup(
    connection: Any,
    start: datetime,
    end: datetime,
    filters: Mapping[str, Any],
) -> dict[str, tuple[int, int]]:
    where, values = _transaction_where(start, end, filters)
    with connection.cursor() as cursor:
        cursor.execute(
            f"""
            SELECT issuer_bank, count(*), count(*) FILTER (WHERE approved)
            FROM transactions
            WHERE {where}
            GROUP BY issuer_bank
            """,
            values,
        )
        return {
            str(issuer_bank): (int(attempts), int(approved))
            for issuer_bank, attempts, approved in cursor.fetchall()
        }


def _series_rollup(
    connection: Any,
    start: datetime,
    end: datetime,
    filters: Mapping[str, Any],
) -> dict[datetime, tuple[int, int]]:
    where, values = _transaction_where(start, end, filters)
    with connection.cursor() as cursor:
        cursor.execute(
            f"""
            SELECT date_trunc('second', created_at) AS ts,
                   count(*) AS attempts,
                   count(*) FILTER (WHERE approved) AS approved
            FROM transactions
            WHERE {where}
            GROUP BY 1
            ORDER BY 1
            """,
            values,
        )
        return {
            _utc(timestamp): (int(attempts), int(approved))
            for timestamp, attempts, approved in cursor.fetchall()
        }


def _baseline_rates(
    connection: Any,
    filters: Mapping[str, Any],
) -> dict[tuple[int, str], float]:
    where, values = _baseline_where(filters)
    where_sql = f"WHERE {where}" if where else ""
    with connection.cursor() as cursor:
        cursor.execute(
            f"""
            SELECT hour_utc, day_type, sum(attempts), sum(approved)
            FROM baseline_profile
            {where_sql}
            GROUP BY hour_utc, day_type
            """,
            values,
        )
        rows = cursor.fetchall()

    return {
        (int(hour_utc), str(day_type)): int(approved) / int(attempts)
        for hour_utc, day_type, attempts, approved in rows
        if int(attempts) > 0
    }


def _wilson_interval(approved: int, attempts: int) -> list[float]:
    if attempts <= 0:
        return [0.0, 1.0]

    z_score = 1.96
    rate = approved / attempts
    denominator = 1.0 + z_score**2 / attempts
    center = (rate + z_score**2 / (2 * attempts)) / denominator
    margin = (
        z_score
        * math.sqrt((rate * (1.0 - rate) + z_score**2 / (4 * attempts)) / attempts)
        / denominator
    )
    return [round(max(0.0, center - margin), 6), round(min(1.0, center + margin), 6)]


def get_evidence(filters: dict[str, Any], window_s: int) -> dict[str, Any]:
    """Compara ventanas consecutivas y expone evidencia para el localizador."""
    selected_filters = _filters(filters)
    seconds = _window_seconds(window_s)

    with connect() as connection:
        after_start, end = _window_bounds(connection, seconds)
        before_start = after_start - timedelta(seconds=seconds)
        before_declines = _decline_counts(
            connection, before_start, after_start, selected_filters
        )
        after_declines = _decline_counts(connection, after_start, end, selected_filters)
        before_issuers = _issuer_rollup(
            connection, before_start, after_start, selected_filters
        )
        after_issuers = _issuer_rollup(connection, after_start, end, selected_filters)
        series_rows = _series_rollup(connection, after_start, end, selected_filters)
        baseline_rates = _baseline_rates(connection, selected_filters)

    issuers: list[dict[str, Any]] = []
    for issuer_bank in set(before_issuers) | set(after_issuers):
        before_attempts, before_approved = before_issuers.get(issuer_bank, (0, 0))
        attempts, approved = after_issuers.get(issuer_bank, (0, 0))
        approval_rate = approved / attempts if attempts else 0.0
        before_rate = before_approved / before_attempts if before_attempts else 0.0
        delta_pts = (approval_rate - before_rate) * 100 if before_attempts else 0.0
        issuers.append(
            {
                "issuer_bank": issuer_bank,
                "attempts": attempts,
                "approval_rate": round(approval_rate, 6),
                "delta_pts": round(delta_pts, 3),
            }
        )
    issuers.sort(
        key=lambda item: (-abs(item["delta_pts"]), -item["attempts"], item["issuer_bank"])
    )

    series: list[dict[str, Any]] = []
    total_attempts = 0
    total_approved = 0
    first_second = end.replace(microsecond=0) - timedelta(seconds=seconds - 1)
    for offset in range(seconds):
        timestamp = first_second + timedelta(seconds=offset)
        attempts, approved = series_rows.get(timestamp, (0, 0))
        expected_rate = baseline_rates.get((timestamp.hour, _day_type(timestamp)), 0.0)
        series.append(
            {
                "ts": timestamp.isoformat(),
                "attempts": attempts,
                "approval_rate": round(approved / attempts, 6) if attempts else None,
                "expected_rate": round(expected_rate, 6),
            }
        )
        total_attempts += attempts
        total_approved += approved

    return {
        "decline_codes": {"before": before_declines, "after": after_declines},
        "issuers": issuers,
        "series": series,
        "sample_size": total_attempts,
        "wilson_ci": _wilson_interval(total_approved, total_attempts),
    }


def money_lost(filters: dict[str, Any], window_s: int) -> dict[str, float]:
    """Estima el costo horario de la diferencia contra el baseline contextual."""
    selected_filters = _filters(filters)
    seconds = _window_seconds(window_s)

    with connect() as connection:
        start, end = _window_bounds(connection, seconds)
        where, values = _transaction_where(start, end, selected_filters)
        with connection.cursor() as cursor:
            cursor.execute(
                f"""
                SELECT count(*), count(*) FILTER (WHERE approved),
                       COALESCE(avg(amount_usd), 0)
                FROM transactions
                WHERE {where}
                """,
                values,
            )
            attempts, approved, avg_ticket_usd = cursor.fetchone()
        baseline_rates = _baseline_rates(connection, selected_filters)

    attempts = int(attempts)
    approved = int(approved)
    average_ticket = float(avg_ticket_usd)
    observed_rate = approved / attempts if attempts else 0.0
    expected_rate = baseline_rates.get((end.hour, _day_type(end)), 0.0)
    lost_attempts = max(0.0, attempts * (expected_rate - observed_rate))
    usd_per_hour = lost_attempts * average_ticket * SECONDS_PER_HOUR / seconds
    return {
        "lost_attempts": round(lost_attempts, 4),
        "avg_ticket_usd": round(average_ticket, 2),
        "usd_per_hour": round(usd_per_hour, 2),
    }
