import { useEffect } from "react";
import { E2EPanel } from "./e2e";
import { CommandCenter } from "./pages/CommandCenter";
import { Landing } from "./pages/Landing";

export function App() {
  const path = window.location.pathname;
  const isE2E = path.startsWith("/e2e");
  const isControlTower = path.startsWith("/control-tower");
  const isLegacyIncident = path.startsWith("/incidents/");

  useEffect(() => {
    if (isLegacyIncident) window.history.replaceState({}, "", "/control-tower");
  }, [isLegacyIncident]);

  if (isE2E) return <E2EPanel />;

  return isControlTower || isLegacyIncident
    ? <div className="app-shell"><CommandCenter /></div>
    : <Landing />;
}
