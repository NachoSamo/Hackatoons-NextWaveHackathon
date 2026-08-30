export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <a className={`brand ${compact ? "brand--compact" : ""}`} href="/" aria-label="Centinel home">
      <span>Centinel</span>
      <span className="brand__divider" aria-hidden="true" />
      <span className="brand__powered">by <strong>toons</strong></span>
    </a>
  );
}
