// Toast de la alerta que YA fue entregada al canal de devs. No dispara el envío
// ni lo simula: se anima cuando `backend/notify_slack.py` confirma un 2xx de Slack.
import { useEffect, useState } from "react";
import type { SlackAlert } from "../api";
import { useLanguage } from "../i18n";

// Logo de Slack (marca oficial, 4 colores) — lucide sólo trae la silueta monocroma.
function SlackMark() {
  return (
    <svg viewBox="0 0 122 122" width="18" height="18" aria-hidden="true">
      <path fill="#E01E5A" d="M25.8 77.6a12.9 12.9 0 1 1-12.9-12.9h12.9v12.9zm6.5 0a12.9 12.9 0 0 1 25.8 0v32.3a12.9 12.9 0 0 1-25.8 0V77.6z" />
      <path fill="#36C5F0" d="M45.2 25.8a12.9 12.9 0 1 1 12.9-12.9v12.9H45.2zm0 6.5a12.9 12.9 0 0 1 0 25.8H12.9a12.9 12.9 0 0 1 0-25.8h32.3z" />
      <path fill="#2EB67D" d="M96.9 45.2a12.9 12.9 0 1 1 12.9 12.9H96.9V45.2zm-6.5 0a12.9 12.9 0 0 1-25.8 0V12.9a12.9 12.9 0 0 1 25.8 0v32.3z" />
      <path fill="#ECB22E" d="M77.6 96.9a12.9 12.9 0 1 1-12.9 12.9V96.9h12.9zm0-6.5a12.9 12.9 0 0 1 0-25.8h32.3a12.9 12.9 0 0 1 0 25.8H77.6z" />
    </svg>
  );
}

export function SlackAlertToast({ alerts }: { alerts: SlackAlert[] }) {
  const { text } = useLanguage();
  const [shown, setShown] = useState<SlackAlert | null>(null);
  const [leaving, setLeaving] = useState(false);
  const latest = alerts.length ? alerts[alerts.length - 1] : null;
  // Sólo el id en las deps: con el objeto (o con `shown`) el efecto se re-ejecuta
  // en cuanto setShown corre, el cleanup mata el timeout y el toast queda fijo.
  const latestId = latest?.incident_id ?? null;

  useEffect(() => {
    if (!latestId || !latest) return;
    setShown(latest);
    setLeaving(false);
    const fade = window.setTimeout(() => setLeaving(true), 8000);
    const drop = window.setTimeout(() => setShown(null), 8500); // desmonta: si no, tapa clicks invisible
    return () => {
      window.clearTimeout(fade);
      window.clearTimeout(drop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [latestId]);

  if (!shown) return null;

  return (
    <div className={`slack-toast ${leaving ? "is-leaving" : ""}`} role="status" aria-live="polite">
      <div className="slack-toast__bar" aria-hidden="true" />
      <div className="slack-toast__icon"><SlackMark /></div>
      <div className="slack-toast__body">
        <span className="slack-toast__meta">
          {text("Delivered to", "Entregado a")} <b>#dev-alerts</b>
          <i>{text("Yuno dev team", "Equipo de devs de Yuno")}</i>
        </span>
        <strong>{shown.headline}</strong>
        <small>{shown.action}</small>
      </div>
      <span className="slack-toast__id">{shown.incident_id}</span>
    </div>
  );
}
