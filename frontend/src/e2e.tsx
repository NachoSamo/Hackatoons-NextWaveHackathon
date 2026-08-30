// Raw end-to-end debug panel. Not the product UI — this exists to watch the
// backend pipeline run and inspect every field. Route: /e2e
import { useCallback, useEffect, useRef, useState } from "react";
import {
  api,
  type CallLog,
  type Diagnosis,
  type ExplainResponse,
  type ScoredIncident,
  type TickResult,
} from "./api";

const PRESETS = [
  { id: "pix_outage", label: "PIX BR → 70%" },
  { id: "provider_br", label: "Adyen BR degradado" },
  { id: "issuer_mx", label: "Emisor MX over-declining" },
];

const FIXTURES = [
  "dual_incident",
  "provider_degradation",
  "pix_method_outage",
  "weak_signal",
];

export function E2EPanel() {
  const [health, setHealth] = useState<string>("…");
  const [busy, setBusy] = useState(false);
  const [resp, setResp] = useState<ExplainResponse | null>(null);
  const [calls, setCalls] = useState<CallLog[]>([]);
  const [custom, setCustom] = useState("");

  const log = useCallback((c: CallLog) => setCalls((prev) => [c, ...prev].slice(0, 50)), []);

  useEffect(() => {
    api.health().then(({ data, call }) => {
      log(call);
      setHealth(data?.status ?? `unreachable (${call.status})`);
    });
  }, [log]);

  const run = useCallback(
    async (input: { fixture: string } | { incidents: unknown[] }) => {
      setBusy(true);
      const { data, call } = await api.explain(input as never);
      log(call);
      setResp(data);
      setBusy(false);
    },
    [log]
  );

  return (
    <div className="e2e">
      <style>{CSS}</style>
      <header>
        <strong>Centinel · E2E debug</strong>
        <span className="badge">SIMULATION</span>
        <span>backend: <code data-ok={health === "ok"}>{health}</code></span>
      </header>

      <StreamPanel onLog={log} />

      <section className="controls">
        <span className="mono" style={{ opacity: 0.6 }}>o disparar un fixture suelto:</span>
        {FIXTURES.map((f) => (
          <button key={f} disabled={busy} onClick={() => run({ fixture: f })}>
            {busy ? "…" : `Run ${f}`}
          </button>
        ))}
        <details>
          <summary>custom EngineOutput</summary>
          <textarea
            rows={6}
            placeholder='{"incidents":[ ... ]}'
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
          />
          <button
            disabled={busy || !custom.trim()}
            onClick={() => {
              try {
                run(JSON.parse(custom));
              } catch (err) {
                alert(`invalid JSON: ${err}`);
              }
            }}
          >
            Run custom
          </button>
        </details>
      </section>

      {resp?.error && <p className="err">error: {resp.error}</p>}

      {resp && !resp.error && (
        <>
          <Priority items={resp.prioritized} />
          {resp.diagnoses.map((d) => (
            <DiagnosisCard key={d.incident_id} d={d} />
          ))}
          <Raw label="full response" value={resp} />
        </>
      )}

      <CallLogView calls={calls} />
    </div>
  );
}

function StreamPanel({ onLog }: { onLog: (c: CallLog) => void }) {
  const [preset, setPreset] = useState(PRESETS[0].id);
  const [running, setRunning] = useState(false);
  const [tick, setTick] = useState<TickResult | null>(null);
  const [feed, setFeed] = useState<string[]>([]);
  const timer = useRef<number | null>(null);
  const feedRef = useRef<HTMLPreElement | null>(null);

  const stop = useCallback(() => {
    if (timer.current) window.clearInterval(timer.current);
    timer.current = null;
    setRunning(false);
  }, []);

  const doTick = useCallback(async () => {
    const { data, call } = await api.debugTick();
    onLog(call);
    if (data) {
      setTick(data);
      setFeed((prev) => [...prev, ...data.steps].slice(-400));
    }
  }, [onLog]);

  const start = useCallback(async () => {
    stop();
    setFeed([]);
    setTick(null);
    const r = await api.debugReset();
    onLog(r.call);
    const inj = await api.debugInject(preset);
    onLog(inj.call);
    setRunning(true);
    await doTick();
    timer.current = window.setInterval(doTick, 2500);
  }, [preset, stop, doTick, onLog]);

  const reset = useCallback(async () => {
    stop();
    setFeed([]);
    setTick(null);
    onLog((await api.debugReset()).call);
  }, [stop, onLog]);

  useEffect(() => () => stop(), [stop]);
  useEffect(() => {
    if (feedRef.current) feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [feed]);

  return (
    <section className="panel">
      <h3>Pipeline stream (motor real → explain)  ·  el detalle en español va a la consola del backend</h3>
      <div className="controls" style={{ marginBottom: 8 }}>
        {PRESETS.map((p) => (
          <button
            key={p.id}
            disabled={running}
            data-sel={p.id === preset}
            onClick={() => setPreset(p.id)}
          >
            {p.label}
          </button>
        ))}
      </div>
      <div className="controls" style={{ marginBottom: 8 }}>
        <button onClick={start} disabled={running}>▶ Start</button>
        <button onClick={stop} disabled={!running}>⏸ Pause</button>
        <button onClick={reset}>⟲ Reset</button>
        {tick && (
          <span className="mono">
            ventana {tick.window} · motor: {tick.engine_incidents.length} · diagnósticos: {tick.diagnoses.length}
          </span>
        )}
      </div>
      <pre ref={feedRef} className="feed">{feed.join("\n") || "sin datos — apretá Start"}</pre>
      {tick && tick.diagnoses.length > 0 && (
        <>
          <Priority items={tick.prioritized} />
          {tick.diagnoses.map((d) => (
            <DiagnosisCard key={d.incident_id} d={d} />
          ))}
        </>
      )}
    </section>
  );
}

function Priority({ items }: { items: ScoredIncident[] }) {
  if (!items.length) return null;
  return (
    <section className="panel">
      <h3>priority queue</h3>
      <table>
        <thead>
          <tr>
            <th>#</th><th>incident</th><th>category</th><th>score</th><th>components</th>
          </tr>
        </thead>
        <tbody>
          {items.map((s, i) => (
            <tr key={s.diagnosis.incident_id}>
              <td>{i + 1}</td>
              <td>{s.diagnosis.incident_id}</td>
              <td>{s.diagnosis.diagnosis_category}</td>
              <td>{s.score.toFixed(3)}</td>
              <td className="mono">
                {Object.entries(s.components)
                  .map(([k, v]) => `${k}=${v.toFixed(2)}`)
                  .join("  ")}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}

function DiagnosisCard({ d }: { d: Diagnosis }) {
  const a = d.recommended_action;
  return (
    <section className="panel">
      <h3>{d.headline}</h3>
      <div className="tags">
        <span>{d.incident_id}</span>
        <span>{d.diagnosis_category}</span>
        <span data-warn={d.diagnosis_status !== "supported"}>{d.diagnosis_status}</span>
        <span>confidence: {d.confidence_level}</span>
        <span data-ok={d.llm_used}>llm_used: {String(d.llm_used)}</span>
        <span className="mono">{fmtSlice(d.slice)}</span>
      </div>

      <h4>executive</h4>
      <p>{d.executive}</p>
      <h4>operations</h4>
      <p>{d.operations}</p>

      <h4>evidence</h4>
      <ul>{d.evidence.map((e, i) => <li key={i}>{e}</li>)}</ul>

      {d.alternatives.length > 0 && (
        <>
          <h4>alternatives</h4>
          <ul>{d.alternatives.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </>
      )}
      {d.missing_data.length > 0 && (
        <>
          <h4>missing data</h4>
          <ul>{d.missing_data.map((e, i) => <li key={i}>{e}</li>)}</ul>
        </>
      )}

      <h4>cost</h4>
      {d.cost ? (
        <p>
          <strong>${d.cost.usd_per_hour.toLocaleString(undefined, { maximumFractionDigits: 0 })}/hr</strong>
          {" — "}{d.cost.lost_approvals_window.toFixed(0)} lost approvals /
          {d.cost.window_seconds}s · avg ticket ${d.cost.avg_ticket_usd}
          <br />
          <em>{d.cost.assumptions.join(" ")}</em>
        </p>
      ) : (
        <p>— (none: status is {d.diagnosis_status})</p>
      )}

      <h4>recommended action</h4>
      {a ? (
        <div>
          <p>
            <strong>{a.title}</strong> · owner: {a.owner}
            {a.simulation_only && " · simulation only"}
          </p>
          <p>{a.rationale}</p>
          {a.params_to_change.length > 0 && (
            <table>
              <thead><tr><th>param</th><th>current</th><th>proposed</th></tr></thead>
              <tbody>
                {a.params_to_change.map((p, i) => (
                  <tr key={i}>
                    <td className="mono">{p.name}</td>
                    <td>{String(p.current)}</td>
                    <td>{String(p.proposed)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p><em>expected impact:</em> {a.expected_impact}</p>
          <p><em>reevaluate after:</em> {a.reevaluate_after}</p>
        </div>
      ) : (
        <p>— (none)</p>
      )}

      <Raw label="raw diagnosis" value={d} />
    </section>
  );
}

function Raw({ label, value }: { label: string; value: unknown }) {
  return (
    <details className="raw">
      <summary>{label} (JSON)</summary>
      <pre>{JSON.stringify(value, null, 2)}</pre>
    </details>
  );
}

function CallLogView({ calls }: { calls: CallLog[] }) {
  return (
    <section className="panel log">
      <h3>call log</h3>
      {calls.length === 0 && <p>no calls yet</p>}
      {calls.map((c, i) => (
        <details key={i}>
          <summary>
            <span className="mono">{c.at}</span> {c.method}{" "}
            <span className="mono">{c.url}</span>{" "}
            <span data-ok={c.status === 200} data-err={c.status === "ERR"}>{c.status}</span>{" "}
            {c.ms}ms
          </summary>
          <pre>{JSON.stringify(c.body, null, 2)}</pre>
        </details>
      ))}
    </section>
  );
}

function fmtSlice(s: Diagnosis["slice"]) {
  const parts = Object.entries(s).filter(([, v]) => v);
  return parts.length ? parts.map(([k, v]) => `${k}=${v}`).join(" / ") : "*";
}

const CSS = `
.e2e { font: 13px/1.5 ui-monospace, SFMono-Regular, Menlo, monospace; color: #ddd;
  background: #14161a; padding: 16px; min-height: 100vh; max-width: 1100px; margin: 0 auto; }
.e2e header { display: flex; gap: 12px; align-items: center; margin-bottom: 16px; }
.e2e .badge { background: #b8860b; color: #000; padding: 1px 6px; border-radius: 3px; font-size: 11px; }
.e2e code { background: #222; padding: 1px 5px; border-radius: 3px; }
.e2e code[data-ok="true"], .e2e span[data-ok="true"] { color: #6fcf76; }
.e2e span[data-warn="true"] { color: #e0a33a; }
.e2e span[data-err="true"] { color: #e06c6c; }
.e2e .controls { display: flex; flex-wrap: wrap; gap: 8px; align-items: flex-start; margin-bottom: 16px; }
.e2e button { background: #2a2f37; color: #ddd; border: 1px solid #444; border-radius: 4px;
  padding: 6px 12px; cursor: pointer; font: inherit; }
.e2e button:disabled { opacity: .5; cursor: default; }
.e2e button[data-sel="true"] { border-color: #6fcf76; color: #6fcf76; }
.e2e .feed { background: #0b0d10; color: #c8d0d8; padding: 10px 12px; border-radius: 4px;
  font-size: 11.5px; line-height: 1.45; max-height: 360px; overflow-y: auto; white-space: pre-wrap;
  border: 1px solid #2a2f37; }
.e2e textarea { width: 480px; background: #0e1013; color: #ddd; border: 1px solid #444;
  border-radius: 4px; font: inherit; display: block; margin: 6px 0; }
.e2e .panel { border: 1px solid #333; border-radius: 6px; padding: 12px 16px; margin-bottom: 14px;
  background: #181b20; }
.e2e h3 { margin: 0 0 8px; font-size: 14px; color: #fff; }
.e2e h4 { margin: 12px 0 2px; font-size: 11px; text-transform: uppercase; letter-spacing: .08em; color: #888; }
.e2e p { margin: 2px 0; }
.e2e ul { margin: 2px 0; padding-left: 20px; }
.e2e .tags { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 6px; }
.e2e .tags span { background: #262b33; padding: 1px 7px; border-radius: 10px; font-size: 11px; }
.e2e table { border-collapse: collapse; margin: 6px 0; width: 100%; }
.e2e th, .e2e td { border: 1px solid #333; padding: 3px 8px; text-align: left; font-size: 12px; }
.e2e th { background: #22262e; }
.e2e .mono { font-family: inherit; color: #9ab; }
.e2e .raw pre, .e2e .log pre { background: #0e1013; padding: 8px; border-radius: 4px; overflow-x: auto;
  font-size: 11px; max-height: 320px; }
.e2e .err { color: #e06c6c; }
.e2e .log summary { cursor: pointer; padding: 3px 0; }
.e2e details.raw > summary { cursor: pointer; color: #888; margin-top: 8px; }
`;
