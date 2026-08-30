# Design System — Centinel

## Visual Authority

Centinel extends the visual and marketing family of Yuno Payments Concierge. It does not copy
that landing page. It inherits the disciplined black-and-white foundation, Geist typography,
technical grid, oversized statements and restrained electric blue-violet activity accent.

## Character

Calm payment infrastructure under pressure: precise, dark, evidence-first and quietly cinematic.
The interface should feel native to Yuno and credible to an operations specialist, not like a
generic analytics template or an AI assistant skin.

## Brand Signature

- Primary lockup: `Centinel by toons`.
- `Centinel` carries product recognition; `toons` is the creator signature, always lowercase.
- Yuno remains the target platform and visual-family reference, not the product author in the lockup.

## Palette

- `ink`: `#050505` — primary environment.
- `panel`: `#0B0B0D` — operational surfaces.
- `line`: `rgba(255,255,255,.14)` — grid, separators and chart guides.
- `text`: `#F5F5F3` — primary content.
- `muted`: `#9B9B9F` — context and secondary labels.
- `signal`: `#5964F2` — live activity, selected evidence and causal connections.
- `healthy`: `#73D3A1` — healthy state only.
- `warning`: `#F2C66D` — validating or insufficient evidence.
- `incident`: `#FF6B60` — validated degradation and destructive attention only.

Status always includes text or an icon; color never carries meaning alone.

## Typography

- Geist Sans: navigation, headings, narrative and controls.
- Geist Mono: timestamps, response codes, windows, percentages and diagnostic evidence.
- Landing uses very large, tightly tracked display text.
- Application uses tabular numerals, compact labels and a deliberate density ladder.

## Layout Grammar

- A fine global grid may continue through multiple regions.
- Landing: generous vertical space, full-width statements and one large live product proof.
- Application: thin command rail, KPI strip, dominant time comparison and prioritized incident rail.
- Incident Detail: metric-to-evidence connection is visually continuous; ownership and action are
  downstream of evidence, never floating recommendations.
- Mostly square corners and one-pixel rules. Pills are reserved for status and compact controls.
- No generic floating card wall, glassmorphism, decorative AI orb, robot, neon cyberpunk or
  uncontrolled gradient.

## Approved Compositions

- **Command Center:** composition A. Time-window comparison and live approval chart dominate;
  prioritized incidents sit on the right; selected evidence and action form the lower layer.
- **Investigation:** composition C. A dedicated temporal workspace contrasts the chart with merchant
  and provider evidence, then shows dimensional controls and the recommended next step.
- Do not merge both into one overloaded screen. A is the home; C is reached through
  `Why this diagnosis?`.

## Signature Interaction

The observed and reference lines begin aligned. When an incident starts, the observed line departs
from the reference and a signal-colored connector travels from the divergence point to the selected
incident, then to its evidence trail. This motion explains the product mechanism in one glance.

## Motion

- One orchestrated incident sequence: stream enters, line diverges, detector validates, evidence
  resolves and action becomes available.
- Fast and mechanical, never bouncy.
- No essential content starts hidden.
- Respect `prefers-reduced-motion` with an immediate final state.

## Responsive Behavior

- Desktop is the full operating environment.
- Tablet collapses evidence into a dedicated detail panel.
- Mobile landing remains complete; mobile app supports triage only: health, incident priority,
  impact, owner, summary and handoff.

## Content Rules

- Public and demo UI copy is English.
- Synthetic data is always labeled `SIMULATION MODE`.
- Claims use evidence, confidence and estimation language.
- Never present projected revenue as reconciled money or correlation as confirmed causality.
