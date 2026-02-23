"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import translations, { Language, TranslationsType } from "@/lib/i18n/translations";

type LanguageContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: TranslationsType;
};

const LanguageContext = createContext<LanguageContextType>({
  language: "en",
  setLanguage: () => {},
  t: translations.en,
});

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<Language>("en");

  // Load persisted preference on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem("makmur_lang") as Language | null;
      if (saved === "en" || saved === "ms") {
        setLanguageState(saved);
      }
    } catch {
      // localStorage unavailable (SSR) — keep default
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    try {
      localStorage.setItem("makmur_lang", lang);
    } catch {}
  };

  const t = translations[language] as typeof translations.en;

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  return useContext(LanguageContext);
}
