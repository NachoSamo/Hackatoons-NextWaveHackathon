"""Stateful orchestration for Centinel's deterministic diagnosis core."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone
from typing import Any, Callable, Iterable, Mapping

from .adapters import RawEventAdapter
from .classifier import DiagnosisClassifier
from .detector import BinomialCusumDetector
from .localizer import RootCauseLocalizer
from .models import (
    Diagnosis,
    DiagnosisStatus,
    EngineConfig,
    EngineOutput,
    IncidentOutput,
    IncidentStatus,
    IncidentTrack,
    Leaf,
    LocalizedCandidate,
    PaymentEvent,
    SliceKey,
)


EvidenceLoader = Callable[[dict[str, str], int], Mapping[str, Any]]


class CentinelEngine:
    """Detect, localize and classify concurrent payment anomalies.

    ``process_cube`` is the production boundary agreed with the data module.
    ``process_events`` is an offline adapter useful for isolated development and
    trial-by-fire inputs when only authorization events are available.
    """

    def __init__(self, config: EngineConfig | None = None) -> None:
        self.config = config or EngineConfig()
        self.detector = BinomialCusumDetector(self.config)
        self.localizer = RootCauseLocalizer(self.config)
        self.classifier = DiagnosisClassifier(self.config)
        self.raw_adapter = RawEventAdapter()
        self._tracks: dict[str, IncidentTrack] = {}
        self._incident_sequence = 0

    def reset(self, keep_baseline: bool = True) -> None:
        self.detector.reset()
        self._tracks.clear()
        self._incident_sequence = 0
        if not keep_baseline:
            self.raw_adapter = RawEventAdapter()

    def fit_baseline(
        self, events: Iterable[PaymentEvent | Mapping[str, Any]]
    ) -> None:
        self.raw_adapter.fit(self._parse_events(events))

    def process_events(
        self,
        events: Iterable[PaymentEvent | Mapping[str, Any]],
        observed_at: datetime | None = None,
    ) -> EngineOutput:
        try:
            parsed = self._parse_events(events)
            timestamp = self._normalise_timestamp(
                observed_at
                or max((event.created_at for event in parsed), default=datetime.now(timezone.utc))
            )
            leaves = self.raw_adapter.to_leaves(parsed, timestamp)

            def evidence_loader(filters: dict[str, str], _: int) -> Mapping[str, Any]:
                return self.raw_adapter.evidence(SliceKey(**filters), parsed)

            return self.process_cube(
                leaves,
                observed_at=timestamp,
                window_start=timestamp - timedelta(seconds=self.config.window_seconds),
                evidence_loader=evidence_loader,
            )
        except (KeyError, TypeError, ValueError, RuntimeError) as exc:
            return EngineOutput(errors=(f"raw_event_adapter: {exc}",))

    def process_cube(
        self,
        leaves: Iterable[Leaf | Mapping[str, Any]],
        observed_at: datetime | None = None,
        window_start: datetime | None = None,
        window_seconds: int | None = None,
        evidence_loader: EvidenceLoader | None = None,
    ) -> EngineOutput:
        """Process one non-overlapping observation window.

        The method never calls an LLM and never needs raw PAN/card data. Domain
        evidence is fetched lazily only for localized candidates.
        """

        try:
            parsed = [
                leaf if isinstance(leaf, Leaf) else Leaf.from_mapping(leaf)
                for leaf in leaves
            ]
            self._validate_cube(parsed)
        except (KeyError, TypeError, ValueError) as exc:
            return EngineOutput(errors=(f"invalid_cube: {exc}",))

        seconds = window_seconds or self.config.window_seconds
        if seconds <= 0:
            return EngineOutput(errors=("invalid_window: seconds must be positive",))
        window_end = self._normalise_timestamp(observed_at or datetime.now(timezone.utc))
        start = self._normalise_timestamp(
            window_start or window_end - timedelta(seconds=seconds)
        )

        detection = self.detector.update(parsed)
        strong = self.localizer.localize(parsed, detection.triggered_slices)
        weak = self.localizer.weak_candidates(parsed, detection.weak_slices)
        weak = [
            candidate
            for candidate in weak
            if all(
                not candidate.member_keys.issubset(item.member_keys)
                for item in strong
            )
        ]
        candidates = [(candidate, False) for candidate in strong]
        remaining_slots = max(0, self.config.maximum_incidents - len(candidates))
        candidates.extend((candidate, True) for candidate in weak[:remaining_slots])

        errors: list[str] = []
        evidence_by_candidate: dict[int, Mapping[str, Any]] = {}
        for candidate, _ in candidates:
            evidence: Mapping[str, Any] = {}
            if evidence_loader is not None:
                try:
                    evidence = evidence_loader(candidate.slice.to_filters(), seconds)
                    if not isinstance(evidence, Mapping):
                        raise TypeError("evidence loader must return a mapping")
                except Exception as exc:  # demo must degrade without taking the UI down
                    errors.append(
                        f"evidence_unavailable[{candidate.slice.to_filters()}]: {exc}"
                    )
                    evidence = {}
            evidence_by_candidate[id(candidate)] = evidence

        matched_tracks: set[str] = set()
        emitted: list[IncidentOutput] = []
        for candidate, force_insufficient in sorted(
            candidates,
            key=lambda pair: (
                pair[0].estimated_lost_approvals,
                pair[0].score,
            ),
            reverse=True,
        ):
            track = self._match_track(candidate, matched_tracks)
            evidence = evidence_by_candidate[id(candidate)]
            diagnosis = self.classifier.classify(
                candidate,
                evidence,
                parsed,
                force_insufficient=force_insufficient,
            )
            if track is None:
                track = self._new_track(candidate, start, window_end)
            else:
                track.candidate = candidate
                track.consecutive_windows += 1
                track.recovery_windows = 0
            matched_tracks.add(track.incident_id)
            track.last_evidence = evidence
            is_insufficient = (
                force_insufficient
                or diagnosis.status == DiagnosisStatus.INSUFFICIENT_EVIDENCE
            )
            insufficient_windows = (
                self.config.weak_signal_validation_windows
                if force_insufficient
                else self.config.validation_windows
            )
            self._advance_track(
                track,
                is_insufficient,
                window_end,
                insufficient_windows,
            )
            if (
                is_insufficient
                and track.consecutive_windows < insufficient_windows
            ):
                continue
            track.has_been_emitted = True
            emitted.append(
                self._to_output(track, diagnosis, evidence, start, window_end, seconds)
            )

        for incident_id, track in list(self._tracks.items()):
            if incident_id in matched_tracks:
                continue
            if track.status == IncidentStatus.VALIDATING:
                del self._tracks[incident_id]
                continue
            track.recovery_windows += 1
            if not track.has_been_emitted:
                if track.recovery_windows >= self.config.recovery_windows:
                    del self._tracks[incident_id]
                continue
            if track.recovery_windows >= self.config.recovery_windows:
                track.status = IncidentStatus.RESOLVED
                diagnosis = self.classifier.classify(
                    track.candidate, track.last_evidence, parsed
                )
                emitted.append(
                    self._to_output(
                        track,
                        diagnosis,
                        track.last_evidence,
                        start,
                        window_end,
                        seconds,
                    )
                )
                del self._tracks[incident_id]
            else:
                diagnosis = self.classifier.classify(
                    track.candidate, track.last_evidence, parsed
                )
                emitted.append(
                    self._to_output(
                        track,
                        diagnosis,
                        track.last_evidence,
                        start,
                        window_end,
                        seconds,
                    )
                )

        emitted.sort(
            key=lambda item: (
                item.incident_status == IncidentStatus.DETECTED,
                item.priority_score,
                item.incident_id,
            ),
            reverse=True,
        )
        return EngineOutput(incidents=tuple(emitted), errors=tuple(errors))

    def _new_track(
        self, candidate: LocalizedCandidate, first_seen: datetime, observed_at: datetime
    ) -> IncidentTrack:
        self._incident_sequence += 1
        incident_id = f"INC-{self._incident_sequence:04d}"
        track = IncidentTrack(
            incident_id=incident_id,
            candidate=candidate,
            first_seen=first_seen,
            detected_at=observed_at,
        )
        self._tracks[incident_id] = track
        return track

    def _match_track(
        self, candidate: LocalizedCandidate, already_matched: set[str]
    ) -> IncidentTrack | None:
        eligible = [
            track
            for incident_id, track in self._tracks.items()
            if incident_id not in already_matched
            and self._jaccard(candidate, track.candidate)
            >= self.config.incident_match_jaccard
        ]
        if not eligible:
            return None
        return max(eligible, key=lambda track: self._jaccard(candidate, track.candidate))

    def _advance_track(
        self,
        track: IncidentTrack,
        force_insufficient: bool,
        observed_at: datetime,
        insufficient_windows: int,
    ) -> None:
        if force_insufficient:
            track.status = (
                IncidentStatus.INSUFFICIENT_EVIDENCE
                if track.consecutive_windows >= insufficient_windows
                else IncidentStatus.VALIDATING
            )
            return
        diagnosing_at = self.config.validation_windows
        detected_at = diagnosing_at + self.config.diagnosing_windows
        if track.consecutive_windows >= detected_at:
            if track.status != IncidentStatus.DETECTED:
                track.detected_at = observed_at
            track.status = IncidentStatus.DETECTED
        elif track.consecutive_windows >= diagnosing_at:
            track.status = IncidentStatus.DIAGNOSING
        else:
            track.status = IncidentStatus.VALIDATING

    def _to_output(
        self,
        track: IncidentTrack,
        diagnosis: Diagnosis,
        evidence: Mapping[str, Any],
        window_start: datetime,
        window_end: datetime,
        window_seconds: int,
    ) -> IncidentOutput:
        priority = min(
            1.0,
            0.45 * track.candidate.coverage
            + 0.35 * diagnosis.confidence_score
            + 0.20
            * min(1.0, track.candidate.estimated_lost_approvals / 50.0),
        )
        return IncidentOutput(
            incident_id=track.incident_id,
            incident_status=track.status,
            detected_at=track.detected_at,
            estimated_start=track.first_seen,
            window_start=window_start,
            window_end=window_end,
            window_seconds=window_seconds,
            candidate=track.candidate,
            diagnosis=diagnosis,
            decline_shift=self.classifier.decline_shift(evidence),
            issuer_evidence=self.classifier.issuer_evidence(evidence),
            priority_score=priority,
        )

    @staticmethod
    def _jaccard(left: LocalizedCandidate, right: LocalizedCandidate) -> float:
        union = left.member_keys | right.member_keys
        return len(left.member_keys & right.member_keys) / len(union) if union else 0.0

    @staticmethod
    def _validate_cube(leaves: list[Leaf]) -> None:
        if not leaves:
            raise ValueError("at least one cube leaf is required")
        keys = [leaf.key for leaf in leaves]
        if len(set(keys)) != len(keys):
            raise ValueError("duplicate cube leaf keys")

    @staticmethod
    def _parse_events(
        events: Iterable[PaymentEvent | Mapping[str, Any]],
    ) -> list[PaymentEvent]:
        return [
            event if isinstance(event, PaymentEvent) else PaymentEvent.from_mapping(event)
            for event in events
        ]

    @staticmethod
    def _normalise_timestamp(value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value.astimezone(timezone.utc)
