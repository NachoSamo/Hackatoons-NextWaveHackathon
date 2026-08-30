import type { Diagnosis, PaymentSlice, RecommendedAction } from "./api";
import type { Language } from "./i18n";

const ES: Record<string, string> = {
  high: "alta",
  medium: "media",
  low: "baja",
  supported: "sustentado",
  detected: "detectado",
  validating: "validando",
  diagnosing: "diagnosticando",
  insufficient_evidence: "evidencia insuficiente",
  resolved: "resuelto",
  provider_degradation: "degradación del proveedor",
  issuer_unavailable: "emisor no disponible",
  issuer_declining: "rechazos elevados del emisor",
  payment_method_outage: "caída del método de pago",
  method_degradation: "degradación del método de pago",
  merchant_integration_error: "error de integración del comercio",
  merchant_configuration: "configuración del comercio",
  unclassified: "causa no clasificada",
  yuno: "Yuno",
  issuer: "emisor",
  merchant: "comercio",
  none: "sin asignar",
  card: "tarjeta",
  wallet: "billetera",
  soft: "blando",
  hard: "duro",
  window: "ventana",
  system: "sistema",
  scope: "alcance",
  diagnosis: "diagnóstico",
  localizer: "localizador",
  explanation: "explicación",
  generator: "generador",
  injector: "inyector",
  bridge: "puente",
  explain: "explicación",
  priority: "prioridad",
  loop: "ciclo",
  impact: "impacto",
  persistence: "persistencia",
  confidence: "confianza",
  merchant_criticality: "criticidad del comercio",
  routing_target: "destino de routing",
  immediate_retry: "reintento inmediato",
  issuer_escalation: "escalamiento al emisor",
  method_availability: "disponibilidad del método",
  integration_change: "cambio de integración",
  payment_configuration: "configuración de pagos",
  enabled: "habilitado",
  active: "activo",
  "not opened": "no abierto",
  "healthy alternative provider": "proveedor alternativo saludable",
  "controlled retry after issuer recovery": "reintento controlado después de la recuperación del emisor",
  "open with evidence bundle": "abrir con el paquete de evidencia",
  "surface healthy alternatives": "mostrar alternativas saludables",
  "current deployment": "despliegue actual",
  "review or roll back the latest affected change": "revisar o revertir el último cambio afectado",
  "active configuration": "configuración activa",
  "validate against the last known healthy configuration": "validar contra la última configuración saludable conocida",
  "Issuer Unavailable": "Emisor no disponible",
  "Do Not Honor": "No autorizar",
  "System Malfunction": "Falla del sistema",
  "Insufficient Funds": "Fondos insuficientes",
  "Exceeds Limit": "Supera el límite",
  "Activity Limit": "Límite de actividad",
  "Invalid Card Number": "Número de tarjeta inválido",
  "Expired Card": "Tarjeta vencida",
  "Lost Card": "Tarjeta perdida",
  "Stolen Card": "Tarjeta robada",
  "CVV Mismatch": "CVV incorrecto",
  "ripple match": "coincidencia de propagación",
  "approval rate drop": "caída de la tasa de aprobación",
  "explains majority of deficit": "explica la mayor parte del déficit",
  "provider slice localized": "segmento del proveedor localizado",
  "code 91 spike": "aumento del código 91",
  "multiple issuers affected": "múltiples emisores afectados",
  "alternative providers healthy": "proveedores alternativos saludables",
};

const ES_LOWER = Object.fromEntries(Object.entries(ES).map(([key, value]) => [key.toLowerCase(), value]));

export function localizeToken(value: string, language: Language) {
  if (language === "en") return value.replaceAll("_", " ");
  return ES[value] ?? ES_LOWER[value.toLowerCase()] ?? ES_LOWER[value.replaceAll("_", " ").toLowerCase()] ?? value.replaceAll("_", " ");
}

export function localizeScope(slice: PaymentSlice, language: Language) {
  const labels: Record<keyof PaymentSlice, [string, string]> = {
    merchant_id: ["merchant", "comercio"],
    provider_id: ["provider", "proveedor"],
    payment_method: ["method", "método"],
    country: ["country", "país"],
  };
  return Object.entries(slice)
    .filter(([, value]) => value)
    .map(([key, value]) => `${labels[key as keyof PaymentSlice][language === "es" ? 1 : 0]}: ${localizeToken(String(value), language)}`)
    .join(" · ");
}

export function localizeEvidence(value: string, language: Language) {
  if (language === "en") return value;
  let match = value.match(/^Approval rate fell from (.+) to (.+) in the affected slice \(n=(\d+)\)\.$/);
  if (match) return `La tasa de aprobación cayó de ${match[1]} a ${match[2]} en el segmento afectado (n=${match[3]}).`;
  match = value.match(/^The 95% Wilson interval for the observed rate is (.+)–(.+)\.$/);
  if (match) return `El intervalo de Wilson del 95% para la tasa observada es ${match[1]}–${match[2]}.`;
  match = value.match(/^Code (.+) \((.+)\) rose from (.+) to (.+) of declines in the affected slice\.$/);
  if (match) return `El código ${match[1]} (${localizeToken(match[2], language)}) subió de ${match[3]} a ${match[4]} de los rechazos del segmento afectado.`;
  match = value.match(/^(.+) approved (.+) of (\d+) attempts, ([+-]?\d+) points versus baseline\.$/);
  if (match) return `${match[1]} aprobó el ${match[2]} de ${match[3]} intentos, ${match[4]} puntos contra el baseline.`;
  match = value.match(/^Signal: (.+)\.$/);
  if (match) return `Señal: ${localizeToken(match[1], language)}.`;
  match = value.match(/^(.+) \(score ([\d.]+)\)\.$/);
  if (match) return `${localizeToken(match[1], language)} (puntaje ${match[2]}).`;
  const exact: Record<string, string> = {
    "No competing explanation scored strongly enough to list.": "Ninguna explicación alternativa alcanzó un puntaje suficiente para mostrarse.",
    "More observations are needed before assigning an actionable cause.": "Se necesitan más observaciones antes de asignar una causa accionable.",
    "The sample is below 30 attempts; monitor the next window.": "La muestra tiene menos de 30 intentos; monitoreá la próxima ventana.",
    "No decline-code shift was available for this slice.": "No hay un cambio de códigos de rechazo disponible para este segmento.",
    "Issuer-level evidence is unavailable.": "No hay evidencia disponible a nivel de emisor.",
  };
  return exact[value] ?? value;
}

function where(diagnosis: Diagnosis, language: Language) {
  const values = Object.values(diagnosis.slice).filter(Boolean).map((value) => localizeToken(String(value), language));
  return values.join(" / ") || (language === "es" ? "el tráfico seleccionado" : "the selected traffic");
}

export function diagnosisHeadline(diagnosis: Diagnosis, language: Language) {
  if (language === "en") return diagnosis.headline;
  const category = localizeToken(diagnosis.diagnosis_category, language);
  return diagnosis.cost
    ? `${category[0].toUpperCase()}${category.slice(1)} en ${where(diagnosis, language)} — aproximadamente USD ${Math.round(diagnosis.cost.usd_per_hour).toLocaleString("es-AR")}/h en riesgo`
    : `${category[0].toUpperCase()}${category.slice(1)} en ${where(diagnosis, language)} — evidencia todavía insuficiente`;
}

export function localizeAction(action: RecommendedAction, diagnosis: Diagnosis, language: Language) {
  if (language === "en") return action;
  const country = diagnosis.slice.country ?? "el país afectado";
  const provider = diagnosis.slice.provider_id ?? "el proveedor afectado";
  const issuer = "el emisor afectado";
  const method = localizeToken(diagnosis.slice.payment_method ?? "método afectado", language);
  const merchant = diagnosis.slice.merchant_id ?? "el comercio afectado";
  const copy: Record<string, Pick<RecommendedAction, "title" | "rationale" | "expected_impact" | "reevaluate_after">> = {
    reroute_provider_slice: { title: `Simular el desvío del tráfico de ${country} fuera de ${provider}`, rationale: "Validá alternativas saludables y después simulá un desvío controlado del segmento afectado.", expected_impact: "Puede reducir la exposición mientras los proveedores alternativos continúen saludables.", reevaluate_after: "5 minutos" },
    monitor_issuer_recovery: { title: `Monitorear la disponibilidad de ${issuer} y escalar la evidencia`, rationale: "Compartí la evidencia del emisor afectado y evitá reintentos inmediatos repetidos.", expected_impact: "Evita reintentos inmediatos innecesarios mientras el emisor no está disponible.", reevaluate_after: "10 minutos" },
    escalate_issuer_declines: { title: `Escalar los rechazos elevados del emisor en ${country}`, rationale: "Escalá el patrón concentrado del emisor junto con la evidencia de códigos de respuesta.", expected_impact: "Abre una investigación enfocada con el emisor; la recuperación no está garantizada.", reevaluate_after: "15 minutos" },
    review_payment_method: { title: `Revisar el rendimiento de ${method} en ${country}`, rationale: "Verificá la configuración del método y mostrale al cliente una alternativa saludable cuando corresponda.", expected_impact: "Puede reducir la exposición del cliente mientras se investiga el método.", reevaluate_after: "10 minutos" },
    inspect_merchant_integration: { title: `Inspeccionar la integración de ${merchant} entre los proveedores afectados`, rationale: "Compará los cambios recientes de integración con controles saludables antes de revertir o corregir el mapeo.", expected_impact: "Puede recuperar la calidad de autorización si un cambio del comercio causó el patrón.", reevaluate_after: "5 minutos" },
    review_merchant_configuration: { title: `Revisar la configuración de pagos de ${merchant}`, rationale: "Validá la configuración afectada y simulá la corrección antes de aplicar cualquier cambio.", expected_impact: "Puede recuperar aprobaciones si una regla o límite del comercio está mal configurado.", reevaluate_after: "10 minutos" },
    monitor_for_evidence: { title: "Monitorear el segmento de pagos afectado", rationale: "No cambies el routing ni los reintentos hasta que la evidencia sea suficiente.", expected_impact: "Evita un cambio operativo prematuro mientras se acumula evidencia.", reevaluate_after: "próxima ventana de 60 segundos" },
  };
  const localized = copy[action.action_id];
  return {
    ...action,
    ...(localized ?? {}),
    owner: localizeToken(action.owner, language),
    params_to_change: action.params_to_change.map((param) => ({
      ...param,
      name: localizeToken(param.name, language),
      current: typeof param.current === "string" ? localizeToken(param.current, language) : param.current,
      proposed: typeof param.proposed === "string" ? localizeToken(param.proposed, language) : param.proposed,
    })),
  };
}

export function diagnosisNarrative(diagnosis: Diagnosis, audience: "operations" | "executive", language: Language) {
  if (language === "en" && audience === "executive") return diagnosis.executive;
  const category = localizeToken(diagnosis.diagnosis_category, language);
  const action = diagnosis.recommended_action ? localizeAction(diagnosis.recommended_action, diagnosis, language) : null;
  if (audience === "executive") {
    const impact = diagnosis.cost ? ` Hay aproximadamente USD ${Math.round(diagnosis.cost.usd_per_hour).toLocaleString("es-AR")} por hora en riesgo.` : " El impacto monetario todavía no puede estimarse con confianza.";
    return `${category[0].toUpperCase()}${category.slice(1)} afecta ${where(diagnosis, language)}.${impact}${action ? ` Próximo paso recomendado: ${action.title}.` : ""}`;
  }
  const primaryEvidence = diagnosis.evidence[0]
    ? localizeEvidence(diagnosis.evidence[0], language)
    : language === "es" ? "Todavía no hay una medición concluyente." : "No conclusive measurement is available yet.";
  const started = new Date(diagnosis.estimated_start).toLocaleTimeString(language === "es" ? "es-AR" : "en-US", { hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  if (diagnosis.diagnosis_status !== "supported") {
    return language === "es"
      ? `Centinel detectó un desvío en ${where(diagnosis, language)}, pero todavía no hay evidencia suficiente para asignar una causa raíz. ${primaryEvidence}`
      : `Centinel detected a deviation in ${where(diagnosis, language)}, but the evidence is not sufficient to assign a root cause yet. ${primaryEvidence}`;
  }
  const impact = diagnosis.cost
    ? language === "es"
      ? `Impacto estimado: USD ${Math.round(diagnosis.cost.usd_per_hour).toLocaleString("es-AR")}/h.`
      : `Estimated impact: $${Math.round(diagnosis.cost.usd_per_hour).toLocaleString("en-US")}/h.`
    : language === "es" ? "El impacto monetario todavía no está disponible." : "Monetary impact is not available yet.";
  return language === "es"
    ? `Causa raíz: ${category} en ${where(diagnosis, language)} desde las ${started}. ${primaryEvidence} ${impact}`
    : `Root cause: ${category} in ${where(diagnosis, language)} since ${started}. ${primaryEvidence} ${impact}`;
}
