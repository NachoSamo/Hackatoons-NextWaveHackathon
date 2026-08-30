// Hook de datos vivos para la CommandCenter: pollea el snapshot del loop de
// diagnóstico + el overview, y escucha el SSE del ticker. Mapea a las formas de Juani.
import { useCallback, useEffect, useRef, useState } from "react";
import {
  api,
  type DiagnosisSnapshot,
  type Overview,
  type StreamSnapshot,
} from "./api";
import { buildIncidents, type LiveIncident } from "./live";

export function useLive(active: boolean) {
  const [snapshot, setSnapshot] = useState<DiagnosisSnapshot | null>(null);
  const [overview, setOverview] = useState<Overview | null>(null);
  const [ticker, setTicker] = useState<StreamSnapshot | null>(null);
  const poll = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;
    let alive = true;
    const tick = async () => {
      const [s, o] = await Promise.all([api.getSnapshot(), api.getOverview()]);
      if (!alive) return;
      if (s.data) setSnapshot(s.data);
      if (o.data) setOverview(o.data);
    };
    void tick();
    poll.current = window.setInterval(tick, 3000);
    return () => {
      alive = false;
      if (poll.current) window.clearInterval(poll.current);
    };
  }, [active]);

  useEffect(() => {
    if (!active) return;
    return api.subscribeStream(setTicker);
  }, [active]);

  const reset = useCallback(async () => {
    await api.resetDemo();
    setSnapshot(null);
    setOverview(null);
    setTicker(null);
  }, []);

  const injectPreset = useCallback(
    (presetId: string) => api.inject({ preset_id: presetId }),
    []
  );

  const incidents: LiveIncident[] = buildIncidents(snapshot, overview);

  return { snapshot, overview, ticker, incidents, reset, injectPreset };
}
