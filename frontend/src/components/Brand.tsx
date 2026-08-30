import { useLanguage } from "../i18n";

export function Brand({ compact = false }: { compact?: boolean }) {
  const { text } = useLanguage();
  return (
    <a className={`brand ${compact ? "brand--compact" : ""}`} href="/" aria-label={text("Centinel home", "Inicio de Centinel")}>
      <span>Centinel</span>
      <span className="brand__divider" aria-hidden="true" />
      <span className="brand__powered">by <strong>toons</strong></span>
    </a>
  );
}
