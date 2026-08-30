import { useEffect, useState } from "react";
import { Activity, ArrowDown, ArrowRight } from "lucide-react";
import { Brand } from "../components/Brand";
import { ControlTowerTransition } from "../components/ControlTowerTransition";
import { LanguageToggle } from "../components/LanguageToggle";
import { SignalChart } from "../components/SignalChart";
import { useLanguage } from "../i18n";
import { CommandCenter } from "./CommandCenter";

export function Landing() {
  const [launching, setLaunching] = useState(false);
  const { text } = useLanguage();

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
        <div className="landing-nav__links"><a href="#how">{text("How it works", "Cómo funciona")}</a><a href="#proof">{text("Why Centinel", "Por qué Centinel")}</a></div>
        <div className="landing-nav__actions"><LanguageToggle /><button className="button button--light" type="button" onClick={() => setLaunching(true)}>{text("Open control tower", "Abrir torre de control")} <ArrowRight size={15} /></button></div>
      </nav>

      <section className="hero">
        <div className="hero-signal" aria-hidden="true"><SignalChart incidentActive compact /></div>
        <div className="hero-copy">
          <h1>{text("Know what’s breaking", "Sabé qué se está rompiendo")}<br />{text("before revenue disappears.", "antes de que desaparezcan los ingresos.")}</h1>
          <p>{text("Centinel monitors payment performance in real time, isolates the smallest affected path and turns evidence into the next best human action.", "Centinel monitorea el rendimiento de pagos en tiempo real, aísla el camino afectado más pequeño y convierte la evidencia en la próxima mejor acción humana.")}</p>
          <div className="hero-actions">
            <button className="button button--light" type="button" onClick={() => setLaunching(true)}>{text("Watch the live incident", "Ver el incidente en vivo")} <ArrowRight size={16} /></button>
            <a className="text-link" href="#how">{text("See how the diagnosis works", "Ver cómo funciona el diagnóstico")} <ArrowDown size={15} /></a>
          </div>
          <span className="hero-note">{text("Built for Yuno’s cross-provider view. Synthetic demo data.", "Creado para la visión multi-provider de Yuno. Datos sintéticos de demo.")}</span>
        </div>
        <div className="hero-preview"><CommandCenter preview /></div>
      </section>

      <section className="problem-section" id="how">
        <h2>{text("Payment problems don’t announce themselves.", "Los problemas de pagos no avisan.")}</h2>
        <div className="problem-copy">
          <p>{text("Dashboards show the symptom. Operations still has to cross providers, methods, countries and merchant logs while revenue remains exposed.", "Los dashboards muestran el síntoma. Operaciones todavía debe cruzar providers, métodos, países y logs del merchant mientras los ingresos siguen expuestos.")}</p>
          <p>{text("Centinel finds the deviation, narrows the scope and shows why the diagnosis deserves trust.", "Centinel encuentra el desvío, reduce el alcance y muestra por qué el diagnóstico merece confianza.")}</p>
        </div>
      </section>

      <section className="mechanism-section" aria-label={text("How Centinel works", "Cómo funciona Centinel")}>
        <div className="mechanism-word">{text("Compare", "Comparar")}</div><ArrowRight aria-hidden="true" />
        <div className="mechanism-word">{text("Detect", "Detectar")}</div><ArrowRight aria-hidden="true" />
        <div className="mechanism-word">{text("Diagnose", "Diagnosticar")}</div><ArrowRight aria-hidden="true" />
        <div className="mechanism-word mechanism-word--signal">{text("Recommend", "Recomendar")}</div>
      </section>

      <section className="truth-section" id="proof">
        <div className="truth-heading"><h2>{text("One operational truth.", "Una verdad operacional.")}<br />{text("Every claim traceable.", "Cada afirmación es trazable.")}</h2><p>{text("Centinel does not ask an LLM to guess over raw transactions. Deterministic evidence arrives first; AI translates it for the person who has to act.", "Centinel no le pide a un LLM que adivine sobre transacciones crudas. Primero llega la evidencia determinística; la IA la traduce para la persona que debe actuar.")}</p></div>
        <div className="truth-ledger">
          <div><span>{text("Observed", "Observado")}</span><strong>72.4%</strong><small>{text("Last 60 seconds · 3,900 attempts", "Últimos 60 segundos · 3.900 intentos")}</small></div>
          <div><span>{text("Expected", "Esperado")}</span><strong>86.1%</strong><small>{text("Contextual 14-day baseline", "Baseline contextual de 14 días")}</small></div>
          <div><span>{text("Likely owner", "Responsable probable")}</span><strong>Adyen</strong><small>{text("High confidence · 7 signals", "Confianza alta · 7 señales")}</small></div>
          <div><span>{text("Next action", "Próxima acción")}</span><strong>{text("Escalate with evidence", "Escalar con evidencia")}</strong><small>{text("No automatic remediation", "Sin remediación automática")}</small></div>
        </div>
      </section>

      <section className="contrast-section">
        <h2>{text("From uncertainty to action.", "De la incertidumbre a la acción.")}</h2>
        <div className="contrast-columns">
          <div><span>{text("The traditional way", "La forma tradicional")}</span><p>{text("You know approval dropped, but not why.", "Sabés que la aprobación cayó, pero no por qué.")}</p><p>{text("Teams investigate fragmented dashboards for hours.", "Los equipos investigan dashboards fragmentados durante horas.")}</p><p>{text("The merchant may discover the incident first.", "El merchant puede descubrir el incidente primero.")}</p></div>
          <div className="contrast-columns__active"><span>{text("With Centinel", "Con Centinel")}</span><p>{text("See the affected path and evidence immediately.", "Ves inmediatamente el camino afectado y la evidencia.")}</p><p>{text("Know the likely owner and recommended human action.", "Conocés el responsable probable y la acción humana recomendada.")}</p><p>{text("Communicate before uncertainty becomes distrust.", "Comunicás antes de que la incertidumbre se convierta en desconfianza.")}</p></div>
        </div>
      </section>

      <section className="closing-section">
        <Activity size={30} aria-hidden="true" />
        <h2>{text("Every rejected payment is a signal.", "Cada pago rechazado es una señal.")}<br />{text("Centinel tells you which ones matter.", "Centinel te dice cuáles importan.")}</h2>
        <button className="button button--light" type="button" onClick={() => setLaunching(true)}>{text("Start the simulation", "Iniciar la simulación")} <ArrowRight size={16} /></button>
      </section>

      <footer><Brand compact /><span>{text("NextWave Hackathon 2026 · Yuno × Nauta · Supported by OpenAI", "NextWave Hackathon 2026 · Yuno × Nauta · Con el apoyo de OpenAI")}</span></footer>
    </main>
  );
}
