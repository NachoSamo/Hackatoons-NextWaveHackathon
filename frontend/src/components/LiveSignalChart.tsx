export type SignalPoint = {
  at: string;
  observed: number;
  expected: number;
};

function pathFor(points: SignalPoint[], key: "observed" | "expected") {
  if (!points.length) return "";
  const width = 920;
  const top = 20;
  const height = 125;
  const values = points.flatMap((point) => [point.observed, point.expected]);
  const min = Math.min(55, ...values) - 2;
  const max = Math.max(92, ...values) + 2;
  if (points.length === 1) {
    const y = top + ((max - points[0][key]) / Math.max(max - min, 1)) * height;
    return `M18 ${y.toFixed(1)} L902 ${y.toFixed(1)}`;
  }
  return points.map((point, index) => {
    const x = points.length === 1 ? 18 : 18 + (index / (points.length - 1)) * (width - 36);
    const y = top + ((max - point[key]) / Math.max(max - min, 1)) * height;
    return `${index ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`;
  }).join(" ");
}

export function LiveSignalChart({ points }: { points: SignalPoint[] }) {
  const { text } = useLanguage();
  const observed = pathFor(points, "observed");
  const expected = pathFor(points, "expected");
  const labels = points.length > 2
    ? [points[0], points[Math.floor((points.length - 1) / 2)], points.at(-1)!]
    : points;

  return (
    <div className={`signal-chart live-signal-chart ${points.length ? "is-running" : "is-empty"}`}>
      <div className="chart-grid" aria-hidden="true" />
      {!points.length && <div className="live-chart-empty">{text("Start the stream to build the timeline", "Iniciá el stream para construir la línea de tiempo")}</div>}
      <svg viewBox="0 0 920 170" role="img" aria-label={text("Approval rate timeline built from incoming processing windows", "Línea de tiempo de aprobación construida con las ventanas de procesamiento entrantes")}>
        {expected && <path className="chart-reference" d={expected} />}
        {observed && <path className="chart-observed" d={observed} />}
      </svg>
      <div className="chart-axis" aria-hidden="true">
        {labels.map((point, index) => <span key={`${point.at}-${index}`}>{point.at}</span>)}
      </div>
    </div>
  );
}
import { useLanguage } from "../i18n";
