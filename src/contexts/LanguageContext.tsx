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
    // Navigation
    "nav.dashboard": "Dashboard",
    "nav.companies": "Companies",
    "nav.bookings": "Booking Files",
    "nav.templates": "Templates",
    "nav.library": "Library",
    "nav.clients": "Leads",
    "nav.customers": "Customers",
    "nav.staff": "Team",
    "nav.settings": "Settings",
    "nav.subscriptions": "Subscriptions",
    "nav.analytics": "Analytics",
    "nav.quotations": "Quotations",
    "nav.invoices": "Invoices",
    "nav.plans": "Plans",
    "nav.operations": "Operations",
    "nav.finance": "Finance",
    
    // App
    "app.name": "Safar",
    "app.tagline": "Travel Agency OS",
    
    // Auth
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
    
    // Topbar
    "topbar.search": "Search...",
    "topbar.notifications": "Notifications",
    "topbar.profile": "Profile",
    
    // Dashboard
    "dashboard.welcome": "Welcome",
    "dashboard.overview": "Operational Overview",
    "dashboard.newBooking": "New Booking",
    "dashboard.upcomingArrivals": "Upcoming Arrivals",
    "dashboard.agentPerformance": "Agent Performance",
    "dashboard.financialSummary": "Financial Summary",
    "dashboard.recentBookings": "Recent Bookings",
    "dashboard.quickActions": "Quick Actions",
    
    // Bookings
    "bookings.title": "Booking Files",
    "bookings.new": "New Booking",
    "bookings.summary": "Summary",
    "bookings.customer": "Customer",
    "bookings.travelers": "Travelers",
    "bookings.itinerary": "Itinerary",
    "bookings.services": "Services",
    "bookings.financials": "Financials",
    "bookings.attachments": "Attachments",
    "bookings.comments": "Comments",
    "bookings.timeline": "Timeline",
    "bookings.status.tentative": "Tentative",
    "bookings.status.confirmed": "Confirmed",
    "bookings.status.in_operation": "In Operation",
    "bookings.status.completed": "Completed",
    "bookings.status.cancelled": "Cancelled",
    
    // Leads
    "leads.title": "Leads",
    "leads.new": "New Lead",
    "leads.convertToBooking": "Convert to Booking",
    "leads.status.new": "New",
    "leads.status.contacted": "Contacted",
    "leads.status.planning": "Planning",
    "leads.status.awaiting_client": "Awaiting Client",
    "leads.status.won": "Won",
    "leads.status.lost": "Lost",
    
    // Library
    "library.title": "Product Library",
    "library.addItem": "Add Item",
    "library.attractions": "Attractions",
    "library.hotels": "Hotels",
    "library.activities": "Activities",
    "library.transfers": "Transfers",
    "library.meals": "Meals",
    "library.guides": "Guides",
    
    // Team
    "team.title": "Team Management",
    "team.invite": "Invite Member",
    "team.roles.company_admin": "Company Admin",
    "team.roles.agent": "Agent",
    "team.roles.operations": "Operations",
    "team.roles.finance": "Finance",
    "team.roles.viewer": "Viewer",
    
    // Common
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.delete": "Delete",
    "common.edit": "Edit",
    "common.view": "View",
    "common.search": "Search",
    "common.filter": "Filter",
    "common.loading": "Loading...",
    "common.noData": "No data",
    "common.actions": "Actions",
  },
  ar: {
    // Navigation
    "nav.dashboard": "لوحة القيادة",
    "nav.companies": "الشركات",
    "nav.bookings": "ملفات الحجز",
    "nav.templates": "القوالب",
    "nav.library": "المكتبة",
    "nav.clients": "العملاء المحتملين",
    "nav.customers": "العملاء",
    "nav.staff": "الفريق",
    "nav.settings": "الإعدادات",
    "nav.subscriptions": "الاشتراكات",
    "nav.analytics": "التحليلات",
    "nav.quotations": "عروض الأسعار",
    "nav.invoices": "الفواتير",
    "nav.plans": "الباقات",
    "nav.operations": "العمليات",
    "nav.finance": "المالية",
    
    // App
    "app.name": "سفر",
    "app.tagline": "نظام إدارة شركات السياحة",
    
    // Auth
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
    
    // Topbar
    "topbar.search": "بحث...",
    "topbar.notifications": "الإشعارات",
    "topbar.profile": "الملف الشخصي",
    
    // Dashboard
    "dashboard.welcome": "مرحباً",
    "dashboard.overview": "نظرة عامة على العمليات",
    "dashboard.newBooking": "حجز جديد",
    "dashboard.upcomingArrivals": "الوصول القادم",
    "dashboard.agentPerformance": "أداء الوكلاء",
    "dashboard.financialSummary": "ملخص مالي",
    "dashboard.recentBookings": "آخر الحجوزات",
    "dashboard.quickActions": "إجراءات سريعة",
    
    // Bookings
    "bookings.title": "ملفات الحجز",
    "bookings.new": "حجز جديد",
    "bookings.summary": "الملخص",
    "bookings.customer": "العميل",
    "bookings.travelers": "المسافرون",
    "bookings.itinerary": "البرنامج",
    "bookings.services": "الخدمات",
    "bookings.financials": "المالية",
    "bookings.attachments": "المرفقات",
    "bookings.comments": "التعليقات",
    "bookings.timeline": "السجل",
    "bookings.status.tentative": "مبدئي",
    "bookings.status.confirmed": "مؤكد",
    "bookings.status.in_operation": "قيد التنفيذ",
    "bookings.status.completed": "مكتمل",
    "bookings.status.cancelled": "ملغي",
    
    // Leads
    "leads.title": "العملاء المحتملين",
    "leads.new": "عميل محتمل جديد",
    "leads.convertToBooking": "تحويل إلى حجز",
    "leads.status.new": "جديد",
    "leads.status.contacted": "تم التواصل",
    "leads.status.planning": "التخطيط",
    "leads.status.awaiting_client": "في انتظار العميل",
    "leads.status.won": "تم الفوز",
    "leads.status.lost": "خسارة",
    
    // Library
    "library.title": "مكتبة المنتجات",
    "library.addItem": "إضافة عنصر",
    "library.attractions": "المعالم",
    "library.hotels": "الفنادق",
    "library.activities": "الأنشطة",
    "library.transfers": "النقل",
    "library.meals": "الوجبات",
    "library.guides": "المرشدين",
    
    // Team
    "team.title": "إدارة الفريق",
    "team.invite": "دعوة عضو",
    "team.roles.company_admin": "مدير الشركة",
    "team.roles.agent": "وكيل",
    "team.roles.operations": "عمليات",
    "team.roles.finance": "مالية",
    "team.roles.viewer": "مشاهد",
    
    // Common
    "common.save": "حفظ",
    "common.cancel": "إلغاء",
    "common.delete": "حذف",
    "common.edit": "تعديل",
    "common.view": "عرض",
    "common.search": "بحث",
    "common.filter": "تصفية",
    "common.loading": "جاري التحميل...",
    "common.noData": "لا توجد بيانات",
    "common.actions": "الإجراءات",
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
