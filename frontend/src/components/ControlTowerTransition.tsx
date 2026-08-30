import { useLanguage } from "../i18n";

export function ControlTowerTransition() {
  const { text } = useLanguage();
  return (
    <div className="launch-transition" role="status" aria-live="assertive" aria-label={text("Opening Centinel control tower", "Abriendo la torre de control de Centinel")}>
      <div className="launch-transition__grid" aria-hidden="true" />
      <div className="launch-transition__content">
        <div className="launch-path" aria-hidden="true">
          <span><i />{text("Merchant", "Comercio")}</span><b /><span><i />Yuno</span><b /><span><i />{text("Provider", "Proveedor")}</span>
        </div>
        <span className="eyebrow">{text("CENTINEL · LIVE OPERATIONS", "CENTINEL · OPERACIONES EN VIVO")}</span>
        <h2>{text("Opening control tower", "Abriendo torre de control")}</h2>
        <p>{text("Synchronizing both sides of the payment path.", "Sincronizando ambos lados del recorrido del pago.")}</p>
        <div className="launch-progress" aria-hidden="true"><i /></div>
        <div className="launch-dimensions" aria-hidden="true"><span>{text("Merchant", "Comercio")}</span><span>{text("Provider", "Proveedor")}</span><span>{text("Method", "Método")}</span><span>{text("Country", "País")}</span></div>
      </div>
    </div>
  );
}
