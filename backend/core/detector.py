"""Sequential anomaly detection over every cuboid slice."""

from __future__ import annotations

from dataclasses import dataclass
from itertools import combinations
from math import log

from .models import DIMENSIONS, EngineConfig, Leaf, SliceKey


@dataclass(frozen=True, slots=True)
class DetectionResult:
    triggered_slices: frozenset[SliceKey]
    weak_slices: frozenset[SliceKey]
    cusum_by_slice: dict[SliceKey, float]


def enumerate_slice_members(leaves: list[Leaf]) -> dict[SliceKey, tuple[int, ...]]:
    """Enumerate all values in the 15 non-empty cuboids of the four-axis cube."""

    members: dict[SliceKey, list[int]] = {}
    for size in range(1, len(DIMENSIONS) + 1):
        for selected in combinations(DIMENSIONS, size):
            for index, leaf in enumerate(leaves):
                key = SliceKey.from_dimensions(leaf, selected)
                members.setdefault(key, []).append(index)
    return {key: tuple(indexes) for key, indexes in members.items()}


class BinomialCusumDetector:
    def __init__(self, config: EngineConfig) -> None:
        self.config = config
        self._cusum: dict[SliceKey, float] = {}

    def reset(self) -> None:
        self._cusum.clear()

    def update(self, leaves: list[Leaf]) -> DetectionResult:
        triggered: set[SliceKey] = set()
        weak: set[SliceKey] = set()
        slice_members = enumerate_slice_members(leaves)

        for key, indexes in slice_members.items():
            attempts = sum(leaves[index].attempts for index in indexes)
            approved = sum(leaves[index].approved for index in indexes)
            expected = sum(
                leaves[index].expected_approved_at_observed_volume
                for index in indexes
            )
            if attempts <= 0:
                continue

            healthy_rate = min(0.999, max(0.001, expected / attempts))
            observed_rate = approved / attempts
            drop = healthy_rate - observed_rate

            if attempts < self.config.minimum_attempts:
                if (
                    key.dimension_count == len(DIMENSIONS)
                    and drop >= self.config.weak_signal_drop
                ):
                    weak.add(key)
                continue

            degraded_rate = max(
                0.001, healthy_rate - self.config.minimum_detectable_drop
            )
            rejections = attempts - approved
            llr = approved * log(degraded_rate / healthy_rate) + rejections * log(
                (1.0 - degraded_rate) / (1.0 - healthy_rate)
            )
            score = max(0.0, self._cusum.get(key, 0.0) + llr)
            self._cusum[key] = score

            if (
                score >= self.config.decision_threshold
                and drop >= self.config.minimum_detectable_drop / 2.0
            ):
                triggered.add(key)

        return DetectionResult(
            triggered_slices=frozenset(triggered),
            weak_slices=frozenset(weak),
            cusum_by_slice=dict(self._cusum),
        )
