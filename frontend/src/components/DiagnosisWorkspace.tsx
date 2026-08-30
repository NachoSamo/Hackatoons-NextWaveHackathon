import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Bot, CalendarRange, Check, X } from "lucide-react";
import type { Diagnosis } from "../api";
import { useLanguage } from "../i18n";
import { diagnosisHeadline, diagnosisNarrative, localizeAction, localizeEvidence, localizeScope, localizeToken } from "../localization";
import { LanguageToggle } from "./LanguageToggle";
import { ComparisonWorkspace } from "./ComparisonWorkspace";
import { useDialogFocus } from "../useDialogFocus";

type Props = { diagnosis: Diagnosis; onClose: () => void };

export function DiagnosisWorkspace({ diagnosis, onClose }: Props) {
  const { language, text } = useLanguage();
  const [audience, setAudience] = useState<"operations" | "executive">("operations");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const [comparisonOpen, setComparisonOpen] = useState(false);
  const dialogRef = useDialogFocus(onClose);
  const action = diagnosis.recommended_action ? localizeAction(diagnosis.recommended_action, diagnosis, language) : null;
  const scope = localizeScope(diagnosis.slice, language);

  const suggested = useMemo(() => [
    text("Why this owner?", "¿Por qué este responsable?"),
    text("What changed?", "¿Qué cambió?"),
    text("What should we do next?", "¿Qué hacemos ahora?"),
  ], [text]);

  const ask = (value: string) => {
    setQuestion(value);
    const normalized = value.toLowerCase();
    if (normalized.includes("next") || normalized.includes("ahora") || normalized.includes("hacer")) {
      setAnswer(action?.rationale ?? text("Keep monitoring until the evidence is sufficient.", "Seguí monitoreando hasta que la evidencia sea suficiente."));
    } else if (normalized.includes("owner") || normalized.includes("responsable")) {
      setAnswer(action
        ? text(`Likely owner: ${action.owner}. ${action.rationale}`, `Responsable probable: ${action.owner}. ${action.rationale}`)
        : text("The evidence does not support assigning an owner yet.", "La evidencia todavía no permite asignar un responsable."));
    } else if (normalized.includes("when") || normalized.includes("since") || normalized.includes("cuándo") || normalized.includes("desde")) {
      const started = new Date(diagnosis.estimated_start).toLocaleTimeString(language === "es" ? "es-AR" : "en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
      setAnswer(text(`The earliest supported start is ${started}.`, `El inicio más temprano respaldado por evidencia es ${started}.`));
    } else if (normalized.includes("affect") || normalized.includes("afecta") || normalized.includes("impact")) {
      setAnswer(text(`Affected scope: ${scope}. Estimated impact: ${diagnosis.cost ? `$${diagnosis.cost.usd_per_hour.toLocaleString()}/h` : "not available"}.`, `Alcance afectado: ${scope}. Impacto estimado: ${diagnosis.cost ? `$${diagnosis.cost.usd_per_hour.toLocaleString()}/h` : "no disponible"}.`));
    } else if (normalized.includes("alternative") || normalized.includes("contrad") || normalized.includes("alternativa")) {
      setAnswer(diagnosis.alternatives.length
        ? diagnosis.alternatives.map((item) => localizeEvidence(item, language)).join(" ")
        : text("No stronger alternative hypothesis is supported by the current evidence bundle.", "El paquete de evidencia actual no respalda una hipótesis alternativa más fuerte."));
    } else if (normalized.includes("change") || normalized.includes("cambió") || normalized.includes("cambio")) {
      setAnswer(diagnosis.evidence.slice(0, 3).map((item) => localizeEvidence(item, language)).join(" "));
    } else if (normalized.includes("why") || normalized.includes("por qué") || normalized.includes("porque")) {
      setAnswer(diagnosisNarrative(diagnosis, "operations", language));
    } else {
      setAnswer(text("I can answer what changed, when it started, who is affected, why ownership is likely, alternative hypotheses and the recommended next action.", "Puedo responder qué cambió, cuándo empezó, a quién afecta, por qué se asigna el responsable, hipótesis alternativas y la próxima acción recomendada."));
    }
  };

  useEffect(() => {
    if (answer && question) ask(question);
    // Rebuild the contextual answer when the interface language changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [language]);

  return (
    <div className="diagnosis-overlay" role="dialog" aria-modal="true" aria-label={text("Incident investigation", "Investigación del incidente")} ref={dialogRef} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="diagnosis-workspace">
        <header className="diagnosis-header">
          <div>
            <span>{text("Incident investigation", "Investigación del incidente")} · {diagnosis.incident_id}</span>
            <h2>{diagnosisHeadline(diagnosis, language)}</h2>
            <p>{scope}</p>
          </div>
          <div className="diagnosis-header__actions"><LanguageToggle /><button type="button" data-autofocus onClick={onClose} aria-label={text("Close", "Cerrar")}><X /></button></div>
        </header>

        <div className="diagnosis-summary">
          <div><span>{text("Confidence", "Confianza")}</span><strong>{localizeToken(diagnosis.confidence_level, language)}</strong></div>
          <div><span>{text("Estimated impact", "Impacto estimado")}</span><strong>{diagnosis.cost ? `$${diagnosis.cost.usd_per_hour.toLocaleString()}/h` : "—"}</strong></div>
          <div><span>{text("Started", "Inicio")}</span><strong>{new Date(diagnosis.estimated_start).toLocaleTimeString(language === "es" ? "es-AR" : "en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</strong></div>
          <div><span>{text("Status", "Estado")}</span><strong>{localizeToken(diagnosis.diagnosis_status, language)}</strong></div>
        </div>

        <div className="diagnosis-grid">
          <main>
            <div className="audience-switch">
              <button className={audience === "operations" ? "is-active" : ""} onClick={() => setAudience("operations")}>{text("Operations", "Operaciones")}</button>
              <button className={audience === "executive" ? "is-active" : ""} onClick={() => setAudience("executive")}>{text("Executive", "Ejecutivo")}</button>
            </div>
            <p className="diagnosis-narrative">{diagnosisNarrative(diagnosis, audience, language)}</p>

            <section className="evidence-list">
              <div className="section-kicker">{text("Evidence behind the diagnosis", "Evidencia detrás del diagnóstico")}</div>
              {diagnosis.evidence.map((item) => <p key={item}><Check size={15} />{localizeEvidence(item, language)}</p>)}
            </section>

            {(diagnosis.alternatives.length > 0 || diagnosis.missing_data.length > 0) && <section className="diagnosis-limits">
              {diagnosis.alternatives.length > 0 && <div><span>{text("Alternative hypotheses", "Hipótesis alternativas")}</span>{diagnosis.alternatives.map((item) => <p key={item}>{localizeEvidence(item, language)}</p>)}</div>}
              {diagnosis.missing_data.length > 0 && <div><span>{text("Missing evidence", "Evidencia faltante")}</span>{diagnosis.missing_data.map((item) => <p key={item}>{localizeEvidence(item, language)}</p>)}</div>}
            </section>}

            {action && <section className="human-action">
              <span>{text("Recommended human action", "Acción humana recomendada")}</span>
              <h3>{action.title}</h3>
              <p>{action.rationale}</p>
              {action.params_to_change.length > 0 && <div className="action-params">{action.params_to_change.map((param) => <span key={param.name}><i>{param.name.replaceAll("_", " ")}</i><b>{String(param.current ?? "—")} → {String(param.proposed ?? "—")}</b></span>)}</div>}
              <footer><strong>{text("Owner", "Responsable")}: {action.owner}</strong><span>{text("Expected", "Esperado")}: {action.expected_impact}</span><span>{text("Re-evaluate", "Reevaluar")}: {action.reevaluate_after}</span><em>{text("Recommendation only — no money is moved", "Sólo recomendación — no mueve dinero")}</em></footer>
            </section>}
          </main>

          <aside className="diagnosis-copilot">
            <div><Bot size={18} /><span><strong>Centinel Copilot</strong><small>{text("Grounded in this evidence bundle", "Basado en este paquete de evidencia")}</small></span></div>
            <p className="copilot-capability">{text("Ask about supported facts in this incident. Copilot explains evidence; it does not recalculate the diagnosis.", "Consultá hechos respaldados por este incidente. Copilot explica evidencia; no recalcula el diagnóstico.")}</p>
            <div className="copilot-suggestions">{suggested.map((item) => <button key={item} onClick={() => ask(item)}>{item}<ArrowRight size={13} /></button>)}</div>
            <button className="copilot-compare" type="button" onClick={() => setComparisonOpen(true)}><CalendarRange size={14} />{text("Compare windows", "Comparar ventanas")}<ArrowRight size={13} /></button>
            {answer && <div className="copilot-answer"><span>{question}</span><p>{answer}</p><small>{text("Sources: deterministic diagnosis + evidence bundle", "Fuentes: diagnóstico determinístico + paquete de evidencia")}</small></div>}
            <form onSubmit={(event) => { event.preventDefault(); if (question.trim()) ask(question); }}>
              <label className="sr-only" htmlFor="diagnosis-question">{text("Question about this diagnosis", "Pregunta sobre este diagnóstico")}</label>
              <input id="diagnosis-question" aria-label={text("Question about this diagnosis", "Pregunta sobre este diagnóstico")} value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={text("Ask about this diagnosis…", "Consultá sobre este diagnóstico…")} />
              <button type="submit" aria-label={text("Ask", "Consultar")}><ArrowRight /></button>
            </form>
          </aside>
        </div>
      </section>
      {comparisonOpen && <ComparisonWorkspace initialScope={diagnosis.slice} onClose={() => setComparisonOpen(false)} />}
    </div>
  );
}
