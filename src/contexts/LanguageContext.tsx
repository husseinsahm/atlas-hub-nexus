import React, { createContext, useContext, useState, useEffect } from "react";

type Language = "en" | "ar";
type Direction = "ltr" | "rtl";

interface LanguageContextType {
  language: Language;
  direction: Direction;
  setLanguage: (lang: Language) => void;
  t: (key: string) => string;
}

const translations: Record<Language, Record<string, string>> = {
  en: {
    "nav.dashboard": "Dashboard",
    "nav.companies": "Companies",
    "nav.trips": "Trips",
    "nav.clients": "Clients",
    "nav.staff": "Staff",
    "nav.settings": "Settings",
    "nav.subscriptions": "Subscriptions",
    "nav.analytics": "Analytics",
    "nav.itineraries": "Itineraries",
    "nav.invoices": "Invoices",
    "app.name": "Safar",
    "app.tagline": "Premium Travel Management",
    "auth.login": "Sign In",
    "auth.email": "Email",
    "auth.password": "Password",
    "auth.forgot": "Forgot password?",
    "auth.welcome": "Welcome back",
    "auth.subtitle": "Sign in to your travel management platform",
    "topbar.search": "Search...",
    "topbar.notifications": "Notifications",
    "topbar.profile": "Profile",
  },
  ar: {
    "nav.dashboard": "لوحة القيادة",
    "nav.companies": "الشركات",
    "nav.trips": "الرحلات",
    "nav.clients": "العملاء",
    "nav.staff": "الموظفين",
    "nav.settings": "الإعدادات",
    "nav.subscriptions": "الاشتراكات",
    "nav.analytics": "التحليلات",
    "nav.itineraries": "خطط الرحلات",
    "nav.invoices": "الفواتير",
    "app.name": "سفر",
    "app.tagline": "إدارة السفر الفاخرة",
    "auth.login": "تسجيل الدخول",
    "auth.email": "البريد الإلكتروني",
    "auth.password": "كلمة المرور",
    "auth.forgot": "نسيت كلمة المرور؟",
    "auth.welcome": "مرحباً بعودتك",
    "auth.subtitle": "سجل دخولك إلى منصة إدارة السفر",
    "topbar.search": "بحث...",
    "topbar.notifications": "الإشعارات",
    "topbar.profile": "الملف الشخصي",
  },
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [language, setLanguageState] = useState<Language>(
    () => (localStorage.getItem("safar-lang") as Language) || "en"
  );

  const direction: Direction = language === "ar" ? "rtl" : "ltr";

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem("safar-lang", lang);
  };

  useEffect(() => {
    document.documentElement.dir = direction;
    document.documentElement.lang = language;
  }, [language, direction]);

  const t = (key: string) => translations[language][key] || key;

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
