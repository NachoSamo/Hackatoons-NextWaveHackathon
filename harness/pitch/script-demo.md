# PITCH SCRIPT — 3 minutes

> Owner: Juani. Finalize **after dinner on Saturday**, not on Sunday.
> Mixed jury: Yuno + Nauta + OpenAI + mentors. Some judge impact; others judge architecture.

| Time | Section | Content |
|---|---|---|
| 0:00–0:30 | **Problem (X)** | Who suffers, through one concrete human example—not an abstraction |
| 0:30–1:00 | **Solution (Y)** | One sentence: “This helps X with Y” + why it is genuinely AI-native |
| 1:00–2:00 | **Live demo** | The demo path, rehearsed with no improvisation |
| 2:00–2:30 | **Architecture** | Roughly 20 seconds per layer, supported by the diagram |
| 2:30–3:00 | **Impact + close** | Metric: time saved, revenue protected or errors avoided + next step |

---

## Script

> **Pre-event draft.** Replace metrics and product name with the values validated during the build.

### 0:00 — Problem

“A payment conversion drop rarely announces itself. It starts inside one provider, one country or
one issuing bank, while every minute means lost sales. Dashboards show the symptom. A tired
operations team still has to cross thousands of transactions to understand the cause — and the
merchant may discover it first through customer complaints.”

### 0:30 — Solution

“We built Centinel: explainable incident intelligence for Yuno. It watches the live payment
stream, distinguishes meaningful drops from normal variation, isolates the smallest affected
segment and turns the evidence into a diagnosis, estimated impact and recommended next step. It
never hides uncertainty, and it never executes a remediation without a human.”

### 1:00 — Demo

“Right now the stream is healthy. The rate moves, but Centinel stays silent because variation
is not an incident.”

“Now a provider starts over-declining only in Brazil. The detector validates that the drop is
persistent, then the localizer compares merchant, provider, method, country and issuer. It isolates
the affected path and shows the evidence behind that conclusion.”

“Operations gets the full diagnosis. An executive gets one line with the money at risk. When a
second issuer incident appears in Mexico for a single merchant, Centinel separates both stories
and prioritizes them.”

“And when the sample is not strong enough, it says so instead of inventing a cause.”

“Now the judge can inject a combination we did not rehearse.”

### 2:00 — Architecture

“A deterministic generator feeds a live transaction stream. A seasonal baseline and CUSUM detect
meaningful deviation. Our multidimensional localizer simulates which smallest segment best explains
the observed ripple. OpenAI does not guess over raw transactions: it receives structured evidence
and produces audience-specific explanations and actions. Every claim remains traceable to the
underlying aggregates.”

### 2:30 — Impact

“Yuno already has the unique view across providers. Centinel turns that visibility into
operational trust: less time blind, fewer hours crossing dashboards and faster, evidence-backed
communication with merchants. Yuno no longer only sees every payment — it can explain what is
breaking before revenue disappears.”

---

## Likely judge questions + prepared answers
- How does this scale? → Detection is computed on time buckets and aggregated dimensional slices,
  not by sending individual transactions to the model. The LLM only processes compact incident
  evidence after a detector fires.
- What happens if the model is wrong? → Detection and localization are deterministic. The model
  receives a bounded evidence object, and the UI shows confidence, alternatives and missing data.
- Why AI instead of rules? → Rules and statistics establish what happened. AI turns that structured
  evidence into contextual explanations and recommended actions for different audiences. Neither
  layer replaces the other.
- How does it integrate with legacy systems? → It consumes Yuno's normalized transaction events and
  emits incidents through an API and notification channels; providers and merchants do not need a
  new point-to-point integration.
- Why isn't this just Monitors? → Monitors detects anomalies and can redistribute traffic. Control
  Centinel adds multidimensional root-cause localization, evidence, uncertainty and incident memory.
- How do you estimate lost revenue? → It is an estimate: affected attempts × approval-rate gap ×
  average ticket. The assumptions are visible and the value is never presented as reconciled money.

## Speakers
Decide **by performance** on Saturday night: everyone delivers the full pitch once, then the team
votes. Maximum two people on stage.
