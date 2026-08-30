import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ChevronLeft, ChevronRight, Clock3, ExternalLink, X } from "lucide-react";
import { Brand } from "./Brand";
import "./pitch.css";

type Slide = {
  id: string;
  eyebrow: string;
  owner: string;
  time: string;
  note: string;
  content: React.ReactNode;
};

const Signal = ({ incident = false }: { incident?: boolean }) => (
  <svg className={`pitch-signal ${incident ? "is-incident" : ""}`} viewBox="0 0 1200 310" role="img" aria-label={incident ? "Observed approval diverges from its reference" : "Observed approval follows its reference"}>
    <defs>
      <linearGradient id="signalFade" x1="0" x2="1">
        <stop offset="0" stopColor="#5964f2" stopOpacity="0" />
        <stop offset=".18" stopColor="#858cfa" />
        <stop offset="1" stopColor={incident ? "#ff6b60" : "#858cfa"} />
      </linearGradient>
    </defs>
    <g className="pitch-signal__grid">
      {[45, 105, 165, 225, 285].map((y) => <line key={y} x1="0" x2="1200" y1={y} y2={y} />)}
    </g>
    <path className="pitch-signal__reference" d="M0 176 C130 145 210 189 330 158 S540 132 650 159 S880 181 1200 145" />
    <path className="pitch-signal__observed" d={incident
      ? "M0 176 C130 145 210 189 330 158 S520 136 620 160 C720 184 770 220 830 246 S1030 272 1200 270"
      : "M0 180 C130 151 210 183 330 162 S540 139 650 165 S880 174 1200 150"} />
    {incident && <g className="pitch-signal__marker"><line x1="675" x2="675" y1="34" y2="278" /><circle cx="675" cy="177" r="7" /><text x="695" y="61">DEVIATION STARTS</text></g>}
  </svg>
);

export function Pitch() {
  const [index, setIndex] = useState(0);
  const [notesOpen, setNotesOpen] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);

  const slides: Slide[] = useMemo(() => [
    {
      id: "reveal", eyebrow: "Payment incident intelligence", owner: "PENNAZI", time: "00:00–00:30",
      note: "Open with the ending. Do not explain features yet. Land the commercial promise in one sentence.",
      content: <div className="pitch-hero"><div><p className="pitch-kicker"><i /> A new operational layer for Yuno</p><h1>Know what is breaking<br /><em>before they ask.</em></h1><p className="pitch-lede">Centinel turns payment anomalies into an evidence-backed incident, a likely owner and the next human action.</p></div><div className="pitch-proof"><span>ONE LIVE INCIDENT</span><strong>Adyen · PIX · Brazil</strong><small>Detected · localized · explained</small></div></div>
    },
    {
      id: "problem", eyebrow: "The operational gap", owner: "PENNAZI", time: "00:30–01:05",
      note: "Explain it like a five-year-old: seeing smoke is not the same as knowing which room is burning or who should act.",
      content: <div className="pitch-statement"><h2>A drop is a symptom.<br /><em>The incident is the product.</em></h2><div className="pitch-contrast"><div><span>WHAT TEAMS SEE</span><strong>Approval rate ↓</strong><small>A global symptom</small></div><ArrowRight /><div className="is-active"><span>WHAT TEAMS NEED</span><strong>Where · why · owner</strong><small>A decision-ready incident</small></div></div></div>
    },
    {
      id: "position", eyebrow: "Orchestrator advantage", owner: "JUANI", time: "01:05–01:35",
      note: "Name the orchestration advantage explicitly: merchants see their own traffic, providers see their own processing, and Yuno can reconcile both sources of truth.",
      content: <div className="pitch-position"><h2>Orchestration creates a second source of truth.</h2><div className="pitch-network"><span>MERCHANT<small>Intent · checkout · customer</small></span><b /><div><i>Y</i><small>NEUTRAL<br />ORCHESTRATOR</small></div><b /><span>PROVIDER<small>Processing · codes · latency</small></span></div><p>Two partial truths become one operational explanation.<br /><strong>That is Yuno’s structural advantage.</strong></p></div>
    },
    {
      id: "mechanism", eyebrow: "Product mechanism · business wins", owner: "JUANI", time: "01:35–02:10",
      note: "Sell the mechanism and the outcome together. Less blind time and manual investigation protect revenue; shared evidence creates clarity, transparency and merchant trust.",
      content: <div className="pitch-mechanism"><div className="pitch-mechanism__title"><h2>Compare.<br />Isolate.<br /><em>Explain.</em></h2><p>One mechanism.<br />Four operational wins.</p></div><div className="pitch-mechanism__visual"><Signal incident /><div className="pitch-wins"><div><span>REVENUE</span><strong>Less blind time</strong></div><div><span>CLARITY</span><strong>One incident truth</strong></div><div><span>TRANSPARENCY</span><strong>Evidence, not guesses</strong></div><div><span>TRUST</span><strong>Explain before they ask</strong></div></div></div></div>
    },
    {
      id: "benchmark", eyebrow: "Market benchmark", owner: "JUANI", time: "02:10–02:35",
      note: "This is not a feature-war slide. Show the market layers, acknowledge Yuno's current strengths, and name the white space Centinel explores.",
      content: <div className="pitch-benchmark"><div className="pitch-benchmark__heading"><h2>The market sees signals.<br /><em>We assemble incidents.</em></h2><p>Centinel is not another monitor, router or chatbot. It is the evidence layer between detection and action.</p></div><div className="pitch-benchmark__table"><div className="pitch-benchmark__row is-head"><span>PRODUCT LAYER</span><span>STRENGTH</span><span>OPERATIONAL GAP</span></div><div className="pitch-benchmark__row"><strong>Yuno Monitors + Routing</strong><span>Detect · alert · reroute</span><span>Deep incident evidence</span></div><div className="pitch-benchmark__row"><strong>Payments Concierge</strong><span>Analyze · communicate · act</span><span>Explicit evidence contract</span></div><div className="pitch-benchmark__row"><strong>Primer / Spreedly</strong><span>Explore · benchmark · optimize</span><span>Real-time incident assembly</span></div><div className="pitch-benchmark__row"><strong>Datadog Watchdog</strong><span>Generic anomaly + RCA</span><span>Payment-domain ownership</span></div><div className="pitch-benchmark__row is-centinel"><strong>Centinel</strong><span>Localize · justify · hand off</span><span>Payment Truth</span></div></div></div>
    },
    {
      id: "architecture", eyebrow: "Architecture flow", owner: "PENNAZI", time: "02:35–02:55",
      note: "Walk left to right. The trust boundary is the evidence bundle: calculations happen before AI, and operational action remains after human review.",
      content: <div className="pitch-architecture"><div className="pitch-architecture__heading"><h2>From payment stream to human decision.</h2><p>Statistics calculate. AI explains. Humans decide.</p></div><div className="pitch-flow"><div><span>01 · WORLD</span><strong>Payment stream</strong><small>Baseline + live replay + injector</small></div><b>→</b><div><span>02 · ENGINE</span><strong>Detect + localize</strong><small>CUSUM · cube · ripple · residuals</small></div><b>→</b><div className="is-truth"><span>03 · TRUTH</span><strong>Evidence bundle</strong><small>Scope · controls · owner · impact</small></div><b>→</b><div><span>04 · EXPLAIN</span><strong>Bounded AI</strong><small>Operations + executive language</small></div><b>→</b><div><span>05 · ACT</span><strong>Human decision</strong><small>Review · handoff · monitor</small></div></div><div className="pitch-flow__rails"><span>FASTAPI + SSE · READ-ONLY LIVE DELIVERY</span><span>RAW TRANSACTIONS NEVER BECOME A PROMPT</span></div></div>
    },
    {
      id: "data", eyebrow: "Built to be challenged", owner: "PENNAZI", time: "02:55–03:05",
      note: "Ten seconds only. The judge chooses dimensions, not a canned diagnosis. The seeded world makes healthy behavior reproducible while the injected combination remains unseen.",
      content: <div className="pitch-data"><div><span>14 DAYS</span><small>Contextual baseline</small></div><div><span>≈65 / SEC</span><small>Authorization replay</small></div><div><span>81 LEAVES</span><small>Canonical payment cube</small></div><div className="is-challenge"><span>UNSEEN</span><small>Judge-selected combination</small></div><p>The injector changes behavior.<br /><strong>The engine must infer the incident.</strong></p></div>
    },
    {
      id: "demo", eyebrow: "Product proof · recorded demo", owner: "SAMO · OSO · JUANI", time: "03:05–06:30",
      note: "Keep the original speaker contract: Samo narrates healthy/injection/detection/stacked incidents; Oso narrates filters/diagnosis/comparison; Juani owns the Slack handoff; Samo covers executive view; Samo and Oso close the video. Video starts at 03:15.",
      content: <div className="pitch-demo"><div><p className="pitch-kicker"><i /> Recorded from a clean reset</p><h2>Watch Centinel build the incident.</h2><p>A single continuous execution. No hidden diagnosis and no production actions.</p><a href={import.meta.env.VITE_DEMO_URL ?? "#"} target="_blank" rel="noreferrer">Open Command Center fallback <ExternalLink size={17} /></a></div><ol><li><span>01</span>Healthy silence</li><li><span>02</span>Inject degradation</li><li><span>03</span>Stack + filter incidents</li><li><span>04</span>Diagnosis + Slack handoff</li><li><span>05</span>Compare windows</li></ol></div>
    },
    {
      id: "production", eyebrow: "Production path", owner: "PENNAZI", time: "06:30–06:45",
      note: "State the prototype boundaries as intentional, then name the production evolution: streaming state, audit persistence, calibrated thresholds and governed remediation.",
      content: <div className="pitch-production"><h2>Prototype boundaries.<br /><em>Production intent.</em></h2><div><span>NOW</span><strong>Seeded replay</strong><small>Reproducible validation</small><b>→</b><strong>In-memory state</strong><small>Demo resilience</small><b>→</b><strong>Human review</strong><small>No real-money changes</small></div><div className="is-next"><span>NEXT</span><strong>Streaming event log</strong><small>Replayable ingestion</small><b>→</b><strong>Audit store</strong><small>Idempotent evidence</small><b>→</b><strong>Governed remediation</strong><small>Simulation · canary · rollback</small></div></div>
    },
    {
      id: "close", eyebrow: "Trial by fire", owner: "JUANI", time: "06:45–07:00",
      note: "Close with the commercial promise, then invite the judges to choose any valid combination. The trial happens after the seven-minute pitch.",
      content: <div className="pitch-close"><Signal /><div><span>THE NEW OPERATIONAL STANDARD</span><h2>Every incident.<br />Explained before<br /><em>the merchant asks.</em></h2><Brand /></div></div>
    }
  ], []);

  const go = (next: number) => setIndex(Math.max(0, Math.min(slides.length - 1, next)));

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (["ArrowRight", "ArrowDown", " "].includes(event.key)) go(index + 1);
      if (["ArrowLeft", "ArrowUp"].includes(event.key)) go(index - 1);
      if (event.key.toLowerCase() === "n") setNotesOpen((open) => !open);
      if (event.key.toLowerCase() === "t") setStartedAt((value) => value ? null : Date.now());
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [index]);

  useEffect(() => {
    if (!startedAt) return;
    const timer = window.setInterval(() => setElapsed(Date.now() - startedAt), 250);
    return () => window.clearInterval(timer);
  }, [startedAt]);

  const clock = `${String(Math.floor(elapsed / 60000)).padStart(2, "0")}:${String(Math.floor((elapsed % 60000) / 1000)).padStart(2, "0")}`;
  const slide = slides[index];

  return <main className="pitch-shell">
    <header className="pitch-header"><Brand /><span>{slide.eyebrow}</span><div><button onClick={() => setStartedAt(startedAt ? null : Date.now())}><Clock3 size={14} /> {startedAt ? clock : "START TIMER"}</button><span>{String(index + 1).padStart(2, "0")} / {String(slides.length).padStart(2, "0")}</span></div></header>
    <section key={slide.id} className={`pitch-slide pitch-slide--${slide.id}`}>{slide.content}</section>
    <footer className="pitch-footer"><div className="pitch-progress"><i style={{ width: `${((index + 1) / slides.length) * 100}%` }} /></div><span>{slide.owner} · {slide.time}</span><div><button disabled={index === 0} onClick={() => go(index - 1)} aria-label="Previous slide"><ChevronLeft /></button><button onClick={() => setNotesOpen(true)}>N · NOTES</button><button disabled={index === slides.length - 1} onClick={() => go(index + 1)} aria-label="Next slide"><ChevronRight /></button></div></footer>
    {notesOpen && <aside className="pitch-notes"><button onClick={() => setNotesOpen(false)} aria-label="Close notes"><X /></button><span>SPEAKER NOTE · {slide.owner}</span><strong>{slide.time}</strong><p>{slide.note}</p><small>← → navigate · N notes · T timer</small></aside>}
  </main>;
}
