import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  Bell,
  Check,
  ChevronDown,
  Clock3,
  Globe2,
  Pause,
  Play,
  RotateCcw,
  Send,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import "@fontsource-variable/geist";
import "@fontsource-variable/geist-mono";
import "./styles.css";
import type { IncidentRow, PaymentSlice } from "./domain";
import { formatPaymentSlice } from "./domain";

type StreamStatus = "READY" | "RUNNING" | "VALIDATING" | "PAUSED" | "COMPLETE" | "MONITORING";
type Audience = "operations" | "executive";

type Incident = {
  id: string;
  priority: "P1" | "P2";
  scope: string;
  risk: string;
  confidence: "High" | "Medium";
  impact: string;
  attempts: string;
  startedAt: string;
  declineCode: string;
  latency: string;
  slice: Partial<PaymentSlice>;
  lifecycle: Pick<IncidentRow, "endsAt" | "stoppedAt" | "mitigatedAt">;
};

const incidents: Incident[] = [
  {
    id: "provider-x-br",
    priority: "P1",
    scope: "Adyen · Brazil",
    risk: "$12.4k /h",
    confidence: "High",
    impact: "−13.2 pp",
    attempts: "1,184 (30.4%)",
    startedAt: "14:03:05 UTC",
    declineCode: "91 · Issuer Unavailable",
    latency: "3.8× baseline",
    slice: { merchantId: "rappido", providerId: "adyen", paymentMethod: "pix", country: "BR" },
    lifecycle: { endsAt: null, stoppedAt: null, mitigatedAt: null },
  },
  {
    id: "bank-y-mx",
    priority: "P2",
    scope: "Banorte · Rappido MX",
    risk: "$4.1k /h",
    confidence: "Medium",
    impact: "−4.6 pp",
    attempts: "284 (7.3%)",
    startedAt: "14:03:12 UTC",
    declineCode: "05 · Do Not Honor",
    latency: "1.1× baseline",
    slice: { merchantId: "rappido", paymentMethod: "card", country: "MX" },
    lifecycle: { endsAt: null, stoppedAt: null, mitigatedAt: null },
  },
];

const observedPath =
  "M18 80 C88 76 150 82 220 78 S350 76 420 74 S515 72 585 73 L620 78 C655 95 700 110 742 112 S830 126 902 130";
const expectedPath =
  "M18 76 C88 74 150 78 220 75 S350 76 420 73 S515 70 585 72 S700 69 770 70 S850 66 902 69";

function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <a className={`brand ${compact ? "brand--compact" : ""}`} href="/" aria-label="Centinel home">
      <span>Centinel</span>
      <span className="brand__divider" aria-hidden="true" />
      <span className="brand__powered">by <strong>toons</strong></span>
    </a>
  );
}

function SignalChart({ incidentActive, compact = false }: { incidentActive: boolean; compact?: boolean }) {
  return (
    <div className={`signal-chart ${incidentActive ? "is-running" : ""} ${compact ? "is-compact" : ""}`}>
      <div className="chart-grid" aria-hidden="true" />
      <svg viewBox="0 0 920 170" role="img" aria-label={incidentActive ? "Observed approval rate diverges from the expected reference at 14:03" : "Observed approval rate remains aligned with the expected reference"}>
        <path className="chart-reference" d={expectedPath} />
        <path className="chart-observed" d={incidentActive ? observedPath : expectedPath} />
        <line className="chart-marker" x1="620" x2="620" y1="26" y2="151" />
        <circle className="chart-pulse" cx="620" cy="78" r="6" />
      </svg>
      <div className="chart-axis" aria-hidden="true">
        <span>14:02:21</span><span>14:02:36</span><span>14:02:51</span><span>14:03:06</span><span>14:03:21</span>
      </div>
    </div>
  );
}

function IncidentCard({ incident, selected, onSelect }: { incident: Incident; selected?: boolean; onSelect: () => void }) {
  return (
    <button className={`incident-card ${selected ? "is-selected" : ""}`} type="button" onClick={onSelect}>
      <div className="incident-card__head">
        <span className={`priority priority--${incident.priority.toLowerCase()}`}>{incident.priority}</span>
        <strong>{incident.scope}</strong>
        <span className="live-dot">LIVE</span>
      </div>
      <div className="incident-card__metrics">
        <div><strong>{incident.risk}</strong><span>Revenue at risk</span></div>
        <div><strong>{incident.confidence}</strong><span>Confidence</span></div>
      </div>
      <dl>
        <div><dt>Slice</dt><dd>{formatPaymentSlice(incident.slice)}</dd></div>
        <div><dt>Started</dt><dd>{incident.startedAt}</dd></div>
        <div><dt>Impact</dt><dd>{incident.impact}</dd></div>
        <div><dt>Attempts</dt><dd>{incident.attempts}</dd></div>
      </dl>
      <span className="incident-card__link">View incident <ArrowRight size={14} /></span>
    </button>
  );
}

function CommandCenter({ preview = false }: { preview?: boolean }) {
  const [status, setStatus] = useState<StreamStatus>(preview ? "RUNNING" : "READY");
  const [incidentsVisible, setIncidentsVisible] = useState(preview);
  const [selectedIncidentId, setSelectedIncidentId] = useState<string | null>(preview ? incidents[0].id : null);
  const [investigationOpen, setInvestigationOpen] = useState(false);
  const running = status === "RUNNING";
  const streamActive = status === "RUNNING" || status === "VALIDATING" || status === "MONITORING";
  const incidentActive = preview || incidentsVisible;
  const selectedIncident = incidents.find((incident) => incident.id === selectedIncidentId) ?? incidents[0];
  const observed = incidentActive ? "72.4%" : "84.8%";
  const delta = incidentActive ? "−13.7 pp" : "−1.3 pp";

  useEffect(() => {
    if (!running || preview || incidentsVisible) return;
    const validatingTimer = window.setTimeout(() => setStatus("VALIDATING"), 1400);
    return () => window.clearTimeout(validatingTimer);
  }, [running, preview, incidentsVisible]);

  useEffect(() => {
    if (status !== "VALIDATING" || preview || incidentsVisible) return;
    const incidentTimer = window.setTimeout(() => {
      setIncidentsVisible(true);
      setSelectedIncidentId(incidents[0].id);
      setStatus("RUNNING");
    }, 1900);
    return () => window.clearTimeout(incidentTimer);
  }, [status, preview, incidentsVisible]);

  useEffect(() => {
    if (status !== "RUNNING" || preview) return;
    const timer = window.setTimeout(() => setStatus("COMPLETE"), 18000);
    return () => window.clearTimeout(timer);
  }, [status, preview]);

  const reset = () => {
    setStatus("READY");
    setIncidentsVisible(false);
    setSelectedIncidentId(null);
    setInvestigationOpen(false);
  };

  const start = () => setStatus("RUNNING");

  return (
    <section className={`command-center ${preview ? "command-center--preview" : ""}`} aria-label="Centinel payment operations command center">
      <header className="command-rail">
        <Brand compact />
        <span className="simulation-badge"><ShieldCheck size={13} /> SIMULATION MODE</span>
        <span className="command-clock"><Clock3 size={14} /> 14:03:21 UTC</span>
        <button className="ghost-control" type="button"><Globe2 size={14} /> Global <ChevronDown size={13} /></button>
        <nav className="command-nav" aria-label="Command center navigation">
          <a href="#alerts"><Bell size={14} /> Alerts <span>2</span></a>
          <a href="#reports">Reports</a>
          <a href="#settings">Settings</a>
        </nav>
      </header>

      <div className="window-rail">
        <span>Time window</span>
        <button type="button" disabled title="Fixed for the deterministic demo">Observed · Last 60 seconds <span className="micro-live">LIVE</span><ChevronDown size={13} /></button>
        <button type="button" disabled title="Fixed for the deterministic demo">Reference · Contextual 14-day baseline <ChevronDown size={13} /></button>
        <button type="button" disabled title="Fixed for the deterministic demo">Scope · All payment traffic <ChevronDown size={13} /></button>
        <div className="stream-controls">
          <button className="button button--signal" type="button" onClick={start} disabled={streamActive}>
            <Play size={15} fill="currentColor" /> {status === "READY" ? "Start live stream" : status === "PAUSED" ? "Resume stream" : status === "COMPLETE" ? "Replay stream" : "Stream running"}
          </button>
          <button type="button" onClick={() => setStatus("PAUSED")} disabled={!running}><Pause size={15} /> Pause</button>
          <button type="button" onClick={reset}><RotateCcw size={15} /> Reset</button>
        </div>
      </div>

      <div className="command-body">
        <div className="command-main">
          <div className="metric-rail">
            <div><span>Approval rate (observed)</span><strong>{observed}</strong><small>{incidentActive ? "3,900" : "3,884"} attempts</small></div>
            <div><span>Approval rate (expected)</span><strong>86.1%</strong><small>3,925 forecast attempts</small></div>
            <div title="Observed approval rate minus expected approval rate, expressed in percentage points"><span>Delta</span><strong className="signal-ink">{delta}</strong><small>{observed} observed − 86.1% expected</small></div>
            <div title="Estimated recoverable payment volume per hour, not reconciled revenue"><span>Revenue at risk</span><strong>{incidentActive ? "$16.5k" : "$0"}</strong><small>Per hour · approval gap × attempts × avg. ticket</small></div>
          </div>

          <div className="chart-panel">
            <div className="panel-heading">
              <div><strong>Approval rate over time</strong><span><i className="legend-observed" />Observed <i className="legend-reference" />Expected</span></div>
              <span className={`system-state system-state--${status.toLowerCase()}`} role="status" aria-live="polite">{status}</span>
            </div>
            <SignalChart incidentActive={incidentActive} compact={preview} />
          </div>
        </div>

        <aside className="incident-queue">
          <div className="queue-heading"><strong>Incident queue ({incidentActive ? 2 : 0})</strong><a href="#all">View all</a></div>
          {incidentActive ? incidents.map((incident) => <IncidentCard key={incident.id} incident={incident} selected={incident.id === selectedIncidentId} onSelect={() => setSelectedIncidentId(incident.id)} />) : status === "VALIDATING" ? (
            <div className="validating-empty"><span className="validating-orbit" /><strong>Validating signal</strong><span>Checking persistence, controls and sample quality before creating an incident.</span></div>
          ) : (
            <div className="healthy-empty"><Check size={19} /><strong>No active incidents</strong><span>Traffic remains inside its expected range.</span></div>
          )}
        </aside>
      </div>

      {incidentActive && <div className="selected-incident is-visible">
        <div className="selected-title"><span>Selected incident</span><strong><span className="priority priority--p1">P1</span> Adyen · Brazil</strong><span>Started 14:03:05 UTC</span></div>
        <div className="evidence-column">
          <strong>Key evidence</strong>
          <span>Approval rate drop <small>−13.2 pp vs. expected</small></span>
          <span>Provider timeout spike <small>3.8× from baseline</small></span>
          <span>Dominant decline code <small>91 · Issuer Unavailable</small></span>
          <button className="investigate-link" type="button" onClick={() => setInvestigationOpen(true)}>Investigate with Centinel <ArrowRight size={14} /></button>
        </div>
        <div className="owner-column">
          <strong>Likely owner</strong>
          <span className="owner-mark">AY</span>
          <div><b>Adyen</b><small>Provider · Brazil</small></div>
        </div>
        <div className="action-column">
          <strong>Recommended human action</strong>
          <ol>
            <li>Check Adyen status and confirm incident</li>
            <li>If confirmed, route to backup provider</li>
            <li>Notify stakeholder channel</li>
          </ol>
        </div>
      </div>}
      {investigationOpen && <InvestigationWorkspace incident={selectedIncident} onClose={() => setInvestigationOpen(false)} onMonitoring={() => setStatus("MONITORING")} />}
    </section>
  );
}

function InvestigationWorkspace({ incident, onClose, onMonitoring }: { incident: Incident; onClose: () => void; onMonitoring: () => void }) {
  const [mitigated, setMitigated] = useState(false);
  const [audience, setAudience] = useState<Audience>("operations");
  const [activePrompt, setActivePrompt] = useState("Compare the current window against its contextual baseline.");
  const [draft, setDraft] = useState("");
  const issuerCase = incident.id === "bank-y-mx";
  const view = issuerCase ? {
    title: <>Banorte declines are concentrated<br />on Rappido traffic in Mexico.</>,
    confidence: "Medium · 78%",
    signals: "3 corroborating signals",
    slice: "rappido · card · MX · issuer: banorte",
    owner: "Banorte / issuer path",
    merchantTruth: "The degradation is isolated to one merchant and issuer.",
    merchantDetail: "Other Mexican merchants and issuers remain inside their expected ranges.",
    providerTruth: "Do Not Honor responses concentrate on Banorte.",
    providerDetail: "Provider-level performance remains healthy outside this issuer cohort.",
    providerMeta: "05 · Do Not Honor · issuer evidence",
    action: "Escalate with issuer-level evidence before recommending retry.",
    evidence: [
      { source: "Merchant slice", observation: "Approval fell 4.6 pp across 284 attempts", implication: "The effect is meaningful but narrower" },
      { source: "Issuer evidence", observation: "Banorte concentrates 05 · Do Not Honor", implication: "Issuer ownership is plausible, not confirmed" },
      { source: "Healthy controls", observation: "Other MX issuers remain within ±1.0 pp", implication: "A country-wide outage is unlikely" },
    ],
  } : {
    title: <>Adyen is degrading<br />PIX approvals in Brazil.</>,
    confidence: "High · 92%",
    signals: "4 corroborating signals",
    slice: "rappido · adyen · pix · BR",
    owner: "Adyen",
    merchantTruth: "Requests leave the merchant correctly.",
    merchantDetail: "Attempt volume, amount distribution and buyer input remain consistent with the baseline.",
    providerTruth: "Issuer-unavailable responses emerge after Adyen receives traffic.",
    providerDetail: "The dominant code and latency spike appear only on this provider path.",
    providerMeta: "91 · Issuer Unavailable · P95 4,860 ms",
    action: "Escalate to Adyen with this evidence bundle.",
    evidence: [
      { source: "Merchant logs", observation: "Approval fell 13.2 pp across 1,184 affected attempts", implication: "The impact is real and concentrated" },
      { source: "Provider response", observation: "91 · Issuer Unavailable became the dominant decline code", implication: "Failure happens after Yuno routes the request" },
      { source: "Latency control", observation: "P95 latency is 3.8× the expected baseline", implication: "Provider degradation is more likely than buyer input" },
      { source: "Healthy controls", observation: "Other providers in BR remain within ±1.1 pp", implication: "Country-wide or merchant-wide failure is unlikely" },
    ],
  };

  const answer = audience === "executive"
    ? issuerCase
      ? "A narrow issuer-level decline pattern is affecting Rappido in Mexico. Evidence is still moderate, so Centinel recommends escalation before any retry decision."
      : "Adyen PIX performance in Brazil is 13.7 percentage points below its expected range, exposing an estimated $12.4k per hour. Provider escalation is recommended."
    : activePrompt.toLowerCase().includes("owner")
      ? `${view.owner} is the most likely owner. The degradation begins after routing, while comparable merchant and country controls remain healthy.`
      : activePrompt.toLowerCase().includes("next") || activePrompt.toLowerCase().includes("action")
        ? `${view.action} Keep automatic buyer retries disabled until the provider path is confirmed.`
        : issuerCase
          ? "The last 60 seconds are 4.6 pp below the contextual 14-day baseline. The deviation is concentrated on Rappido card traffic issued by Banorte; other Mexican issuer cohorts remain healthy."
          : "The last 60 seconds are 13.7 pp below the contextual 14-day baseline. The loss is concentrated on Adyen PIX traffic in Brazil, with code 91 and P95 latency at 3.8× baseline; comparable provider controls remain healthy.";

  const submitQuestion = (event: React.FormEvent) => {
    event.preventDefault();
    const question = draft.trim();
    if (!question) return;
    setActivePrompt(question);
    setDraft("");
  };

  const applyAction = () => {
    setMitigated(true);
    onMonitoring();
  };

  return (
    <div className="investigation-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="investigation-workspace" role="dialog" aria-modal="false" aria-label={`Investigation for ${incident.scope}`}>
        <header className="workspace-header">
          <div><span className="eyebrow">INCIDENT #{incident.id}</span><strong>{incident.scope}</strong></div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close investigation"><X size={18} /></button>
        </header>

        <div className="stage-rail" aria-label="Investigation progress">
          {["Observe", "Detect", "Diagnose", "Decide", "Monitor"].map((stage, index) => <span className={mitigated ? index <= 4 ? "is-complete" : "" : index < 2 ? "is-complete" : index === 2 ? "is-active" : ""} key={stage}><i>{index < 2 || mitigated ? <Check size={10} /> : index + 1}</i>{stage}</span>)}
        </div>

        <div className="workspace-body">
          <section className="workspace-evidence">
            <div className="workspace-title"><span>{mitigated ? "MONITORING RECOVERY" : "DIAGNOSIS READY"}</span><h1>{view.title}</h1><p>{view.confidence} · {view.signals}</p></div>
            <div className="workspace-metrics">
              <div><span>Observed / expected</span><strong>72.4% / 86.1%</strong></div>
              <div><span>Revenue at risk</span><strong>{incident.risk}</strong></div>
              <div><span>Likely owner</span><strong>{view.owner}</strong></div>
            </div>
            <div className="compact-truth">
              <div><span>Merchant truth</span><strong>{view.merchantTruth}</strong><small>{view.merchantDetail}</small></div>
              <div><span>Provider truth</span><strong>{view.providerTruth}</strong><small>{view.providerMeta}</small></div>
            </div>
            <div className="compact-ledger">
              <div className="compact-ledger__head"><strong>Payment truth</strong><span>Deterministic evidence</span></div>
              {view.evidence.map((item, index) => <div className="compact-evidence" key={item.source}><span>E-{String(index + 1).padStart(2, "0")}</span><div><strong>{item.source}</strong><p>{item.observation}</p></div><small>{item.implication}</small></div>)}
            </div>
          </section>

          <section className="copilot-rail">
            <div className="copilot-head"><div><Sparkles size={15} /><strong>Centinel Copilot</strong></div><span>Evidence-grounded</span></div>
            <div className="audience-switch" aria-label="Explanation audience"><button className={audience === "operations" ? "is-active" : ""} type="button" onClick={() => setAudience("operations")}>Operations</button><button className={audience === "executive" ? "is-active" : ""} type="button" onClick={() => setAudience("executive")}>Executive</button></div>
            <div className="copilot-thread">
              <div className="copilot-question"><span>You</span><p>{activePrompt}</p></div>
              <div className="copilot-answer"><span><Sparkles size={12} /> Centinel</span><p>{answer}</p><div className="evidence-chips"><button type="button">E-01 · Approval gap</button><button type="button">E-02 · Decline mix</button><button type="button">E-03 · Healthy controls</button></div><dl><div><dt>Comparison</dt><dd>60 s vs contextual 14 d</dd></div><div><dt>Confidence</dt><dd>{view.confidence}</dd></div><div><dt>Limitation</dt><dd>{issuerCase ? "Issuer ownership not confirmed" : "Provider status not externally confirmed"}</dd></div></dl></div>
            </div>
            <div className="suggested-prompts"><span>Suggested follow-ups</span><button type="button" onClick={() => setActivePrompt("Why is this provider-owned?")}>Why this owner?</button><button type="button" onClick={() => setActivePrompt("What should operations do next?")}>What should we do next?</button></div>
            <form className="copilot-input" onSubmit={submitQuestion}><input value={draft} onChange={(event) => setDraft(event.target.value)} placeholder="Ask about this incident…" aria-label="Ask Centinel about this incident" /><button type="submit" aria-label="Send question"><Send size={15} /></button></form>
            <div className="copilot-action"><span>Recommended human action</span><strong>{mitigated ? "Action applied. Monitor the approval curve." : view.action}</strong><button className="button button--light" type="button" onClick={applyAction} disabled={mitigated}>{mitigated ? "Monitoring recovery" : "Apply action (simulated)"} <ArrowRight size={14} /></button></div>
          </section>
        </div>
      </aside>
    </div>
  );
}

function Landing() {
  return (
    <main className="landing">
      <nav className="landing-nav">
        <Brand />
        <div className="landing-nav__links"><a href="#how">How it works</a><a href="#proof">Why Centinel</a></div>
        <a className="button button--light" href="/control-tower">Open control tower <ArrowRight size={15} /></a>
      </nav>

      <section className="hero">
        <div className="hero-signal" aria-hidden="true"><SignalChart incidentActive compact /></div>
        <div className="hero-copy">
          <h1>Know what’s breaking<br />before revenue disappears.</h1>
          <p>Centinel monitors payment performance in real time, isolates the smallest affected path and turns evidence into the next best human action.</p>
          <div className="hero-actions">
            <a className="button button--light" href="/control-tower">Watch the live incident <ArrowRight size={16} /></a>
            <a className="text-link" href="#how">See how the diagnosis works <ArrowDown size={15} /></a>
          </div>
          <span className="hero-note">Built for Yuno’s cross-provider view. Synthetic demo data.</span>
        </div>
        <div className="hero-preview"><CommandCenter preview /></div>
      </section>

      <section className="problem-section" id="how">
        <h2>Payment problems don’t announce themselves.</h2>
        <div className="problem-copy">
          <p>Dashboards show the symptom. Operations still has to cross providers, methods, countries and merchant logs while revenue remains exposed.</p>
          <p>Centinel finds the deviation, narrows the scope and shows why the diagnosis deserves trust.</p>
        </div>
      </section>

      <section className="mechanism-section" aria-label="How Centinel works">
        <div className="mechanism-word">Compare</div><ArrowRight aria-hidden="true" />
        <div className="mechanism-word">Detect</div><ArrowRight aria-hidden="true" />
        <div className="mechanism-word">Diagnose</div><ArrowRight aria-hidden="true" />
        <div className="mechanism-word mechanism-word--signal">Recommend</div>
      </section>

      <section className="truth-section" id="proof">
        <div className="truth-heading"><h2>One operational truth.<br />Every claim traceable.</h2><p>Centinel does not ask an LLM to guess over raw transactions. Deterministic evidence arrives first; AI translates it for the person who has to act.</p></div>
        <div className="truth-ledger">
          <div><span>Observed</span><strong>72.4%</strong><small>Last 60 seconds · 3,900 attempts</small></div>
          <div><span>Expected</span><strong>86.1%</strong><small>Contextual 14-day baseline</small></div>
          <div><span>Likely owner</span><strong>Adyen</strong><small>High confidence · 7 signals</small></div>
          <div><span>Next action</span><strong>Escalate with evidence</strong><small>No automatic remediation</small></div>
        </div>
      </section>

      <section className="contrast-section">
        <h2>From uncertainty to action.</h2>
        <div className="contrast-columns">
          <div><span>The traditional way</span><p>You know approval dropped, but not why.</p><p>Teams investigate fragmented dashboards for hours.</p><p>The merchant may discover the incident first.</p></div>
          <div className="contrast-columns__active"><span>With Centinel</span><p>See the affected path and evidence immediately.</p><p>Know the likely owner and recommended human action.</p><p>Communicate before uncertainty becomes distrust.</p></div>
        </div>
      </section>

      <section className="closing-section">
        <Activity size={30} aria-hidden="true" />
        <h2>Every rejected payment is a signal.<br />Centinel tells you which ones matter.</h2>
        <a className="button button--light" href="/control-tower">Start the simulation <ArrowRight size={16} /></a>
      </section>

      <footer><Brand compact /><span>NextWave Hackathon 2026 · Yuno × Nauta · Supported by OpenAI</span></footer>
    </main>
  );
}

function App() {
  const path = window.location.pathname;
  const isControlTower = path.startsWith("/control-tower");
  const isLegacyIncident = path.startsWith("/incidents/");
  useEffect(() => {
    if (isLegacyIncident) window.history.replaceState({}, "", "/control-tower");
  }, [isLegacyIncident]);
  const content = useMemo(() => isControlTower || isLegacyIncident
      ? <div className="app-shell"><CommandCenter /></div>
      : <Landing />, [isControlTower, isLegacyIncident]);
  return content;
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode><App /></React.StrictMode>,
);
