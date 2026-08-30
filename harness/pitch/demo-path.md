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

**Story:** the public promise becomes a live operational proof. The system moves from trustworthy
silence to a guided investigation: it detects, localizes, compares the active window against its
contextual baseline, explains the evidence for two audiences and recommends the next human action.
It ends with an unrehearsed incident created by the judge.

| # | What appears on screen | Presenter action | Status | Owner |
|---|---|---|---|---|
| 0 | Public landing page with the promise, a real product preview and `Watch the live incident` CTA | Opens the pitch on the landing, then clicks the CTA when the live demo begins | ⬜ | Juani |
| 1 | Command Center in `SIMULATION MODE`, state `READY`, with `Start live stream` visible | Starts the stream. Approved and rejected synthetic records enter in real time and settle inside the expected range: “Variation is normal. Noise is not an incident.” | ⬜ | Juani |
| 2 | Compact demo control with prepared scenarios and a separate judge mode for valid dimensional combinations | Injects the prepared case: one provider degrades only in Brazil | 🟡 | Samo + Juani |
| 3 | The signal enters `validating` before triggering. An incident appears with start time, severity and estimated impact | Does nothing and lets the detector react | ⬜ | Luca + Pena |
| 4 | Incident Detail converges from the global drop to `Provider X × Brazil`; the investigation stage changes to `Diagnose` and shows baseline, sample, codes, healthy controls and confidence | Opens `Investigate with Centinel` | ⬜ | Luca + Juani |
| 5 | A contextual Copilot rail opens a structured Comparison Workspace: current 60 s against the contextual baseline, explicit scope/sample/UTC and session query history. Its answer states confidence and limitations, assigns likely ownership and proposes the next human action | Runs the suggested comparison, shows a second query in the same session, then switches `Operations / Executive` over the same evidence bundle | 🟡 | Luca + Juani |
| 5A | `Explore` compares two custom historical windows over an explicit payment scope; the result can become a structured `PolicyDraft`, never an active alert from a prompt | Cut from the seven-minute UI to protect the required detection and trial-by-fire story | ❌ | Juani |
| 6 | A Mexican issuer fails for one merchant at the same time. Centinel creates a second incident without mixing causes | Triggers the second prepared case | ⬜ | Samo + Luca |
| 7 | Both incidents are prioritized by impact, scope, persistence and confidence; every score is explainable | Briefly opens priority #1 | ⬜ | Juani |
| 8 | Ambiguous or low-sample case: the system shows `Insufficient evidence`, alternatives and missing data | Injects a weak-signal case | ⬜ | Luca + Juani |
| 9 | Trial by fire: the judge selects and triggers a new combination; the system detects, localizes and explains without team intervention | Hands the injection panel to the judge | ⬜ | Whole team |

Statuses: ⬜ pending · 🟡 in progress · ✅ ready · 🔧 hardcoded · ❌ cut

---

## Required fallbacks

- [ ] Stream controls are visible and deterministic: `Start live stream`, `Pause`, `Reset`
- [ ] Persistent `SIMULATION MODE` badge; synthetic data is never presented as customer production data
- [ ] The stream resets to a known state with one button
- [ ] Every prepared scenario can replay from deterministic fixtures
- [ ] If OpenAI fails, a structured template renders the same evidence without a blank state
- [ ] The Copilot never calculates metrics from raw transactions: it explains backend aggregates and references evidence IDs
- [ ] The scripted comparison remains usable through suggested prompts and a deterministic response if free-form chat is unavailable
- [ ] If SSE/WebSocket disconnects, the frontend reconnects or falls back to polling
- [ ] The judge panel restricts inputs to valid combinations and never requires raw JSON
- [ ] Cost is presented as an estimate with visible assumptions, not reconciled money
- [ ] **Record a full demo-path video on Saturday around 01:30**, once it works

## Scope-cut order at 22:30

1. Never cut steps 1–5 or 9: they are the minimum challenge. Step 0 may become a static opening frame,
   but the landing and app must still share the same visual system.
2. Step 5A (`Explore + PolicyDraft`) is already cut from the timed pitch; do not restore it before the required path is fully rehearsed.
3. Second cut: incident memory, if it was added outside this path.
4. Third cut: simplify step 8 to a visible confidence interval.
5. Last allowed simplification: prepare step 6 as a fixture, but still show two separate incidents
   because that is an expected challenge result.
