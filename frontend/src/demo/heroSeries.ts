// Serie estática para los gráficos de la landing.
//
// La landing no habla con el backend, pero muestra los MISMOS componentes que la torre
// (`LiveSignalChart`, `ExpectedBandChart`), así que necesita puntos con la forma real de
// `SignalPoint`. Determinística a propósito: la promesa pública tiene que verse igual en
// cada carga y coincidir con lo que el jurado ve después en vivo.
//
// Números alineados con el mundo sintético: 65 tx/s, ventana de 60 s (3.900 intentos),
// baseline sano ~87,4% y una caída de proveedor que sale claramente de la banda del 95%.
import type { SignalPoint } from "../components/LiveSignalChart";

const EXPECTED_RATE = 87.4;
const WINDOW_ATTEMPTS = 3900;
const TX_PER_POINT = 65;
const POINTS = 26;
const HEALTHY_POINTS = 16;

/** Oscilación determinística dentro de la banda: nada de Math.random, la landing no debe titilar. */
function healthyRate(index: number): number {
  return EXPECTED_RATE + Math.sin(index * 1.7) * 0.55 + Math.cos(index * 0.9) * 0.3;
}

/** Caída de proveedor: cae rápido y sigue deprimida, como el preset `provider_br`. */
function incidentRate(step: number, total: number): number {
  const progress = Math.min(1, step / Math.max(1, total * 0.55));
  return EXPECTED_RATE - (EXPECTED_RATE - 73.8) * progress + Math.sin(step * 2.1) * 0.4;
}

export const HERO_SERIES: SignalPoint[] = Array.from({ length: POINTS }, (_, index) => {
  const incident = index >= HEALTHY_POINTS;
  const observedRate = incident
    ? incidentRate(index - HEALTHY_POINTS, POINTS - HEALTHY_POINTS)
    : healthyRate(index);
  const approved = Math.round(TX_PER_POINT * (observedRate / 100));
  const seconds = 21 + index * 5;
  const at = `14:${String(2 + Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
  return {
    at,
    attempts: TX_PER_POINT,
    approved,
    declined: TX_PER_POINT - approved,
    expectedApproved: TX_PER_POINT * (EXPECTED_RATE / 100),
    observedRate,
    expectedRate: EXPECTED_RATE,
    cumulativeAttempts: TX_PER_POINT * (index + 1),
    windowAttempts: WINDOW_ATTEMPTS,
  };
});
