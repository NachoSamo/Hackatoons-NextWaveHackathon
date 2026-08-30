// Typed client for the Centinel backend. Mirrors backend/contracts.py.
// Dev: calls go to "/api/..." and Vite proxies to :8000 (see vite.config.ts).
// Deploy: set VITE_API_BASE to the backend origin.

const BASE = (import.meta.env.VITE_API_BASE as string | undefined) ?? "";

export type PaymentSlice = {
  merchant_id: string | null;
  provider_id: string | null;
  payment_method: string | null;
  country: string | null;
};

export type CostEstimate = {
  usd_per_hour: number;
  lost_approvals_window: number;
  window_seconds: number;
  avg_ticket_usd: number;
  assumptions: string[];
};

export type ParamChange = {
  name: string;
  current: string | number | boolean | null;
  proposed: string | number | boolean | null;
};

export type RecommendedAction = {
  action_id: string;
  title: string;
  owner: string;
  rationale: string;
  params_to_change: ParamChange[];
  expected_impact: string;
  reevaluate_after: string;
  simulation_only: boolean;
};

export type Diagnosis = {
  incident_id: string;
  detected_at: string;
  estimated_start: string;
  slice: PaymentSlice;
  diagnosis_category: string;
  diagnosis_status: string;
  confidence_level: string;
  headline: string;
  executive: string;
  operations: string;
  evidence: string[];
  alternatives: string[];
  missing_data: string[];
  cost: CostEstimate | null;
  recommended_action: RecommendedAction | null;
  llm_used: boolean;
};

export type ScoredIncident = {
  diagnosis: Diagnosis;
  score: number;
  components: Record<string, number>;
};

export type ExplainResponse = {
  diagnoses: Diagnosis[];
  prioritized: ScoredIncident[];
  error?: string;
};

export type EngineOutput = { incidents: unknown[] };

export type CallLog = {
  method: string;
  url: string;
  status: number | "ERR";
  ms: number;
  body: unknown;
  at: string;
};

async function call<T>(
  method: string,
  path: string,
  payload?: unknown
): Promise<{ data: T | null; call: CallLog }> {
  const url = `${BASE}${path}`;
  const started = performance.now();
  const at = new Date().toISOString().slice(11, 23);
  try {
    const res = await fetch(url, {
      method,
      headers: payload ? { "content-type": "application/json" } : undefined,
      body: payload ? JSON.stringify(payload) : undefined,
    });
    const body = await res.json().catch(() => null);
    const log: CallLog = {
      method,
      url,
      status: res.status,
      ms: Math.round(performance.now() - started),
      body,
      at,
    };
    return { data: body as T, call: log };
  } catch (err) {
    return {
      data: null,
      call: {
        method,
        url,
        status: "ERR",
        ms: Math.round(performance.now() - started),
        body: String(err),
        at,
      },
    };
  }
}

export type TickResult = {
  ok: boolean;
  window: number;
  t: string;
  engine_incidents: { id: string; status: string; category: string; slice: string }[];
  diagnoses: Diagnosis[];
  prioritized: ScoredIncident[];
  steps: string[];
  error?: string;
};

export const api = {
  health: () => call<{ status: string }>("GET", "/health"),
  explain: (input: { fixture: string } | EngineOutput) =>
    call<ExplainResponse>("POST", "/api/agent/explain", input),
  getDiagnosis: (id: string) =>
    call<{ diagnosis: Diagnosis | null; error?: string }>(
      "GET",
      `/api/incidents/${encodeURIComponent(id)}/diagnosis`
    ),
  debugReset: () =>
    call<{ ok: boolean; presets: Record<string, string> }>(
      "POST",
      "/api/debug/stream/reset"
    ),
  debugInject: (preset: string) =>
    call<{ ok: boolean; error?: string }>("POST", "/api/debug/inject", { preset }),
  debugTick: () => call<TickResult>("POST", "/api/debug/stream/tick"),
};
