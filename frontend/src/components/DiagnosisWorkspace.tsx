import { useMemo, useState } from "react";
import { ArrowRight, Bot, Check, X } from "lucide-react";
import type { Diagnosis } from "../api";
import { useLanguage } from "../i18n";
import { LanguageToggle } from "./LanguageToggle";

type Props = { diagnosis: Diagnosis; onClose: () => void };

export function DiagnosisWorkspace({ diagnosis, onClose }: Props) {
  const { text } = useLanguage();
  const [audience, setAudience] = useState<"operations" | "executive">("operations");
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);
  const action = diagnosis.recommended_action;
  const scope = Object.entries(diagnosis.slice)
    .filter(([, value]) => value)
    .map(([key, value]) => `${key.replace("_id", "").replace("_", " ")}: ${value}`)
    .join(" · ");

  const suggested = useMemo(() => [
    text("Why this owner?", "¿Por qué este responsable?"),
    text("What changed?", "¿Qué cambió?"),
    text("What should we do next?", "¿Qué hacemos ahora?"),
  ], [text]);

  const ask = (value: string) => {
    setQuestion(value);
    const normalized = value.toLowerCase();
    if (normalized.includes("next") || normalized.includes("ahora")) {
      setAnswer(action?.rationale ?? text("Keep monitoring until the evidence is sufficient.", "Seguí monitoreando hasta que la evidencia sea suficiente."));
    } else if (normalized.includes("owner") || normalized.includes("responsable")) {
      setAnswer(diagnosis.evidence.slice(0, 2).join(" "));
    } else {
      setAnswer(diagnosis.operations);
    }
  };

  return (
    <div className="diagnosis-overlay" role="dialog" aria-modal="true" aria-label={text("Incident investigation", "Investigación del incidente")}>
      <section className="diagnosis-workspace">
        <header className="diagnosis-header">
          <div>
            <span>{text("Incident investigation", "Investigación del incidente")} · {diagnosis.incident_id}</span>
            <h2>{diagnosis.headline}</h2>
            <p>{scope}</p>
          </div>
          <div className="diagnosis-header__actions"><LanguageToggle /><button type="button" onClick={onClose} aria-label={text("Close", "Cerrar")}><X /></button></div>
        </header>

        <div className="diagnosis-summary">
          <div><span>{text("Confidence", "Confianza")}</span><strong>{diagnosis.confidence_level}</strong></div>
          <div><span>{text("Estimated impact", "Impacto estimado")}</span><strong>{diagnosis.cost ? `$${diagnosis.cost.usd_per_hour.toLocaleString()}/h` : "—"}</strong></div>
          <div><span>{text("Started", "Inicio")}</span><strong>{new Date(diagnosis.estimated_start).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</strong></div>
          <div><span>{text("Status", "Estado")}</span><strong>{diagnosis.diagnosis_status.replace("_", " ")}</strong></div>
        </div>

        <div className="diagnosis-grid">
          <main>
            <div className="audience-switch">
              <button className={audience === "operations" ? "is-active" : ""} onClick={() => setAudience("operations")}>{text("Operations", "Operaciones")}</button>
              <button className={audience === "executive" ? "is-active" : ""} onClick={() => setAudience("executive")}>{text("Executive", "Ejecutivo")}</button>
            </div>
            <p className="diagnosis-narrative">{audience === "operations" ? diagnosis.operations : diagnosis.executive}</p>

            <section className="evidence-list">
              <div className="section-kicker">{text("Evidence behind the diagnosis", "Evidencia detrás del diagnóstico")}</div>
              {diagnosis.evidence.map((item) => <p key={item}><Check size={15} />{item}</p>)}
              {diagnosis.missing_data.map((item) => <p className="is-missing" key={item}>— {item}</p>)}
            </section>

            {action && <section className="human-action">
              <span>{text("Recommended human action", "Acción humana recomendada")}</span>
              <h3>{action.title}</h3>
              <p>{action.rationale}</p>
              <footer><strong>{text("Owner", "Responsable")}: {action.owner}</strong><span>{text("Re-evaluate", "Reevaluar")}: {action.reevaluate_after}</span><em>{text("Recommendation only — no money is moved", "Sólo recomendación — no mueve dinero")}</em></footer>
            </section>}
          </main>

          <aside className="diagnosis-copilot">
            <div><Bot size={18} /><span><strong>Centinel Copilot</strong><small>{text("Grounded in this evidence bundle", "Basado en este paquete de evidencia")}</small></span></div>
            <div className="copilot-suggestions">{suggested.map((item) => <button key={item} onClick={() => ask(item)}>{item}<ArrowRight size={13} /></button>)}</div>
            {answer && <div className="copilot-answer"><span>{question}</span><p>{answer}</p><small>{text("Sources: deterministic diagnosis + evidence bundle", "Fuentes: diagnóstico determinístico + paquete de evidencia")}</small></div>}
            <form onSubmit={(event) => { event.preventDefault(); if (question.trim()) ask(question); }}>
              <input value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={text("Ask about this diagnosis…", "Consultá sobre este diagnóstico…")} />
              <button type="submit" aria-label={text("Ask", "Consultar")}><ArrowRight /></button>
            </form>
          </aside>
        </div>
      </section>
    </div>
  );
}
