const observedPath =
  "M18 80 C88 76 150 82 220 78 S350 76 420 74 S515 72 585 73 L620 78 C655 95 700 110 742 112 S830 126 902 130";
const expectedPath =
  "M18 76 C88 74 150 78 220 75 S350 76 420 73 S515 70 585 72 S700 69 770 70 S850 66 902 69";

export function SignalChart({ incidentActive, compact = false }: { incidentActive: boolean; compact?: boolean }) {
  const { text } = useLanguage();
  return (
    <div className={`signal-chart ${incidentActive ? "is-running" : ""} ${compact ? "is-compact" : ""}`}>
      <div className="chart-grid" aria-hidden="true" />
      <svg viewBox="0 0 920 170" role="img" aria-label={incidentActive ? text("Observed approval rate diverges from the expected reference at 14:03", "La tasa de aprobación observada se desvía de la referencia esperada a las 14:03") : text("Observed approval rate remains aligned with the expected reference", "La tasa de aprobación observada permanece alineada con la referencia esperada")}>
        <path className="chart-reference" d={expectedPath} />
        <path className="chart-observed" d={incidentActive ? observedPath : expectedPath} />
        <line className="chart-marker" x1="620" x2="620" y1="26" y2="151" />
        <circle className="chart-pulse" cx="620" cy="78" r="6" />
      </svg>
      <div className="chart-axis" aria-hidden="true">
        <span>14:02:21</span><span>14:02:36</span><span>14:02:51</span><span>14:03:06</span><span>14:03:21</span>
      </div>
    </div>
  );
}
import { useLanguage } from "../i18n";
