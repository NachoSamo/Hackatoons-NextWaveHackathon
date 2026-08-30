import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";

export type Language = "en" | "es";

type LanguageContextValue = {
  language: Language;
  text: (english: string, spanish: string) => string;
  toggleLanguage: () => void;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    const saved = window.localStorage.getItem("centinel-language");
    return saved === "es" ? "es" : "en";
  });

  useEffect(() => {
    document.documentElement.lang = language;
    window.localStorage.setItem("centinel-language", language);
  }, [language]);

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    text: (english, spanish) => language === "es" ? spanish : english,
    toggleLanguage: () => setLanguage((current) => current === "en" ? "es" : "en"),
  }), [language]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used inside LanguageProvider");
  return context;
}
