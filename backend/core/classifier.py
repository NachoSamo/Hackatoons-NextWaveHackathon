"""Deterministic diagnosis classification from localized evidence."""

from __future__ import annotations

from collections import Counter
from typing import Any, Mapping

from .models import (
    ConfidenceLevel,
    Diagnosis,
    DiagnosisCategory,
    DiagnosisStatus,
    EngineConfig,
    Leaf,
    LocalizedCandidate,
)


TECHNICAL_CODES = {"91", "96"}
ISSUER_GENERIC_CODES = {"05"}
MERCHANT_INTEGRATION_CODES = {"14", "N7"}
MERCHANT_CONFIGURATION_CODES = {"61", "65"}
DECLINE_CODE_METADATA = {
    "05": ("Do Not Honor", "soft"),
    "51": ("Insufficient Funds", "soft"),
    "91": ("Issuer Unavailable", "soft"),
    "96": ("System Malfunction", "soft"),
    "61": ("Exceeds Limit", "soft"),
    "65": ("Activity Limit", "soft"),
    "14": ("Invalid Card Number", "hard"),
    "54": ("Expired Card", "hard"),
    "41": ("Lost Card", "hard"),
    "43": ("Stolen Card", "hard"),
    "N7": ("CVV Mismatch", "hard"),
}


def _confidence_level(score: float) -> ConfidenceLevel:
    if score >= 0.80:
        return ConfidenceLevel.HIGH
    if score >= 0.60:
        return ConfidenceLevel.MEDIUM
    return ConfidenceLevel.LOW


def _normalised_decline_shift(evidence: Mapping[str, Any]) -> tuple[dict[str, Any], ...]:
    codes = evidence.get("decline_codes", {})
    before = codes.get("before", {}) if isinstance(codes, Mapping) else {}
    after = codes.get("after", {}) if isinstance(codes, Mapping) else {}
    before_total = sum(int(value) for value in before.values()) or 1
    after_total = sum(int(value) for value in after.values()) or 1
    rows: list[dict[str, Any]] = []
    for code in sorted(set(before) | set(after)):
        count_before = int(before.get(code, 0))
        count_after = int(after.get(code, 0))
        label, kind = DECLINE_CODE_METADATA.get(str(code), ("Unknown", "unknown"))
        rows.append(
            {
                "code": str(code),
                "label": label,
                "kind": kind,
                "count_before": count_before,
                "count_after": count_after,
                "share_before": count_before / before_total,
                "share_after": count_after / after_total,
                "share_delta": count_after / after_total
                - count_before / before_total,
            }
        )
    return tuple(sorted(rows, key=lambda row: row["share_delta"], reverse=True))


class DiagnosisClassifier:
    def __init__(self, config: EngineConfig) -> None:
        self.config = config

    def classify(
        self,
        candidate: LocalizedCandidate,
        evidence: Mapping[str, Any] | None,
        leaves: list[Leaf],
        force_insufficient: bool = False,
    ) -> Diagnosis:
        evidence = evidence or {}
        sample_size = int(evidence.get("sample_size", candidate.attempts))
        wilson = evidence.get("wilson_ci", candidate.wilson_ci)
        try:
            wilson_width = float(wilson[1]) - float(wilson[0])
        except (IndexError, TypeError, ValueError):
            wilson_width = candidate.wilson_ci[1] - candidate.wilson_ci[0]

        if (
            force_insufficient
            or sample_size < self.config.minimum_attempts
            or wilson_width > self.config.maximum_wilson_width
        ):
            return Diagnosis(
                category=DiagnosisCategory.INSUFFICIENT_EVIDENCE,
                status=DiagnosisStatus.INSUFFICIENT_EVIDENCE,
                confidence_score=min(candidate.confidence_score, 0.49),
                confidence_level=ConfidenceLevel.LOW,
                reason_codes=("LOW_SAMPLE_SIZE", "WIDE_WILSON_INTERVAL"),
            )

        shift = _normalised_decline_shift(evidence)
        dominant_code = shift[0]["code"] if shift and shift[0]["share_delta"] > 0 else None
        issuers = evidence.get("issuers", ())
        issuer_rows = [row for row in issuers if isinstance(row, Mapping)]
        affected_issuers = [
            row
            for row in issuer_rows
            if float(row.get("delta_pts", row.get("delta_percentage_points", 0.0)))
            <= -self.config.minimum_detectable_drop * 100
        ]
        issuer_concentrated = self._issuer_is_concentrated(issuer_rows)
        controls = self._control_facts(candidate, leaves)
        rule_scores: list[tuple[DiagnosisCategory, float, tuple[str, ...]]] = []

        if candidate.slice.provider_id is not None and (
            dominant_code in TECHNICAL_CODES or len(affected_issuers) >= 2
        ):
            score = 0.55 * candidate.score + 0.25
            reasons = ["PROVIDER_SLICE_LOCALIZED"]
            if dominant_code:
                reasons.append(f"CODE_{dominant_code}_SPIKE")
            if len(affected_issuers) >= 2:
                score += 0.10
                reasons.append("MULTIPLE_ISSUERS_AFFECTED")
            if controls["alternative_providers_healthy"]:
                score += 0.10
                reasons.append("ALTERNATIVE_PROVIDERS_HEALTHY")
            rule_scores.append(
                (
                    DiagnosisCategory.PROVIDER_DEGRADATION,
                    min(score, 0.99),
                    tuple(reasons),
                )
            )

        if dominant_code == "91" and issuer_concentrated:
            rule_scores.append(
                (
                    DiagnosisCategory.ISSUER_UNAVAILABLE,
                    min(0.99, 0.60 * candidate.score + 0.35),
                    ("CODE_91_SPIKE", "SINGLE_ISSUER_CONCENTRATION"),
                )
            )

        if dominant_code == "05" and issuer_concentrated:
            rule_scores.append(
                (
                    DiagnosisCategory.ISSUER_OVER_DECLINING,
                    min(0.99, 0.60 * candidate.score + 0.32),
                    ("CODE_05_SPIKE", "SINGLE_ISSUER_CONCENTRATION"),
                )
            )

        if (
            candidate.slice.payment_method is not None
            and candidate.slice.provider_id is None
            and controls["affected_provider_count"] >= 2
        ):
            rule_scores.append(
                (
                    DiagnosisCategory.PAYMENT_METHOD_OUTAGE,
                    min(0.99, 0.65 * candidate.score + 0.25),
                    ("METHOD_SLICE_LOCALIZED", "MULTIPLE_PROVIDERS_AFFECTED"),
                )
            )

        if (
            candidate.slice.merchant_id is not None
            and dominant_code in MERCHANT_INTEGRATION_CODES
            and controls["affected_provider_count"] >= 2
        ):
            rule_scores.append(
                (
                    DiagnosisCategory.MERCHANT_INTEGRATION_ERROR,
                    min(0.99, 0.60 * candidate.score + 0.30),
                    (
                        f"CODE_{dominant_code}_SPIKE",
                        "MERCHANT_SLICE_LOCALIZED",
                        "MULTIPLE_PROVIDERS_AFFECTED",
                    ),
                )
            )

        configuration_signal = bool(evidence.get("configuration_signal"))
        if (
            candidate.slice.merchant_id is not None
            and (
                dominant_code in MERCHANT_CONFIGURATION_CODES
                or configuration_signal
            )
        ):
            rule_scores.append(
                (
                    DiagnosisCategory.MERCHANT_CONFIGURATION,
                    min(0.99, 0.60 * candidate.score + 0.25),
                    ("MERCHANT_SLICE_LOCALIZED", "CONFIGURATION_SIGNAL"),
                )
            )

        if not rule_scores:
            score = min(candidate.score, 0.59)
            return Diagnosis(
                category=DiagnosisCategory.UNCLASSIFIED,
                status=DiagnosisStatus.UNCLASSIFIED,
                confidence_score=score,
                confidence_level=_confidence_level(score),
                reason_codes=("NO_SUPPORTED_DOMAIN_RULE",),
            )

        ranked = sorted(rule_scores, key=lambda item: item[1], reverse=True)
        category, rule_score, reasons = ranked[0]
        combined_score = min(
            0.99,
            0.55 * candidate.confidence_score + 0.45 * rule_score,
        )
        return Diagnosis(
            category=category,
            status=DiagnosisStatus.SUPPORTED,
            confidence_score=combined_score,
            confidence_level=_confidence_level(combined_score),
            reason_codes=reasons,
            alternatives=tuple(
                (alternative, score) for alternative, score, _ in ranked[1:3]
            ),
        )

    @staticmethod
    def decline_shift(evidence: Mapping[str, Any] | None) -> tuple[Mapping[str, Any], ...]:
        return _normalised_decline_shift(evidence or {})

    @staticmethod
    def issuer_evidence(evidence: Mapping[str, Any] | None) -> tuple[Mapping[str, Any], ...]:
        rows = (evidence or {}).get("issuers", ())
        normalised: list[dict[str, Any]] = []
        for row in rows:
            if not isinstance(row, Mapping):
                continue
            normalised.append(
                {
                    "issuer_bank": str(row.get("issuer_bank", "unknown")),
                    "attempts": int(row.get("attempts", 0)),
                    "approval_rate": float(row.get("approval_rate", 0.0)),
                    "delta_points": float(
                        row.get(
                            "delta_points",
                            row.get("delta_pts", row.get("delta_percentage_points", 0.0)),
                        )
                    ),
                }
            )
        return tuple(normalised)

    @staticmethod
    def _issuer_is_concentrated(rows: list[Mapping[str, Any]]) -> bool:
        if not rows:
            return False
        attempts = Counter(
            {
                str(row.get("issuer_bank", "unknown")): int(row.get("attempts", 0))
                for row in rows
            }
        )
        total = sum(attempts.values())
        return bool(total and attempts.most_common(1)[0][1] / total >= 0.50)

    def _control_facts(
        self, candidate: LocalizedCandidate, leaves: list[Leaf]
    ) -> dict[str, Any]:
        filters = candidate.slice.to_filters()
        provider_deltas: dict[str, list[float]] = {}
        for leaf in leaves:
            if any(
                name != "provider_id"
                and value is not None
                and getattr(leaf, name) != value
                for name, value in filters.items()
            ):
                continue
            provider_deltas.setdefault(leaf.provider_id, []).append(
                leaf.expected_rate - leaf.observed_rate
            )
        provider_drop = {
            provider: sum(values) / len(values)
            for provider, values in provider_deltas.items()
            if values
        }
        affected = {
            provider
            for provider, drop in provider_drop.items()
            if drop >= self.config.minimum_detectable_drop / 2
        }
        selected_provider = candidate.slice.provider_id
        alternatives = [
            drop
            for provider, drop in provider_drop.items()
            if provider != selected_provider
        ]
        return {
            "affected_provider_count": len(affected),
            "alternative_providers_healthy": bool(alternatives)
            and all(
                drop < self.config.minimum_detectable_drop / 2
                for drop in alternatives
            ),
        }
