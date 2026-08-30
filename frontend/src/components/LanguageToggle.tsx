import { Languages } from "lucide-react";
import { useLanguage } from "../i18n";

export function LanguageToggle() {
  const { language, text, toggleLanguage } = useLanguage();

  return (
    <button
      className="language-toggle"
      type="button"
      onClick={toggleLanguage}
      aria-label={text("Switch interface to Spanish", "Cambiar la interfaz a inglés")}
      title={text("Switch interface to Spanish", "Cambiar la interfaz a inglés")}
    >
      <Languages size={14} />
      <span className={language === "en" ? "is-active" : ""}>EN</span>
      <i aria-hidden="true">/</i>
      <span className={language === "es" ? "is-active" : ""}>ES</span>
    </button>
  );
}
