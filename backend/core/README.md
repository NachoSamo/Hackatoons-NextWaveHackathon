# Deterministic diagnosis core

This module owns the non-LLM part of Centinel: it detects approval anomalies,
localizes concurrent root-cause slices, classifies them with explicit rules and
emits a bounded JSON contract for the playbook/RAG layer.

## Production boundary

The canonical input is the 81-leaf cube produced by Pena's data module:

```python
from backend.core import CentinelEngine

engine = CentinelEngine()
result = engine.process_cube(
    leaves=get_cube(window_s=60),
    observed_at=window_end,
    evidence_loader=get_evidence,
)
payload = result.to_dict()  # always {"incidents": [...], "errors": [...]}
```

The serialized incident contract is:

```json
{
  "incidents": [{
    "incident_id": "INC-0001",
    "incident_status": "validating | diagnosing | detected | insufficient_evidence | resolved",
    "detected_at": "ISO-8601",
    "estimated_start": "ISO-8601",
    "window": {"start": "ISO-8601", "end": "ISO-8601", "seconds": 60},
    "slice": {
      "merchant_id": null,
      "provider_id": "adyen",
      "payment_method": null,
      "country": "BR"
    },
    "diagnosis_category": "provider_degradation",
    "diagnosis_status": "supported",
    "confidence_score": 0.94,
    "confidence_level": "high",
    "priority_score": 0.91,
    "baseline_rate": 0.90,
    "observed_rate": 0.49,
    "sample_size": 430,
    "wilson_ci": [0.44, 0.54],
    "estimated_lost_approvals": {"value": 176, "window_seconds": 60},
    "decline_shift": [],
    "issuer_evidence": [],
    "reason_codes": [],
    "alternatives": [{"category": "issuer_unavailable", "score": 0.31}]
  }],
  "errors": []
}
```

Each leaf keeps observed attempts and approvals separate from their forecast:
`merchant_id`, `provider_id`, `payment_method`, `country`, `attempts`,
`approved`, `fc_attempts`, `fc_approved`, `amount_usd_sum`.

`evidence_loader(filters, window_s)` is lazy: it is invoked only after the
localizer has a candidate. The core therefore consumes issuer and decline-code
breakdowns as evidence without adding them as cube dimensions.

For isolated development, `fit_baseline(healthy_events)` plus
`process_events(window_events)` adapts raw authorization events to the same cube
contract. This fallback path does not replace `get_cube()` in the integrated
demo.

## Algorithm

1. Enumerate every observed value in the 15 non-empty cuboids of
   `merchant × provider × payment_method × country`.
2. Run a one-sided binomial CUSUM per slice against the contextual forecast.
3. Convert leaf deficits into a vector and rank Squeeze-inspired ripple fits.
4. Subtract each winning ripple from both residual deficit and available
   baseline. This residualization separates simultaneous and overlapping causes,
   including two incidents in the same country.
5. Match candidates to stateful incidents by affected-leaf Jaccard overlap and
   move them through `validating → diagnosing → detected → resolved`.
6. Apply deterministic domain rules to produce `diagnosis_category`. The LLM
   may explain this result but cannot choose or change it.

The supported taxonomy is `provider_degradation`, `issuer_unavailable`,
`issuer_over_declining`, `payment_method_outage`,
`merchant_integration_error`, `merchant_configuration`,
`insufficient_evidence` and `unclassified`.

Confidence combines statistical separation, localization fit and the matched
domain rule. It is a ranking/display score, not a formal posterior probability.

## Run the acceptance scenario

```bash
python scripts/run_core_demo.py
python scripts/run_core_demo.py --raw-smoke
```

The runner uses the team's generated Parquet artifacts and verifies:

- healthy silence;
- simultaneous BR and MX incidents with stable IDs;
- independent recovery;
- two overlapping incidents inside BR;
- an unseen `dlocal × CO` combination;
- explicit `insufficient_evidence` for a low-volume leaf;
- the optional raw-event adapter.

Weak, low-volume slices require four consecutive anomalous windows before they
become visible as `insufficient_evidence`; transient low-n noise stays silent.
The current calibration also replayed all 90 healthy generated windows without
emitting an incident. This is a fixture result, not a production false-positive
guarantee.

The implementation is intentionally in-memory for the hackathon. Persisting
CUSUM and incident state across process restarts is a post-demo concern.
