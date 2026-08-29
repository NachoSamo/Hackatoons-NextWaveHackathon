"""Genera el baseline agregado de 14 días sin materializar transacciones raw."""

from __future__ import annotations

import sys
from pathlib import Path

# Permite ejecutar el script directo: python backend/data/gen_baseline.py
PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

import numpy as np
import pandas as pd

from backend.data.probability import p_approve
from backend.data.world import (
    CELL_VOLUME_WEIGHTS,
    HOURLY_VOLUME_MULTIPLIERS,
    ISSUERS_BY_COUNTRY,
    LEAF_CELLS,
    volume_seasonality,
)


BASELINE_SEED = 20260829
STREAM_TX_PER_SECOND = 65
SECONDS_PER_HOUR = 60 * 60
DAYS_BY_TYPE = {"weekday": 10, "weekend": 4}
VOLUME_NORMALIZER = sum(HOURLY_VOLUME_MULTIPLIERS) / len(HOURLY_VOLUME_MULTIPLIERS)
OUTPUT_PATH = Path(__file__).resolve().parent / "out" / "baseline_profile.parquet"

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


def _attempts_for(
    merchant_id: str,
    provider_id: str,
    payment_method: str,
    country: str,
    hour_utc: int,
    day_type: str,
) -> int:
    cell_weight = CELL_VOLUME_WEIGHTS[
        (merchant_id, provider_id, payment_method, country)
    ]
    hourly_attempts = STREAM_TX_PER_SECOND * SECONDS_PER_HOUR
    attempts = (
        hourly_attempts
        * DAYS_BY_TYPE[day_type]
        * cell_weight
        * volume_seasonality(hour_utc, day_type)
        / VOLUME_NORMALIZER
    )
    return max(1, round(attempts))


def _expected_approval_rate(
    merchant_id: str,
    provider_id: str,
    payment_method: str,
    country: str,
    hour_utc: int,
    day_type: str,
) -> float:
    issuer_rates = []
    for issuer_bank in ISSUERS_BY_COUNTRY[country]:
        issuer_rates.append(
            p_approve(
                {
                    "merchant_id": merchant_id,
                    "provider_id": provider_id,
                    "payment_method": payment_method,
                    "country": country,
                    "issuer_bank": issuer_bank,
                    "hour_utc": hour_utc,
                    "day_type": day_type,
                    "jitter_multiplier": 1.0,
                },
                incidents=None,
            )
        )
    return sum(issuer_rates) / len(issuer_rates)


def _average_ticket_usd(
    merchant_id: str,
    payment_method: str,
    country: str,
    hour_utc: int,
) -> float:
    # Un ticket estable por perfil evita tener que materializar importes por fila.
    hour_multiplier = 0.96 if hour_utc < 7 else 1.03 if hour_utc >= 18 else 1.0
    amount = (
        BASE_TICKET_USD[payment_method]
        * MERCHANT_TICKET_MULTIPLIER[merchant_id]
        * COUNTRY_TICKET_MULTIPLIER[country]
        * hour_multiplier
    )
    return round(amount, 2)


def generate_baseline() -> pd.DataFrame:
    """Acumula 14 días de intentos y aprobaciones en 3.888 perfiles."""
    rng = np.random.default_rng(BASELINE_SEED)
    rows: list[dict[str, object]] = []

    for merchant_id, provider_id, payment_method, country in LEAF_CELLS:
        for day_type in DAYS_BY_TYPE:
            for hour_utc in range(24):
                attempts = _attempts_for(
                    merchant_id,
                    provider_id,
                    payment_method,
                    country,
                    hour_utc,
                    day_type,
                )
                expected_rate = _expected_approval_rate(
                    merchant_id,
                    provider_id,
                    payment_method,
                    country,
                    hour_utc,
                    day_type,
                )
                approved = int(rng.binomial(attempts, expected_rate))

                rows.append(
                    {
                        "merchant_id": merchant_id,
                        "provider_id": provider_id,
                        "payment_method": payment_method,
                        "country": country,
                        "hour_utc": hour_utc,
                        "day_type": day_type,
                        "attempts": attempts,
                        "approved": approved,
                        "avg_amount_usd": _average_ticket_usd(
                            merchant_id,
                            payment_method,
                            country,
                            hour_utc,
                        ),
                    }
                )

    return pd.DataFrame(rows).sort_values(
        [
            "merchant_id",
            "provider_id",
            "payment_method",
            "country",
            "hour_utc",
            "day_type",
        ]
    )


def main() -> None:
    baseline = generate_baseline()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    baseline.to_parquet(OUTPUT_PATH, engine="pyarrow", index=False)
    print(f"Baseline: {len(baseline):,} perfiles -> {OUTPUT_PATH}")


if __name__ == "__main__":
    main()
