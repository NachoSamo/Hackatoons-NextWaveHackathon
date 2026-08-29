"""Constantes del mundo sintético de pagos de PagoTotal.

Este módulo no consulta servicios ni genera transacciones: deja visibles los
supuestos que el generador, el replay y el baseline comparten.
"""

from __future__ import annotations

from typing import Final


MERCHANTS: Final[list[str]] = ["tiendita", "rappido", "streamplus"]
PROVIDERS: Final[list[str]] = ["adyen", "dlocal", "mercadopago"]
COUNTRIES: Final[list[str]] = ["MX", "CO", "BR"]

METHODS_BY_COUNTRY: Final[dict[str, list[str]]] = {
    "MX": ["card", "wallet", "cash_oxxo"],
    "CO": ["card", "wallet", "pse"],
    "BR": ["card", "wallet", "pix"],
}

ISSUERS_BY_COUNTRY: Final[dict[str, list[str]]] = {
    "MX": ["banorte", "bbva_mx", "banamex", "hsbc_mx"],
    "CO": ["bancolombia", "davivienda", "bbva_co"],
    "BR": ["itau", "bradesco", "nubank", "santander_br"],
}

# Tasas sanas antes de sumar la variación de merchant, provider e issuer.
BASE_METHOD_COUNTRY_RATE: Final[dict[str, dict[str, float]]] = {
    "MX": {"card": 0.820, "wallet": 0.9002, "cash_oxxo": 0.910},
    "CO": {"card": 0.805, "wallet": 0.895, "pse": 0.880},
    "BR": {"card": 0.835, "wallet": 0.9055, "pix": 0.960},
}

PROVIDER_APPROVAL_OFFSETS: Final[dict[str, float]] = {
    "adyen": 0.012,
    "dlocal": -0.010,
    "mercadopago": 0.004,
}

MERCHANT_APPROVAL_OFFSETS: Final[dict[str, float]] = {
    "tiendita": -0.006,
    "rappido": 0.015,
    "streamplus": -0.010,
}

# Los bancos son evidencia, no otra dimensión del cubo.
ISSUER_APPROVAL_MULTIPLIERS: Final[dict[str, float]] = {
    "banorte": 0.986,
    "bbva_mx": 0.998,
    "banamex": 1.009,
    "hsbc_mx": 0.976,
    "bancolombia": 1.008,
    "davivienda": 0.986,
    "bbva_co": 0.996,
    "itau": 1.012,
    "bradesco": 0.991,
    "nubank": 1.003,
    "santander_br": 0.982,
}

# Alias corto para los consumidores del generador.
ISSUER_MULTIPLIERS = ISSUER_APPROVAL_MULTIPLIERS

DECLINE_CODES: Final[dict[str, dict[str, str]]] = {
    "05": {"name": "Do Not Honor", "type": "soft"},
    "51": {"name": "Insufficient Funds", "type": "soft"},
    "91": {"name": "Issuer Unavailable", "type": "soft"},
    "96": {"name": "System Malfunction", "type": "soft"},
    "61": {"name": "Exceeds Limit", "type": "soft"},
    "65": {"name": "Activity Limit", "type": "soft"},
    "14": {"name": "Invalid Card Number", "type": "hard"},
    "54": {"name": "Expired Card", "type": "hard"},
    "41": {"name": "Lost Card", "type": "hard"},
    "43": {"name": "Stolen Card", "type": "hard"},
    "N7": {"name": "CVV Mismatch", "type": "hard"},
}

# dLocal representa el proveedor con mayor latencia del mundo sintético.
PROVIDER_LATENCY_MS: Final[dict[str, int]] = {
    "adyen": 230,
    "dlocal": 430,
    "mercadopago": 320,
}
SLOW_PROVIDERS: Final[frozenset[str]] = frozenset({"dlocal"})

# Multiplicadores de aprobación por hora UTC: peor de madrugada, mejor en la
# tarde. Su amplitud mantiene una diferencia visible en el baseline horario.
HOURLY_APPROVAL_MULTIPLIERS: Final[tuple[float, ...]] = (
    0.952,
    0.946,
    0.942,
    0.940,
    0.938,
    0.944,
    0.957,
    0.972,
    0.989,
    1.003,
    1.015,
    1.027,
    1.035,
    1.041,
    1.045,
    1.048,
    1.044,
    1.036,
    1.027,
    1.018,
    1.005,
    0.990,
    0.975,
    0.962,
)
WEEKEND_APPROVAL_MULTIPLIER: Final[float] = 0.983

# La curva horaria de volumen tiene la misma forma, con una caída nocturna más
# marcada. El fin de semana baja otro 15% el tráfico.
HOURLY_VOLUME_MULTIPLIERS: Final[tuple[float, ...]] = (
    0.36,
    0.31,
    0.28,
    0.27,
    0.29,
    0.36,
    0.52,
    0.73,
    0.94,
    1.08,
    1.18,
    1.27,
    1.34,
    1.39,
    1.43,
    1.46,
    1.44,
    1.38,
    1.31,
    1.20,
    1.05,
    0.86,
    0.64,
    0.48,
)
WEEKEND_VOLUME_MULTIPLIER: Final[float] = 0.85


def _hour_index(hour_utc: int) -> int:
    """Normaliza horas válidas de una fuente externa sin romper el replay."""
    try:
        return int(hour_utc) % 24
    except (TypeError, ValueError):
        return 12


def seasonality(hour_utc: int, day_type: str) -> float:
    """Devuelve el multiplicador de aprobación para hora UTC y tipo de día."""
    multiplier = HOURLY_APPROVAL_MULTIPLIERS[_hour_index(hour_utc)]
    if str(day_type).lower() == "weekend":
        multiplier *= WEEKEND_APPROVAL_MULTIPLIER
    return multiplier


def volume_seasonality(hour_utc: int, day_type: str) -> float:
    """Devuelve el multiplicador de tráfico equivalente para el generador."""
    multiplier = HOURLY_VOLUME_MULTIPLIERS[_hour_index(hour_utc)]
    if str(day_type).lower() == "weekend":
        multiplier *= WEEKEND_VOLUME_MULTIPLIER
    return multiplier


LEAF_CELLS: Final[tuple[tuple[str, str, str, str], ...]] = tuple(
    (merchant_id, provider_id, payment_method, country)
    for merchant_id in MERCHANTS
    for provider_id in PROVIDERS
    for country in COUNTRIES
    for payment_method in METHODS_BY_COUNTRY[country]
)


def _nest_by_cell(
    values: dict[tuple[str, str, str, str], float],
) -> dict[str, dict[str, dict[str, dict[str, float]]]]:
    nested: dict[str, dict[str, dict[str, dict[str, float]]]] = {}
    for (merchant_id, provider_id, payment_method, country), value in values.items():
        nested.setdefault(merchant_id, {}).setdefault(provider_id, {}).setdefault(
            payment_method, {}
        )[country] = value
    return nested


_base_rates_by_cell = {
    (merchant_id, provider_id, payment_method, country): round(
        BASE_METHOD_COUNTRY_RATE[country][payment_method]
        + PROVIDER_APPROVAL_OFFSETS[provider_id]
        + MERCHANT_APPROVAL_OFFSETS[merchant_id],
        6,
    )
    for merchant_id, provider_id, payment_method, country in LEAF_CELLS
}

# Forma deliberada para respetar el contrato: base[m][p][method][country].
BASE_APPROVAL_RATES = _nest_by_cell(_base_rates_by_cell)
BASE_RATES = BASE_APPROVAL_RATES

# Las ponderaciones suman 1.0. La combinación rappido × card × BR agrega casi
# 8% del stream; streamplus × cash_oxxo × MX apenas 0.3% y sirve como weak signal.
MERCHANT_VOLUME_WEIGHTS: Final[dict[str, float]] = {
    "tiendita": 0.28,
    "rappido": 0.47,
    "streamplus": 0.25,
}
PROVIDER_VOLUME_WEIGHTS: Final[dict[str, float]] = {
    "adyen": 0.42,
    "dlocal": 0.25,
    "mercadopago": 0.33,
}
METHOD_COUNTRY_VOLUME_WEIGHTS: Final[dict[str, dict[str, float]]] = {
    "MX": {"card": 0.135, "wallet": 0.075, "cash_oxxo": 0.012},
    "CO": {"card": 0.115, "wallet": 0.060, "pse": 0.105},
    "BR": {"card": 0.170, "wallet": 0.0701, "pix": 0.2579},
}

CELL_VOLUME_WEIGHTS: Final[dict[tuple[str, str, str, str], float]] = {
    (merchant_id, provider_id, payment_method, country): (
        MERCHANT_VOLUME_WEIGHTS[merchant_id]
        * PROVIDER_VOLUME_WEIGHTS[provider_id]
        * METHOD_COUNTRY_VOLUME_WEIGHTS[country][payment_method]
    )
    for merchant_id, provider_id, payment_method, country in LEAF_CELLS
}
VOLUME_WEIGHTS = _nest_by_cell(CELL_VOLUME_WEIGHTS)
