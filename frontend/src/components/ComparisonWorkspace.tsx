import { useMemo, useState } from "react";
import { ArrowRight, Building2, CalendarRange, Check, CircleAlert, Database, Search, X } from "lucide-react";
import { api, type CubeLeaf, type EvidenceResponse, type PaymentSlice } from "../api";
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

type MerchantImpact = {
  merchantId: string;
  attempts: number;
  referenceAttempts: number;
  observedRate: number;
  referenceRate: number;
  delta: number;
  lostApprovals: number;
  revenueRiskPerHour: number;
  shareOfRisk: number;
  sampleSufficient: boolean;
};

type CauseEvidence = {
  status: "consistent" | "observed" | "insufficient";
  dominantCode: string;
  beforeShare: number;
  afterShare: number;
  beforeDeclines: number;
  afterDeclines: number;
  affectedIssuers: {
    issuerBank: string;
    attempts: number;
    approvalRate: number;
    deltaPoints: number;
  }[];
};

type ComparisonResult = {
  id: number;
  scope: Scope;
  observedWindow: number;
  reference: "baseline" | number;
  observedRate: number;
  referenceRate: number;
  attempts: number;
  referenceAttempts: number;
  delta: number;
  revenueRisk: number;
  lostApprovalsPerHour: number;
  finding: "supported" | "insufficient" | "healthy";
  confidence: "high" | "medium" | "low";
  merchantImpacts: MerchantImpact[];
  causeEvidence: CauseEvidence | null;
  candidate: {
    scope: Scope;
    observedRate: number;
    referenceRate: number;
    attempts: number;
    delta: number;
  } | null;
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

function leafKey(leaf: CubeLeaf) {
  return [leaf.merchant_id, leaf.provider_id, leaf.payment_method, leaf.country].join("|");
}

function weakestIntersection(observedLeaves: CubeLeaf[], referenceLeaves: CubeLeaf[], baseline: boolean) {
  const references = new Map(referenceLeaves.map((leaf) => [leafKey(leaf), leaf]));
  return observedLeaves.map((leaf) => {
    const referenceLeaf = baseline ? leaf : references.get(leafKey(leaf));
    const observedRate = leaf.attempts ? leaf.approved / leaf.attempts : 0;
    const referenceAttempts = baseline ? leaf.fc_attempts : referenceLeaf?.attempts ?? 0;
    const referenceApproved = baseline ? leaf.fc_approved : referenceLeaf?.approved ?? 0;
    const referenceRate = referenceAttempts ? referenceApproved / referenceAttempts : 0;
    return {
      scope: { merchant_id: leaf.merchant_id, provider_id: leaf.provider_id, payment_method: leaf.payment_method, country: leaf.country },
      observedRate,
      referenceRate,
      attempts: leaf.attempts,
      delta: (observedRate - referenceRate) * 100,
    };
  }).filter((item) => item.attempts > 0 && item.referenceRate > 0).sort((left, right) => left.delta - right.delta)[0] ?? null;
}

function groupByMerchant(leaves: CubeLeaf[]) {
  const grouped = new Map<string, CubeLeaf[]>();
  leaves.forEach((leaf) => grouped.set(leaf.merchant_id, [...(grouped.get(leaf.merchant_id) ?? []), leaf]));
  return grouped;
}

function merchantImpactBreakdown(observedLeaves: CubeLeaf[], referenceLeaves: CubeLeaf[], baseline: boolean, observedWindow: number): MerchantImpact[] {
  const observedByMerchant = groupByMerchant(observedLeaves);
  const referenceByMerchant = groupByMerchant(referenceLeaves);
  const impacts = [...observedByMerchant.entries()].map(([merchantId, merchantLeaves]) => {
    const observed = aggregate(merchantLeaves);
    const compared = baseline
      ? aggregate(merchantLeaves, true)
      : aggregate(referenceByMerchant.get(merchantId) ?? []);
    const approvalGap = Math.max(0, compared.rate - observed.rate);
    const lostApprovals = approvalGap * observed.attempts;
    const revenueRiskPerHour = lostApprovals * (3600 / observedWindow) * (observed.avgTicket || 35);
    return {
      merchantId,
      attempts: Math.round(observed.attempts),
      referenceAttempts: Math.round(compared.attempts),
      observedRate: observed.rate,
      referenceRate: compared.rate,
      delta: (observed.rate - compared.rate) * 100,
      lostApprovals,
      revenueRiskPerHour,
      shareOfRisk: 0,
      sampleSufficient: observed.attempts >= 30 && compared.attempts >= 30,
    };
  }).filter((impact) => impact.attempts > 0 && impact.referenceAttempts > 0);
  const totalRisk = impacts.reduce((sum, impact) => sum + impact.revenueRiskPerHour, 0);
  return impacts
    .map((impact) => ({ ...impact, shareOfRisk: totalRisk > 0 ? impact.revenueRiskPerHour / totalRisk : 0 }))
    .sort((left, right) => right.revenueRiskPerHour - left.revenueRiskPerHour || right.attempts - left.attempts);
}

function buildCauseEvidence(evidence: EvidenceResponse | null): CauseEvidence | null {
  if (!evidence || evidence.error) return null;
  const beforeEntries = Object.entries(evidence.decline_codes.before ?? {});
  const afterEntries = Object.entries(evidence.decline_codes.after ?? {});
  const beforeDeclines = beforeEntries.reduce((sum, [, count]) => sum + count, 0);
  const afterDeclines = afterEntries.reduce((sum, [, count]) => sum + count, 0);
  const dominant = afterEntries.sort((left, right) => right[1] - left[1])[0];
  if (!dominant || !afterDeclines) return null;
  const dominantCode = dominant[0];
  const beforeShare = beforeDeclines ? (evidence.decline_codes.before[dominantCode] ?? 0) / beforeDeclines : 0;
  const afterShare = dominant[1] / afterDeclines;
  const affectedIssuers = evidence.issuers
    .filter((issuer) => issuer.attempts >= 20 && issuer.delta_pts <= -10)
    .sort((left, right) => left.delta_pts - right.delta_pts || right.attempts - left.attempts)
    .slice(0, 3)
    .map((issuer) => ({
      issuerBank: issuer.issuer_bank,
      attempts: issuer.attempts,
      approvalRate: issuer.approval_rate,
      deltaPoints: issuer.delta_pts,
    }));
  const insufficient = evidence.sample_size < 50 || afterDeclines < 10;
  const issuerUnavailablePattern = dominantCode === "91"
    && afterShare >= 0.35
    && afterShare - beforeShare >= 0.20
    && affectedIssuers.length > 0;
  return {
    status: insufficient ? "insufficient" : issuerUnavailablePattern ? "consistent" : "observed",
    dominantCode,
    beforeShare,
    afterShare,
    beforeDeclines,
    afterDeclines,
    affectedIssuers,
  };
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
    const [observedResponse, referenceResponse, evidenceResponse] = await Promise.all([
      api.cube(observedWindow),
      reference === "baseline" ? Promise.resolve(null) : api.cube(reference),
      api.evidence(observedWindow, scope),
    ]);
    if (!observedResponse.data?.leaves || (reference !== "baseline" && !referenceResponse?.data?.leaves)) {
      setError(text("Comparison unavailable. The previous results remain visible.", "Comparación no disponible. Los resultados anteriores siguen visibles."));
      setBusy(false);
      return;
    }
    const observed = aggregate(scoped(observedResponse.data.leaves, scope));
    const observedLeaves = scoped(observedResponse.data.leaves, scope);
    const referenceLeaves = reference === "baseline" ? observedLeaves : scoped(referenceResponse!.data!.leaves, scope);
    const compared = reference === "baseline"
      ? aggregate(observedLeaves, true)
      : aggregate(referenceLeaves);
    if (!observed.attempts || !compared.attempts) {
      setError(text("No attempts match this scope in one of the selected windows.", "No hay intentos para este alcance en una de las ventanas seleccionadas."));
      setBusy(false);
      return;
    }
    const delta = (observed.rate - compared.rate) * 100;
    const attemptsPerHour = observed.attempts * (3600 / observedWindow);
    const aggregateRevenueRisk = Math.max(0, compared.rate - observed.rate) * attemptsPerHour * (observed.avgTicket || 35);
    const aggregateLostApprovalsPerHour = Math.max(0, compared.rate - observed.rate) * attemptsPerHour;
    const candidate = weakestIntersection(observedLeaves, referenceLeaves, reference === "baseline");
    const insufficient = observed.attempts < 50 || compared.attempts < 50 || !candidate || candidate.attempts < 30;
    const meaningfulGap = delta <= -1 || Boolean(candidate && candidate.delta <= -5);
    const finding = insufficient ? "insufficient" : meaningfulGap ? "supported" : "healthy";
    const confidence = insufficient ? "low" : observed.attempts >= 200 && candidate && candidate.attempts >= 80 ? "high" : "medium";
    const merchantImpacts = scope.merchant_id
      ? []
      : merchantImpactBreakdown(observedLeaves, referenceLeaves, reference === "baseline", observedWindow);
    const revenueRisk = merchantImpacts.length
      ? merchantImpacts.reduce((sum, impact) => sum + impact.revenueRiskPerHour, 0)
      : aggregateRevenueRisk;
    const lostApprovalsPerHour = merchantImpacts.length
      ? merchantImpacts.reduce((sum, impact) => sum + impact.lostApprovals * (3600 / observedWindow), 0)
      : aggregateLostApprovalsPerHour;
    const result: ComparisonResult = {
      id: Date.now(), scope: { ...scope }, observedWindow, reference,
      observedRate: observed.rate, referenceRate: compared.rate,
      attempts: Math.round(observed.attempts), referenceAttempts: Math.round(compared.attempts), delta, revenueRisk,
      lostApprovalsPerHour, finding, confidence, candidate, merchantImpacts,
      causeEvidence: buildCauseEvidence(evidenceResponse.data),
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
                <ComparisonFinding result={active} />
                <ComparisonCauseEvidence evidence={active.causeEvidence} finding={active.finding} />
                {active.merchantImpacts.length > 0 && <MerchantImpactBreakdown impacts={active.merchantImpacts} />}
                <footer><div><span>{text("Samples", "Muestras")}</span><strong>{active.attempts.toLocaleString()} / {active.referenceAttempts.toLocaleString()}</strong><small>{text("observed / reference attempts", "intentos observados / referencia")}</small></div><div><span>{text("Estimated revenue at risk", "Ingreso estimado en riesgo")}</span><strong>${Math.round(active.revenueRisk).toLocaleString()}/h</strong><small>{Math.round(active.lostApprovalsPerHour).toLocaleString()} {text("lost approvals/h", "aprobaciones perdidas/h")}</small></div><p>{text("Estimate based on approval gap, observed throughput and average ticket. It is not reconciled revenue.", "Estimación basada en brecha de aprobación, throughput observado y ticket promedio. No es ingreso conciliado.")}</p></footer>
              </>}
            </section>
          </main>
        </div>
      </section>
    </div>
  );
}

function ComparisonCauseEvidence({ evidence, finding }: { evidence: CauseEvidence | null; finding: ComparisonResult["finding"] }) {
  const { language, text } = useLanguage();
  if (!evidence || finding === "healthy") return null;
  const title = evidence.status === "consistent"
    ? text("Issuer-unavailable responses are elevated.", "Las respuestas de emisor no disponible están elevadas.")
    : evidence.status === "insufficient"
      ? text("The decline mix is not large enough to support a cause hypothesis.", "La mezcla de rechazos no alcanza para sostener una hipótesis causal.")
      : text(`Decline code ${evidence.dominantCode} dominates the selected window.`, `El código de rechazo ${evidence.dominantCode} domina la ventana seleccionada.`);
  const issuerSummary = evidence.affectedIssuers.length
    ? evidence.affectedIssuers.map((issuer) => `${localizeToken(issuer.issuerBank, language)} ${issuer.deltaPoints.toFixed(0)} pp`).join(" · ")
    : text("No issuer has enough concentrated degradation", "Ningún emisor concentra degradación suficiente");
  const limitation = evidence.status === "consistent"
    ? text("This evidence supports an availability hypothesis; the comparison does not declare an incident or assign root cause.", "Esta evidencia sostiene una hipótesis de disponibilidad; la comparación no declara un incidente ni asigna causa raíz.")
    : evidence.status === "insufficient"
      ? text("The sample is below the evidence threshold. Expand the window before interpreting the decline mix.", "La muestra está por debajo del umbral de evidencia. Ampliá la ventana antes de interpretar la mezcla de rechazos.")
      : text("A dominant decline code alone is not enough to assign a cause. The live engine still has to validate persistence and concentration.", "Un código de rechazo dominante no alcanza para asignar una causa. El motor vivo todavía debe validar persistencia y concentración.");
  return <section className={`comparison-cause comparison-cause--${evidence.status}`}>
    <header><CircleAlert size={14} /><div><span>{text("Supporting decline evidence", "Evidencia de rechazos complementaria")}</span><strong>{title}</strong></div></header>
    <div>
      <p><span>{text("Dominant response", "Respuesta dominante")}</span><strong>{text("Code", "Código")} {evidence.dominantCode}</strong></p>
      <p><span>{text("Share of declines", "Proporción de rechazos")}</span><strong>{(evidence.beforeShare * 100).toFixed(1)}% → {(evidence.afterShare * 100).toFixed(1)}%</strong><small>{evidence.beforeDeclines.toLocaleString()} / {evidence.afterDeclines.toLocaleString()} {text("declines", "rechazos")}</small></p>
      <p><span>{text("Affected issuers", "Emisores afectados")}</span><strong>{issuerSummary}</strong></p>
    </div>
    <small>{limitation}</small>
  </section>;
}

function MerchantImpactBreakdown({ impacts }: { impacts: MerchantImpact[] }) {
  const { language, text } = useLanguage();
  return <section className="comparison-impact">
    <header><Building2 size={15} /><div><span>{text("Impact by merchant", "Impacto por comercio")}</span><strong>{text("Who absorbed the degradation inside the selected scope", "Quién absorbió la degradación dentro del alcance seleccionado")}</strong></div></header>
    <div className="comparison-impact-table"><table>
      <thead><tr><th>{text("Merchant", "Comercio")}</th><th>{text("Attempts", "Intentos")}</th><th>{text("Approval", "Aprobación")}</th><th>Delta</th><th>{text("Lost approvals", "Aprobaciones perdidas")}</th><th>{text("Risk / hour", "Riesgo / hora")}</th><th>{text("Share of risk", "Porción del riesgo")}</th></tr></thead>
      <tbody>{impacts.map((impact) => <tr key={impact.merchantId}>
        <td><strong>{localizeToken(impact.merchantId, language)}</strong>{!impact.sampleSufficient && <small>{text("Low sample", "Muestra baja")}</small>}</td>
        <td>{impact.attempts.toLocaleString()}</td>
        <td>{(impact.observedRate * 100).toFixed(1)}% <small>{text("vs", "contra")} {(impact.referenceRate * 100).toFixed(1)}%</small></td>
        <td className={impact.delta < -1 ? "is-negative" : ""}>{impact.delta >= 0 ? "+" : ""}{impact.delta.toFixed(1)} pp</td>
        <td>{Math.round(impact.lostApprovals).toLocaleString()}</td>
        <td>${Math.round(impact.revenueRiskPerHour).toLocaleString()}</td>
        <td>{(impact.shareOfRisk * 100).toFixed(1)}%</td>
      </tr>)}</tbody>
    </table></div>
    <small>{text("Ranked by estimated revenue at risk. This attributes affected traffic, not causal ownership; rows below 30 attempts are informational.", "Ordenado por ingreso estimado en riesgo. Esto atribuye tráfico afectado, no responsabilidad causal; las filas con menos de 30 intentos son informativas.")}</small>
  </section>;
}

function ComparisonFinding({ result }: { result: ComparisonResult }) {
  const { language, text } = useLanguage();
  const candidate = result.candidate;
  const candidateLabel = candidate ? scopeLabel(candidate.scope, text("selected traffic", "tráfico seleccionado"), language) : scopeLabel(result.scope, text("selected traffic", "tráfico seleccionado"), language);
  const confidence = result.confidence === "high" ? text("High confidence", "Confianza alta") : result.confidence === "medium" ? text("Medium confidence", "Confianza media") : text("Low confidence", "Confianza baja");
  const title = result.finding === "supported"
    ? text(`${candidateLabel} is the strongest degraded intersection.`, `${candidateLabel} es el cruce con mayor degradación.`)
    : result.finding === "healthy"
      ? text("No material degradation is visible in this comparison.", "No se observa una degradación material en esta comparación.")
      : text("The comparison does not support a root-cause hypothesis yet.", "La comparación todavía no sustenta una hipótesis de causa raíz.");
  const recommendation = result.finding === "supported"
    ? text("Validate the same slice against healthy providers and decline-code evidence. If the contrast holds, prepare a controlled routing simulation for human review.", "Validá el mismo segmento contra proveedores sanos y evidencia de códigos de rechazo. Si el contraste se sostiene, prepará una simulación controlada de ruteo para revisión humana.")
    : result.finding === "healthy"
      ? text("Keep monitoring. No operational action is recommended from these windows.", "Seguí monitoreando. Estas ventanas no justifican una acción operativa.")
      : text("Expand the observed window or narrow the payment scope before assigning ownership or recommending a change.", "Ampliá la ventana observada o acotá el segmento de pagos antes de asignar responsabilidad o recomendar un cambio.");
  return <section className={`comparison-finding comparison-finding--${result.finding}`}>
    <header><span>{text("Comparative diagnosis", "Diagnóstico comparativo")} · {confidence}</span><h4>{title}</h4></header>
    {candidate && <div className="comparison-evidence"><p><Check size={13} /><span>{text("Intersection", "Cruce")}<strong>{candidateLabel}</strong></span></p><p><Check size={13} /><span>{text("Approval contrast", "Contraste de aprobación")}<strong>{(candidate.observedRate * 100).toFixed(1)}% {text("vs", "contra")} {(candidate.referenceRate * 100).toFixed(1)}%</strong></span></p><p><Check size={13} /><span>{text("Candidate sample", "Muestra del cruce")}<strong>{candidate.attempts.toLocaleString()} {text("attempts", "intentos")}</strong></span></p></div>}
    <div className="comparison-recommendation"><span>{text("Recommended human action", "Acción humana recomendada")}</span><p>{recommendation}</p></div>
  </section>;
}
