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
    "nav.operations": "Operations",
    "nav.finance": "Finance",
    "app.name": "Safar",
    "app.tagline": "Premium Travel Management",
    "auth.login": "Sign In",
    "auth.register": "Register",
    "auth.email": "Email",
    "auth.password": "Password",
    "auth.confirmPassword": "Confirm Password",
    "auth.fullName": "Full Name",
    "auth.companyName": "Company Name",
    "auth.forgot": "Forgot password?",
    "auth.welcome": "Welcome back",
    "auth.subtitle": "Sign in to your travel management platform",
    "auth.noAccount": "Don't have an account?",
    "auth.hasAccount": "Already have an account?",
    "auth.registerTitle": "Create your account",
    "auth.registerSubtitle": "Register your travel company on Safar",
    "auth.forgotTitle": "Reset your password",
    "auth.forgotSubtitle": "Enter your email to receive a password reset link",
    "auth.sendReset": "Send Reset Link",
    "auth.resetSent": "Reset link sent! Check your email.",
    "auth.backToLogin": "Back to sign in",
    "auth.resetTitle": "Set new password",
    "auth.resetSubtitle": "Enter your new password below",
    "auth.updatePassword": "Update Password",
    "auth.registering": "Creating account...",
    "auth.signingIn": "Signing in...",
    "auth.registerCompany": "Register Company",
    "auth.inviteTitle": "You've been invited",
    "auth.inviteSubtitle": "Create your account to join the team",
    "auth.acceptInvite": "Accept Invitation",
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
    "nav.operations": "العمليات",
    "nav.finance": "المالية",
    "app.name": "سفر",
    "app.tagline": "إدارة السفر الفاخرة",
    "auth.login": "تسجيل الدخول",
    "auth.register": "إنشاء حساب",
    "auth.email": "البريد الإلكتروني",
    "auth.password": "كلمة المرور",
    "auth.confirmPassword": "تأكيد كلمة المرور",
    "auth.fullName": "الاسم الكامل",
    "auth.companyName": "اسم الشركة",
    "auth.forgot": "نسيت كلمة المرور؟",
    "auth.welcome": "مرحباً بعودتك",
    "auth.subtitle": "سجل دخولك إلى منصة إدارة السفر",
    "auth.noAccount": "ليس لديك حساب؟",
    "auth.hasAccount": "لديك حساب بالفعل؟",
    "auth.registerTitle": "إنشاء حسابك",
    "auth.registerSubtitle": "سجل شركة السفر الخاصة بك في سفر",
    "auth.forgotTitle": "إعادة تعيين كلمة المرور",
    "auth.forgotSubtitle": "أدخل بريدك الإلكتروني لتلقي رابط إعادة التعيين",
    "auth.sendReset": "إرسال رابط إعادة التعيين",
    "auth.resetSent": "تم إرسال رابط إعادة التعيين! تحقق من بريدك الإلكتروني.",
    "auth.backToLogin": "العودة لتسجيل الدخول",
    "auth.resetTitle": "تعيين كلمة مرور جديدة",
    "auth.resetSubtitle": "أدخل كلمة المرور الجديدة أدناه",
    "auth.updatePassword": "تحديث كلمة المرور",
    "auth.registering": "جاري إنشاء الحساب...",
    "auth.signingIn": "جاري تسجيل الدخول...",
    "auth.registerCompany": "تسجيل الشركة",
    "auth.inviteTitle": "لقد تمت دعوتك",
    "auth.inviteSubtitle": "أنشئ حسابك للانضمام إلى الفريق",
    "auth.acceptInvite": "قبول الدعوة",
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
