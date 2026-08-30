# PITCH SCRIPT — 7 minutes

> **Format:** 2:00 product story + 5:00 live demo. Public delivery in English.
> Owner: Juani. One presenter drives the story; a second person only operates the judge injector if needed.

## Timing contract

| Time | Duration | Screen | What must land |
|---|---:|---|---|
| 0:00–0:25 | 0:25 | Landing hero | Revenue disappears before teams understand why |
| 0:25–0:55 | 0:30 | Problem section | Existing dashboards show symptoms, not ownership or action |
| 0:55–1:20 | 0:25 | Payment Truth | Yuno has the unique cross-provider position to solve it |
| 1:20–1:50 | 0:30 | Product preview | Centinel detects, diagnoses, explains and recommends; it does not remediate |
| 1:50–2:00 | 0:10 | CTA transition | Move from promise to operational proof |
| 2:00–2:20 | 0:20 | Healthy Command Center | Normal noise produces trustworthy silence |
| 2:20–2:35 | 0:15 | Judge injector | Inject prepared Adyen × Brazil degradation |
| 2:35–3:20 | 0:45 | Validating → incident | Detection, localization, impact and likely ownership |
| 3:20–4:10 | 0:50 | Investigation + Copilot | Evidence, temporal comparison, Operations / Executive, human action |
| 4:10–4:40 | 0:30 | Two incidents | Separation and explainable prioritization |
| 4:40–5:05 | 0:25 | Insufficient evidence | Honest uncertainty instead of fabricated certainty |
| 5:05–7:00 | 1:55 | Trial by fire | Judge injects an unrehearsed valid combination; team stops touching the keyboard |

## 0:00–2:00 · Product / introduction

### 0:00 — Hook

“At 3:00 a.m., a merchant does not care that approval rate dropped. They need to know what broke,
who owns it and what happens next. Today, the answer often arrives hours later — sometimes after
the merchant discovers the problem through customer complaints or Twitter.”

### 0:25 — Problem

“Payment conversion can fall inside one provider, one country, one method or one issuing bank.
Classic alerts either fire on normal variance until people ignore them, or stay silent while
revenue disappears. Dashboards show the symptom. An operations team still has to cross thousands
of transactions and several sources to reconstruct the cause.”

### 0:55 — Why Yuno

“Yuno is uniquely positioned between merchants and multiple payment providers. That means it can
compare both sides of the payment path and contrast an affected segment with healthy controls.
The raw visibility already exists. The missing layer is a shared, explainable Payment Truth.”

### 1:20 — Product

“We built Centinel by toons: a payment operations control tower that watches approval live,
distinguishes meaningful drops from normal noise, isolates the smallest affected path and turns
deterministic evidence into a diagnosis and the next best human action.”

“Centinel is AI-native, but the model never guesses over raw transactions. Statistics calculate.
AI explains. A human decides. Centinel diagnoses and recommends; it does not remediate production.”

### 1:50 — Transition

“Now let’s replace that promise with a live operational proof.”

Click `Watch the live incident`. Do not speak over the 1.45-second transition.

## 2:00–7:00 · Live demo

### 2:00 — Healthy silence

Click `Start live stream`.

“Payments are entering in real time. Observed approval moves around its contextual fourteen-day
baseline, but Centinel stays silent. Variation is normal. Noise is not an incident.”

### 2:20 — Prepared injection

Inject the prepared provider degradation: `Adyen × PIX × Brazil`.

“A provider now starts over-declining only in Brazil. Nobody refreshes a dashboard and nobody
changes a filter.”

### 2:35 — Detection and localization

Pause narration briefly while `VALIDATING` is visible.

“Centinel validates persistence, sample quality and healthy controls before creating an incident.
The detector and multidimensional localizer are deterministic: the LLM is not finding the cause.”

When the incident appears:

“The global signal has been narrowed to Adyen PIX traffic in Brazil. We can see when it began,
the approval gap, affected attempts, estimated revenue at risk and the likely owner.”

### 3:20 — Investigation and Copilot

Click `Investigate with Centinel`.

“This is not a separate dashboard. The investigation preserves the operational context and exposes
the evidence behind the conclusion: merchant-side truth, provider responses, latency and healthy
controls.”

Run the suggested comparison.

“Centinel Copilot is grounded in this immutable evidence bundle. We can ask what changed, since
when, who is affected, why ownership points to Adyen and what evidence contradicts the diagnosis.”

Switch `Operations → Executive`.

“Operations gets the full trail. An executive gets one line with impact and status. The facts do
not change with the audience.”

Show the recommendation without applying it.

“The recommendation is human-reviewed. This challenge diagnoses; it does not silently reroute real
money.”

### 4:10 — Simultaneous incidents

Return to `Live Monitoring`; trigger the prepared Mexican issuer case.

“At the same time, one Mexican issuing bank fails for a single merchant. Centinel does not merge
both drops into one vague outage. It keeps separate scopes, evidence, owners and impact, then
prioritizes them explainably.”

### 4:40 — Honest uncertainty

Trigger or open the weak-signal fixture.

“When the sample is too small, Centinel says `Insufficient evidence`, shows the alternatives and
names the data it still needs. Trust also means knowing when not to conclude.”

### 5:05 — Trial by fire

Hand control to the judge.

“Now choose any valid combination we did not rehearse. From this point on, our team will not touch
the keyboard.”

While the system reacts, only narrate visible state changes. Do not predict the diagnosis.

When complete:

“Centinel detected the deviation, isolated the affected payment path and explained the result from
traceable evidence. Yuno no longer only sees every payment. It can explain what is breaking before
the merchant has to ask.”

Stop. Do not add another closing paragraph.

## Rehearsal rules

- At 2:00 the landing must already be open; no setup is shown.
- The product introduction is a hard stop at 2:00, even if a sentence was missed.
- Historical Explore and PolicyDraft are already cut from the timed demo; describe them only in Q&A.
- The judge receives only valid dropdowns, never JSON.
- After `Inject incident`, the presenting team does not touch the keyboard.
- If OpenAI fails, use the structured explanation fallback without apologizing.
- If time reaches 5:05, jump immediately to trial by fire.

## Likely judge questions + prepared answers

- **How does this scale?** Detection runs on time buckets and aggregated dimensional slices, not by
  sending individual transactions to the model. The LLM only receives a compact evidence bundle.
- **What happens if the model is wrong?** Detection and localization are deterministic. The UI
  exposes confidence, alternatives, missing data and evidence IDs.
- **Why AI instead of rules?** Rules and statistics establish what happened. AI translates the
  evidence into contextual explanations and recommended actions for different audiences.
- **Can a prompt change production alerts?** No. It can only propose a structured `PolicyDraft`.
  Validation, replay, approval and versioning are required before activation.
- **Why is this a Yuno product?** Yuno can contrast merchant-side and provider-side behavior across
  multiple processors. A single merchant or provider does not have that same comparative view.
- **How is revenue at risk calculated?** Affected attempts × approval-rate gap × average ticket,
  normalized per hour. It is labeled as an estimate, never reconciled revenue.

## Speakers

Preferred setup: Juani owns the complete product story and visible demo narration. One technical
teammate stays ready for architecture questions; Samo owns only the judge injection surface. Maximum
two people speak during the seven minutes.
