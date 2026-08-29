# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

TypeScript, React and Tailwind CSS in `frontend/`. Desktop-first web interface. Frontend deploy target: Vercel.

## Users

- Primary: Yuno payment-operations specialists monitoring approval performance across merchants,
  providers, methods and markets. Their job is to detect important incidents before merchants do,
  understand the likely owner and escalate with evidence.
- Secondary: merchant payment leaders who need a scoped explanation of what affects their traffic,
  the estimated impact and Yuno's recommended next step.
- Secondary: executives who need a one-line incident summary, revenue at risk and current status.
- External actor: payment providers receive evidence packages when the likely issue is on their side.

## Product Purpose

Control Tower watches payment performance, compares an observed time window with a trusted
reference, distinguishes meaningful approval-rate drops from normal variation, localizes the
smallest affected payment segment and produces an evidence-backed diagnosis and recommended next
step. Success means Yuno understands and communicates an incident before the merchant has to ask.

## Positioning

Yuno is uniquely positioned between merchants and multiple payment providers. Control Tower uses
that cross-provider visibility to contrast comparable traffic and infer likely ownership. It adds
explainable multidimensional diagnosis, evidence, uncertainty and recommended action to monitoring;
it is not another generic dashboard or an LLM guessing over raw transactions.

## Operating Context

- The primary scene is a desktop payment-operations command center.
- Approval rate is the primary metric.
- Operators compare recent traffic with an equivalent historical window, a previous period or a
  contractual threshold.
- Incidents may overlap and must remain separate and prioritized.
- Provider codes may be generic, undocumented, newly introduced or incorrectly mapped.
- Recommendations are reviewed by a human. The hackathon MVP diagnoses and recommends; it does not
  automatically remediate.
- A hidden/separate demo panel lets judges inject a valid synthetic incident without raw JSON.
- The complete demo must run without the team touching the keyboard after the judge submits input.

## Capabilities and Constraints

- Show observed window, comparison window, timezone, sample size, expected behavior and deviation.
- Support historical, previous-period and contractual comparisons in product language; the exact
  MVP subset remains an implementation decision.
- Show why an incident triggered, which dimensions explain it, alternative hypotheses, likely owner,
  confidence and missing evidence.
- Possible owners: provider, merchant, Yuno integration, issuing bank, buyer/input or unknown.
- A retry recommendation is only valid when input and merchant policy allow it. Never expose a
  generic retry action.
- Detection and localization are deterministic. OpenAI translates structured evidence into
  audience-specific explanations and recommended actions.
- The interface must include healthy, collecting-baseline, validating, diagnosing, detected,
  insufficient-evidence, monitoring-recovery and resolved states.
- Synthetic demonstration data must be clearly treated as synthetic, with no fabricated customer
  claims or production performance metrics.
- Internal docs are Spanish. Public deliverables and pitch surfaces are English.

## Brand Commitments

- Working name: Control Tower. Final name remains open.
- Operational, calm, precise and evidence-first.
- Visual and marketing authority: Yuno Payments Concierge. Extend its black/white foundation,
  Geist typography, technical grid, oversized type and restrained electric blue-violet accent
  without cloning its page.
- Landing and application are one product family: the landing is spacious and persuasive; the
  Control Tower is dense and operational.
- Avoid generic AI aesthetics, sci-fi spectacle, uncontrolled gradients, glassmorphism and
  chatbot-first composition.
- The interface must make temporal comparison and evidence memorable, not AI branding.
- Use the phrase **Payment Truth** as the product thesis: evidence-backed operational truth about
  what changed, where, why it likely changed and what a human should do next.

## Product Surfaces

- `/`: public landing. Hero, real product preview, problem, signal-to-action story, evidence and
  final CTA. Primary CTA: `Watch the live incident`.
- `/control-tower`: operational application. Command Center first; Incident Detail second.
- `/demo-control` or an equivalent separated surface: judge-only incident injection. It must not
  compete with the operator interface.
- The demo stream exposes `READY`, `RUNNING`, `PAUSED` and `COMPLETE`, with `Start live stream`,
  `Pause` and `Reset`. A persistent `SIMULATION MODE` badge makes synthetic data explicit.

## Evidence on Hand

- Challenge and technical domain: `harness/docs/05-challenges.md`,
  `harness/docs/06-dominio-pagos.md` and `harness/docs/07-decisiones-core.md`.
- Product, UX and go-to-market synthesis: `harness/docs/08-product-ux-gtm.md`.
- Frozen demo path: `harness/pitch/demo-path.md`.
- Mentor conversation transcript: `/Users/juani/Downloads/transcript`.
- No final logo, visual identity, production screenshots, customer testimonials or validated pricing
  are available. Future work must not fabricate them.

## Product Principles

1. Compare before concluding.
2. Evidence before confidence.
3. Separate diagnosis from action.
4. Say when the data is insufficient.
5. Make ownership and the next human step obvious.

## Accessibility & Inclusion

- Do not encode status with color alone.
- Use accessible contrast, visible focus, keyboard-operable controls and text alternatives for
  charts and live status.
- Localize dates, timezones, currencies and number formats explicitly.
- Respect reduced-motion preferences.
