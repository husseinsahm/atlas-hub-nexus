import { Compass, Globe } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { motion } from "framer-motion";

interface AuthLayoutProps {
  children: React.ReactNode;
}

export function AuthLayout({ children }: AuthLayoutProps) {
  const { t, language, setLanguage } = useLanguage();

  return (
    <div className="flex min-h-screen">
      {/* Left - Decorative panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden navy-gradient">
        <div className="absolute inset-0 opacity-[0.03]">
          <div className="absolute top-20 start-20 w-96 h-96 rounded-full border border-accent/30" />
          <div className="absolute bottom-40 end-10 w-64 h-64 rounded-full border border-accent/20" />
          <div className="absolute top-1/2 start-1/3 w-48 h-48 rounded-full border border-accent/10" />
        </div>

        <div className="relative z-10 flex flex-col justify-between p-12 text-primary-foreground">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg gold-gradient flex items-center justify-center">
              <Compass className="w-5 h-5 text-accent-foreground" />
            </div>
            <span className="text-xl font-bold font-display">{t("app.name")}</span>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="max-w-md"
          >
            <h2 className="text-4xl font-bold font-display leading-tight mb-6">
              Crafting Extraordinary Travel Experiences
            </h2>
            <p className="text-primary-foreground/60 text-lg leading-relaxed">
              The complete platform for premium travel agencies to manage itineraries,
              clients, and teams — all in one elegant workspace.
            </p>
          </motion.div>

          <p className="text-xs text-primary-foreground/30">
            © 2026 Safar. Premium Travel Management Platform.
          </p>
        </div>
      </div>

      {/* Right - Form area */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-sm"
        >
          {/* Language toggle */}
          <div className="flex justify-end mb-8">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setLanguage(language === "en" ? "ar" : "en")}
              className="text-muted-foreground hover:text-foreground gap-2"
            >
              <Globe className="w-4 h-4" />
              {language === "en" ? "العربية" : "English"}
            </Button>
          </div>

          {/* Mobile logo */}
          <div className="flex items-center gap-3 mb-8 lg:hidden">
            <div className="w-10 h-10 rounded-lg gold-gradient flex items-center justify-center">
              <Compass className="w-5 h-5 text-accent-foreground" />
            </div>
            <span className="text-xl font-bold font-display">{t("app.name")}</span>
          </div>

          {children}
        </motion.div>
      </div>
    </div>
  );
}
