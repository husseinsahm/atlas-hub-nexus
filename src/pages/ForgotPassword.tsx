import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { ArrowRight, AlertCircle, CheckCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { AuthLayout } from "@/components/auth/AuthLayout";

export default function ForgotPassword() {
  const { resetPassword } = useAuth();
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await resetPassword(email);
    if (result.error) setError(result.error);
    else setSent(true);
    setLoading(false);
  };

  if (sent) {
    return (
      <AuthLayout>
        <div className="text-center animate-fade-in">
          <div className="w-14 h-14 rounded-full bg-gold/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-7 h-7 text-gold" />
          </div>
          <h2 className="text-2xl font-bold font-display text-foreground mb-2">
            {t("auth.resetSent")}
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            Check your inbox for a link to reset your password.
          </p>
          <Link to="/login">
            <Button variant="ghost" className="text-gold hover:text-gold-dark">
              {t("auth.backToLogin")}
            </Button>
          </Link>
        </div>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <h2 className="text-2xl font-bold font-display text-foreground mb-2">
        {t("auth.forgotTitle")}
      </h2>
      <p className="text-sm text-muted-foreground mb-8">
        {t("auth.forgotSubtitle")}
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

        <Button
          type="submit"
          disabled={loading}
          className="w-full h-11 gold-gradient border-0 text-accent-foreground font-semibold text-sm rounded-lg hover:opacity-90 transition-opacity"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-accent-foreground/30 border-t-accent-foreground rounded-full animate-spin" />
              Sending...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              {t("auth.sendReset")}
              <ArrowRight className="w-4 h-4" />
            </span>
          )}
        </Button>
      </form>

      <p className="mt-6 text-sm text-center text-muted-foreground">
        <Link to="/login" className="text-gold hover:text-gold-dark font-medium transition-colors">
          {t("auth.backToLogin")}
        </Link>
      </p>
    </AuthLayout>
  );
}
