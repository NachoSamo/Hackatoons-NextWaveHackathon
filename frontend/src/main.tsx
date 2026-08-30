import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import { E2EPanel } from "./e2e";
import { useLive } from "./useLive";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  Bell,
  CalendarRange,
  Check,
  ChevronDown,
  Clock3,
  Globe2,
  Pause,
  Play,
  RotateCcw,
  Search,
  Send,
  ShieldCheck,
  SlidersHorizontal,
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
type AnalysisMode = "live" | "explore";

type AnalysisQuery = {
  observedFrom: string;
  observedTo: string;
  referenceFrom: string;
  referenceTo: string;
  merchant: string;
  provider: string;
  method: string;
  country: string;
};

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

const liveScopeOptions = {
  all: { label: "All payment traffic", title: "Approval rate across all payment traffic", healthy: 84.8, incident: 72.4, attempts: 3884, risk: "$16.5k" },
  pix_br: { label: "PIX · Brazil", title: "PIX approval rate in Brazil", healthy: 85.2, incident: 74.1, attempts: 1640, risk: "$12.4k" },
  adyen_br: { label: "Adyen · Brazil", title: "Adyen approval rate in Brazil", healthy: 84.9, incident: 68.7, attempts: 1184, risk: "$12.4k" },
  rappido_mx: { label: "Rappido · Mexico", title: "Rappido approval rate in Mexico", healthy: 86.4, incident: 81.5, attempts: 284, risk: "$4.1k" },
} as const;

const liveWindowOptions = {
  "60s": { label: "Last 60 sec", context: "Last 60 seconds", multiplier: 1 },
  "5m": { label: "Last 5 min", context: "Last 5 minutes", multiplier: 5 },
  "15m": { label: "Last 15 min", context: "Last 15 minutes", multiplier: 15 },
} as const;

const liveReferenceOptions = {
  contextual: { label: "14-day baseline", context: "Contextual 14-day baseline", rate: 86.1 },
  previous: { label: "Previous period", context: "Previous equivalent period", rate: 85.7 },
  threshold: { label: "Contract threshold", context: "Contractual threshold", rate: 82.0 },
} as const;

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
  const [analysisMode, setAnalysisMode] = useState<AnalysisMode>("live");
  const [liveObservedWindow, setLiveObservedWindow] = useState<keyof typeof liveWindowOptions>("60s");
  const [liveReference, setLiveReference] = useState<keyof typeof liveReferenceOptions>("contextual");
  const [liveScope, setLiveScope] = useState<keyof typeof liveScopeOptions>("all");
  const [queryText, setQueryText] = useState("Compare PIX approvals in Brazil over the last 2 hours against August 22 at the same time.");
  const [queryParsed, setQueryParsed] = useState(false);
  const [analysisApplied, setAnalysisApplied] = useState(false);
  const [policyOpen, setPolicyOpen] = useState(false);
  const [analysisQuery, setAnalysisQuery] = useState<AnalysisQuery>({
    observedFrom: "2026-08-29T12:00",
    observedTo: "2026-08-29T14:00",
    referenceFrom: "2026-08-22T12:00",
    referenceTo: "2026-08-22T14:00",
    merchant: "all",
    provider: "all",
    method: "pix",
    country: "BR",
  });
  const running = status === "RUNNING";
  const exploring = analysisMode === "explore";
  const streamActive = status === "RUNNING" || status === "VALIDATING" || status === "MONITORING";
  // Datos vivos del backend (motor + explain). Si no hay nada, cae al mock.
  const live = useLive(streamActive && !preview);
  const feed = live.incidents.length ? live.incidents : incidents;
  const hasLiveIncidents = live.incidents.length > 0;
  const incidentActive = preview || incidentsVisible || hasLiveIncidents;
  const selectedIncident = feed.find((incident) => incident.id === selectedIncidentId) ?? feed[0];
  const liveWindow = liveWindowOptions[liveObservedWindow];
  const referenceProfile = liveReferenceOptions[liveReference];
  const scopeProfile = liveScopeOptions[liveScope];
  const comparisonActive = exploring && analysisApplied;
  const chartDiverges = incidentActive || comparisonActive;
  const liveObserved = incidentActive ? scopeProfile.incident : scopeProfile.healthy;
  const liveExpected = referenceProfile.rate;
  const liveDelta = liveObserved - liveExpected;
  const observed = comparisonActive ? "78.9%" : `${liveObserved.toFixed(1)}%`;
  const expected = comparisonActive ? "85.4%" : `${liveExpected.toFixed(1)}%`;
  const delta = comparisonActive ? "−6.5 pp" : `${liveDelta < 0 ? "−" : "+"}${Math.abs(liveDelta).toFixed(1)} pp`;
  const attempts = comparisonActive ? "11,482" : Math.round(scopeProfile.attempts * liveWindow.multiplier).toLocaleString("en-US");
  const expectedAttempts = comparisonActive ? "11,530 reference attempts" : `${Math.round(scopeProfile.attempts * liveWindow.multiplier * 1.01).toLocaleString("en-US")} reference attempts`;
  const risk = comparisonActive ? "$8.2k" : incidentActive ? scopeProfile.risk : "$0";

  useEffect(() => {
    if (!running || preview || incidentsVisible || hasLiveIncidents) return;
    const validatingTimer = window.setTimeout(() => setStatus("VALIDATING"), 1400);
    return () => window.clearTimeout(validatingTimer);
  }, [running, preview, incidentsVisible, hasLiveIncidents]);

  useEffect(() => {
    if (status !== "VALIDATING" || preview || incidentsVisible || hasLiveIncidents) return;
    const incidentTimer = window.setTimeout(() => {
      setIncidentsVisible(true);
      setSelectedIncidentId(incidents[0].id);
      setStatus("RUNNING");
    }, 1900);
    return () => window.clearTimeout(incidentTimer);
  }, [status, preview, incidentsVisible, hasLiveIncidents]);

  // El primer incidente vivo selecciona solo y saca a la UI de VALIDATING.
  useEffect(() => {
    if (!hasLiveIncidents) return;
    setSelectedIncidentId((current) => current ?? live.incidents[0].id);
    setStatus((s) => (s === "VALIDATING" || s === "READY" ? "RUNNING" : s));
  }, [hasLiveIncidents, live.incidents]);

  useEffect(() => {
    if (status !== "RUNNING" || preview) return;
    const timer = window.setTimeout(() => setStatus("COMPLETE"), 18000);
    return () => window.clearTimeout(timer);
  }, [status, preview]);

  const reset = () => {
    void live.reset();
    setStatus("READY");
    setIncidentsVisible(false);
    setSelectedIncidentId(null);
    setInvestigationOpen(false);
    setAnalysisMode("live");
    setAnalysisApplied(false);
    setQueryParsed(false);
    setPolicyOpen(false);
    setLiveObservedWindow("60s");
    setLiveReference("contextual");
    setLiveScope("all");
  };

  const start = () => setStatus("RUNNING");
  const updateQuery = (field: keyof AnalysisQuery, value: string) => setAnalysisQuery((current) => ({ ...current, [field]: value }));
  const interpretQuery = () => {
    setAnalysisQuery((current) => ({ ...current, method: "pix", country: "BR" }));
    setQueryParsed(true);
  };
  const runAnalysis = () => {
    setQueryParsed(true);
    setAnalysisApplied(true);
  };

  return (
    <section className={`command-center mode--${analysisMode} ${preview ? "command-center--preview" : ""}`} aria-label="Centinel payment operations command center">
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

      <div className={`query-surface ${exploring ? "is-explore" : ""}`}>
        <div className="query-toolbar">
          <div className="mode-switch" aria-label="Analysis mode">
            <button className={!exploring ? "is-active" : ""} type="button" onClick={() => setAnalysisMode("live")}>Live monitoring</button>
            <button className={exploring ? "is-active" : ""} type="button" onClick={() => setAnalysisMode("explore")}>Explore</button>
          </div>
          {!exploring ? <>
            <label className="live-query-control"><span>Observed</span><select aria-label="Observed live window" value={liveObservedWindow} onChange={(event) => setLiveObservedWindow(event.target.value as keyof typeof liveWindowOptions)}>{Object.entries(liveWindowOptions).map(([value, option]) => <option value={value} key={value}>{option.label}</option>)}</select><i>LIVE</i><ChevronDown size={13} /></label>
            <label className="live-query-control"><span>Reference</span><select aria-label="Live reference" value={liveReference} onChange={(event) => setLiveReference(event.target.value as keyof typeof liveReferenceOptions)}>{Object.entries(liveReferenceOptions).map(([value, option]) => <option value={value} key={value}>{option.label}</option>)}</select><ChevronDown size={13} /></label>
            <label className="live-query-control"><span>Scope</span><select aria-label="Live payment scope" value={liveScope} onChange={(event) => setLiveScope(event.target.value as keyof typeof liveScopeOptions)}>{Object.entries(liveScopeOptions).map(([value, option]) => <option value={value} key={value}>{option.label}</option>)}</select><ChevronDown size={13} /></label>
            <div className="stream-controls">
              <button className="button button--signal" type="button" onClick={start} disabled={streamActive}>
                <Play size={15} fill="currentColor" /> {status === "READY" ? "Start live stream" : status === "PAUSED" ? "Resume stream" : status === "COMPLETE" ? "Replay stream" : "Stream running"}
              </button>
              <button type="button" onClick={() => setStatus("PAUSED")} disabled={!running}><Pause size={15} /> Pause</button>
              <button type="button" onClick={reset}><RotateCcw size={15} /> Reset</button>
            </div>
            <div className="stream-controls" aria-label="Inject incident (demo)">
              <button type="button" onClick={() => { setStatus("RUNNING"); void live.injectPreset("provider_br"); }}>Inject · Provider BR</button>
              <button type="button" onClick={() => { setStatus("RUNNING"); void live.injectPreset("issuer_mx"); }}>Inject · Issuer MX</button>
            </div>
          </> : <>
            <form className="query-composer" onSubmit={(event) => { event.preventDefault(); interpretQuery(); }}>
              <Sparkles size={15} />
              <input value={queryText} onChange={(event) => setQueryText(event.target.value)} aria-label="Describe an analysis" />
              <button type="submit">Interpret query <ArrowRight size={13} /></button>
            </form>
            <span className="query-safety"><ShieldCheck size={13} /> Analysis only · detector unchanged</span>
          </>}
        </div>
        {exploring && <div className="explore-controls">
          <label><span>Observed range</span><div><input type="datetime-local" value={analysisQuery.observedFrom} onChange={(event) => updateQuery("observedFrom", event.target.value)} /><i>→</i><input type="datetime-local" value={analysisQuery.observedTo} onChange={(event) => updateQuery("observedTo", event.target.value)} /></div></label>
          <label><span>Reference range</span><div><input type="datetime-local" value={analysisQuery.referenceFrom} onChange={(event) => updateQuery("referenceFrom", event.target.value)} /><i>→</i><input type="datetime-local" value={analysisQuery.referenceTo} onChange={(event) => updateQuery("referenceTo", event.target.value)} /></div></label>
          <div className="scope-controls"><span>Scope</span><select aria-label="Merchant" value={analysisQuery.merchant} onChange={(event) => updateQuery("merchant", event.target.value)}><option value="all">All merchants</option><option value="rappido">Rappido</option><option value="tiendita">Tiendita</option><option value="streamplus">Streamplus</option></select><select aria-label="Provider" value={analysisQuery.provider} onChange={(event) => updateQuery("provider", event.target.value)}><option value="all">All providers</option><option value="adyen">Adyen</option><option value="dlocal">dLocal</option><option value="mercadopago">MercadoPago</option></select><select aria-label="Payment method" value={analysisQuery.method} onChange={(event) => updateQuery("method", event.target.value)}><option value="all">All methods</option><option value="pix">PIX</option><option value="card">Card</option><option value="pse">PSE</option></select><select aria-label="Country" value={analysisQuery.country} onChange={(event) => updateQuery("country", event.target.value)}><option value="all">All countries</option><option value="BR">Brazil</option><option value="MX">Mexico</option><option value="CO">Colombia</option></select></div>
          <button className="run-analysis" type="button" onClick={runAnalysis}><Search size={14} /> Run analysis</button>
          <div className={`query-preview ${queryParsed ? "is-ready" : ""}`}><CalendarRange size={13} /><span>{analysisQuery.method === "pix" ? "PIX" : "Payment"} approval · {analysisQuery.country === "BR" ? "Brazil" : "Selected markets"}</span><small>Custom observed vs custom reference · UTC</small></div>
        </div>}
      </div>

      <div className="command-body">
        <div className="command-main">
          <div className="metric-rail">
            <div><span>Approval rate (observed)</span><strong>{observed}</strong><small>{attempts} attempts</small></div>
            <div><span>Approval rate (reference)</span><strong>{expected}</strong><small>{expectedAttempts}</small></div>
            <div title="Observed approval rate minus reference approval rate, expressed in percentage points"><span>Delta</span><strong className="signal-ink">{delta}</strong><small>{observed} observed − {expected} reference</small></div>
            <div title="Estimated recoverable payment volume per hour, not reconciled revenue"><span>Revenue at risk</span><strong>{risk}</strong><small>Estimated per hour · assumptions visible</small></div>
          </div>

          <div className="chart-panel">
            <div className="panel-heading">
              <div><strong>{comparisonActive ? "PIX approval rate in Brazil" : scopeProfile.title}</strong><span className="chart-context">{comparisonActive ? "Aug 29, 12:00–14:00 vs Aug 22, 12:00–14:00 · UTC" : `${liveWindow.context} vs ${referenceProfile.context} · UTC · View only`}</span><span><i className="legend-observed" />Observed <i className="legend-reference" />Reference</span></div>
              <div className="chart-actions">{comparisonActive && <button type="button" onClick={() => setPolicyOpen(true)}><SlidersHorizontal size={13} /> Create alert from this analysis</button>}<span className={`system-state system-state--${status.toLowerCase()}`} role="status" aria-live="polite">{comparisonActive ? "ANALYSIS READY" : status}</span></div>
            </div>
            <SignalChart incidentActive={chartDiverges} compact={preview} />
          </div>
        </div>

        <aside className="incident-queue">
          <div className="queue-heading"><strong>{exploring ? "Analysis findings" : `Incident queue (${incidentActive ? feed.length : 0})`}</strong><a href="#all">{exploring ? "Export" : "View all"}</a></div>
          {exploring ? comparisonActive ? <div className="analysis-finding"><span>SIGNIFICANT DEVIATION</span><h3>PIX approval is 6.5 pp below the selected reference.</h3><p>The loss concentrates on Adyen traffic in Brazil. Other providers remain inside the expected range.</p><dl><div><dt>Sample</dt><dd>11,482 attempts</dd></div><div><dt>Estimated impact</dt><dd>$8.2k /h</dd></div><div><dt>Confidence</dt><dd>High · 89%</dd></div></dl><button type="button" onClick={() => setPolicyOpen(true)}>Create an alert for this pattern <ArrowRight size={13} /></button></div> : <div className="explore-empty"><CalendarRange size={20} /><strong>Define a comparison</strong><span>Select two ranges and a scope, then run the analysis.</span></div> : incidentActive ? feed.map((incident) => <IncidentCard key={incident.id} incident={incident} selected={incident.id === selectedIncidentId} onSelect={() => setSelectedIncidentId(incident.id)} />) : status === "VALIDATING" ? (
            <div className="validating-empty"><span className="validating-orbit" /><strong>Validating signal</strong><span>Checking persistence, controls and sample quality before creating an incident.</span></div>
          ) : (
            <div className="healthy-empty"><Check size={19} /><strong>No active incidents</strong><span>Traffic remains inside its expected range.</span></div>
          )}
        </aside>
      </div>

      {!exploring && incidentActive && <div className="selected-incident is-visible">
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
      {policyOpen && <PolicyDraftPanel query={analysisQuery} onClose={() => setPolicyOpen(false)} />}
    </section>
  );
}

function PolicyDraftPanel({ query, onClose }: { query: AnalysisQuery; onClose: () => void }) {
  const [threshold, setThreshold] = useState("8");
  const [duration, setDuration] = useState("90");
  const [minImpact, setMinImpact] = useState("5000");
  const [replayStatus, setReplayStatus] = useState<"idle" | "running" | "done">("idle");
  const [saved, setSaved] = useState(false);

  const runReplay = () => {
    setReplayStatus("running");
    window.setTimeout(() => setReplayStatus("done"), 900);
  };

  return (
    <div className="policy-scrim" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <aside className="policy-panel" role="dialog" aria-modal="false" aria-label="Alert policy draft">
        <header className="policy-header"><div><SlidersHorizontal size={16} /><strong>Alert policy draft</strong><span>DRAFT · NOT ACTIVE</span></div><button className="icon-button" type="button" onClick={onClose} aria-label="Close alert policy"><X size={18} /></button></header>
        <div className="policy-intent"><span>Created from analysis</span><h2>Alert me when this payment pattern degrades again.</h2><p>Centinel translated the active comparison into a structured proposal. Review every field before testing it.</p></div>
        <div className="policy-fields">
          <label><span>Metric</span><input value="Approval rate delta" disabled /></label>
          <label><span>Scope</span><input value={`${query.method.toUpperCase()} · ${query.country} · All merchants · All providers`} disabled /></label>
          <label><span>Trigger below reference</span><div className="field-with-unit"><input type="number" value={threshold} onChange={(event) => setThreshold(event.target.value)} /><span>pp</span></div></label>
          <label><span>Minimum persistence</span><div className="field-with-unit"><input type="number" value={duration} onChange={(event) => setDuration(event.target.value)} /><span>seconds</span></div></label>
          <label><span>Minimum estimated impact</span><div className="field-with-unit"><input type="number" value={minImpact} onChange={(event) => setMinImpact(event.target.value)} /><span>USD / h</span></div></label>
          <label><span>Baseline</span><input value="Contextual historical behavior" disabled /></label>
        </div>
        <div className="policy-readable"><span>Human-readable rule</span><p>If <strong>PIX approval in Brazil</strong> falls more than <strong>{threshold} pp</strong> below its reference for <strong>{duration} seconds</strong> and exposes at least <strong>${Number(minImpact || 0).toLocaleString()} per hour</strong>, propose a high-priority incident.</p></div>
        <div className={`replay-result is-${replayStatus}`}><div><span>Replay validation</span><strong>{replayStatus === "idle" ? "Not tested" : replayStatus === "running" ? "Testing against fixture…" : "3 true incidents · 0 noise alerts"}</strong></div>{replayStatus === "done" && <small>Fixture: previous 2 hours · 7,800 buckets evaluated</small>}</div>
        <footer className="policy-actions"><button type="button" onClick={runReplay} disabled={replayStatus === "running"}>{replayStatus === "running" ? "Running replay…" : "Run replay"}</button><button className="button button--light" type="button" onClick={() => setSaved(true)}>{saved ? "Draft saved" : "Save draft"} <ArrowRight size={14} /></button><p><ShieldCheck size={12} /> Saving does not activate this policy. Approval is required.</p></footer>
      </aside>
    </div>
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

function ControlTowerTransition() {
  return (
    <div className="launch-transition" role="status" aria-live="assertive" aria-label="Opening Centinel control tower">
      <div className="launch-transition__grid" aria-hidden="true" />
      <div className="launch-transition__content">
        <div className="launch-object" aria-hidden="true">
          <div className="launch-ring launch-ring--horizontal"><i /><i /></div>
          <div className="launch-ring launch-ring--vertical"><i /><i /></div>
          <div className="launch-ring launch-ring--diagonal"><i /><i /></div>
          <div className="launch-core"><Activity size={22} /></div>
        </div>
        <span className="eyebrow">CENTINEL · LIVE OPERATIONS</span>
        <h2>Opening control tower</h2>
        <p>Synchronizing merchant and provider truth.</p>
        <div className="launch-progress" aria-hidden="true"><i /></div>
        <div className="launch-dimensions" aria-hidden="true"><span>Merchant</span><span>Provider</span><span>Method</span><span>Country</span></div>
      </div>
    </div>
  );
}

function Landing() {
  const [launching, setLaunching] = useState(false);

  useEffect(() => {
    if (!launching) return;
    const timer = window.setTimeout(() => window.location.assign("/control-tower"), 1450);
    return () => window.clearTimeout(timer);
  }, [launching]);

  return (
    <main className="landing">
      {launching && <ControlTowerTransition />}
      <nav className="landing-nav">
        <Brand />
        <div className="landing-nav__links"><a href="#how">How it works</a><a href="#proof">Why Centinel</a></div>
        <button className="button button--light" type="button" onClick={() => setLaunching(true)}>Open control tower <ArrowRight size={15} /></button>
      </nav>

      <section className="hero">
        <div className="hero-signal" aria-hidden="true"><SignalChart incidentActive compact /></div>
        <div className="hero-copy">
          <h1>Know what’s breaking<br />before revenue disappears.</h1>
          <p>Centinel monitors payment performance in real time, isolates the smallest affected path and turns evidence into the next best human action.</p>
          <div className="hero-actions">
            <button className="button button--light" type="button" onClick={() => setLaunching(true)}>Watch the live incident <ArrowRight size={16} /></button>
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
        <button className="button button--light" type="button" onClick={() => setLaunching(true)}>Start the simulation <ArrowRight size={16} /></button>
      </section>

      <footer><Brand compact /><span>NextWave Hackathon 2026 · Yuno × Nauta · Supported by OpenAI</span></footer>
    </main>
  );
}

function App() {
  const path = window.location.pathname;
  if (path.startsWith("/e2e")) return <E2EPanel />;
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
