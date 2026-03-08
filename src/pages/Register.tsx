import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { ArrowRight, Eye, EyeOff, AlertCircle, CheckCircle } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { supabase } from "@/integrations/supabase/client";

export default function Register() {
  const { register, isLoading } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const generateSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters");
      return;
    }

    // 1. Register the user
    const result = await register(email, password, fullName);
    if (result.error) {
      setError(result.error);
      return;
    }

    if (result.userId) {
      try {
        // 2. Create the company
        const slug = generateSlug(companyName);
        const { data: company, error: companyError } = await supabase
          .from("companies")
          .insert({ name: companyName, slug, email })
          .select()
          .single();

        if (companyError) throw companyError;

        // 3. Create the membership as company_admin
        const { error: memberError } = await supabase
          .from("company_memberships")
          .insert({
            user_id: result.userId,
            company_id: company.id,
            role: "company_admin" as const,
          });

        if (memberError) throw memberError;

        setSuccess(true);
      } catch (err: any) {
        setError(err.message || "Failed to create company");
      }
    }
  };

  if (success) {
    return (
      <AuthLayout>
        <div className="text-center animate-fade-in">
          <div className="w-14 h-14 rounded-full bg-gold/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-7 h-7 text-gold" />
          </div>
          <h2 className="text-2xl font-bold font-display text-foreground mb-2">
            Account Created!
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            Please check your email to verify your account, then sign in.
          </p>
          <Link to="/login">
            <Button className="gold-gradient border-0 text-accent-foreground font-semibold hover:opacity-90">
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
        {t("auth.registerTitle")}
      </h2>
      <p className="text-sm text-muted-foreground mb-6">
        {t("auth.registerSubtitle")}
      </p>

      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-medium text-foreground/80 uppercase tracking-wider">
            {t("auth.fullName")}
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Omar Al-Rashid"
            className="luxury-input w-full"
            required
            maxLength={100}
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-foreground/80 uppercase tracking-wider">
            {t("auth.companyName")}
          </label>
          <input
            type="text"
            value={companyName}
            onChange={(e) => setCompanyName(e.target.value)}
            placeholder="Luxury Voyages"
            className="luxury-input w-full"
            required
            maxLength={100}
          />
        </div>

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
            maxLength={255}
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-foreground/80 uppercase tracking-wider">
            {t("auth.password")}
          </label>
          <div className="relative">
            <input
              type={showPassword ? "text" : "password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="luxury-input w-full"
              style={{ paddingInlineEnd: 40 }}
              required
              minLength={6}
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

        <div className="space-y-2">
          <label className="text-xs font-medium text-foreground/80 uppercase tracking-wider">
            {t("auth.confirmPassword")}
          </label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="••••••••"
            className="luxury-input w-full"
            required
          />
        </div>

        <Button
          type="submit"
          disabled={isLoading}
          className="w-full h-11 gold-gradient border-0 text-accent-foreground font-semibold text-sm rounded-lg hover:opacity-90 transition-opacity"
        >
          {isLoading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-accent-foreground/30 border-t-accent-foreground rounded-full animate-spin" />
              {t("auth.registering")}
            </span>
          ) : (
            <span className="flex items-center gap-2">
              {t("auth.registerCompany")}
              <ArrowRight className="w-4 h-4" />
            </span>
          )}
        </Button>
      </form>

      <p className="mt-6 text-sm text-center text-muted-foreground">
        {t("auth.hasAccount")}{" "}
        <Link to="/login" className="text-gold hover:text-gold-dark font-medium transition-colors">
          {t("auth.login")}
        </Link>
      </p>
    </AuthLayout>
  );
}
