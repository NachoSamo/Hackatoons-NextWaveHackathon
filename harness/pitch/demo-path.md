# DEMO PATH — exact sequence shown during the pitch

> **Freeze BEFORE writing product code (Saturday ~13:20). This is the team's contract.**
>
> This is NOT a feature list. It is the screen-and-action sequence, step by step.
> **Anything not visible here is optional.**

## How to use it

- Feature proposed at 21:00 → *“Which demo-path step shows it?”* → if none, do not build it.
- Scope-cut checkpoint (22:30) → remove, simplify or hardcode **steps**, not isolated features.
- A hardcoded step that looks flawless is better than a half-built real step that fails live.

---

## Pre-event proposal — validate and freeze on Saturday

**Story:** the system moves from trustworthy silence to two separate diagnoses, explains the impact
for two audiences and ends with an unrehearsed incident created by the judge.

| # | What appears on screen | Presenter action | Status | Owner |
|---|---|---|---|---|
| 1 | Healthy Command Center. Live stream, actual vs. expected approval rate within range and zero incidents | Opens the app: “Variation is normal. Noise is not an incident.” | ⬜ | Juani |
| 2 | Injection panel with merchant, provider, method, country, issuer, magnitude and duration dropdowns | Injects the prepared case: one provider degrades only in Brazil | ⬜ | Samo |
| 3 | The signal enters `validating` before triggering. An incident appears with start time, severity and estimated impact | Does nothing and lets the detector react | ⬜ | Luca + Pena |
| 4 | Incident Detail converges from the global drop to `Provider X × Brazil`; shows baseline, sample, codes and confidence | Opens “Why this diagnosis?” | ⬜ | Luca + Juani |
| 5 | Two explanations of the same incident: executive one-liner and operations detail. Recommended action is visible but not executed | Switches `Executive / Operations` | ⬜ | Luca + Juani |
| 6 | A Mexican issuer fails for one merchant at the same time. Control Tower creates a second incident without mixing causes | Triggers the second prepared case | ⬜ | Samo + Luca |
| 7 | Both incidents are prioritized by impact, scope, persistence and confidence; every score is explainable | Briefly opens priority #1 | ⬜ | Juani |
| 8 | Ambiguous or low-sample case: the system shows `Insufficient evidence`, alternatives and missing data | Injects a weak-signal case | ⬜ | Luca + Juani |
| 9 | Trial by fire: the judge selects and triggers a new combination; the system detects, localizes and explains without team intervention | Hands the injection panel to the judge | ⬜ | Whole team |

Statuses: ⬜ pending · 🟡 in progress · ✅ ready · 🔧 hardcoded · ❌ cut

---

## Required fallbacks

- [ ] The stream resets to a known state with one button
- [ ] Every prepared scenario can replay from deterministic fixtures
- [ ] If OpenAI fails, a structured template renders the same evidence without a blank state
- [ ] If SSE/WebSocket disconnects, the frontend reconnects or falls back to polling
- [ ] The judge panel restricts inputs to valid combinations and never requires raw JSON
- [ ] Cost is presented as an estimate with visible assumptions, not reconciled money
- [ ] **Record a full demo-path video on Saturday around 01:30**, once it works

## Scope-cut order at 22:30

1. Never cut steps 1–5 or 9: they are the minimum challenge.
2. First cut: incident memory, if it was added outside this path.
3. Second cut: simplify step 8 to a visible confidence interval.
4. Last allowed simplification: prepare step 6 as a fixture, but still show two separate incidents
   because that is an expected challenge result.
