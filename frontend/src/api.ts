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

export type CubeLeaf = {
  merchant_id: string;
  provider_id: string;
  payment_method: string;
  country: string;
  attempts: number;
  approved: number;
  fc_attempts: number;
  fc_approved: number;
  amount_usd_sum: number;
};

export type CubeResponse = {
  window_s: number;
  leaves: CubeLeaf[];
  error?: string;
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

// Snapshot del loop de diagnóstico vivo (GET /api/diagnosis).
export type DiagnosisSnapshot = {
  window: number;
  ts: string | null;
  engine_incidents: { id: string; status: string; category: string; slice: string }[];
  diagnoses: Diagnosis[];
  prioritized: ScoredIncident[];
  active_injections: Record<string, unknown>[];
  slack_alerts: SlackAlert[];
  error: string | null;
  log_tail: string[];
};

// Alerta efectivamente entregada al canal de devs (backend/notify_slack.py).
export type SlackAlert = {
  incident_id: string;
  headline: string;
  action: string;
  at: string;
};

export type Overview = {
  window_s: number;
  view_filters?: Record<string, string>;
  stream: { ts: string; observed_rate: number; expected_rate: number; tx_count: number } | null;
  attempts: number;
  approved: number;
  observed_rate: number;
  expected_rate: number;
  active_incidents: Record<string, unknown>[];
  replay_error: string | null;
  copy_error: string | null;
  simulation_only: boolean;
};

export type StreamSnapshot = { ts: string; observed_rate: number; expected_rate: number; tx_count: number };

export type CopilotResponse = {
  answer: string | null;
  llm_used: boolean;
  out_of_scope: boolean;
  error?: string;
};

export type InjectBody =
  | { preset_id: string }
  | { filters?: Record<string, string>; magnitude: number; decline_code: string; duration_s?: number; label?: string };

export type InjectOptions = {
  filter_fields: string[];
  merchants: string[];
  providers: string[];
  countries: string[];
  methods_by_country: Record<string, string[]>;
  issuers_by_country: Record<string, string[]>;
  decline_codes: { code: string; name?: string; type?: string; [key: string]: unknown }[];
  magnitude: { min: number; max: number; step: number; meaning: string };
  simulation_only: boolean;
};

const BASE_URL = BASE || "";

export const api = {
  health: () => call<{ status: string }>("GET", "/health"),
  explain: (input: { fixture: string } | EngineOutput) =>
    call<ExplainResponse>("POST", "/api/agent/explain", input),
  // Refina una respuesta que el frontend YA mostró. Si falla, el caller no cambia nada.
  askCopilot: (diagnosis: Diagnosis, question: string) =>
    call<CopilotResponse>("POST", "/api/copilot/ask", { diagnosis, question }),
  cube: (windowSeconds: number) =>
    call<CubeResponse>("GET", `/api/cube?window_s=${windowSeconds}`),

  // loop de diagnóstico vivo
  getSnapshot: () => call<DiagnosisSnapshot>("GET", "/api/diagnosis"),
  // viewFilters acota SOLO los KPIs (dimensiones del cubo). El `stream` sigue global.
  getOverview: (viewFilters?: Record<string, string>) => {
    const query = new URLSearchParams(
      Object.entries(viewFilters ?? {}).filter(([, value]) => value)
    ).toString();
    return call<Overview>("GET", `/api/overview${query ? `?${query}` : ""}`);
  },

  // injector real de Pena
  getInjectOptions: () => call<InjectOptions>("GET", "/api/inject/options"),
  inject: (body: InjectBody) =>
    call<{ incident_id?: string; incident?: unknown; error?: string }>("POST", "/api/inject", body),
  stopIncident: (id: string) =>
    call<{ incident_id: string; error?: string }>("POST", `/api/inject/${encodeURIComponent(id)}/stop`),
  applyAction: (id: string) =>
    call<{ incident_id: string; simulation_only: boolean; message?: string; error?: string }>(
      "POST", "/api/actions/apply", { incident_id: id }
    ),
  // el reset de la demo también resetea el motor del loop
  resetDemo: async () => {
    const a = await call<Record<string, unknown>>("POST", "/api/demo/reset");
    const b = await call<{ ok: boolean }>("POST", "/api/diagnosis/reset");
    const failed = [a.call, b.call].find((entry) => entry.status === "ERR" || Number(entry.status) >= 400);
    return {
      data: { demo: a.data, diagnosis: b.data },
      call: failed ?? a.call,
      ok: !failed && a.data !== null && b.data?.ok !== false,
    };
  },

  // SSE del ticker (GET /api/stream). Devuelve una función para desuscribirse.
  subscribeStream: (
    onSnapshot: (s: StreamSnapshot) => void,
    onError?: (e: Event) => void
  ): (() => void) => {
    const es = new EventSource(`${BASE_URL}/api/stream`);
    es.onmessage = (ev) => {
      try {
        onSnapshot(JSON.parse(ev.data) as StreamSnapshot);
      } catch {
        /* ignore malformed frame */
      }
    };
    if (onError) es.onerror = onError;
    return () => es.close();
  },
};
