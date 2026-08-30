# Flight log — Centinel (C2 · The Control Tower)

Submission-ready decision log. Twelve decisions that define the product, each in the four fields
the organizers' form asks for: **Decision · Options considered · What we chose · Why**.

The full internal log — 89 entries in Spanish, including every UI iteration — stays in
[`decision-log.md`](decision-log.md). This file is the curated subset.

---

## 1 · Where the intelligence lives

**Decision**
Whether the LLM participates in detecting, localizing and classifying an incident.

**Options considered**
- Send raw transactions to an LLM and let it find the anomaly
- LLM proposes the root cause, deterministic code validates it
- Deterministic engine owns detection, localization and classification; the LLM never sees raw data

**What we chose**
A deterministic engine owns the entire verdict. `diagnosis_category` is decided in `backend/core`,
after localization and before any AI runs. The LLM may phrase the diagnosis but cannot choose or
change the category, the action or the confidence.

**Why**
The judges inject an unrehearsed incident live. Detection has to be correct and reproducible under
that pressure, and a model's output is neither. This also gives a defensible boundary: the core
detects, localizes and classifies; the playbook selects the action; the LLM communicates. A plain
response-code lookup would not be enough either, because the same code means different causes
depending on the shape of the slice and which control segments stay healthy.

---

## 2 · Cube dimensions

**Decision**
Whether the issuing bank is a search axis of the OLAP cube.

**Options considered**
- Five dimensions: merchant × provider × method × country × issuer
- Four dimensions, issuer attached as evidence of the winning slice

**What we chose**
Four dimensions. The issuer enters as evidence of the winning slice, the same way the decline code
does.

**Why**
Adding the issuer multiplies the cube's leaves and the search space without changing the story we
tell: the operator still needs to know *which path* is failing, and the issuer answers *why* rather
than *where*. Recommended to us by the mentors, and it kept the localizer tractable in the time
available.

---

## 3 · Detecting a drop

**Decision**
How to tell a real approval-rate drop from normal variance.

**Options considered**
- Fixed threshold on the approval rate
- Percentage delta against the same hour yesterday
- One-sided binomial CUSUM per slice, over the residual against a contextual baseline

**What we chose**
A one-sided binomial CUSUM per slice, with an hourly baseline and independent state per country.

**Why**
Approval rate is born from binomial successes over attempts, so using both counts folds volume into
the decision: a drop across 5 attempts and a drop across 500 stop being treated alike. A fixed
threshold would fire on every quiet hour of the diurnal profile. Independent state per country lets
two simultaneous incidents open, rank and resolve without mixing identities.

---

## 4 · Two incidents at once

**Decision**
How to separate two simultaneous incidents that share country and cube leaves.

**Options considered**
- Report the union as one large incident
- Promote issuer and decline code to cube dimensions so the slices stop overlapping
- Ask the LLM to disambiguate
- Multiplicative residualization: after picking a cause, discount its ripple before searching again

**What we chose**
Multiplicative residualization. Once a cause wins, the localizer subtracts its ripple from both the
deficit and the still-available baseline, then searches for the next one.

**Why**
Merging them hides one of the two failures from the operator. Adding dimensions inflates the cube
for a case that appears rarely. Handing the ambiguity to the LLM breaks the reproducibility of the
whole engine. Residualization solves it inside the deterministic layer, which is where the trial by
fire needs it to be solved.

---

## 5 · Showing statistical certainty

**Decision**
How the interface shows whether an observed drop is signal or noise.

**Options considered**
- Plot expected as a single line and let the reader judge the gap
- Show a confidence number next to the chart
- Draw a 95% prediction band around the expected rate

**What we chose**
A 95% prediction band: `p ± 1.96·√(p(1−p)/n)`, with `n` taken from the 60-second window
(≈3,900 attempts), not from the individual point (≈65). Computed client-side; it does not touch
detection or localization.

**Why**
Without the band, the judge has to eyeball whether a gap between observed and expected means
anything. The band makes visible the same statistical certainty the engine already uses internally.
Using the window's `n` rather than the point's matters: the plotted series is the rolling 60-second
rate, so the point's `n` would produce a band eight times wider — lying in the comfortable
direction.

---

## 6 · Who writes the headline

**Decision**
Which parts of the diagnosis text the LLM is allowed to produce.

**Options considered**
- The LLM writes the full diagnosis, including the headline
- The LLM writes everything, validated against a schema
- The headline is a deterministic template; the LLM only phrases the two audience narratives

**What we chose**
The headline is built from a template (situation + slice + money at risk). The LLM writes only
`executive`, `operations` and the action rationale. With no API key, no `pydantic-ai`, an error or a
timeout, Jinja templates render the same evidence and the same action.

**Why**
We tried letting the model write the headline and it put the *recommended action* where the
*situation* belonged — the single line the judge reads first was the least reliable one. Making it
a template also means the money figure on screen always comes from the cost calculation, never from
a model.

---

## 7 · Choosing the remediation

**Decision**
How the recommended action is selected.

**Options considered**
- The LLM proposes the action freely
- The LLM picks from a list we provide
- Deterministic lookup from a YAML catalog keyed by `diagnosis_category`

**What we chose**
A YAML catalog with one entry per category, selected deterministically. Each entry carries owner,
parameters to change, expected impact and re-evaluation window. Insufficient evidence maps to a
`monitor` entry that recommends no operational change.

**Why**
The mentors were explicit that a high-quality recommended action is where the product's value is
judged. A catalog gives us control over that quality and keeps the recommendation auditable. It
also makes the honest case possible: when evidence is weak the system recommends monitoring rather
than inventing an intervention.

---

## 8 · Diagnose versus execute

**Decision**
Whether the system applies the remediation it recommends.

**Options considered**
- Execute the reroute automatically
- Execute it behind a human confirmation
- Show it, with an explicitly simulated apply button

**What we chose**
The action is displayed with an "apply (simulated)" button and a persistent `SIMULATION MODE`
badge. Every action carries `simulation_only: true`.

**Why**
The challenge asks for diagnosis, not remediation, and payment routing is not something a
prototype should touch. Marking the simulation explicitly is what lets us show the effect on the
stream without a judge being able to say we blurred the line.

---

## 9 · Database dependency

**Decision**
Whether the live demo depends on PostgreSQL.

**Options considered**
- PostgreSQL as the source of truth for the cube and the evidence
- In-memory ring buffer first, PostgreSQL as a cold archive

**What we chose**
Ring-first. `get_evidence` and `money_lost` read the in-memory ring buffer whenever the replayer is
running; `connect()` carries a 2-second timeout. The demo runs end to end with no database.

**Why**
A filtered 5432 port hung `/api/evidence` and stalled the diagnosis loop for about 150 seconds — on
a conference network that is a dead demo. Removing the database from the critical path removed the
single dependency we could not control on site. PostgreSQL stays as a cold transaction archive for
auditability.

---

## 10 · What reaches the team channel

**Decision**
Which incidents trigger a real Slack alert to the dev channel.

**Options considered**
- Every incident the engine tracks
- Everything above a confidence threshold
- Only `supported` diagnoses that carry a real catalog action

**What we chose**
Only diagnoses the deterministic classifier resolved: status `supported` **and** a real action
(not the `monitor` fallback). Deduplicated by `incident_id`, so an incident open for minutes sends
one message, not one per five-second window.

**Why**
The whole promise is "before it shows up on X.com" — an alert that fires on low-volume noise or on
drops no domain rule explains stops being an alert and becomes spam. The gate is the same one the
UI uses to declare an incident, so the screen and the channel can never contradict each other.
Without deduplication a two-minute incident would have sent about 24 messages.

---

## 11 · What the Copilot may say

**Decision**
How far the conversational Copilot can go when answering an operator's question.

**Options considered**
- Give the LLM access to raw transactions and let it compute answers
- Keyword matching over the resolved diagnosis, no LLM
- LLM constrained to the evidence bundle, with the keyword path as fallback

**What we chose**
The LLM answers only from the supplied evidence bundle, using the same domain rules that wrote the
diagnosis. It cannot re-run detection or change the diagnosis, category or action. Out-of-scope
questions are flagged rather than guessed. The interface renders a deterministic answer first and
replaces it only if the model responds in time.

**Why**
The judges will test exactly this: asking something the evidence cannot support. Answering "that is
outside this evidence bundle, here is what I can tell you" is stronger than a confident invention.
Sharing the rule base with the explanation layer means the Copilot cannot contradict on screen what
that same base already wrote. Rendering the deterministic answer first means there is never a
loading spinner, and a failed API call is invisible to the audience.

---

## 12 · The shape of the product

**Decision**
Whether Centinel presents itself as a dashboard.

**Options considered**
- A metrics dashboard with alerting
- A conversational assistant over payment data
- A guided investigation: watch → validate → diagnose → decide

**What we chose**
A guided investigation. The interface carries the operator from anomaly to a defensible decision,
with the Copilot as a contextual rail on the incident rather than a chat replacing the screen.

**Why**
Both briefs point the same way: the winning shape is not more metrics, it is fragmented data turned
into an explanation and an action. A dashboard shows the symptom and leaves the operator to cross
providers, methods, countries and merchant logs while revenue is exposed. The value we can
demonstrate in five minutes is conducting that path, not rendering more charts.
