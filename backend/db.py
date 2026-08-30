"""Conexión PostgreSQL y carga inicial de los artefactos sintéticos."""

from __future__ import annotations

import os
import sys
import time
from pathlib import Path
from typing import Any

# Permite ejecutar el script directo: python backend/db.py
PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import pandas as pd
import psycopg


DEFAULT_DATABASE_URL = "postgresql://postgres@localhost:5432/postgres"
SCHEMA_PATH = PROJECT_ROOT / "backend" / "data" / "schema.sql"
DATA_DIR = PROJECT_ROOT / "backend" / "data" / "out"
BASELINE_PATH = DATA_DIR / "baseline_profile.parquet"
FIXTURE_PATH = DATA_DIR / "fixture.parquet"

BASELINE_COLUMNS = [
    "merchant_id",
    "provider_id",
    "payment_method",
    "country",
    "hour_utc",
    "day_type",
    "attempts",
    "approved",
    "avg_amount_usd",
]
TRANSACTION_COLUMNS = [
    "created_at",
    "merchant_id",
    "provider_id",
    "payment_method",
    "country",
    "issuer_bank",
    "amount_usd",
    "approved",
    "decline_code",
    "latency_ms",
    "source",
]


def database_url() -> str:
    """Usa DATABASE_URL cuando existe y un Postgres local como fallback."""
    return os.getenv("DATABASE_URL", DEFAULT_DATABASE_URL)


def connect(dsn: str | None = None, **kwargs: Any) -> psycopg.Connection[Any]:
    # PostgreSQL es opcional (archivo frío). Sin timeout, un 5432 filtrado cuelga
    # la request ~150 s en vez de caer al fallback ring+parquet.
    kwargs.setdefault("connect_timeout", 2)
    return psycopg.connect(dsn or database_url(), **kwargs)


def initialize_schema(connection: psycopg.Connection[Any]) -> None:
    statements = [statement.strip() for statement in SCHEMA_PATH.read_text().split(";")]
    with connection.cursor() as cursor:
        for statement in statements:
            if statement:
                cursor.execute(statement)


def _python_value(value: Any) -> Any:
    if value is None or pd.isna(value):
        return None
    if isinstance(value, pd.Timestamp):
        return value.to_pydatetime()
    if hasattr(value, "item"):
        return value.item()
    return value


def _copy_dataframe(
    cursor: psycopg.Cursor[Any],
    table: str,
    columns: list[str],
    frame: pd.DataFrame,
) -> None:
    sql = f"COPY {table} ({', '.join(columns)}) FROM STDIN"
    with cursor.copy(sql) as copy:
        for row in frame.loc[:, columns].itertuples(index=False, name=None):
            copy.write_row(tuple(_python_value(value) for value in row))


def _load_fixture_window() -> pd.DataFrame:
    fixture = pd.read_parquet(FIXTURE_PATH)
    fixture["created_at"] = pd.to_datetime(fixture["created_at"], utc=True)
    fixture["source"] = "fixture"
    latest = fixture["created_at"].max()
    cutoff = latest - pd.Timedelta(hours=2)
    return fixture.loc[fixture["created_at"] >= cutoff].sort_values("created_at")


def load_artifacts(connection: psycopg.Connection[Any]) -> dict[str, float | int]:
    """Reemplaza el seed fixture y carga baseline + hasta dos horas disponibles."""
    baseline = pd.read_parquet(BASELINE_PATH)
    fixture = _load_fixture_window()
    started = time.perf_counter()

    with connection.cursor() as cursor:
        cursor.execute("DELETE FROM transactions WHERE source = %s", ("fixture",))
        cursor.execute("TRUNCATE TABLE baseline_profile")
        _copy_dataframe(cursor, "baseline_profile", BASELINE_COLUMNS, baseline)
        _copy_dataframe(cursor, "transactions", TRANSACTION_COLUMNS, fixture)
        cursor.execute(
            "SELECT count(*) FROM transactions WHERE source = %s", ("fixture",)
        )
        transaction_count = int(cursor.fetchone()[0])
        cursor.execute("SELECT count(*) FROM baseline_profile")
        baseline_count = int(cursor.fetchone()[0])

    return {
        "transactions": transaction_count,
        "baseline_profile": baseline_count,
        "fixture_loaded": len(fixture),
        "elapsed_seconds": round(time.perf_counter() - started, 2),
    }


def seed_database(dsn: str | None = None) -> dict[str, float | int]:
    with connect(dsn) as connection:
        initialize_schema(connection)
        return load_artifacts(connection)


def delete_live_transactions(dsn: str | None = None) -> int:
    """Borra sólo el replay live para que el reset de demo no toque el seed."""
    with connect(dsn, connect_timeout=1) as connection:
        with connection.cursor() as cursor:
            cursor.execute("DELETE FROM transactions WHERE source = %s", ("live",))
            return int(cursor.rowcount)


def main() -> None:
    try:
        result = seed_database()
    except Exception as exc:
        print("Database seed unavailable. Set DATABASE_URL with PostgreSQL credentials.")
        print(f"Reason: {exc}")
        raise SystemExit(1) from exc

    print(
        "Loaded "
        f"{result['fixture_loaded']:,} fixture rows, "
        f"{result['baseline_profile']:,} baseline profiles in "
        f"{result['elapsed_seconds']}s."
    )


if __name__ == "__main__":
    main()
