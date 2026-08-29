"""Genera tráfico sano determinístico y un sample Leaf para el localizador."""

from __future__ import annotations

import random
import sys
from bisect import bisect
from datetime import datetime, timedelta, timezone
from itertools import accumulate
from pathlib import Path

# Permite ejecutar el script directo: python backend/data/gen_fixture.py
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import pandas as pd

from backend.data.gen_baseline import DAYS_BY_TYPE, SECONDS_PER_HOUR
from backend.data.probability import p_approve, pick_decline_code
from backend.data.world import (
    CELL_VOLUME_WEIGHTS,
    ISSUERS_BY_COUNTRY,
    LEAF_CELLS,
    PROVIDER_LATENCY_MS,
)


FIXTURE_SEED = 20260829
TX_PER_SECOND = 65
FIXTURE_DURATION_SECONDS = 90 * 60
FIXTURE_TX_COUNT = TX_PER_SECOND * FIXTURE_DURATION_SECONDS
CUBE_WINDOW_SECONDS = 60
CUBE_WINDOW_TX_COUNT = TX_PER_SECOND * CUBE_WINDOW_SECONDS
FIXTURE_START = datetime(2026, 8, 24, 8, 0, tzinfo=timezone.utc)

DATA_DIR = Path(__file__).resolve().parent / "out"
BASELINE_PATH = DATA_DIR / "baseline_profile.parquet"
FIXTURE_PATH = DATA_DIR / "fixture.parquet"
CUBE_SAMPLE_PATH = DATA_DIR / "cube_sample.parquet"

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
LEAF_COLUMNS = [
    "merchant_id",
    "provider_id",
    "payment_method",
    "country",
    "attempts",
    "approved",
    "fc_attempts",
    "fc_approved",
    "amount_usd_sum",
]

BASE_TICKET_USD = {
    "card": 48.0,
    "wallet": 34.0,
    "cash_oxxo": 24.0,
    "pse": 37.0,
    "pix": 29.0,
}
MERCHANT_TICKET_MULTIPLIER = {
    "tiendita": 0.84,
    "rappido": 0.93,
    "streamplus": 1.32,
}
COUNTRY_TICKET_MULTIPLIER = {"MX": 0.94, "CO": 0.88, "BR": 1.00}

_LEAF_WEIGHTS = [CELL_VOLUME_WEIGHTS[cell] for cell in LEAF_CELLS]
_CUMULATIVE_LEAF_WEIGHTS = tuple(accumulate(_LEAF_WEIGHTS))


def _day_type(created_at: datetime) -> str:
    return "weekend" if created_at.weekday() >= 5 else "weekday"


def _next_leaf(rng: random.Random) -> tuple[str, str, str, str]:
    index = bisect(_CUMULATIVE_LEAF_WEIGHTS, rng.random())
    return LEAF_CELLS[min(index, len(LEAF_CELLS) - 1)]


def _amount_usd(
    rng: random.Random,
    merchant_id: str,
    payment_method: str,
    country: str,
) -> float:
    expected_amount = (
        BASE_TICKET_USD[payment_method]
        * MERCHANT_TICKET_MULTIPLIER[merchant_id]
        * COUNTRY_TICKET_MULTIPLIER[country]
    )
    return round(max(1.0, expected_amount * (0.70 + rng.random() * 0.60)), 2)


def _latency_ms(rng: random.Random, provider_id: str) -> int:
    return max(40, round(rng.gauss(PROVIDER_LATENCY_MS[provider_id], 35)))


def _created_at(index: int) -> datetime:
    microseconds = (index * 1_000_000) // TX_PER_SECOND
    return FIXTURE_START + timedelta(microseconds=microseconds)


def _empty_cube_stats() -> dict[tuple[str, str, str, str], dict[str, float | int]]:
    return {
        cell: {"attempts": 0, "approved": 0, "amount_usd_sum": 0.0}
        for cell in LEAF_CELLS
    }


def _cube_sample(
    cube_stats: dict[tuple[str, str, str, str], dict[str, float | int]],
) -> pd.DataFrame:
    baseline = pd.read_parquet(BASELINE_PATH)
    baseline_index = baseline.set_index(
        [
            "merchant_id",
            "provider_id",
            "payment_method",
            "country",
            "hour_utc",
            "day_type",
        ]
    )
    window_day_type = _day_type(FIXTURE_START)
    window_hour = FIXTURE_START.hour
    profile_factor = CUBE_WINDOW_SECONDS / SECONDS_PER_HOUR / DAYS_BY_TYPE[window_day_type]
    profiles = {
        cell: baseline_index.loc[
            (
                cell[0],
                cell[1],
                cell[2],
                cell[3],
                window_hour,
                window_day_type,
            )
        ]
        for cell in LEAF_CELLS
    }
    baseline_window_attempts = sum(
        float(profile["attempts"]) * profile_factor for profile in profiles.values()
    )
    stream_volume_factor = CUBE_WINDOW_TX_COUNT / baseline_window_attempts

    rows: list[dict[str, object]] = []
    for merchant_id, provider_id, payment_method, country in LEAF_CELLS:
        profile = profiles[(merchant_id, provider_id, payment_method, country)]
        stats = cube_stats[(merchant_id, provider_id, payment_method, country)]
        rows.append(
            {
                "merchant_id": merchant_id,
                "provider_id": provider_id,
                "payment_method": payment_method,
                "country": country,
                "attempts": int(stats["attempts"]),
                "approved": int(stats["approved"]),
                "fc_attempts": float(profile["attempts"])
                * profile_factor
                * stream_volume_factor,
                "fc_approved": float(profile["approved"])
                * profile_factor
                * stream_volume_factor,
                "amount_usd_sum": round(float(stats["amount_usd_sum"]), 2),
            }
        )
    return pd.DataFrame(rows, columns=LEAF_COLUMNS)


def generate_fixture() -> tuple[pd.DataFrame, pd.DataFrame]:
    """Genera 351.000 transacciones sanas y agrega sus primeros 60 segundos."""
    if not BASELINE_PATH.exists():
        raise FileNotFoundError(f"No existe el baseline requerido: {BASELINE_PATH}")

    rng = random.Random(FIXTURE_SEED)
    records: dict[str, list[object]] = {column: [] for column in TRANSACTION_COLUMNS}
    cube_stats = _empty_cube_stats()

    for index in range(FIXTURE_TX_COUNT):
        created_at = _created_at(index)
        merchant_id, provider_id, payment_method, country = _next_leaf(rng)
        issuer_bank = rng.choice(ISSUERS_BY_COUNTRY[country])
        context = {
            "merchant_id": merchant_id,
            "provider_id": provider_id,
            "payment_method": payment_method,
            "country": country,
            "issuer_bank": issuer_bank,
            "hour_utc": created_at.hour,
            "day_type": _day_type(created_at),
            "rng": rng,
        }
        approval_probability = p_approve(context, incidents=None)
        approved = rng.random() < approval_probability
        amount_usd = _amount_usd(rng, merchant_id, payment_method, country)
        decline_code = None if approved else pick_decline_code(context, incidents=None)

        records["created_at"].append(created_at)
        records["merchant_id"].append(merchant_id)
        records["provider_id"].append(provider_id)
        records["payment_method"].append(payment_method)
        records["country"].append(country)
        records["issuer_bank"].append(issuer_bank)
        records["amount_usd"].append(amount_usd)
        records["approved"].append(approved)
        records["decline_code"].append(decline_code)
        records["latency_ms"].append(_latency_ms(rng, provider_id))
        records["source"].append("fixture")

        if index < CUBE_WINDOW_TX_COUNT:
            stats = cube_stats[(merchant_id, provider_id, payment_method, country)]
            stats["attempts"] = int(stats["attempts"]) + 1
            stats["approved"] = int(stats["approved"]) + int(approved)
            stats["amount_usd_sum"] = float(stats["amount_usd_sum"]) + amount_usd

    fixture = pd.DataFrame(records, columns=TRANSACTION_COLUMNS)
    return fixture, _cube_sample(cube_stats)


def main() -> None:
    fixture, cube_sample = generate_fixture()
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    fixture.to_parquet(FIXTURE_PATH, engine="pyarrow", index=False)
    cube_sample.to_parquet(CUBE_SAMPLE_PATH, engine="pyarrow", index=False)
    print(f"Fixture: {len(fixture):,} transacciones -> {FIXTURE_PATH}")
    print(f"Cube sample: {len(cube_sample)} hojas -> {CUBE_SAMPLE_PATH}")


if __name__ == "__main__":
    main()
