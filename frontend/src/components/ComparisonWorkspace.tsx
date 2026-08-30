import { useMemo, useState } from "react";
import { ArrowRight, CalendarRange, Database, Search, X } from "lucide-react";
import { api, type CubeLeaf, type PaymentSlice } from "../api";
import { useLanguage } from "../i18n";
import { localizeToken } from "../localization";
import { LanguageToggle } from "./LanguageToggle";
import { useDialogFocus } from "../useDialogFocus";

type Scope = {
  merchant_id: string;
  provider_id: string;
  payment_method: string;
  country: string;
};

type ComparisonResult = {
  id: number;
  scope: Scope;
  observedWindow: number;
  reference: "baseline" | number;
  observedRate: number;
  referenceRate: number;
  attempts: number;
  delta: number;
  revenueRisk: number;
};

const WINDOWS = [
  { value: 60, en: "Last 60 seconds", es: "Últimos 60 segundos" },
  { value: 300, en: "Last 5 minutes", es: "Últimos 5 minutos" },
  { value: 900, en: "Last 15 minutes", es: "Últimos 15 minutos" },
  { value: 3600, en: "Last hour", es: "Última hora" },
  { value: 7200, en: "Last 2 hours", es: "Últimas 2 horas" },
];

const emptyScope: Scope = { merchant_id: "", provider_id: "", payment_method: "", country: "" };

function scoped(leaves: CubeLeaf[], scope: Scope) {
  return leaves.filter((leaf) => Object.entries(scope).every(([key, value]) => !value || leaf[key as keyof Scope] === value));
}

function aggregate(leaves: CubeLeaf[], forecast = false) {
  const attempts = leaves.reduce((sum, leaf) => sum + (forecast ? leaf.fc_attempts : leaf.attempts), 0);
  const approved = leaves.reduce((sum, leaf) => sum + (forecast ? leaf.fc_approved : leaf.approved), 0);
  const amount = leaves.reduce((sum, leaf) => sum + leaf.amount_usd_sum, 0);
  return { attempts, rate: attempts ? approved / attempts : 0, avgTicket: attempts ? amount / attempts : 35 };
}

function scopeLabel(scope: Scope, emptyLabel: string, language: "en" | "es") {
  return Object.values(scope).filter(Boolean).map((value) => localizeToken(value, language)).join(" · ") || emptyLabel;
}

export function ComparisonWorkspace({ initialScope, onClose }: { initialScope?: PaymentSlice; onClose: () => void }) {
  const { language, text } = useLanguage();
  const [scope, setScope] = useState<Scope>({
    ...emptyScope,
    merchant_id: initialScope?.merchant_id ?? "",
    provider_id: initialScope?.provider_id ?? "",
    payment_method: initialScope?.payment_method ?? "",
    country: initialScope?.country ?? "",
  });
  const [observedWindow, setObservedWindow] = useState(60);
  const [reference, setReference] = useState<"baseline" | number>("baseline");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ComparisonResult[]>([]);
  const [activeId, setActiveId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interpretation, setInterpretation] = useState<string | null>(null);
  const dialogRef = useDialogFocus(onClose);

  const observedLabel = text(WINDOWS.find((item) => item.value === observedWindow)?.en ?? "Observed window", WINDOWS.find((item) => item.value === observedWindow)?.es ?? "Ventana observada");
  const referenceLabel = reference === "baseline"
    ? text("Contextual 14-day baseline", "Baseline contextual de 14 días")
    : text(WINDOWS.find((item) => item.value === reference)?.en ?? "Reference window", WINDOWS.find((item) => item.value === reference)?.es ?? "Ventana de referencia");
  const active = results.find((item) => item.id === activeId) ?? results.at(-1);

  const chips = useMemo(() => [
    scopeLabel(scope, text("All payment traffic", "Todo el tráfico de pagos"), language),
    observedLabel,
    `${text("versus", "contra")} ${referenceLabel}`,
    "UTC",
  ], [scope, observedLabel, referenceLabel, language, text]);

  const interpret = () => {
    const value = query.toLowerCase();
    const next = { ...emptyScope };
    const recognized: string[] = [];
    if (value.includes("adyen")) { next.provider_id = "adyen"; recognized.push("Adyen"); }
    if (value.includes("dlocal")) { next.provider_id = "dlocal"; recognized.push("dLocal"); }
    if (value.includes("mercadopago")) { next.provider_id = "mercadopago"; recognized.push("MercadoPago"); }
    if (value.includes("brazil") || value.includes("brasil")) { next.country = "BR"; recognized.push(text("Brazil", "Brasil")); }
    if (value.includes("mexico") || value.includes("méxico")) { next.country = "MX"; recognized.push(text("Mexico", "México")); }
    if (value.includes("colombia")) { next.country = "CO"; recognized.push("Colombia"); }
    if (value.includes("pix")) { next.payment_method = "pix"; recognized.push("PIX"); }
    if (value.includes("pse")) { next.payment_method = "pse"; recognized.push("PSE"); }
    if (value.includes("card") || value.includes("tarjeta")) { next.payment_method = "card"; recognized.push(text("Card", "Tarjeta")); }
    if (value.includes("2 hour") || value.includes("2 hora")) { setObservedWindow(7200); recognized.push(text("last 2 hours", "últimas 2 horas")); }
    else if (value.includes("15 min")) { setObservedWindow(900); recognized.push(text("last 15 minutes", "últimos 15 minutos")); }
    else if (value.includes("5 min")) { setObservedWindow(300); recognized.push(text("last 5 minutes", "últimos 5 minutos")); }
    else if (value.includes("60 second") || value.includes("60 segundo")) { setObservedWindow(60); recognized.push(text("last 60 seconds", "últimos 60 segundos")); }
    if (value.includes("baseline")) { setReference("baseline"); recognized.push(text("contextual baseline", "baseline contextual")); }
    setScope(next);
    setInterpretation(recognized.length
      ? text(`Understood: ${recognized.join(" · ")}. Review the visible controls, then run the comparison.`, `Entendí: ${recognized.join(" · ")}. Revisá los controles visibles y después ejecutá la comparación.`)
      : text("I could not identify a supported scope. Use provider, country, method and time-window terms, or configure the controls below.", "No pude identificar un alcance compatible. Usá proveedor, país, método y ventana temporal, o configurá los controles de abajo."));
  };

  const run = async () => {
    setBusy(true);
    setError(null);
    const observedResponse = await api.cube(observedWindow);
    const referenceResponse = reference === "baseline" ? null : await api.cube(reference);
    if (!observedResponse.data?.leaves || (reference !== "baseline" && !referenceResponse?.data?.leaves)) {
      setError(text("Comparison unavailable. The previous results remain visible.", "Comparación no disponible. Los resultados anteriores siguen visibles."));
      setBusy(false);
      return;
    }
    const observed = aggregate(scoped(observedResponse.data.leaves, scope));
    const compared = reference === "baseline"
      ? aggregate(scoped(observedResponse.data.leaves, scope), true)
      : aggregate(scoped(referenceResponse!.data!.leaves, scope));
    if (!observed.attempts || !compared.attempts) {
      setError(text("No attempts match this scope in one of the selected windows.", "No hay intentos para este alcance en una de las ventanas seleccionadas."));
      setBusy(false);
      return;
    }
    const delta = (observed.rate - compared.rate) * 100;
    const attemptsPerHour = observed.attempts * (3600 / observedWindow);
    const revenueRisk = Math.max(0, compared.rate - observed.rate) * attemptsPerHour * (observed.avgTicket || 35);
    const result: ComparisonResult = {
      id: Date.now(), scope: { ...scope }, observedWindow, reference,
      observedRate: observed.rate, referenceRate: compared.rate,
      attempts: Math.round(observed.attempts), delta, revenueRisk,
    };
    setResults((current) => [...current, result]);
    setActiveId(result.id);
    setBusy(false);
  };

  return (
    <div className="comparison-overlay" role="dialog" aria-modal="true" aria-label={text("Compare payment windows", "Comparar ventanas de pagos")} ref={dialogRef} onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}>
      <section className="comparison-workspace">
        <header className="comparison-header">
          <div><span><CalendarRange size={14} /> {text("Temporal comparison", "Comparación temporal")}</span><h2>{text("Ask one clear question of the payment stream.", "Hacé una pregunta clara al stream de pagos.")}</h2><p>{text("Every result keeps its scope, windows, sample and data source visible.", "Cada resultado conserva visibles su alcance, ventanas, muestra y fuente de datos.")}</p></div>
          <div><LanguageToggle /><button type="button" data-autofocus onClick={onClose} aria-label={text("Close comparison", "Cerrar comparación")}><X /></button></div>
        </header>

        <div className="comparison-layout">
          <aside className="comparison-builder">
            <form onSubmit={(event) => { event.preventDefault(); interpret(); }}><Search size={15} /><input value={query} onChange={(event) => { setQuery(event.target.value); setInterpretation(null); }} aria-label={text("Describe a comparison", "Describir una comparación")} placeholder={text("Compare Adyen in Brazil against its baseline…", "Compará Adyen en Brasil contra su baseline…")} /><button type="submit">{text("Interpret", "Interpretar")}</button></form>
            {interpretation && <p className={`comparison-interpretation ${interpretation.startsWith(text("I could not", "No pude")) ? "is-warning" : ""}`} role="status">{interpretation}</p>}
            <div className="comparison-fields">
              <label><span>{text("Observed window", "Ventana observada")}</span><select value={observedWindow} onChange={(event) => setObservedWindow(Number(event.target.value))}>{WINDOWS.map((item) => <option key={item.value} value={item.value}>{text(item.en, item.es)}</option>)}</select></label>
              <label><span>{text("Compare against", "Comparar contra")}</span><select value={reference} onChange={(event) => setReference(event.target.value === "baseline" ? "baseline" : Number(event.target.value))}><option value="baseline">{text("Contextual 14-day baseline", "Baseline contextual de 14 días")}</option>{WINDOWS.filter((item) => item.value !== observedWindow).map((item) => <option key={item.value} value={item.value}>{text(item.en, item.es)}</option>)}</select></label>
              <label><span>{text("Merchant", "Comercio")}</span><select value={scope.merchant_id} onChange={(event) => setScope({ ...scope, merchant_id: event.target.value })}><option value="">{text("All", "Todos")}</option><option value="rappido">Rappido</option><option value="tiendita">Tiendita</option><option value="streamplus">Streamplus</option></select></label>
              <label><span>{text("Provider", "Proveedor")}</span><select value={scope.provider_id} onChange={(event) => setScope({ ...scope, provider_id: event.target.value })}><option value="">{text("All", "Todos")}</option><option value="adyen">Adyen</option><option value="dlocal">dLocal</option><option value="mercadopago">MercadoPago</option></select></label>
              <label><span>{text("Method", "Método")}</span><select value={scope.payment_method} onChange={(event) => setScope({ ...scope, payment_method: event.target.value })}><option value="">{text("All", "Todos")}</option><option value="card">{text("Card", "Tarjeta")}</option><option value="pix">PIX</option><option value="pse">PSE</option></select></label>
              <label><span>{text("Country", "País")}</span><select value={scope.country} onChange={(event) => setScope({ ...scope, country: event.target.value })}><option value="">{text("All", "Todos")}</option><option value="BR">{text("Brazil", "Brasil")}</option><option value="MX">{text("Mexico", "México")}</option><option value="CO">Colombia</option></select></label>
            </div>
            <div className="comparison-chips">{chips.map((chip) => <span key={chip}>{chip}</span>)}</div>
            <button className="run-comparison" onClick={run} disabled={busy}>{busy ? text("Comparing…", "Comparando…") : text("Run comparison", "Ejecutar comparación")}<ArrowRight size={14} /></button>
            <small><Database size={12} />{text("Backend aggregate cubes · no raw transactions sent to AI", "Cubos agregados del backend · no se envían transacciones crudas a la IA")}</small>
          </aside>

          <main className="comparison-results">
            <nav aria-label={text("Comparison history", "Historial de comparaciones")}>
              <span>{text("Session queries", "Consultas de la sesión")} ({results.length})</span>
              {results.map((result, index) => {
                const resultObserved = text(WINDOWS.find((item) => item.value === result.observedWindow)?.en ?? "Observed window", WINDOWS.find((item) => item.value === result.observedWindow)?.es ?? "Ventana observada");
                const resultReference = result.reference === "baseline" ? text("Contextual 14-day baseline", "Baseline contextual de 14 días") : text(WINDOWS.find((item) => item.value === result.reference)?.en ?? "Reference window", WINDOWS.find((item) => item.value === result.reference)?.es ?? "Ventana de referencia");
                return <button className={result.id === active?.id ? "is-active" : ""} key={result.id} onClick={() => setActiveId(result.id)}><i>{String(index + 1).padStart(2, "0")}</i><span>{scopeLabel(result.scope, text("All payment traffic", "Todo el tráfico de pagos"), language)}<small>{resultObserved} {text("vs", "contra")} {resultReference}</small></span></button>;
              })}
            </nav>
            <section className="comparison-output">
              {error && <p className="comparison-error">{error}</p>}
              {!active ? <div className="comparison-empty"><CalendarRange size={26} /><strong>{text("No comparison has run yet", "Todavía no ejecutaste una comparación")}</strong><p>{text("Structure a query on the left. Results accumulate here so you can contrast several hypotheses without losing context.", "Estructurá una consulta a la izquierda. Los resultados se acumulan acá para contrastar varias hipótesis sin perder contexto.")}</p></div> : <>
                <header><span>{scopeLabel(active.scope, text("All payment traffic", "Todo el tráfico de pagos"), language)}</span><h3>{active.delta < -1 ? text("A meaningful approval gap is visible.", "Hay una brecha significativa de aprobación.") : text("The selected windows remain broadly aligned.", "Las ventanas seleccionadas permanecen mayormente alineadas.")}</h3><p>{text(WINDOWS.find((item) => item.value === active.observedWindow)?.en ?? "Observed window", WINDOWS.find((item) => item.value === active.observedWindow)?.es ?? "Ventana observada")} {text("vs", "contra")} {active.reference === "baseline" ? text("Contextual 14-day baseline", "Baseline contextual de 14 días") : text(WINDOWS.find((item) => item.value === active.reference)?.en ?? "Reference window", WINDOWS.find((item) => item.value === active.reference)?.es ?? "Ventana de referencia")} · UTC</p></header>
                <div className="comparison-metrics"><div><span>{text("Observed", "Observado")}</span><strong>{(active.observedRate * 100).toFixed(1)}%</strong></div><div><span>{text("Reference", "Referencia")}</span><strong>{(active.referenceRate * 100).toFixed(1)}%</strong></div><div><span>Delta</span><strong className={active.delta < -1 ? "is-negative" : ""}>{active.delta >= 0 ? "+" : ""}{active.delta.toFixed(1)} pp</strong></div></div>
                <div className="comparison-bars"><div><span>{text("Observed approval", "Aprobación observada")}</span><i><b style={{ width: `${Math.max(2, active.observedRate * 100)}%` }} /></i></div><div><span>{text("Reference approval", "Aprobación de referencia")}</span><i><b style={{ width: `${Math.max(2, active.referenceRate * 100)}%` }} /></i></div></div>
                <footer><div><span>{text("Sample", "Muestra")}</span><strong>{active.attempts.toLocaleString()} {text("attempts", "intentos")}</strong></div><div><span>{text("Estimated revenue at risk", "Ingreso estimado en riesgo")}</span><strong>${Math.round(active.revenueRisk).toLocaleString()}/h</strong></div><p>{text("Estimate based on approval gap, observed throughput and average ticket. It is not reconciled revenue.", "Estimación basada en brecha de aprobación, throughput observado y ticket promedio. No es ingreso conciliado.")}</p></footer>
              </>}
            </section>
          </main>
        </div>
      </section>
    </div>
  );
}
