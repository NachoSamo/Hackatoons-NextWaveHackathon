export type SignalPoint = {
  at: string;
  attempts: number;
  approved: number;
  declined: number;
  expectedApproved: number;
  observedRate: number;
  expectedRate: number;
  cumulativeAttempts: number;
  /** Intentos de la ventana de 60 s (overview.attempts). Es el n de la banda de confianza. */
  windowAttempts?: number;
};

const CANDLE_SECONDS = 6;

function candlePoints(points: SignalPoint[]) {
  return points.reduce<SignalPoint[]>((buckets, point) => {
    const [hours, minutes, seconds] = point.at.split(":").map(Number);
    const bucket = Math.floor((hours * 3600 + minutes * 60 + seconds) / CANDLE_SECONDS);
    const previous = buckets.at(-1);
    const previousTime = previous?.at.split(":").map(Number);
    const previousBucket = previousTime ? Math.floor((previousTime[0] * 3600 + previousTime[1] * 60 + previousTime[2]) / CANDLE_SECONDS) : -1;
    if (!previous || previousBucket !== bucket) return [...buckets, { ...point }];
    const attempts = previous.attempts + point.attempts;
    const approved = previous.approved + point.approved;
    const declined = previous.declined + point.declined;
    const expectedApproved = previous.expectedApproved + point.expectedApproved;
    return [...buckets.slice(0, -1), {
      ...point,
      attempts,
      approved,
      declined,
      expectedApproved,
      observedRate: attempts ? (approved / attempts) * 100 : 0,
      expectedRate: attempts ? (expectedApproved / attempts) * 100 : 0,
    }];
  }, []);
}

function expectedPath(points: SignalPoint[], maxVolume: number) {
  if (!points.length) return "";
  const left = 54;
  const width = 846;
  const top = 16;
  const height = 154;
  return points.map((point, index) => {
    const slot = width / Math.max(points.length, 1);
    const x = left + slot * index + slot / 2;
    const y = top + height - (point.expectedApproved / maxVolume) * height;
    return `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
}

export function LiveSignalChart({ points }: { points: SignalPoint[] }) {
  const { text } = useLanguage();
  const candles = candlePoints(points);
  const maxVolume = Math.max(1, ...candles.flatMap((point) => [point.attempts, point.expectedApproved]));
  const expected = expectedPath(candles, maxVolume);
  const chartHeight = 154;
  const chartTop = 16;
  const chartLeft = 54;
  const chartWidth = 846;
  const slot = chartWidth / Math.max(candles.length, 1);
  const barWidth = Math.max(7, Math.min(22, slot * 0.38));
  const ticks = [maxVolume, maxVolume / 2, 0];
  const labels = candles.length > 2
    ? [candles[0], candles[Math.floor((candles.length - 1) / 2)], candles.at(-1)!]
    : candles;

  return (
    <div className={`signal-chart live-signal-chart ${points.length ? "is-running" : "is-empty"}`}>
      <div className="chart-grid" aria-hidden="true" />
      {!points.length && <div className="live-chart-empty">{text("Start the stream to build the timeline", "Iniciá el stream para construir la línea de tiempo")}</div>}
      <svg viewBox="0 0 920 190" role="img" aria-label={text("Transaction volume by processing window: approved, declined and expected approvals", "Volumen de transacciones por ventana: aprobadas, rechazadas y aprobaciones esperadas")}>
        <defs>
          <linearGradient id="approvedGlass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#a7f3c7" stopOpacity=".96" /><stop offset=".42" stopColor="#5ad38f" stopOpacity=".82" /><stop offset="1" stopColor="#267f55" stopOpacity=".62" /></linearGradient>
          <linearGradient id="declinedGlass" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#ffb0aa" stopOpacity=".98" /><stop offset=".45" stopColor="#ff6b60" stopOpacity=".86" /><stop offset="1" stopColor="#9a302b" stopOpacity=".66" /></linearGradient>
          <filter id="candleGlass" x="-80%" y="-25%" width="260%" height="180%"><feDropShadow dx="0" dy="5" stdDeviation="4" floodColor="#000000" floodOpacity=".7" /><feDropShadow dx="0" dy="0" stdDeviation="2.5" floodColor="#8b91ff" floodOpacity=".16" /></filter>
        </defs>
        {ticks.map((tick, index) => {
          const y = chartTop + (index / 2) * chartHeight;
          return <g className="volume-tick" key={tick}><line x1={chartLeft} x2={900} y1={y} y2={y} /><text x="8" y={y + 3}>{Math.round(tick)}</text></g>;
        })}
        {candles.map((point, index) => {
          const x = chartLeft + slot * index + (slot - barWidth) / 2;
          const approvedHeight = (point.approved / maxVolume) * chartHeight;
          const declinedHeight = (point.declined / maxVolume) * chartHeight;
          const baseline = chartTop + chartHeight;
          return <g className="volume-candle" filter="url(#candleGlass)" key={`${point.at}-${index}`}>
            <title>{`${point.at} · ${point.attempts} ${text("attempts", "intentos")} · ${point.approved} ${text("approved", "aprobadas")} · ${point.declined} ${text("declined", "rechazadas")}`}</title>
            <rect className="volume-approved" fill="url(#approvedGlass)" x={x} y={baseline - approvedHeight} width={barWidth} height={approvedHeight} rx="2" />
            <rect className="volume-declined" fill="url(#declinedGlass)" x={x} y={baseline - approvedHeight - declinedHeight} width={barWidth} height={declinedHeight} rx="2" />
          </g>;
        })}
        {expected && <path className="volume-expected" d={expected} />}
      </svg>
      <div className="chart-axis" aria-hidden="true">
        {labels.map((point, index) => <span key={`${point.at}-${index}`}>{point.at}</span>)}
      </div>
    </div>
  );
}
import { useLanguage } from "../i18n";
