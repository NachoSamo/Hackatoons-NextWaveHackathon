import { useLanguage } from "../i18n";
import type { SignalPoint } from "./LiveSignalChart";

// Banda de predicción al 95% alrededor de la tasa esperada.
//
// El esperado viene de `baseline_profile` (perfil por hora del día y tipo de día) y su propia
// incertidumbre es despreciable: cada perfil acumula entre ~1.000 y ~80.000 intentos. Toda la
// incertidumbre relevante está del lado observado, así que la banda es el intervalo de predicción
// de la tasa observada dado el esperado y el tamaño de muestra:
//
//   sd = sqrt(p * (1 - p) / n)      banda = p ± 1.96 * sd
//
// `n` es el de la VENTANA de 60 s (`overview.attempts`, ~3.900), no el del punto (~65): la tasa que
// se grafica es la móvil de 60 segundos, así que usar el n del punto daría una banda de ±9 pts
// alrededor de una serie suavizada que nunca se mueve.
const Z_95 = 1.96;
// El eje se acerca todo lo posible para que la banda sea legible: el dominio mínimo es apenas más
// ancho que la banda misma (±1,04 pts con n≈3.900). No se ensancha el intervalo — eso mentiría —
// se acerca el zoom. Cuando entra un incidente el dominio se expande solo para contener la caída.
const MIN_RANGE_PTS = 4;
const PAD_PTS = 0.8;

const LEFT = 54;
const WIDTH = 846;
const TOP = 16;
const HEIGHT = 154;

type Band = { x: number; observed: number; expected: number; lo: number; hi: number; lowEvidence: boolean };

function bandFor(point: SignalPoint, index: number, total: number): Band {
  const slot = WIDTH / Math.max(total, 1);
  const x = LEFT + slot * index + slot / 2;
  const expected = point.expectedRate;
  const p = expected / 100;
  const n = point.windowAttempts ?? 0;
  // La aproximación normal necesita n·p y n·(1-p) por encima de 10; por debajo la banda no
  // significa nada y preferimos no dibujarla antes que dibujar una que miente.
  const lowEvidence = n <= 0 || n * p < 10 || n * (1 - p) < 10;
  const halfWidth = lowEvidence ? 0 : Z_95 * Math.sqrt((p * (1 - p)) / n) * 100;
  return { x, observed: point.observedRate, expected, lo: expected - halfWidth, hi: expected + halfWidth, lowEvidence };
}

export function ExpectedBandChart({ points }: { points: SignalPoint[] }) {
  const { text } = useLanguage();
  const bands = points.map((point, index) => bandFor(point, index, points.length));
  const solid = bands.filter((band) => !band.lowEvidence);

  const values = bands.flatMap((band) => [band.observed, band.expected, band.lo, band.hi]);
  let low = values.length ? Math.min(...values) - PAD_PTS : 80;
  let high = values.length ? Math.max(...values) + PAD_PTS : 95;
  if (high - low < MIN_RANGE_PTS) {
    const middle = (high + low) / 2;
    low = middle - MIN_RANGE_PTS / 2;
    high = middle + MIN_RANGE_PTS / 2;
  }
  const y = (rate: number) => TOP + HEIGHT - ((rate - low) / (high - low)) * HEIGHT;

  const line = (pick: (band: Band) => number, source = bands) =>
    source.map((band, index) => `${index ? "L" : "M"}${band.x.toFixed(1)} ${y(pick(band)).toFixed(1)}`).join(" ");
  // Ida por el techo de la banda, vuelta por el piso, cerrada.
  const area = solid.length
    ? `${line((band) => band.hi, solid)} ${solid
        .slice()
        .reverse()
        .map((band) => `L${band.x.toFixed(1)} ${y(band.lo).toFixed(1)}`)
        .join(" ")} Z`
    : "";

  const outside = bands.filter((band) => !band.lowEvidence && (band.observed > band.hi || band.observed < band.lo));
  const last = bands.at(-1);
  const breached = Boolean(last && !last.lowEvidence && (last.observed > last.hi || last.observed < last.lo));
  const ticks = [high, (high + low) / 2, low];

  return (
    <div className={`signal-chart band-chart ${points.length ? "is-running" : "is-empty"} ${breached ? "is-breached" : ""}`}>
      <div className="chart-grid" aria-hidden="true" />
      {!points.length && (
        <div className="live-chart-empty">
          {text("Start the stream to build the expected range", "Iniciá el stream para construir el rango esperado")}
        </div>
      )}
      <svg
        viewBox="0 0 920 190"
        role="img"
        aria-label={text(
          "Observed approval rate against the expected range at 95% confidence",
          "Tasa de aprobación observada contra el rango esperado con 95% de confianza"
        )}
      >
        {ticks.map((tick, index) => {
          const lineY = TOP + (index / 2) * HEIGHT;
          return (
            <g className="volume-tick" key={`${tick}-${index}`}>
              <line x1={LEFT} x2={900} y1={lineY} y2={lineY} />
              <text x="8" y={lineY + 3}>{`${tick.toFixed(1)}%`}</text>
            </g>
          );
        })}
        {area && <path className="band-area" d={area} />}
        {solid.length > 1 && <path className="band-expected" d={line((band) => band.expected, solid)} />}
        {bands.length > 1 && <path className="band-observed" d={line((band) => band.observed)} />}
        {outside.map((band, index) => (
          <circle className="band-breach" key={`${band.x}-${index}`} cx={band.x} cy={y(band.observed)} r="3" />
        ))}
      </svg>
      <div className="chart-axis" aria-hidden="true">
        {(points.length > 2 ? [points[0], points[Math.floor((points.length - 1) / 2)], points.at(-1)!] : points).map(
          (point, index) => (
            <span key={`${point.at}-${index}`}>{point.at}</span>
          )
        )}
      </div>
    </div>
  );
}
