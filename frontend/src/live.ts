// Adapter: el snapshot del backend (Diagnosis + engine_incidents) → la forma
// `Incident` que ya usa la CommandCenter de Juani. Funciones puras.
import type { DiagnosisSnapshot, Overview } from "./api";

export type LiveIncident = {
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
  slice: Partial<{
    merchantId: string;
    providerId: string;
    paymentMethod: string;
    country: string;
  }>;
  lifecycle: { endsAt: string | null; stoppedAt: string | null; mitigatedAt: string | null };
};

const CODE_LABEL: Record<string, string> = {
  "05": "Do Not Honor",
  "51": "Insufficient Funds",
  "91": "Issuer Unavailable",
  "96": "System Malfunction",
  "14": "Invalid Card Number",
  "54": "Expired Card",
  "41": "Lost Card",
  "43": "Stolen Card",
  N7: "CVV Mismatch",
  "61": "Exceeds Limit",
  "65": "Activity Limit",
};

const money = (n: number) =>
  n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${Math.round(n)}`;

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

type EngineIncident = DiagnosisSnapshot["engine_incidents"][number] & {
  slice: Record<string, string | null>;
  slice_label: string;
  baseline_rate: number;
  observed_rate: number;
  delta_pp: number;
  sample_size: number;
  estimated_lost_approvals: number;
  dominant_code: string | null;
  detected_at: string;
  priority_score: number;
};

export function buildIncidents(
  snap: DiagnosisSnapshot | null,
  overview: Overview | null
): LiveIncident[] {
  if (!snap || !snap.diagnoses.length) return [];
  const topId = snap.prioritized[0]?.diagnosis.incident_id;
  const totalAttempts = overview?.attempts ?? 0;
  const injection = (snap.active_injections?.[0] ?? {}) as Record<string, unknown>;

  return snap.diagnoses.map((d) => {
    const eng = snap.engine_incidents.find((e) => e.id === d.incident_id) as
      | EngineIncident
      | undefined;
    const s = d.slice;
    const scope =
      [s.provider_id, s.merchant_id, s.payment_method, s.country]
        .filter(Boolean)
        .map((x) => cap(String(x)))
        .join(" · ") || "All traffic";

    const code = eng?.dominant_code;
    return {
      id: d.incident_id,
      priority: d.incident_id === topId ? "P1" : "P2",
      scope,
      risk: d.cost ? `${money(d.cost.usd_per_hour)} /h` : "—",
      confidence: d.confidence_level === "high" ? "High" : "Medium",
      impact: eng
        ? `${eng.delta_pp <= 0 ? "−" : "+"}${Math.abs(eng.delta_pp).toFixed(1)} pp`
        : "—",
      attempts: eng
        ? `${eng.sample_size.toLocaleString()}${
            totalAttempts ? ` (${((100 * eng.sample_size) / totalAttempts).toFixed(1)}%)` : ""
          }`
        : "—",
      startedAt: eng ? `${new Date(eng.detected_at).toISOString().slice(11, 19)} UTC` : "",
      declineCode: code
        ? `${code} · ${CODE_LABEL[code] ?? "Decline"}`
        : d.diagnosis_category.replace(/_/g, " "),
      latency: "—",
      slice: {
        merchantId: s.merchant_id ?? undefined,
        providerId: s.provider_id ?? undefined,
        paymentMethod: s.payment_method ?? undefined,
        country: s.country ?? undefined,
      },
      lifecycle: {
        endsAt: (injection["ends_at"] as string | null) ?? null,
        stoppedAt: (injection["stopped_at"] as string | null) ?? null,
        mitigatedAt: (injection["mitigated_at"] as string | null) ?? null,
      },
    };
  });
}
