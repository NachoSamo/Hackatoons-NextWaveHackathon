"""Cost calculation with a data-layer preference and an explicit demo fallback."""

from __future__ import annotations

from backend.contracts import CostEstimate, Slice


AVG_TICKET_FALLBACK = 35.0


def cost_for(slice_: Slice, window_s: int, fallback_lost_approvals: float = 0.0) -> CostEstimate | None:
    if window_s <= 0:
        return None
    filters = slice_.model_dump(exclude_none=True)
    try:
        from backend.data.cube import money_lost

        result = money_lost(filters, window_s)
        return CostEstimate(
            usd_per_hour=float(result["usd_per_hour"]),
            lost_approvals_window=float(result["lost_attempts"]),
            window_seconds=window_s,
            avg_ticket_usd=float(result["avg_ticket_usd"]),
            assumptions=["Estimated from the data-layer baseline, observed approvals, and average ticket for this slice.", "Potential lost approvals are not guaranteed recovered sales."],
        )
    except Exception:
        lost = max(0.0, fallback_lost_approvals)
        return CostEstimate(
            usd_per_hour=lost * AVG_TICKET_FALLBACK * 3600 / window_s,
            lost_approvals_window=lost,
            window_seconds=window_s,
            avg_ticket_usd=AVG_TICKET_FALLBACK,
            assumptions=["Data-layer money_lost was unavailable; using a $35.00 average-ticket demo fallback.", "Potential lost approvals are extrapolated from this window and are not guaranteed recovered sales."],
        )
