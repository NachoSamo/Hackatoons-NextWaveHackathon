import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, Check, ChevronDown, Pause, Play, RotateCcw, ShieldCheck, Wifi, WifiOff } from "lucide-react";
import { api, type Diagnosis, type TickResult } from "../api";
import { Brand } from "../components/Brand";
import { DiagnosisWorkspace } from "../components/DiagnosisWorkspace";
import { LanguageToggle } from "../components/LanguageToggle";
import { SignalChart } from "../components/SignalChart";
import { useLanguage } from "../i18n";

type TowerState = "READY" | "HEALTHY" | "VALIDATING" | "DIAGNOSED" | "PAUSED" | "ERROR";

const PRESETS = [
  { id: "provider_br", en: "Adyen degrades in Brazil", es: "Adyen se degrada en Brasil" },
  { id: "issuer_mx", en: "Mexican issuer fails", es: "Falla un emisor mexicano" },
  { id: "pix_outage", en: "PIX outage in Brazil", es: "Caída de PIX en Brasil" },
];

export function CommandCenter({ preview = false }: { preview?: boolean }) {
  const { text } = useLanguage();
  const [towerState, setTowerState] = useState<TowerState>(preview ? "DIAGNOSED" : "READY");
  const [tick, setTick] = useState<TickResult | null>(null);
  const [connected, setConnected] = useState<boolean | null>(preview ? true : null);
  const [selected, setSelected] = useState<Diagnosis | null>(null);
  const [demoControlsOpen, setDemoControlsOpen] = useState(false);
  const [judgeMode, setJudgeMode] = useState(false);
  const [judgeFilters, setJudgeFilters] = useState({ merchant_id: "", provider_id: "dlocal", payment_method: "card", country: "CO", magnitude: "0.45" });
  const [busy, setBusy] = useState(false);
  const timer = useRef<number | null>(null);

  const stopTimer = useCallback(() => {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
  }, []);

  const updateFromTick = useCallback((next: TickResult | null) => {
    if (!next?.ok) {
      setTowerState("ERROR");
      return;
    }
    setTick(next);
    if (next.diagnoses.length) setTowerState("DIAGNOSED");
    else if (next.engine_incidents.length) setTowerState("VALIDATING");
    else setTowerState("HEALTHY");
  }, []);

  const runTick = useCallback(async () => {
    const { data, call } = await api.debugTick();
    setConnected(call.status !== "ERR" && Number(call.status) < 500);
    updateFromTick(data);
  }, [updateFromTick]);

  useEffect(() => {
    if (preview) return;
    api.health().then(({ data }) => setConnected(data?.status === "ok"));
    return stopTimer;
  }, [preview, stopTimer]);

  const start = async () => {
    if (preview || busy) return;
    setBusy(true);
    stopTimer();
    const reset = await api.debugReset();
    setConnected(reset.call.status !== "ERR");
    setTick(null);
    setSelected(null);
    await runTick();
    timer.current = window.setInterval(runTick, 2500);
    setBusy(false);
  };

  const pause = () => { stopTimer(); setTowerState("PAUSED"); };
  const resume = () => { setTowerState("HEALTHY"); runTick(); timer.current = window.setInterval(runTick, 2500); };
  const reset = async () => {
    stopTimer();
    if (!preview) await api.debugReset();
    setTick(null); setSelected(null); setTowerState("READY"); setDemoControlsOpen(false);
  };
  const inject = async (preset: string) => {
    setBusy(true);
    await api.debugInject(preset);
    setTowerState("VALIDATING");
    setDemoControlsOpen(false);
    await runTick();
    setBusy(false);
  };
  const injectJudgeCase = async () => {
    setBusy(true);
    const { magnitude, ...values } = judgeFilters;
    const filters = Object.fromEntries(Object.entries(values).filter(([, value]) => value));
    await api.debugInject({ filters, magnitude: Number(magnitude), decline_code: "96" });
    setTowerState("VALIDATING");
    setDemoControlsOpen(false);
    await runTick();
    setBusy(false);
  };

  const prioritized = tick?.prioritized ?? [];
  const incidentActive = preview || prioritized.length > 0 || towerState === "VALIDATING";
  const observedRate = preview ? 0.724 : incidentActive ? 0.724 : 0.854;
  const expectedRate = 0.861;
  const delta = (observedRate - expectedRate) * 100;
  const revenueRisk = prioritized.reduce((sum, item) => sum + (item.diagnosis.cost?.usd_per_hour ?? 0), 0);
  const stateMessage = useMemo(() => {
    if (towerState === "READY") return text("Ready to watch payment traffic", "Listo para observar el tráfico de pagos");
    if (towerState === "HEALTHY") return text("Normal variance. No action required.", "Variación normal. No requiere acción.");
    if (towerState === "VALIDATING") return text("Signal found. Checking persistence and controls…", "Señal encontrada. Validando persistencia y controles…");
    if (towerState === "DIAGNOSED") return text(`${prioritized.length} separate incident${prioritized.length === 1 ? "" : "s"} diagnosed`, `${prioritized.length} incidente${prioritized.length === 1 ? "" : "s"} separado${prioritized.length === 1 ? "" : "s"} y diagnosticado${prioritized.length === 1 ? "" : "s"}`);
    if (towerState === "PAUSED") return text("Stream paused", "Stream pausado");
    return text("Backend unavailable — use the deterministic fallback", "Backend no disponible — usar fallback determinístico");
  }, [towerState, prioritized.length, text]);

  if (preview) return <PreviewTower />;

  return (
    <section className="tower" aria-label={text("Centinel payment control tower", "Torre de control de pagos Centinel")}>
      <header className="tower-header">
        <Brand compact />
        <div className="tower-header__context"><span className="simulation-badge"><ShieldCheck size={13} /> SIMULATION MODE</span><span className={`backend-state ${connected ? "is-connected" : ""}`}>{connected ? <Wifi size={13} /> : <WifiOff size={13} />}{connected === null ? text("Checking backend", "Conectando al backend") : connected ? text("Backend connected", "Backend conectado") : text("Backend offline", "Backend sin conexión")}</span></div>
        <LanguageToggle />
      </header>

      <div className="tower-flow" aria-label={text("Detection flow", "Flujo de detección")}>
        {[
          ["HEALTHY", text("Watch", "Observar")],
          ["VALIDATING", text("Validate", "Validar")],
          ["DIAGNOSED", text("Diagnose", "Diagnosticar")],
        ].map(([key, label], index) => {
          const rank = towerState === "READY" ? -1 : towerState === "HEALTHY" || towerState === "PAUSED" ? 0 : towerState === "VALIDATING" ? 1 : 2;
          return <div className={rank >= index ? "is-active" : ""} key={key}><i>{index + 1}</i><span>{label}</span></div>;
        })}
        <p className={`tower-state tower-state--${towerState.toLowerCase()}`} aria-live="polite">{stateMessage}</p>
      </div>

      <div className="tower-toolbar">
        <div className="comparison-context"><span>{text("Observed", "Observado")} <strong>{text("Last 60 seconds", "Últimos 60 segundos")}</strong></span><i>vs</i><span>{text("Expected", "Esperado")} <strong>{text("Contextual 14-day baseline", "Baseline contextual de 14 días")}</strong></span><small>UTC · {tick ? "3,900" : "0"} {text("attempts", "intentos")}</small></div>
        <div className="tower-actions">
          {towerState === "READY" && <button className="button button--signal" onClick={start} disabled={busy}><Play size={15} fill="currentColor" />{text("Start live stream", "Iniciar stream")}</button>}
          {towerState !== "READY" && towerState !== "PAUSED" && <button onClick={pause}><Pause size={15} />{text("Pause", "Pausar")}</button>}
          {towerState === "PAUSED" && <button className="button button--signal" onClick={resume}><Play size={15} />{text("Resume", "Reanudar")}</button>}
          <button onClick={reset}><RotateCcw size={15} />{text("Reset", "Reiniciar")}</button>
          {towerState !== "READY" && <div className="demo-menu"><button className="demo-menu__trigger" onClick={() => setDemoControlsOpen((open) => !open)}><AlertTriangle size={15} />{text("Inject test incident", "Inyectar incidente de prueba")}<ChevronDown size={14} /></button>{demoControlsOpen && <div className={`demo-menu__panel ${judgeMode ? "is-judge" : ""}`}><div className="demo-menu__tabs"><button className={!judgeMode ? "is-active" : ""} onClick={() => setJudgeMode(false)}>{text("Prepared", "Preparados")}</button><button className={judgeMode ? "is-active" : ""} onClick={() => setJudgeMode(true)}>{text("Judge mode", "Modo juez")}</button></div>{!judgeMode ? PRESETS.map((preset) => <button disabled={busy} key={preset.id} onClick={() => inject(preset.id)}>{text(preset.en, preset.es)}</button>) : <div className="judge-fields"><label><span>Merchant</span><select value={judgeFilters.merchant_id} onChange={(event) => setJudgeFilters({ ...judgeFilters, merchant_id: event.target.value })}><option value="">All</option><option value="rappido">Rappido</option><option value="tiendita">Tiendita</option><option value="streamplus">Streamplus</option></select></label><label><span>Provider</span><select value={judgeFilters.provider_id} onChange={(event) => setJudgeFilters({ ...judgeFilters, provider_id: event.target.value })}><option value="adyen">Adyen</option><option value="dlocal">dLocal</option><option value="mercadopago">MercadoPago</option></select></label><label><span>{text("Method", "Método")}</span><select value={judgeFilters.payment_method} onChange={(event) => setJudgeFilters({ ...judgeFilters, payment_method: event.target.value })}><option value="card">Card</option><option value="pix">PIX</option><option value="pse">PSE</option></select></label><label><span>{text("Country", "País")}</span><select value={judgeFilters.country} onChange={(event) => setJudgeFilters({ ...judgeFilters, country: event.target.value })}><option value="BR">Brazil</option><option value="MX">Mexico</option><option value="CO">Colombia</option></select></label><label><span>{text("Approval multiplier", "Multiplicador de aprobación")}</span><select value={judgeFilters.magnitude} onChange={(event) => setJudgeFilters({ ...judgeFilters, magnitude: event.target.value })}><option value="0.70">70%</option><option value="0.45">45%</option><option value="0.25">25%</option></select></label><button className="judge-inject" disabled={busy} onClick={injectJudgeCase}>{text("Inject unrehearsed case", "Inyectar caso no ensayado")}</button></div>}</div>}</div>}
        </div>
      </div>

      <main className="tower-main">
        <section className="signal-surface">
          <div className="tower-metrics">
            <div><span>{text("Approval observed", "Aprobación observada")}</span><strong>{(observedRate * 100).toFixed(1)}%</strong></div>
            <div><span>{text("Delta vs expected", "Delta vs esperado")}</span><strong className={delta < -1 ? "is-negative" : ""}>{delta >= 0 ? "+" : ""}{delta.toFixed(1)} pp</strong></div>
            <div><span>{text("Estimated revenue at risk", "Ingreso estimado en riesgo")}</span><strong>{revenueRisk ? `$${Math.round(revenueRisk).toLocaleString()}/h` : "$0/h"}</strong><small>{text("Estimate · assumptions in diagnosis", "Estimación · supuestos en diagnóstico")}</small></div>
          </div>
          <div className="tower-chart-heading"><div><strong>{text("Approval rate over time", "Tasa de aprobación en el tiempo")}</strong><span><i className="legend-observed" />{text("Observed", "Observado")} <i className="legend-reference" />{text("Expected", "Esperado")}</span></div></div>
          <SignalChart incidentActive={incidentActive} />
        </section>

        <aside className={`tower-incidents ${towerState === "VALIDATING" ? "is-validating" : ""}`}>
          <header><span>{text("Incident queue", "Cola de incidentes")}</span><strong>{prioritized.length}</strong></header>
          {towerState === "VALIDATING" && <div className="tower-empty"><span className="signal-loader" /><strong>{text("Validating the signal", "Validando la señal")}</strong><p>{text("Waiting for persistence, sufficient sample and healthy controls before alerting.", "Esperando persistencia, muestra suficiente y controles sanos antes de alertar.")}</p></div>}
          {towerState !== "VALIDATING" && !prioritized.length && <div className="tower-empty is-healthy"><Check size={20} /><strong>{text("Trustworthy silence", "Silencio confiable")}</strong><p>{text("Traffic is inside its expected range. Centinel does not alert on noise.", "El tráfico está dentro de su rango esperado. Centinel no alerta por ruido.")}</p></div>}
          {prioritized.map((item, index) => <button className="tower-incident" key={item.diagnosis.incident_id} onClick={() => setSelected(item.diagnosis)}>
            <div><span>P{index + 1}</span><small>{Math.round(item.score * 100)} {text("priority score", "score de prioridad")}</small></div>
            <h3>{item.diagnosis.headline}</h3>
            <p>{item.diagnosis.executive}</p>
            <footer><strong>{item.diagnosis.cost ? `$${Math.round(item.diagnosis.cost.usd_per_hour).toLocaleString()}/h` : text("Impact unknown", "Impacto desconocido")}</strong><span>{text("Investigate", "Investigar")} →</span></footer>
          </button>)}
        </aside>
      </main>

      {selected && <DiagnosisWorkspace diagnosis={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}

function PreviewTower() {
  const { text } = useLanguage();
  return <section className="tower tower--preview"><div className="tower-flow"><div className="is-active"><i>1</i><span>{text("Watch", "Observar")}</span></div><div className="is-active"><i>2</i><span>{text("Validate", "Validar")}</span></div><div className="is-active"><i>3</i><span>{text("Diagnose", "Diagnosticar")}</span></div></div><div className="tower-metrics"><div><span>{text("Approval observed", "Aprobación observada")}</span><strong>72.4%</strong></div><div><span>{text("Delta vs expected", "Delta vs esperado")}</span><strong className="is-negative">−13.7 pp</strong></div><div><span>{text("Revenue at risk", "Ingresos en riesgo")}</span><strong>$16.5k/h</strong></div></div><SignalChart incidentActive /><div className="preview-diagnosis"><span>P1 · Adyen × Brazil</span><strong>{text("Provider degradation isolated", "Degradación del provider aislada")}</strong><p>{text("Evidence, ownership and next human action — before the merchant has to ask.", "Evidencia, responsable y próxima acción humana — antes de que el merchant tenga que preguntar.")}</p></div></section>;
}
