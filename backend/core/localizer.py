"""Squeeze-inspired exhaustive root-cause localization for the 4D payment cube."""

from __future__ import annotations

from math import exp, sqrt

from .detector import enumerate_slice_members
from .models import EngineConfig, Leaf, LocalizedCandidate, SliceKey


def wilson_interval(
    successes: int, attempts: int, z: float = 1.959963984540054
) -> tuple[float, float]:
    if attempts <= 0:
        return 0.0, 1.0
    proportion = successes / attempts
    denominator = 1.0 + z * z / attempts
    centre = proportion + z * z / (2.0 * attempts)
    margin = z * sqrt(
        proportion * (1.0 - proportion) / attempts
        + z * z / (4.0 * attempts * attempts)
    )
    return (
        max(0.0, (centre - margin) / denominator),
        min(1.0, (centre + margin) / denominator),
    )


def confidence_from_interval(
    attempts: int, expected_rate: float, interval: tuple[float, float]
) -> float:
    if attempts <= 0 or interval[1] >= expected_rate:
        return 0.0
    separation = expected_rate - interval[1]
    return max(0.0, min(1.0, 1.0 - exp(-attempts * separation * separation)))


class RootCauseLocalizer:
    def __init__(self, config: EngineConfig) -> None:
        self.config = config

    def localize(
        self,
        leaves: list[Leaf],
        triggered_slices: frozenset[SliceKey],
    ) -> list[LocalizedCandidate]:
        if not leaves:
            return []

        expected = [leaf.expected_approved_at_observed_volume for leaf in leaves]
        available = list(expected)
        residual = [
            max(0.0, expected[index] - leaf.approved)
            for index, leaf in enumerate(leaves)
        ]
        members = enumerate_slice_members(leaves)
        selected: list[LocalizedCandidate] = []

        for _ in range(self.config.maximum_incidents):
            total_residual = sum(residual)
            if total_residual < self.config.minimum_lost_approvals:
                break

            candidates = [
                candidate
                for key, indexes in members.items()
                if key not in {item.slice for item in selected}
                if (
                    candidate := self._score_candidate(
                        key,
                        indexes,
                        leaves,
                        expected,
                        available,
                        residual,
                        total_residual,
                    )
                )
                is not None
                and not any(
                    candidate.member_keys.issubset(item.member_keys)
                    for item in selected
                )
                and self._is_supported_by_detection(
                    candidate, triggered_slices, members, leaves
                )
            ]
            if not candidates:
                break

            best = max(
                candidates,
                key=lambda candidate: (
                    candidate.score,
                    candidate.coverage,
                    -candidate.slice.dimension_count,
                    sorted(candidate.slice.to_filters().items()),
                ),
            )
            if best.score < self.config.minimum_localization_score:
                break
            selected.append(best)

            available_in_slice = sum(
                available[index]
                for index, leaf in enumerate(leaves)
                if leaf.key in best.member_keys
            )
            severity = min(
                0.98,
                best.estimated_lost_approvals / max(available_in_slice, 1e-9),
            )
            for index, leaf in enumerate(leaves):
                if leaf.key in best.member_keys:
                    predicted = available[index] * severity
                    residual[index] = max(0.0, residual[index] - predicted)
                    available[index] = max(0.0, available[index] - predicted)

        return selected

    def weak_candidates(
        self, leaves: list[Leaf], weak_slices: frozenset[SliceKey]
    ) -> list[LocalizedCandidate]:
        candidates: list[LocalizedCandidate] = []
        members = enumerate_slice_members(leaves)
        expected = [leaf.expected_approved_at_observed_volume for leaf in leaves]
        available = list(expected)
        residual = [
            max(0.0, expected[index] - leaf.approved)
            for index, leaf in enumerate(leaves)
        ]
        total = sum(residual)
        for key in weak_slices:
            indexes = members.get(key, ())
            candidate = self._score_candidate(
                key,
                indexes,
                leaves,
                expected,
                available,
                residual,
                max(total, 1e-9),
                weak=True,
            )
            if candidate is not None:
                candidates.append(candidate)
        return sorted(candidates, key=lambda item: item.score, reverse=True)[:1]

    def _score_candidate(
        self,
        key: SliceKey,
        indexes: tuple[int, ...],
        leaves: list[Leaf],
        expected: list[float],
        available: list[float],
        residual: list[float],
        total_residual: float,
        weak: bool = False,
    ) -> LocalizedCandidate | None:
        attempts = sum(leaves[index].attempts for index in indexes)
        approved = sum(leaves[index].approved for index in indexes)
        expected_approvals = sum(expected[index] for index in indexes)
        deficit = sum(residual[index] for index in indexes)
        if attempts <= 0 or expected_approvals <= 0:
            return None
        if not weak and (
            attempts < self.config.minimum_attempts
            or deficit < self.config.minimum_lost_approvals
        ):
            return None

        baseline_rate = expected_approvals / attempts
        observed_rate = approved / attempts
        available_approvals = sum(available[index] for index in indexes)
        residual_drop = deficit / max(available_approvals, 1e-9)
        if residual_drop < self.config.minimum_detectable_drop / 2:
            return None
        severity = min(0.98, deficit / max(available_approvals, 1e-9))
        predicted = [0.0 for _ in leaves]
        for index in indexes:
            predicted[index] = available[index] * severity

        denominator = sum(residual) + sum(predicted) + 1e-9
        ripple_fit = max(
            0.0,
            1.0
            - sum(
                abs(residual[index] - predicted[index])
                for index in range(len(leaves))
            )
            / denominator,
        )
        coverage = min(1.0, deficit / max(total_residual, 1e-9))
        interval = wilson_interval(approved, attempts)
        confidence = confidence_from_interval(attempts, baseline_rate, interval)
        complexity_penalty = 0.015 * max(0, key.dimension_count - 1)
        score = max(
            0.0,
            0.70 * ripple_fit
            + 0.10 * coverage
            + 0.20 * confidence
            - complexity_penalty,
        )

        reason_codes = ["RIPPLE_MATCH", "APPROVAL_RATE_DROP"]
        if coverage >= 0.50:
            reason_codes.append("EXPLAINS_MAJORITY_OF_DEFICIT")
        if weak:
            reason_codes.append("LOW_SAMPLE_SIZE")

        return LocalizedCandidate(
            slice=key,
            member_keys=frozenset(leaves[index].key for index in indexes),
            score=round(score, 6),
            ripple_fit=round(ripple_fit, 6),
            coverage=round(coverage, 6),
            confidence_score=round(confidence, 6),
            attempts=attempts,
            approved=approved,
            expected_approvals=expected_approvals,
            estimated_lost_approvals=deficit,
            baseline_rate=baseline_rate,
            observed_rate=observed_rate,
            wilson_ci=interval,
            reason_codes=tuple(reason_codes),
        )

    @staticmethod
    def _is_supported_by_detection(
        candidate: LocalizedCandidate,
        triggered_slices: frozenset[SliceKey],
        members: dict[SliceKey, tuple[int, ...]],
        leaves: list[Leaf],
    ) -> bool:
        if not triggered_slices:
            return False
        candidate_members = set(candidate.member_keys)
        for triggered in triggered_slices:
            triggered_indexes = members.get(triggered, ())
            if not triggered_indexes:
                continue
            if triggered == candidate.slice:
                return True
            triggered_members = {leaves[index].key for index in triggered_indexes}
            smaller = min(len(candidate_members), len(triggered_members))
            if smaller and (
                len(candidate_members & triggered_members) / smaller >= 0.80
            ):
                return True
        return False
