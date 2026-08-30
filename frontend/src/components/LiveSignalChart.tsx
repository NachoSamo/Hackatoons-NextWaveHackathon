export type SignalPoint = {
  at: string;
  attempts: number;
  approved: number;
  declined: number;
  expectedApproved: number;
  observedRate: number;
  expectedRate: number;
  cumulativeAttempts: number;
};

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
  const maxVolume = Math.max(1, ...points.flatMap((point) => [point.attempts, point.expectedApproved]));
  const expected = expectedPath(points, maxVolume);
  const chartHeight = 154;
  const chartTop = 16;
  const chartLeft = 54;
  const chartWidth = 846;
  const slot = chartWidth / Math.max(points.length, 1);
  const barWidth = Math.max(4, Math.min(20, slot * 0.58));
  const ticks = [maxVolume, maxVolume / 2, 0];
  const labels = points.length > 2
    ? [points[0], points[Math.floor((points.length - 1) / 2)], points.at(-1)!]
    : points;

  return (
    <div className={`signal-chart live-signal-chart ${points.length ? "is-running" : "is-empty"}`}>
      <div className="chart-grid" aria-hidden="true" />
      {!points.length && <div className="live-chart-empty">{text("Start the stream to build the timeline", "Iniciá el stream para construir la línea de tiempo")}</div>}
      <svg viewBox="0 0 920 190" role="img" aria-label={text("Transaction volume by processing window: approved, declined and expected approvals", "Volumen de transacciones por ventana: aprobadas, rechazadas y aprobaciones esperadas")}>
        {ticks.map((tick, index) => {
          const y = chartTop + (index / 2) * chartHeight;
          return <g className="volume-tick" key={tick}><line x1={chartLeft} x2={900} y1={y} y2={y} /><text x="8" y={y + 3}>{Math.round(tick)}</text></g>;
        })}
        {points.map((point, index) => {
          const x = chartLeft + slot * index + (slot - barWidth) / 2;
          const approvedHeight = (point.approved / maxVolume) * chartHeight;
          const declinedHeight = (point.declined / maxVolume) * chartHeight;
          const baseline = chartTop + chartHeight;
          return <g className="volume-candle" key={`${point.at}-${index}`}>
            <title>{`${point.at} · ${point.attempts} ${text("attempts", "intentos")} · ${point.approved} ${text("approved", "aprobadas")} · ${point.declined} ${text("declined", "rechazadas")}`}</title>
            <rect className="volume-approved" x={x} y={baseline - approvedHeight} width={barWidth} height={approvedHeight} rx="1" />
            <rect className="volume-declined" x={x} y={baseline - approvedHeight - declinedHeight} width={barWidth} height={declinedHeight} rx="1" />
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
