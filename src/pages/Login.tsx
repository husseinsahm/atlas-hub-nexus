import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { Compass, Globe, ArrowRight, Eye, EyeOff } from "lucide-react";
import { motion } from "framer-motion";

export default function Login() {
  const { login, isLoading } = useAuth();
  const { t, language, setLanguage } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await login(email, password);
  };

  return (
    <div className="flex min-h-screen">
      {/* Left - Decorative panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden navy-gradient">
        {/* Decorative elements */}
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

      {/* Right - Login form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-sm"
        >
          {/* Language toggle */}
          <div className="flex justify-end mb-12">
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
          <div className="flex items-center gap-3 mb-10 lg:hidden">
            <div className="w-10 h-10 rounded-lg gold-gradient flex items-center justify-center">
              <Compass className="w-5 h-5 text-accent-foreground" />
            </div>
            <span className="text-xl font-bold font-display">{t("app.name")}</span>
          </div>

          <h2 className="text-2xl font-bold font-display text-foreground mb-2">
            {t("auth.welcome")}
          </h2>
          <p className="text-sm text-muted-foreground mb-8">
            {t("auth.subtitle")}
          </p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground/80 uppercase tracking-wider">
                {t("auth.email")}
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="luxury-input w-full"
                required
              />
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-foreground/80 uppercase tracking-wider">
                  {t("auth.password")}
                </label>
                <button type="button" className="text-xs text-gold hover:text-gold-dark transition-colors">
                  {t("auth.forgot")}
                </button>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="luxury-input w-full"
                  style={{ paddingInlineEnd: 40 }}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  style={{ insetInlineEnd: 12 }}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading}
              className="w-full h-11 gold-gradient border-0 text-accent-foreground font-semibold text-sm rounded-lg hover:opacity-90 transition-opacity"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-accent-foreground/30 border-t-accent-foreground rounded-full animate-spin" />
                  Signing in...
                </span>
              ) : (
                <span className="flex items-center gap-2">
                  {t("auth.login")}
                  <ArrowRight className="w-4 h-4" />
                </span>
              )}
            </Button>
          </form>

          {/* Demo accounts hint */}
          <div className="mt-8 p-4 rounded-lg bg-muted/50 border border-border">
            <p className="text-xs font-medium text-muted-foreground mb-2">Demo Accounts:</p>
            <div className="space-y-1 text-xs text-muted-foreground/80">
              <p><span className="font-mono">admin@safar.com</span> — Super Admin</p>
              <p><span className="font-mono">company@safar.com</span> — Company Admin</p>
              <p><span className="font-mono">staff@safar.com</span> — Staff Agent</p>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
