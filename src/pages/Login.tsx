import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { ArrowRight, Eye, EyeOff, AlertCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { AuthLayout } from "@/components/auth/AuthLayout";

export default function Login() {
  const { login, isLoading } = useAuth();
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    const result = await login(email, password);
    if (result.error) setError(result.error);
  };

  return (
    <AuthLayout>
      <h2 className="text-2xl font-bold font-display text-foreground mb-2">
        {t("auth.welcome")}
      </h2>
      <p className="text-sm text-muted-foreground mb-8">
        {t("auth.subtitle")}
      </p>

      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

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
            <Link to="/forgot-password" className="text-xs text-gold hover:text-gold-dark transition-colors">
              {t("auth.forgot")}
            </Link>
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
              {t("auth.signingIn")}
            </span>
          ) : (
            <span className="flex items-center gap-2">
              {t("auth.login")}
              <ArrowRight className="w-4 h-4" />
            </span>
          )}
        </Button>
      </form>

      <p className="mt-6 text-sm text-center text-muted-foreground">
        {t("auth.noAccount")}{" "}
        <Link to="/register" className="text-gold hover:text-gold-dark font-medium transition-colors">
          {t("auth.register")}
        </Link>
      </p>

      {/* Demo accounts hint */}
      <div className="mt-6 p-4 rounded-lg bg-muted/50 border border-border">
        <p className="text-xs font-medium text-muted-foreground mb-2">Demo Accounts <span className="text-muted-foreground/60">(password = email)</span>:</p>
        <div className="space-y-1 text-xs text-muted-foreground/80">
          <p><span className="font-mono">admin@safar.com</span> — Super Admin</p>
          <p><span className="font-mono">company@safar.com</span> — Company Admin</p>
          <p><span className="font-mono">agent@safar.com</span> — Agent</p>
          <p><span className="font-mono">ops@safar.com</span> — Operations</p>
          <p><span className="font-mono">finance@safar.com</span> — Finance</p>
        </div>
      </div>
    </AuthLayout>
  );
}
