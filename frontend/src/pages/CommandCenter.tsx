import { useEffect, useMemo, useState } from "react";
import { ArrowLeftRight, Check, ChevronDown, Filter, Pause, Play, RotateCcw, ShieldCheck, SlidersHorizontal, Wifi, WifiOff } from "lucide-react";
import { api, type Diagnosis, type InjectOptions, type ScoredIncident } from "../api";
import { Brand } from "../components/Brand";
import { ComparisonWorkspace } from "../components/ComparisonWorkspace";
import { DiagnosisWorkspace } from "../components/DiagnosisWorkspace";
import { ExpectedBandChart } from "../components/ExpectedBandChart";
import { LanguageToggle } from "../components/LanguageToggle";
import { LiveSignalChart, type SignalPoint } from "../components/LiveSignalChart";
import { SignalChart } from "../components/SignalChart";
import { useLanguage } from "../i18n";
import { diagnosisHeadline, diagnosisNarrative, localizeToken } from "../localization";
import { useLive } from "../useLive";

type TowerState = "READY" | "HEALTHY" | "VALIDATING" | "DIAGNOSED" | "PAUSED" | "ERROR";
type DetectionScope = {
  merchant_id: string;
  provider_id: string;
  payment_method: string;
  country: string;
  issuer_bank: string;
  magnitude: string;
  decline_code: string;
};

const DEFAULT_SCOPE: DetectionScope = {
  merchant_id: "",
  provider_id: "",
  payment_method: "",
  country: "",
  issuer_bank: "",
  magnitude: "0.38",
  decline_code: "91",
};

const FALLBACK_OPTIONS: InjectOptions = {
  filter_fields: ["merchant_id", "provider_id", "payment_method", "country", "issuer_bank"],
  merchants: ["rappido", "tiendita", "streamplus"],
  providers: ["adyen", "dlocal", "mercadopago"],
  countries: ["BR", "MX", "CO"],
  methods_by_country: { BR: ["card", "pix", "wallet"], MX: ["card", "cash_oxxo", "wallet"], CO: ["card", "pse", "wallet"] },
  issuers_by_country: { BR: ["itau", "nubank", "bradesco"], MX: ["banorte", "bbva_mx"], CO: ["bancolombia", "davivienda"] },
  decline_codes: [{ code: "91", name: "Issuer unavailable" }, { code: "05", name: "Do not honor" }, { code: "96", name: "System malfunction" }, { code: "51", name: "Insufficient funds" }],
  magnitude: { min: 0.05, max: 0.95, step: 0.01, meaning: "approval probability multiplier" },
  simulation_only: true,
};

function options(values: string[], allLabel: string, language: "en" | "es") {
  return [["", allLabel], ...values.map((value) => [value, localizeToken(value, language)])];
}

export function CommandCenter({ preview = false }: { preview?: boolean }) {
  const { language, text } = useLanguage();
  const [streamActive, setStreamActive] = useState(false);
  const live = useLive(streamActive && !preview);
  const [towerState, setTowerState] = useState<TowerState>(preview ? "DIAGNOSED" : "READY");
  const [connected, setConnected] = useState<boolean | null>(preview ? true : null);
  const [selected, setSelected] = useState<Diagnosis | null>(null);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [scope, setScope] = useState<DetectionScope>(DEFAULT_SCOPE);
  const [injectOptions, setInjectOptions] = useState<InjectOptions>(FALLBACK_OPTIONS);
  const [signalPoints, setSignalPoints] = useState<SignalPoint[]>([]);
  const [incidentQueue, setIncidentQueue] = useState<ScoredIncident[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (preview) return;
    const checkHealth = () => api.health().then(({ data }) => setConnected(data?.status === "ok"));
    void checkHealth();
    const healthPoll = window.setInterval(checkHealth, 5000);
    api.getInjectOptions().then(({ data }) => { if (data) setInjectOptions(data); });
    return () => window.clearInterval(healthPoll);
  }, [preview]);

  useEffect(() => {
    if (!filtersOpen) return;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setFiltersOpen(false);
    };
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [filtersOpen]);

  useEffect(() => {
    if (!live.ticker) return;
    setSignalPoints((current) => {
      const previousTotal = current.at(-1)?.cumulativeAttempts ?? 0;
      const attempts = Math.max(0, live.ticker!.tx_count - previousTotal);
      if (!attempts) return current;
      const approved = Math.round(attempts * live.ticker!.observed_rate);
      const point: SignalPoint = {
        at: live.ticker!.ts.slice(11, 19),
        attempts,
        approved,
        declined: Math.max(0, attempts - approved),
        expectedApproved: attempts * live.ticker!.expected_rate,
        observedRate: live.ticker!.observed_rate * 100,
        expectedRate: live.ticker!.expected_rate * 100,
        cumulativeAttempts: live.ticker!.tx_count,
        windowAttempts: live.overview?.attempts ?? 0,
      };
      return current.at(-1)?.at === point.at ? current : [...current, point].slice(-30);
    });
  }, [live.ticker]);

  useEffect(() => {
    const snapshot = live.snapshot;
    if (!snapshot) return;
    if (snapshot.prioritized.length) {
      setIncidentQueue((current) => {
        const accumulated = new Map(current.map((item) => [item.diagnosis.incident_id, item]));
        snapshot.prioritized.forEach((item) => accumulated.set(item.diagnosis.incident_id, item));
        return [...accumulated.values()].sort((left, right) => right.score - left.score);
      });
    }
    if (snapshot.error) setTowerState("ERROR");
    else if (snapshot.diagnoses.length) setTowerState("DIAGNOSED");
    else if (snapshot.engine_incidents.length || snapshot.active_injections.length) setTowerState("VALIDATING");
    else if (incidentQueue.length) setTowerState("DIAGNOSED");
    else setTowerState("HEALTHY");
  }, [live.snapshot, incidentQueue.length]);

  const start = async () => {
    if (preview || busy) return;
    setBusy(true);
    try {
      const resetOk = await live.reset();
      if (!resetOk) {
        setConnected(false); setTowerState("ERROR");
        return;
      }
      setSignalPoints([]); setIncidentQueue([]); setSelected(null);
      setConnected(true); setTowerState("HEALTHY"); setStreamActive(true);
    } finally {
      setBusy(false);
    }
  };
  const pause = () => { setStreamActive(false); setTowerState("PAUSED"); };
  const resume = () => { setStreamActive(true); setTowerState("HEALTHY"); };
  const reset = async () => {
    setStreamActive(false); setBusy(true);
    try {
      const resetOk = await live.reset();
      if (!resetOk) {
        setConnected(false); setTowerState("ERROR");
        return;
      }
      setSignalPoints([]); setIncidentQueue([]); setSelected(null);
      setConnected(true); setTowerState("READY"); setFiltersOpen(false);
    } finally {
      setBusy(false);
    }
  };
  const simulateScope = async () => {
    setBusy(true);
    try {
      const { magnitude, decline_code, ...values } = scope;
      const filters = Object.fromEntries(Object.entries(values).filter(([, value]) => value));
      const response = await api.inject({ filters, magnitude: Number(magnitude), decline_code, label: "Control Tower trial" });
      if (response.data?.error || response.call.status === "ERR" || Number(response.call.status) >= 400) setTowerState("ERROR");
      else setTowerState("VALIDATING");
      setFiltersOpen(false);
    } finally {
      setBusy(false);
    }
  };

  const prioritized = incidentQueue;
  const currentIncidentIds = useMemo(() => new Set((live.snapshot?.prioritized ?? []).map((item) => item.diagnosis.incident_id)), [live.snapshot?.prioritized]);
  const latestPoint = signalPoints.at(-1);
  const observedRate = latestPoint?.observedRate ?? (live.overview?.observed_rate ?? 0.854) * 100;
  const expectedRate = latestPoint?.expectedRate ?? (live.overview?.expected_rate ?? 0.861) * 100;
  const delta = observedRate - expectedRate;
  const revenueRisk = prioritized.reduce((sum, item) => sum + (item.diagnosis.cost?.usd_per_hour ?? 0), 0);
  const scopeParts = Object.entries(scope).filter(([key, value]) => !["magnitude", "decline_code"].includes(key) && value).map(([, value]) => localizeToken(value, language));
  const scopeLabel = `${scopeParts.join(" × ") || text("Choose a dimensional scope", "Elegí un alcance dimensional")} · ${text("code", "código")} ${scope.decline_code}`;
  const stateMessage = useMemo(() => {
    if (towerState === "READY") return text("Ready to watch payment traffic", "Listo para observar el tráfico de pagos");
    if (towerState === "HEALTHY") return text("Normal variance. No action required.", "Variación normal. No requiere acción.");
    if (towerState === "VALIDATING") return text("Signal found. Checking persistence and controls…", "Señal encontrada. Validando persistencia y controles…");
    if (towerState === "DIAGNOSED") return text(`${prioritized.length} separate incident${prioritized.length === 1 ? "" : "s"} diagnosed`, `${prioritized.length} incidente${prioritized.length === 1 ? "" : "s"} diagnosticado${prioritized.length === 1 ? "" : "s"}`);
    if (towerState === "PAUSED") return text("View frozen. Backend processing continues.", "Vista congelada. El backend sigue procesando.");
    return text("Backend unavailable or injection rejected", "Backend no disponible o inyección rechazada");
  }, [towerState, prioritized.length, text]);

  if (preview) return <PreviewTower />;

  const methodValues = scope.country ? injectOptions.methods_by_country[scope.country] ?? [] : [...new Set(Object.values(injectOptions.methods_by_country).flat())];
  const issuerValues = scope.country ? injectOptions.issuers_by_country[scope.country] ?? [] : [...new Set(Object.values(injectOptions.issuers_by_country).flat())];

  return (
    <section className="tower" aria-label={text("Centinel payment control tower", "Torre de control de pagos Centinel")}>
      <header className="tower-header">
        <Brand compact />
        <div className="tower-header__context"><span className="simulation-badge"><ShieldCheck size={13} />{text("SIMULATION MODE", "MODO SIMULACIÓN")}</span><span className={`backend-state ${connected ? "is-connected" : ""}`}>{connected ? <Wifi size={13} /> : <WifiOff size={13} />}{connected === null ? text("Checking backend", "Conectando al backend") : connected ? text("Backend connected", "Backend conectado") : text("Backend offline", "Backend sin conexión")}</span></div>
        <LanguageToggle />
      </header>

      <div className="tower-flow" aria-label={text("Detection flow", "Flujo de detección")}>
        {[["HEALTHY", text("Watch", "Observar")], ["VALIDATING", text("Validate", "Validar")], ["DIAGNOSED", text("Diagnose", "Diagnosticar")]].map(([key, label], index) => {
          const rank = towerState === "READY" || towerState === "ERROR" ? -1 : towerState === "HEALTHY" || towerState === "PAUSED" ? 0 : towerState === "VALIDATING" ? 1 : 2;
          return <div className={rank >= index ? "is-active" : ""} key={key}><i>{index + 1}</i><span>{label}</span></div>;
        })}
        <p className={`tower-state tower-state--${towerState.toLowerCase()}`} aria-live="polite">{stateMessage}</p>
      </div>

      <div className="tower-toolbar">
        <div className="comparison-context"><span>{text("Observed", "Observado")} <strong>{text("Last 60 seconds", "Últimos 60 segundos")}</strong></span><i>{text("vs", "contra")}</i><span>{text("Expected", "Esperado")} <strong>{text("Contextual 14-day baseline", "Baseline contextual de 14 días")}</strong></span><small>UTC · {live.snapshot ? text(`window ${live.snapshot.window}`, `ventana ${live.snapshot.window}`) : text("waiting", "esperando")}</small></div>
        <div className="tower-actions">
          <button className="compare-trigger" onClick={() => setComparisonOpen(true)}><ArrowLeftRight size={15} />{text("Compare periods", "Comparar períodos")}</button>
          {(towerState === "READY" || towerState === "ERROR") && <button className="button button--signal" onClick={start} disabled={busy}><Play size={15} fill="currentColor" />{towerState === "ERROR" ? text("Retry connection", "Reintentar conexión") : text("Start live stream", "Iniciar stream")}</button>}
          {["HEALTHY", "VALIDATING", "DIAGNOSED"].includes(towerState) && <button onClick={pause}><Pause size={15} />{text("Freeze view", "Congelar vista")}</button>}
          {towerState === "PAUSED" && <button className="button button--signal" onClick={resume}><Play size={15} />{text("Resume live view", "Retomar vista en vivo")}</button>}
          <button onClick={reset} disabled={busy}><RotateCcw size={15} />{text("Reset", "Reiniciar")}</button>
          <div className="demo-menu">
            <button className="demo-menu__trigger detection-trigger" aria-expanded={filtersOpen} aria-controls="detection-scope-panel" onClick={() => setFiltersOpen((open) => !open)}>
              <Filter size={15} />
              <span className="detection-trigger__copy">
                <strong>{text("Detection filters", "Filtros de detección")}</strong>
                <small>{text("Test scope", "Alcance de prueba")} · {scopeLabel}</small>
              </span>
              <ChevronDown size={14} />
            </button>
            {filtersOpen && <div className="demo-menu__panel detection-panel" id="detection-scope-panel" role="group" aria-label={text("Test incident scope", "Alcance del incidente de prueba")}>
              <header><SlidersHorizontal size={14} /><div><strong>{text("Test incident scope", "Alcance del incidente de prueba")}</strong><span>{text("Choose the dimensional intersection the simulator will affect", "Elegí el cruce dimensional que afectará el simulador")}</span></div></header>
              <div className="judge-fields">
                <ScopeField label={text("Merchant", "Comercio")} value={scope.merchant_id} onChange={(merchant_id) => setScope({ ...scope, merchant_id })} options={options(injectOptions.merchants, text("All", "Todos"), language)} />
                <ScopeField label={text("Provider", "Proveedor")} value={scope.provider_id} onChange={(provider_id) => setScope({ ...scope, provider_id })} options={options(injectOptions.providers, text("All", "Todos"), language)} />
                <ScopeField label={text("Country", "País")} value={scope.country} onChange={(country) => setScope({ ...scope, country, payment_method: "", issuer_bank: "" })} options={options(injectOptions.countries, text("All", "Todos"), language)} />
                <ScopeField label={text("Method", "Método")} value={scope.payment_method} onChange={(payment_method) => setScope({ ...scope, payment_method })} options={options(methodValues, text("All", "Todos"), language)} />
                <ScopeField label={text("Issuing bank", "Banco emisor")} value={scope.issuer_bank} onChange={(issuer_bank) => setScope({ ...scope, issuer_bank })} options={options(issuerValues, text("All", "Todos"), language)} />
                <ScopeField label={text("Decline code", "Código de rechazo")} value={scope.decline_code} onChange={(decline_code) => setScope({ ...scope, decline_code })} options={injectOptions.decline_codes.map((item) => [item.code, `${item.code} · ${localizeToken(String(item.name ?? text("Decline", "Rechazo")), language)} · ${localizeToken(String(item.type ?? ""), language)}`])} />
                <ScopeField label={text("Simulation strength", "Intensidad de simulación")} value={scope.magnitude} onChange={(magnitude) => setScope({ ...scope, magnitude })} options={[["0.70", text("Mild · 70%", "Leve · 70%")], ["0.55", text("Weak signal · 55%", "Señal débil · 55%")], ["0.45", text("Strong · 45%", "Fuerte · 45%")], ["0.38", text("Critical · 38%", "Crítica · 38%")], ["0.25", text("Severe · 25%", "Severa · 25%")]]} />
              </div>
              <footer><button className="simulate-scope" disabled={busy || towerState === "READY" || towerState === "ERROR" || !scopeParts.length} onClick={simulateScope}>{text("Inject test signal", "Inyectar señal de prueba")}</button></footer>
              <small>{text("Simulation only. Centinel keeps monitoring all traffic; these dimensions define the injected test signal.", "Sólo simulación. Centinel sigue monitoreando todo el tráfico; estas dimensiones definen la señal de prueba.")}</small>
            </div>}
          </div>
        </div>
      </div>

      <section className="tower-metrics">
        <div><span>{text("Approval observed", "Aprobación observada")}</span><strong>{observedRate.toFixed(1)}%</strong></div>
        <div><span>{text("Delta vs expected", "Delta vs esperado")}</span><strong className={delta < -1 ? "is-negative" : ""}>{delta >= 0 ? "+" : ""}{delta.toFixed(1)} pp</strong></div>
        <div><span>{text("Estimated revenue at risk", "Ingreso estimado en riesgo")}</span><strong>{revenueRisk ? `$${Math.round(revenueRisk).toLocaleString()}/h` : "$0/h"}</strong><small>{text("Estimate · assumptions in diagnosis", "Estimación · supuestos en diagnóstico")}</small></div>
      </section>

      <main className="tower-main">
        <LiveWorkspace points={signalPoints} />
        <IncidentWorkspace state={towerState} prioritized={prioritized} currentIncidentIds={currentIncidentIds} onSelect={setSelected} />
      </main>

      {selected && <DiagnosisWorkspace diagnosis={selected} onClose={() => setSelected(null)} />}
      {comparisonOpen && <ComparisonWorkspace onClose={() => setComparisonOpen(false)} />}
    </section>
  );
}

function ScopeField({ label, value, onChange, options: fieldOptions }: { label: string; value: string; onChange: (value: string) => void; options: string[][] }) {
  return <label><span>{label}</span><select value={value} onChange={(event) => onChange(event.target.value)}>{fieldOptions.map(([optionValue, optionLabel]) => <option key={`${label}-${optionValue}`} value={optionValue}>{optionLabel}</option>)}</select></label>;
}

function LiveWorkspace({ points }: { points: SignalPoint[] }) {
  const { text } = useLanguage();
  const rows = [...points].reverse();
  return <section className="signal-surface live-workspace">
    <section className="pipeline-log">
      <header><div><strong>{text("Incoming transaction log", "Log de transacciones entrantes")}</strong><span>{text("Every snapshot evaluated by detection · newest first", "Todos los snapshots evaluados por detección · más recientes primero")}</span></div><b>{rows.length}/30 {text("snapshots", "snapshots")}</b></header>
      <div className="pipeline-table-wrap"><table><thead><tr><th>{text("Time", "Hora")}</th><th>{text("Transactions", "Transacciones")}</th><th>{text("Approved", "Aprobadas")}</th><th>{text("Declined", "Rechazadas")}</th><th>{text("Approval", "Approval")}</th><th>{text("Expected", "Esperado")}</th><th>{text("Signal", "Señal")}</th></tr></thead><tbody>
        {!rows.length && <tr className="pipeline-empty"><td colSpan={7}>{text("Start the stream to see every incoming snapshot evaluated by Centinel.", "Iniciá el stream para ver cada snapshot entrante evaluado por Centinel.")}</td></tr>}
        {rows.map((point) => {
          const gap = point.observedRate - point.expectedRate;
          const signal = point.attempts < 30
            ? { key: "sampling", label: text("Building sample", "Armando muestra") }
            : gap <= -5
              ? { key: "incident", label: text("Strong deviation", "Desvío fuerte") }
              : gap <= -1
                ? { key: "warning", label: text("Watch", "Observar") }
                : { key: "healthy", label: text("Expected", "Esperado") };
          return <tr key={`${point.at}-${point.cumulativeAttempts}`}><td>{point.at}</td><td>{point.attempts}</td><td>{point.approved}</td><td>{point.declined}</td><td>{point.observedRate.toFixed(1)}%</td><td>{point.expectedRate.toFixed(1)}%</td><td><span className={`log-stage log-stage--${signal.key}`}>{signal.label}</span></td></tr>;
        })}
      </tbody></table></div>
    </section>
    <div className="tower-chart-heading"><div><strong>{text("Transaction volume by incoming snapshot", "Volumen de transacciones por snapshot entrante")}</strong><span><i className="legend-approved" />{text("Approved", "Aprobadas")} <i className="legend-declined" />{text("Declined", "Rechazadas")} <i className="legend-reference" />{text("Expected approvals", "Aprobaciones esperadas")}</span></div><small>{points.length}/30 {text("snapshots · rolling 60-second mix", "snapshots · mezcla móvil de 60 segundos")}</small></div>
    <LiveSignalChart points={points} />
    <div className="tower-chart-heading"><div><strong>{text("Approval rate vs expected range", "Tasa de aprobación vs rango esperado")}</strong><span><i className="legend-observed" />{text("Observed", "Observada")} <i className="legend-reference" />{text("Expected", "Esperada")} <i className="legend-band" />{text("Expected range (95%)", "Rango esperado (95%)")}</span></div><small>{text("Prediction interval from the seasonal baseline and the 60-second sample size", "Intervalo de predicción del baseline estacional y el tamaño de muestra de 60 segundos")}</small></div>
    <ExpectedBandChart points={points} />
  </section>;
}

function IncidentWorkspace({ state, prioritized, currentIncidentIds, onSelect }: { state: TowerState; prioritized: ScoredIncident[]; currentIncidentIds: Set<string>; onSelect: (diagnosis: Diagnosis) => void }) {
  const { language, text } = useLanguage();
  return <aside className={`tower-incidents ${state === "VALIDATING" ? "is-validating" : ""}`} aria-label={text("Prioritized incident queue", "Cola priorizada de incidentes")}>
    <header><span>{text("Session incident stack", "Incidentes de la sesión")}</span><strong>{prioritized.length}</strong></header>
    {state === "VALIDATING" && <div className="tower-empty"><span className="signal-loader" /><strong>{text("Validating the signal", "Validando la señal")}</strong><p>{text("Waiting for persistence, sufficient sample and healthy controls before alerting.", "Esperando persistencia, muestra suficiente y controles sanos antes de alertar.")}</p></div>}
    {state !== "VALIDATING" && !prioritized.length && <div className="tower-empty is-healthy"><Check size={20} /><strong>{text("Trustworthy silence", "Silencio confiable")}</strong><p>{text("Traffic is inside its expected range. Centinel does not alert on noise.", "El tráfico está dentro de su rango esperado. Centinel no alerta por ruido.")}</p></div>}
    <div className="incident-grid">{prioritized.map((item, index) => <button className="tower-incident" key={item.diagnosis.incident_id} onClick={() => onSelect(item.diagnosis)}>
      <div><span>P{index + 1}</span><small className={currentIncidentIds.has(item.diagnosis.incident_id) ? "is-live" : ""}>{currentIncidentIds.has(item.diagnosis.incident_id) ? text("Live signal", "Señal activa") : text("Retained in session", "Guardado en sesión")} · {Math.round(item.score * 100)}</small></div><h3>{diagnosisHeadline(item.diagnosis, language)}</h3><p>{diagnosisNarrative(item.diagnosis, "executive", language)}</p>
      <div className="priority-breakdown">{Object.entries(item.components).map(([name, value]) => <span key={name}><i>{localizeToken(name, language)}</i><b>{Math.round(value * 100)}</b></span>)}</div>
      <footer><strong>{item.diagnosis.cost ? `$${Math.round(item.diagnosis.cost.usd_per_hour).toLocaleString()}/h` : text("Impact unknown", "Impacto desconocido")}</strong><span>{text("Open playbook", "Abrir playbook")} →</span></footer>
    </button>)}</div>
  </aside>;
}

function PreviewTower() {
  const { text } = useLanguage();
  return <section className="tower tower--preview"><div className="tower-flow"><div className="is-active"><i>1</i><span>{text("Watch", "Observar")}</span></div><div className="is-active"><i>2</i><span>{text("Validate", "Validar")}</span></div><div className="is-active"><i>3</i><span>{text("Diagnose", "Diagnosticar")}</span></div></div><div className="tower-metrics"><div><span>{text("Approval observed", "Aprobación observada")}</span><strong>72.4%</strong></div><div><span>{text("Delta vs expected", "Delta vs esperado")}</span><strong className="is-negative">−13.7 pp</strong></div><div><span>{text("Revenue at risk", "Ingresos en riesgo")}</span><strong>$16.5k/h</strong></div></div><SignalChart incidentActive /><div className="preview-diagnosis"><span>{text("P1 · Adyen × Brazil", "P1 · Adyen × Brasil")}</span><strong>{text("Provider degradation isolated", "Degradación del proveedor aislada")}</strong><p>{text("Evidence, ownership and next human action — before the merchant has to ask.", "Evidencia, responsable y próxima acción humana — antes de que el comercio tenga que preguntar.")}</p></div></section>;
}
