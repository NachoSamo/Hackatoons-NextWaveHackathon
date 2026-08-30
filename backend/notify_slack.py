"""Real-time Slack alert for supported, actionable incidents.

Fires once per incident_id, as soon as the deterministic classifier confirms
a `supported` diagnosis with a real playbook action (not the `monitor`
fallback). Dedup lives entirely in this module so the explain layer stays
free of side effects: `POST /api/agent/explain` (used by the `/e2e` debug
panel) and `backend/explain/selfcheck.py` call `diagnose()` directly and
never touch Slack — only the live `diagnosis_loop` calls `notify()`.

No `SLACK_WEBHOOK_URL` in the environment -> no-op, same pattern as the
OpenAI wording pass in `backend/explain/agent.py`.
"""

from __future__ import annotations

import json
import os
from datetime import datetime, timezone
from pathlib import Path

import httpx

from backend.contracts import Diagnosis
from backend.logging_setup import log

_NOTIFIED: set[str] = set()
_SENT: list[dict[str, str]] = []  # what actually reached Slack, for the UI toast


def reset() -> None:
    """Clears the dedup set. Must run together with the engine's own reset:
    CentinelEngine.reset() restarts incident_id at INC-0001, so a stale entry
    here would silently swallow a brand-new incident in a later run."""
    _NOTIFIED.clear()
    _SENT.clear()


def recent() -> list[dict[str, str]]:
    """Alerts confirmed delivered, oldest first. The frontend animates new entries."""
    return list(_SENT)


def _text(diagnosis: Diagnosis) -> str:
    return (
        f"\U0001f6a8 *{diagnosis.headline}*\n\n{diagnosis.operations}\n\n"
        f"_Incident {diagnosis.incident_id} · simulation only_"
    )


def notify(diagnosis: Diagnosis) -> None:
    """Best-effort Slack alert. Never raises; a failed send retries on the
    next tick because the incident stays out of `_NOTIFIED` until a POST
    actually succeeds."""
    if diagnosis.diagnosis_status != "supported":
        return
    action = diagnosis.recommended_action
    if action is None or action.owner == "none":  # the catalog's `monitor` entry
        return
    if diagnosis.incident_id in _NOTIFIED:
        return
    url = os.getenv("SLACK_WEBHOOK_URL")
    if not url:
        return
    try:
        response = httpx.post(url, json={"text": _text(diagnosis)}, timeout=5)
        response.raise_for_status()
    except Exception as exc:  # noqa: BLE001
        log.warning(
            "[SLACK]    no se pudo enviar %s (%s) — reintenta en el próximo tick",
            diagnosis.incident_id, exc,
        )
        return
    _NOTIFIED.add(diagnosis.incident_id)
    _SENT.append({
        "incident_id": diagnosis.incident_id,
        "headline": diagnosis.headline,
        "action": action.title,
        "at": datetime.now(timezone.utc).isoformat(),
    })
    del _SENT[:-10]  # the toast only ever shows the newest few
    log.info("[SLACK]    alerta enviada · %s", diagnosis.incident_id)


def _demo() -> None:
    """Runnable check: `python -m backend.notify_slack`. No network — stubs httpx.post."""
    from backend.contracts import EngineOutput
    from backend.explain.build import diagnose

    fixture = json.loads(
        (Path(__file__).parent / "fixtures" / "engine_output_provider_degradation.json")
        .read_text(encoding="utf-8")
    )
    diagnosis = diagnose(EngineOutput.model_validate(fixture))[0]

    calls: list[str] = []

    class _FakeResponse:
        def raise_for_status(self) -> None:
            pass

    def _fake_post(url: str, json, timeout: float) -> _FakeResponse:
        calls.append(url)
        return _FakeResponse()

    real_post = httpx.post
    previous_env = os.environ.get("SLACK_WEBHOOK_URL")
    httpx.post = _fake_post
    os.environ["SLACK_WEBHOOK_URL"] = "https://hooks.slack.example/test"
    try:
        notify(diagnosis)
        assert len(calls) == 1, "first notify() must send"
        assert len(recent()) == 1, "a delivered alert must be visible to the UI"
        assert recent()[0]["incident_id"] == diagnosis.incident_id
        notify(diagnosis)
        assert len(calls) == 1, "same incident_id must be deduped"
        assert len(recent()) == 1, "a deduped alert must not be re-listed"
        reset()
        assert recent() == [], "reset() must clear the delivered list too"
        notify(diagnosis)
        assert len(calls) == 2, "reset() must clear the dedup set"
    finally:
        httpx.post = real_post
        if previous_env is None:
            os.environ.pop("SLACK_WEBHOOK_URL", None)
        else:
            os.environ["SLACK_WEBHOOK_URL"] = previous_env

    print("notify_slack self-check passed")


if __name__ == "__main__":
    _demo()
