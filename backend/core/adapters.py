"""Adapters between raw payment events and the canonical 81-leaf cube."""

from __future__ import annotations

from collections import Counter, defaultdict
from dataclasses import dataclass
from datetime import datetime
from typing import Iterable

from .localizer import wilson_interval
from .models import DIMENSIONS, Leaf, PaymentEvent, SliceKey


def _day_type(timestamp: datetime) -> str:
    return "weekend" if timestamp.weekday() >= 5 else "weekday"


@dataclass(frozen=True, slots=True)
class _BaselineCell:
    attempts: int
    approved: int

    @property
    def rate(self) -> float:
        return self.approved / self.attempts if self.attempts else 0.0


class RawEventAdapter:
    """Optional offline/fallback path; production integration uses get_cube()."""

    def __init__(self) -> None:
        self._profiles: dict[
            tuple[tuple[str, str, str, str], int, str], _BaselineCell
        ] = {}
        self._leaf_fallback: dict[tuple[str, str, str, str], _BaselineCell] = {}
        self._bucket_attempts: Counter[tuple[int, str]] = Counter()
        self._all_leaf_keys: set[tuple[str, str, str, str]] = set()
        self._reference_events: tuple[PaymentEvent, ...] = ()

    @property
    def fitted(self) -> bool:
        return bool(self._leaf_fallback)

    def fit(self, events: Iterable[PaymentEvent]) -> None:
        reference = tuple(events)
        if not reference:
            raise ValueError("healthy baseline history cannot be empty")

        profiles: dict[tuple[tuple[str, str, str, str], int, str], list[int]] = defaultdict(
            lambda: [0, 0]
        )
        fallback: dict[tuple[str, str, str, str], list[int]] = defaultdict(
            lambda: [0, 0]
        )
        bucket_attempts: Counter[tuple[int, str]] = Counter()

        for event in reference:
            leaf_key = (
                event.merchant_id,
                event.provider_id,
                event.payment_method,
                event.country,
            )
            bucket = (event.created_at.hour, _day_type(event.created_at))
            profiles[(leaf_key, *bucket)][0] += 1
            profiles[(leaf_key, *bucket)][1] += int(event.approved)
            fallback[leaf_key][0] += 1
            fallback[leaf_key][1] += int(event.approved)
            bucket_attempts[bucket] += 1

        self._profiles = {
            key: _BaselineCell(*counts) for key, counts in profiles.items()
        }
        self._leaf_fallback = {
            key: _BaselineCell(*counts) for key, counts in fallback.items()
        }
        self._bucket_attempts = bucket_attempts
        self._all_leaf_keys = set(fallback)
        self._reference_events = reference

    def to_leaves(
        self, events: Iterable[PaymentEvent], observed_at: datetime
    ) -> list[Leaf]:
        if not self.fitted:
            raise RuntimeError("fit_baseline must be called before process_events")

        window = tuple(events)
        aggregate: dict[tuple[str, str, str, str], list[float]] = defaultdict(
            lambda: [0, 0, 0.0]
        )
        for event in window:
            key = (
                event.merchant_id,
                event.provider_id,
                event.payment_method,
                event.country,
            )
            aggregate[key][0] += 1
            aggregate[key][1] += int(event.approved)
            aggregate[key][2] += max(0.0, event.amount_usd)

        bucket = (observed_at.hour, _day_type(observed_at))
        contextual = {
            leaf_key: profile
            for (leaf_key, hour, day_type), profile in self._profiles.items()
            if (hour, day_type) == bucket
        }
        total_profile_attempts = sum(cell.attempts for cell in contextual.values())
        total_window_attempts = len(window)
        leaves: list[Leaf] = []

        for leaf_key in sorted(self._all_leaf_keys | set(aggregate)):
            attempts, approved, amount = aggregate.get(leaf_key, [0, 0, 0.0])
            profile = contextual.get(leaf_key, self._leaf_fallback.get(leaf_key))
            if profile is None:
                continue
            if total_profile_attempts:
                fc_attempts = total_window_attempts * profile.attempts / total_profile_attempts
            else:
                all_attempts = sum(cell.attempts for cell in self._leaf_fallback.values())
                fc_attempts = total_window_attempts * profile.attempts / max(all_attempts, 1)
            leaves.append(
                Leaf(
                    merchant_id=leaf_key[0],
                    provider_id=leaf_key[1],
                    payment_method=leaf_key[2],
                    country=leaf_key[3],
                    attempts=int(attempts),
                    approved=int(approved),
                    fc_attempts=fc_attempts,
                    fc_approved=fc_attempts * profile.rate,
                    amount_usd_sum=float(amount),
                )
            )
        return leaves

    def evidence(
        self,
        filters: SliceKey,
        events: Iterable[PaymentEvent],
    ) -> dict[str, object]:
        current = [event for event in events if self._matches(event, filters)]
        reference = [
            event for event in self._reference_events if self._matches(event, filters)
        ]
        current_codes = Counter(
            event.decline_code or "unknown"
            for event in current
            if not event.approved
        )
        reference_codes = Counter(
            event.decline_code or "unknown"
            for event in reference
            if not event.approved
        )
        current_by_issuer: dict[str, list[int]] = defaultdict(lambda: [0, 0])
        reference_by_issuer: dict[str, list[int]] = defaultdict(lambda: [0, 0])
        for event in current:
            current_by_issuer[event.issuer_bank][0] += 1
            current_by_issuer[event.issuer_bank][1] += int(event.approved)
        for event in reference:
            reference_by_issuer[event.issuer_bank][0] += 1
            reference_by_issuer[event.issuer_bank][1] += int(event.approved)

        issuers: list[dict[str, object]] = []
        for issuer, (attempts, approved) in current_by_issuer.items():
            reference_attempts, reference_approved = reference_by_issuer.get(
                issuer, (0, 0)
            )
            observed_rate = approved / attempts if attempts else 0.0
            baseline_rate = (
                reference_approved / reference_attempts
                if reference_attempts
                else observed_rate
            )
            issuers.append(
                {
                    "issuer_bank": issuer,
                    "attempts": attempts,
                    "approval_rate": observed_rate,
                    "delta_pts": (observed_rate - baseline_rate) * 100,
                }
            )

        approvals = sum(int(event.approved) for event in current)
        return {
            "decline_codes": {
                "before": dict(reference_codes),
                "after": dict(current_codes),
            },
            "issuers": sorted(
                issuers, key=lambda item: float(item["delta_pts"])
            ),
            "sample_size": len(current),
            "wilson_ci": list(wilson_interval(approvals, len(current))),
        }

    @staticmethod
    def _matches(event: PaymentEvent, filters: SliceKey) -> bool:
        return all(
            getattr(filters, dimension) in (None, getattr(event, dimension))
            for dimension in DIMENSIONS
        )
