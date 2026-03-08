import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { ArrowRight, Eye, EyeOff, AlertCircle, CheckCircle, Loader2 } from "lucide-react";
import { AuthLayout } from "@/components/auth/AuthLayout";
import { supabase } from "@/integrations/supabase/client";

interface InvitationData {
  id: string;
  email: string;
  role: string;
  companyName: string;
  companyId: string;
}

export default function AcceptInvite() {
  const { token } = useParams();
  const { register } = useAuth();
  const { t } = useLanguage();
  const navigate = useNavigate();
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [loadingInvite, setLoadingInvite] = useState(true);
  const [fullName, setFullName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    async function fetchInvitation() {
      if (!token) return;
      const { data, error } = await supabase
        .from("invitations")
        .select(`
          id,
          email,
          role,
          company_id,
          expires_at,
          accepted_at,
          companies (name)
        `)
        .eq("token", token)
        .single();

      if (error || !data) {
        setError("Invalid or expired invitation link.");
        setLoadingInvite(false);
        return;
      }

      if (data.accepted_at) {
        setError("This invitation has already been accepted.");
        setLoadingInvite(false);
        return;
      }

      if (new Date(data.expires_at) < new Date()) {
        setError("This invitation has expired.");
        setLoadingInvite(false);
        return;
      }

      setInvitation({
        id: data.id,
        email: data.email,
        role: data.role,
        companyId: data.company_id,
        companyName: (data as any).companies?.name || "Unknown",
      });
      setLoadingInvite(false);
    }
    fetchInvitation();
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!invitation) return;
    setError("");
    setLoading(true);

    const result = await register(invitation.email, password, fullName);
    if (result.error) {
      setError(result.error);
      setLoading(false);
      return;
    }

    if (result.userId) {
      try {
        // Create membership
        const { error: memberError } = await supabase
          .from("company_memberships")
          .insert({
            user_id: result.userId,
            company_id: invitation.companyId,
            role: invitation.role as any,
          });

        if (memberError) throw memberError;

        // Mark invitation as accepted
        await supabase
          .from("invitations")
          .update({ accepted_at: new Date().toISOString() })
          .eq("id", invitation.id);

        setSuccess(true);
      } catch (err: any) {
        setError(err.message || "Failed to accept invitation");
      }
    }
    setLoading(false);
  };

  if (loadingInvite) {
    return (
      <AuthLayout>
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-gold" />
        </div>
      </AuthLayout>
    );
  }

  if (success) {
    return (
      <AuthLayout>
        <div className="text-center animate-fade-in">
          <div className="w-14 h-14 rounded-full bg-gold/10 flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="w-7 h-7 text-gold" />
          </div>
          <h2 className="text-2xl font-bold font-display text-foreground mb-2">
            Welcome to {invitation?.companyName}!
          </h2>
          <p className="text-sm text-muted-foreground mb-6">
            Please check your email to verify, then sign in.
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

  if (error && !invitation) {
    return (
      <AuthLayout>
        <div className="text-center animate-fade-in">
          <div className="flex items-center gap-2 p-4 rounded-lg bg-destructive/10 text-destructive text-sm mb-6">
            <AlertCircle className="w-5 h-5 shrink-0" />
            {error}
          </div>
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
        {t("auth.inviteTitle")}
      </h2>
      <p className="text-sm text-muted-foreground mb-2">
        {t("auth.inviteSubtitle")}
      </p>
      {invitation && (
        <div className="p-3 rounded-lg bg-gold/5 border border-gold/20 mb-6">
          <p className="text-sm font-medium text-foreground">{invitation.companyName}</p>
          <p className="text-xs text-muted-foreground capitalize">Role: {invitation.role.replace("_", " ")}</p>
        </div>
      )}

      {error && (
        <div className="flex items-center gap-2 p-3 mb-4 rounded-lg bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs font-medium text-foreground/80 uppercase tracking-wider">
            {t("auth.email")}
          </label>
          <input
            type="email"
            value={invitation?.email || ""}
            className="luxury-input w-full bg-muted/50"
            disabled
          />
        </div>

        <div className="space-y-2">
          <label className="text-xs font-medium text-foreground/80 uppercase tracking-wider">
            {t("auth.fullName")}
          </label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your full name"
            className="luxury-input w-full"
            required
            maxLength={100}
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

        <Button
          type="submit"
          disabled={loading}
          className="w-full h-11 gold-gradient border-0 text-accent-foreground font-semibold text-sm rounded-lg hover:opacity-90 transition-opacity"
        >
          {loading ? (
            <span className="flex items-center gap-2">
              <span className="w-4 h-4 border-2 border-accent-foreground/30 border-t-accent-foreground rounded-full animate-spin" />
              Creating account...
            </span>
          ) : (
            <span className="flex items-center gap-2">
              {t("auth.acceptInvite")}
              <ArrowRight className="w-4 h-4" />
            </span>
          )}
        </Button>
      </form>
    </AuthLayout>
  );
}
