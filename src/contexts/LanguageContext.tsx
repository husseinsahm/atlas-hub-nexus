import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { type Language, type Direction, getDirection, translate, SUPPORTED_LANGUAGES } from "@/i18n";

interface LanguageContextType {
  language: Language;
  direction: Direction;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(() => {
    const stored = localStorage.getItem("safar-lang") as Language | null;
    if (stored && SUPPORTED_LANGUAGES.some(l => l.code === stored)) return stored;
    return "en";
  });

  const direction = getDirection(language);

  const setLanguage = useCallback((lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("safar-lang", lang);
  }, []);

  useEffect(() => {
    // Set both dir and lang attributes on the HTML element
    document.documentElement.dir = direction;
    document.documentElement.lang = language;
    
    // Add RTL class to body for additional CSS targeting if needed
    if (direction === 'rtl') {
      document.body.classList.add('rtl');
      document.body.classList.remove('ltr');
    } else {
      document.body.classList.add('ltr');
      document.body.classList.remove('rtl');
    }
  }, [language, direction]);

  const t = useCallback((key: string) => translate(language, key), [language]);

  return (
    <LanguageContext.Provider value={{ language, direction, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error("useLanguage must be used within LanguageProvider");
  return ctx;
};
