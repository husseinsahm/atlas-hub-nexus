import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Building2, Globe, Phone, Mail, MapPin, Camera, Loader2, Save,
  Languages, DollarSign, Hash, Trash2, Plus, CheckCircle, Settings,
  Image as ImageIcon, KeyRound, Eye, EyeOff, ShieldCheck,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { LockOverlay } from "@/components/plan/LockOverlay";
import { LimitReachedDialog } from "@/components/plan/LimitReachedDialog";

interface CompanyData {
  id: string; name: string; slug: string; email: string | null;
  phone: string | null; address: string | null; logo_url: string | null; is_active: boolean;
}

interface SettingsData {
  id?: string; company_id: string; logo_url: string | null;
  tagline: string; website: string; default_language: string;
  default_currency: string; supported_languages: string[];
  trip_prefix: string; trip_next_number: number;
  booking_prefix: string; booking_next_number: number;
  invoice_prefix: string; invoice_next_number: number;
  default_tax_rate: number; default_payment_terms: string;
  default_invoice_currency: string;
}

interface Branch {
  id: string; name: string; city: string | null; country: string | null;
  phone: string | null; email: string | null; address: string | null;
  is_main: boolean; is_active: boolean;
}

const CURRENCIES = ["USD", "EUR", "GBP", "SAR", "AED", "EGP", "JOD", "KWD", "QAR", "BHD", "OMR", "TRY", "INR"];
const LANGUAGES = [
  { code: "en", name: "English" }, { code: "ar", name: "Arabic" },
  { code: "fr", name: "French" }, { code: "de", name: "German" },
  { code: "es", name: "Spanish" }, { code: "tr", name: "Turkish" },
  { code: "hi", name: "Hindi" }, { code: "zh", name: "Chinese" },
];

export default function SettingsPage() {
  const { user, refreshUser } = useAuth();
  const { toast } = useToast();
  const { limits, hasFeature } = usePlanLimits();
  const companyId = user?.activeMembership?.companyId;
  const isBrandingLocked = !hasFeature("custom_branding") && limits.planSlug !== "professional" && limits.planSlug !== "enterprise";
  const [branchLimitOpen, setBranchLimitOpen] = useState(false);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  const [company, setCompany] = useState<CompanyData | null>(null);
  const [settings, setSettings] = useState<SettingsData | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);

  // Forms
  const [companyForm, setCompanyForm] = useState({ name: "", email: "", phone: "", address: "" });
  const [settingsForm, setSettingsForm] = useState({
    tagline: "", website: "", default_language: "en", default_currency: "USD",
    supported_languages: ["en"] as string[],
    trip_prefix: "TRP", trip_next_number: 1,
    booking_prefix: "BKG", booking_next_number: 1,
    invoice_prefix: "INV", invoice_next_number: 1,
    default_tax_rate: 0, default_payment_terms: "Payment is due within 30 days of the invoice date.",
    default_invoice_currency: "USD",
  });
  const [branchForm, setBranchForm] = useState({ name: "", city: "", country: "", phone: "", email: "", address: "", is_main: false });
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!companyId) { setLoading(false); return; }
    loadAll();
  }, [companyId]);

  async function loadAll() {
    setLoading(true);
    const [companyRes, settingsRes, branchesRes] = await Promise.all([
      supabase.from("companies").select("*").eq("id", companyId!).single(),
      supabase.from("company_settings").select("*").eq("company_id", companyId!).maybeSingle(),
      supabase.from("company_branches").select("*").eq("company_id", companyId!).is("deleted_at", null).order("is_main", { ascending: false }),
    ]);

    if (companyRes.data) {
      const c = companyRes.data;
      setCompany(c as CompanyData);
      setCompanyForm({ name: c.name, email: c.email || "", phone: c.phone || "", address: c.address || "" });
      setLogoPreview(c.logo_url);
    }

    if (settingsRes.data) {
      const s = settingsRes.data;
      setSettings(s as any);
      setSettingsForm({
        tagline: s.tagline || "", website: s.website || "",
        default_language: s.default_language || "en",
        default_currency: s.default_currency || "USD",
        supported_languages: (s.supported_languages as string[]) || ["en"],
        trip_prefix: s.trip_prefix || "TRP", trip_next_number: s.trip_next_number || 1,
        booking_prefix: s.booking_prefix || "BKG", booking_next_number: s.booking_next_number || 1,
        invoice_prefix: s.invoice_prefix || "INV", invoice_next_number: s.invoice_next_number || 1,
        default_tax_rate: s.default_tax_rate ?? 0,
        default_payment_terms: s.default_payment_terms || "Payment is due within 30 days of the invoice date.",
        default_invoice_currency: s.default_invoice_currency || s.default_currency || "USD",
      });
      if (s.logo_url) setLogoPreview(s.logo_url);
    }

    if (branchesRes.data) setBranches(branchesRes.data as Branch[]);
    setLoading(false);
  }

  // Logo upload
  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !companyId) return;
    setUploading(true);
    const ext = file.name.split(".").pop();
    const path = `${companyId}/logo.${ext}`;

    const { error: uploadErr } = await supabase.storage.from("company-assets").upload(path, file, { upsert: true });
    if (uploadErr) {
      toast({ title: "Upload failed", description: uploadErr.message, variant: "destructive" });
      setUploading(false); return;
    }
    const { data: urlData } = supabase.storage.from("company-assets").getPublicUrl(path);
    const logoUrl = urlData.publicUrl + `?t=${Date.now()}`;
    setLogoPreview(logoUrl);

    // Save to both company and settings
    await supabase.from("companies").update({ logo_url: logoUrl }).eq("id", companyId);
    setUploading(false);
    toast({ title: "Logo updated" });
  };

  // Save company profile
  const saveCompanyProfile = async () => {
    if (!companyId) return;
    setSaving(true);
    const { error } = await supabase.from("companies").update({
      name: companyForm.name, email: companyForm.email || null,
      phone: companyForm.phone || null, address: companyForm.address || null,
    }).eq("id", companyId);
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else { toast({ title: "Company profile saved" }); refreshUser(); }
    setSaving(false);
  };

  // Save settings
  const saveSettings = async () => {
    if (!companyId) return;
    setSaving(true);
    const payload = {
      company_id: companyId,
      tagline: settingsForm.tagline || null,
      website: settingsForm.website || null,
      default_language: settingsForm.default_language,
      default_currency: settingsForm.default_currency,
      supported_languages: settingsForm.supported_languages,
      trip_prefix: settingsForm.trip_prefix,
      trip_next_number: settingsForm.trip_next_number,
      booking_prefix: settingsForm.booking_prefix,
      booking_next_number: settingsForm.booking_next_number,
      invoice_prefix: settingsForm.invoice_prefix,
      invoice_next_number: settingsForm.invoice_next_number,
      default_tax_rate: settingsForm.default_tax_rate,
      default_payment_terms: settingsForm.default_payment_terms || null,
      default_invoice_currency: settingsForm.default_invoice_currency,
      logo_url: logoPreview,
    };

    if (settings?.id) {
      const { error } = await supabase.from("company_settings").update(payload).eq("id", settings.id);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else toast({ title: "Settings saved" });
    } else {
      const { error } = await supabase.from("company_settings").insert(payload);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else toast({ title: "Settings created" });
    }
    setSaving(false);
    loadAll();
  };

  const toggleLanguage = (code: string) => {
    setSettingsForm((prev) => ({
      ...prev,
      supported_languages: prev.supported_languages.includes(code)
        ? prev.supported_languages.filter((l) => l !== code)
        : [...prev.supported_languages, code],
    }));
  };

  // Branches
  const handleAddBranch = async () => {
    if (!companyId || !branchForm.name.trim()) return;
    if (!limits.canAddBranch) {
      setBranchLimitOpen(true);
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("company_branches").insert({
      company_id: companyId, name: branchForm.name,
      city: branchForm.city || null, country: branchForm.country || null,
      phone: branchForm.phone || null, email: branchForm.email || null,
      address: branchForm.address || null, is_main: branchForm.is_main,
    });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Branch added" });
      setBranchForm({ name: "", city: "", country: "", phone: "", email: "", address: "", is_main: false });
      loadAll();
    }
    setSaving(false);
  };

  const handleDeleteBranch = async (branchId: string) => {
    await supabase.from("company_branches").update({ deleted_at: new Date().toISOString() }).eq("id", branchId);
    toast({ title: "Branch removed" });
    loadAll();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-gold" />
      </div>
    );
  }

  if (!companyId) {
    return (
      <div className="luxury-card p-12 text-center animate-fade-in">
        <Settings className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
        <p className="text-sm text-muted-foreground">No company selected. Please join or create a company first.</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      {/* Header */}
      <div>
        <h1 className="text-[22px] font-bold font-display text-foreground leading-tight">Company Settings</h1>
        <p className="text-[13px] text-muted-foreground mt-1">Manage your company profile, branding, and preferences</p>
      </div>

      <Tabs defaultValue="profile" className="space-y-6">
        <TabsList className="bg-muted/50 border border-border p-1 flex-wrap h-auto">
          <TabsTrigger value="profile" className="text-xs font-semibold data-[state=active]:bg-card data-[state=active]:shadow-sm gap-1.5">
            <Building2 className="w-3.5 h-3.5" /> Profile
          </TabsTrigger>
          <TabsTrigger value="brand" className="text-xs font-semibold data-[state=active]:bg-card data-[state=active]:shadow-sm gap-1.5">
            <ImageIcon className="w-3.5 h-3.5" /> Brand
          </TabsTrigger>
          <TabsTrigger value="preferences" className="text-xs font-semibold data-[state=active]:bg-card data-[state=active]:shadow-sm gap-1.5">
            <Globe className="w-3.5 h-3.5" /> Preferences
          </TabsTrigger>
          <TabsTrigger value="branches" className="text-xs font-semibold data-[state=active]:bg-card data-[state=active]:shadow-sm gap-1.5">
            <MapPin className="w-3.5 h-3.5" /> Branches
          </TabsTrigger>
          <TabsTrigger value="numbering" className="text-xs font-semibold data-[state=active]:bg-card data-[state=active]:shadow-sm gap-1.5">
            <Hash className="w-3.5 h-3.5" /> Numbering
          </TabsTrigger>
          <TabsTrigger value="invoicing" className="text-xs font-semibold data-[state=active]:bg-card data-[state=active]:shadow-sm gap-1.5">
            <DollarSign className="w-3.5 h-3.5" /> Invoicing
          </TabsTrigger>
          <TabsTrigger value="security" className="text-xs font-semibold data-[state=active]:bg-card data-[state=active]:shadow-sm gap-1.5">
            <KeyRound className="w-3.5 h-3.5" /> Security
          </TabsTrigger>
        </TabsList>

        {/* ── Profile Tab ── */}
        <TabsContent value="profile">
          <div className="luxury-card p-6 space-y-6">
            <div>
              <h3 className="font-semibold font-display text-foreground mb-1">Company Profile</h3>
              <p className="text-xs text-muted-foreground">Basic information about your travel company</p>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Company Name *</label>
                <input value={companyForm.name} onChange={(e) => setCompanyForm({ ...companyForm, name: e.target.value })}
                  className="luxury-input w-full" maxLength={100} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Mail className="w-3 h-3" /> Email
                </label>
                <input type="email" value={companyForm.email} onChange={(e) => setCompanyForm({ ...companyForm, email: e.target.value })}
                  className="luxury-input w-full" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Phone className="w-3 h-3" /> Phone
                </label>
                <input value={companyForm.phone} onChange={(e) => setCompanyForm({ ...companyForm, phone: e.target.value })}
                  className="luxury-input w-full" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <MapPin className="w-3 h-3" /> Address
                </label>
                <input value={companyForm.address} onChange={(e) => setCompanyForm({ ...companyForm, address: e.target.value })}
                  className="luxury-input w-full" />
              </div>
            </div>
            <div className="flex justify-end pt-2">
              <Button onClick={saveCompanyProfile} disabled={saving || !companyForm.name.trim()}
                className="gold-gradient border-0 text-accent-foreground font-semibold hover:opacity-90 gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Profile
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ── Brand Tab ── */}
        <TabsContent value="brand">
          <div className="luxury-card p-6 space-y-6 relative">
            {isBrandingLocked && (
              <LockOverlay planRequired="Professional" featureName="Custom Branding" />
            )}
            <div>
              <h3 className="font-semibold font-display text-foreground mb-1">Brand Settings</h3>
              <p className="text-xs text-muted-foreground">Your company logo, tagline, and website</p>
            </div>

            {/* Logo upload */}
            <div className="flex items-start gap-6">
              <div className="relative group">
                <div className="w-24 h-24 rounded-xl border-2 border-dashed border-border bg-muted/30 flex items-center justify-center overflow-hidden">
                  {logoPreview ? (
                    <img src={logoPreview} alt="Logo" className="w-full h-full object-contain p-2" />
                  ) : (
                    <Camera className="w-8 h-8 text-muted-foreground" />
                  )}
                </div>
                <button onClick={() => fileInputRef.current?.click()}
                  className="absolute inset-0 bg-primary/60 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  {uploading ? <Loader2 className="w-5 h-5 animate-spin text-primary-foreground" /> : <Camera className="w-5 h-5 text-primary-foreground" />}
                </button>
                <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleLogoUpload} />
              </div>
              <div className="flex-1 space-y-1">
                <p className="text-sm font-medium text-foreground">Company Logo</p>
                <p className="text-xs text-muted-foreground">Upload a square logo (PNG, JPG). Recommended 512×512px.</p>
                <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="mt-2 text-xs">
                  {uploading ? "Uploading…" : "Choose File"}
                </Button>
              </div>
            </div>

            {/* Tagline & Website */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Tagline</label>
                <input value={settingsForm.tagline} onChange={(e) => setSettingsForm({ ...settingsForm, tagline: e.target.value })}
                  className="luxury-input w-full" placeholder="Premium Travel Experiences" maxLength={150} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Globe className="w-3 h-3" /> Website
                </label>
                <input value={settingsForm.website} onChange={(e) => setSettingsForm({ ...settingsForm, website: e.target.value })}
                  className="luxury-input w-full" placeholder="https://yourcompany.com" />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={saveSettings} disabled={saving}
                className="gold-gradient border-0 text-accent-foreground font-semibold hover:opacity-90 gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Brand
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ── Preferences Tab ── */}
        <TabsContent value="preferences">
          <div className="luxury-card p-6 space-y-6">
            <div>
              <h3 className="font-semibold font-display text-foreground mb-1">Language & Currency</h3>
              <p className="text-xs text-muted-foreground">Default language, currency, and supported languages for your company</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <Languages className="w-3 h-3" /> Default Language
                </label>
                <select value={settingsForm.default_language}
                  onChange={(e) => setSettingsForm({ ...settingsForm, default_language: e.target.value })}
                  className="luxury-input w-full">
                  {LANGUAGES.map((l) => <option key={l.code} value={l.code}>{l.name}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <DollarSign className="w-3 h-3" /> Default Currency
                </label>
                <select value={settingsForm.default_currency}
                  onChange={(e) => setSettingsForm({ ...settingsForm, default_currency: e.target.value })}
                  className="luxury-input w-full">
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            {/* Supported Languages */}
            <div>
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2 block">
                Supported Languages
              </label>
              <div className="flex flex-wrap gap-2">
                {LANGUAGES.map((lang) => {
                  const active = settingsForm.supported_languages.includes(lang.code);
                  return (
                    <button key={lang.code} type="button" onClick={() => toggleLanguage(lang.code)}
                      className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all duration-150 ${
                        active
                          ? "bg-accent/15 text-accent border-accent/30"
                          : "bg-muted/50 text-muted-foreground border-border hover:border-accent/30"
                      }`}>
                      {active && <CheckCircle className="w-3 h-3 inline me-1" />}
                      {lang.name}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={saveSettings} disabled={saving}
                className="gold-gradient border-0 text-accent-foreground font-semibold hover:opacity-90 gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Preferences
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ── Branches Tab ── */}
        <TabsContent value="branches">
          <div className="space-y-4">
            {/* Existing branches */}
            <div className="luxury-card p-6 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-semibold font-display text-foreground mb-1">Branches</h3>
                  <p className="text-xs text-muted-foreground">{branches.length} branch{branches.length !== 1 ? "es" : ""} configured</p>
                </div>
              </div>

              {branches.length === 0 ? (
                <div className="py-8 text-center">
                  <MapPin className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No branches yet. Add your first branch below.</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {branches.map((b) => (
                    <div key={b.id} className="flex items-center justify-between p-4 rounded-xl bg-muted/20 border border-border">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-primary/5 flex items-center justify-center">
                          <MapPin className="w-4 h-4 text-primary" />
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-foreground flex items-center gap-2">
                            {b.name}
                            {b.is_main && (
                              <span className="text-[10px] bg-accent/15 text-accent px-1.5 py-0.5 rounded-full uppercase font-bold">Main</span>
                            )}
                          </p>
                          <p className="text-[11px] text-muted-foreground">
                            {[b.city, b.country].filter(Boolean).join(", ") || "No location set"}
                            {b.phone && <span className="ms-2">· {b.phone}</span>}
                          </p>
                        </div>
                      </div>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleDeleteBranch(b.id)}>
                        <Trash2 className="w-4 h-4 text-muted-foreground hover:text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add branch */}
            <div className="luxury-card p-6 space-y-4">
              <h4 className="text-sm font-semibold text-foreground flex items-center gap-2">
                <Plus className="w-4 h-4 text-accent" /> Add Branch
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-muted-foreground">Branch Name *</label>
                  <input value={branchForm.name} onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })}
                    className="luxury-input w-full" placeholder="Main Office" maxLength={100} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-muted-foreground">City</label>
                  <input value={branchForm.city} onChange={(e) => setBranchForm({ ...branchForm, city: e.target.value })}
                    className="luxury-input w-full" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-muted-foreground">Country</label>
                  <input value={branchForm.country} onChange={(e) => setBranchForm({ ...branchForm, country: e.target.value })}
                    className="luxury-input w-full" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-muted-foreground">Phone</label>
                  <input value={branchForm.phone} onChange={(e) => setBranchForm({ ...branchForm, phone: e.target.value })}
                    className="luxury-input w-full" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-muted-foreground">Email</label>
                  <input type="email" value={branchForm.email} onChange={(e) => setBranchForm({ ...branchForm, email: e.target.value })}
                    className="luxury-input w-full" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-muted-foreground">Address</label>
                  <input value={branchForm.address} onChange={(e) => setBranchForm({ ...branchForm, address: e.target.value })}
                    className="luxury-input w-full" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
                <input type="checkbox" checked={branchForm.is_main}
                  onChange={(e) => setBranchForm({ ...branchForm, is_main: e.target.checked })}
                  className="accent-[hsl(var(--accent))] w-4 h-4" />
                Main branch
              </label>
              <Button onClick={handleAddBranch} disabled={saving || !branchForm.name.trim()}
                className="gold-gradient border-0 text-accent-foreground font-semibold hover:opacity-90 gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Add Branch
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ── Numbering Tab ── */}
        <TabsContent value="numbering">
          <div className="luxury-card p-6 space-y-6">
            <div>
              <h3 className="font-semibold font-display text-foreground mb-1">Numbering Settings</h3>
              <p className="text-xs text-muted-foreground">Configure prefixes and auto-increment numbers for trips, bookings, and invoices</p>
            </div>

            <div className="space-y-5">
              {[
                { label: "Trip", prefixKey: "trip_prefix" as const, numberKey: "trip_next_number" as const, icon: "🗺️" },
                { label: "Booking", prefixKey: "booking_prefix" as const, numberKey: "booking_next_number" as const, icon: "📋" },
                { label: "Invoice", prefixKey: "invoice_prefix" as const, numberKey: "invoice_next_number" as const, icon: "🧾" },
              ].map((item) => (
                <div key={item.label} className="p-4 rounded-xl bg-muted/20 border border-border space-y-3">
                  <p className="text-sm font-semibold text-foreground">{item.icon} {item.label} Numbering</p>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-muted-foreground">Prefix</label>
                      <input value={settingsForm[item.prefixKey]}
                        onChange={(e) => setSettingsForm({ ...settingsForm, [item.prefixKey]: e.target.value.toUpperCase() })}
                        className="luxury-input w-full font-mono" maxLength={10} />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[10px] text-muted-foreground">Next Number</label>
                      <input type="number" min="1" value={settingsForm[item.numberKey]}
                        onChange={(e) => setSettingsForm({ ...settingsForm, [item.numberKey]: parseInt(e.target.value) || 1 })}
                        className="luxury-input w-full font-mono" />
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    Preview: <span className="font-mono font-semibold text-foreground">
                      {settingsForm[item.prefixKey]}-{String(settingsForm[item.numberKey]).padStart(5, "0")}
                    </span>
                  </p>
                </div>
              ))}
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={saveSettings} disabled={saving}
                className="gold-gradient border-0 text-accent-foreground font-semibold hover:opacity-90 gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Numbering
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ── Invoicing Tab ── */}
        <TabsContent value="invoicing">
          <div className="luxury-card p-6 space-y-6">
            <div>
              <h3 className="font-semibold font-display text-foreground mb-1">Invoice Settings</h3>
              <p className="text-xs text-muted-foreground">Default values applied when creating new invoices</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                  <DollarSign className="w-3 h-3" /> Default Invoice Currency
                </label>
                <select value={settingsForm.default_invoice_currency}
                  onChange={(e) => setSettingsForm({ ...settingsForm, default_invoice_currency: e.target.value })}
                  className="luxury-input w-full">
                  {CURRENCIES.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Default Tax Rate (%)</label>
                <input type="number" min="0" max="100" step="0.5" value={settingsForm.default_tax_rate}
                  onChange={(e) => setSettingsForm({ ...settingsForm, default_tax_rate: parseFloat(e.target.value) || 0 })}
                  className="luxury-input w-full font-mono" />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Default Payment Terms</label>
              <textarea value={settingsForm.default_payment_terms}
                onChange={(e) => setSettingsForm({ ...settingsForm, default_payment_terms: e.target.value })}
                className="luxury-input w-full min-h-[80px] resize-y" rows={3}
                placeholder="Payment is due within 30 days of the invoice date." />
            </div>

            <div className="flex justify-end pt-2">
              <Button onClick={saveSettings} disabled={saving}
                className="gold-gradient border-0 text-accent-foreground font-semibold hover:opacity-90 gap-2">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                Save Invoice Settings
              </Button>
            </div>
          </div>
        </TabsContent>

        {/* ── Security Tab ── */}
        <TabsContent value="security">
          <PasswordChangeSection />
        </TabsContent>
      </Tabs>

      <LimitReachedDialog open={branchLimitOpen} onOpenChange={setBranchLimitOpen} type="branches" />
    </div>
  );
}

function PasswordChangeSection() {
  const { updatePassword } = useAuth();
  const { toast } = useToast();
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [saving, setSaving] = useState(false);

  const passwordsMatch = newPassword === confirmPassword;
  const isValid = newPassword.length >= 6 && passwordsMatch;

  async function handleChangePassword() {
    if (!isValid) return;
    setSaving(true);
    try {
      const result = await updatePassword(newPassword);
      if (result.error) throw new Error(result.error);
      toast({ title: "Password updated successfully ✓" });
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="luxury-card p-6 space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <ShieldCheck className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h3 className="font-semibold font-display text-foreground">Change Password</h3>
          <p className="text-xs text-muted-foreground">Update your login password</p>
        </div>
      </div>

      <div className="max-w-md space-y-4">
        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">New Password</label>
          <div className="relative">
            <KeyRound className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type={showNew ? "text" : "password"}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="Min 6 characters"
              className="luxury-input w-full ps-9 pe-10"
            />
            <button
              type="button"
              onClick={() => setShowNew(!showNew)}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Confirm Password</label>
          <div className="relative">
            <KeyRound className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type={showConfirm ? "text" : "password"}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="Re-enter your new password"
              className="luxury-input w-full ps-9 pe-10"
            />
            <button
              type="button"
              onClick={() => setShowConfirm(!showConfirm)}
              className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
            </button>
          </div>
          {confirmPassword && !passwordsMatch && (
            <p className="text-xs text-destructive">Passwords do not match</p>
          )}
        </div>

        <Button
          onClick={handleChangePassword}
          disabled={!isValid || saving}
          className="gold-gradient border-0 text-accent-foreground font-semibold hover:opacity-90 gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
          Update Password
        </Button>
      </div>

    </div>
  );
}
