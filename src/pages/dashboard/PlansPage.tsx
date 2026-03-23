import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Plus, Search, DollarSign, MoreHorizontal, Pencil, Trash2,
  CheckCircle, XCircle, Loader2, Star, Users, Building2, Map,
  Zap, Shield, BarChart3, X
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";

interface Plan {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  price_monthly: number;
  price_yearly: number;
  currency: string;
  max_users: number | null;
  max_branches: number | null;
  max_trips: number | null;
  features: any;
  is_active: boolean;
  sort_order: number;
  created_at: string;
}

const AVAILABLE_FEATURES = [
  "Analytics", "API Access", "Priority Support", "Custom Branding",
  "Bulk Import", "Invoicing", "Multi-Currency", "Itinerary Builder",
  "Client Portal", "Automated Emails", "Reporting", "Webhooks",
];

const defaultForm = {
  name: "", slug: "", description: "",
  price_monthly: "0", price_yearly: "0", currency: "USD",
  max_users: "5", max_branches: "1", max_trips: "",
  sort_order: "0",
};

export default function PlansPage() {
  const { toast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editDialog, setEditDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(defaultForm);
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([]);
  const [subscriberCounts, setSubscriberCounts] = useState<Record<string, number>>({});

  const fetchPlans = async () => {
    setLoading(true);
    const [plansRes, subsRes] = await Promise.all([
      supabase.from("plans").select("*").is("deleted_at", null).order("sort_order", { ascending: true }),
      supabase.from("subscriptions").select("plan_id").eq("status", "active"),
    ]);
    if (plansRes.data) setPlans(plansRes.data as Plan[]);
    if (subsRes.data) {
      const counts: Record<string, number> = {};
      subsRes.data.forEach((s: any) => { counts[s.plan_id] = (counts[s.plan_id] || 0) + 1; });
      setSubscriberCounts(counts);
    }
    setLoading(false);
  };

  useEffect(() => { fetchPlans(); }, []);

  const generateSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const openEdit = (plan?: Plan) => {
    if (plan) {
      setSelectedPlan(plan);
      setForm({
        name: plan.name, slug: plan.slug, description: plan.description || "",
        price_monthly: String(plan.price_monthly), price_yearly: String(plan.price_yearly),
        currency: plan.currency,
        max_users: plan.max_users !== null ? String(plan.max_users) : "",
        max_branches: plan.max_branches !== null ? String(plan.max_branches) : "",
        max_trips: plan.max_trips !== null ? String(plan.max_trips) : "",
        sort_order: String(plan.sort_order),
      });
      setSelectedFeatures(Array.isArray(plan.features) ? plan.features : []);
    } else {
      setSelectedPlan(null);
      setForm(defaultForm);
      setSelectedFeatures([]);
    }
    setEditDialog(true);
  };

  const toggleFeature = (f: string) => {
    setSelectedFeatures((prev) => prev.includes(f) ? prev.filter((x) => x !== f) : [...prev, f]);
  };

  const handleSave = async () => {
    setSaving(true);
    const slug = form.slug || generateSlug(form.name);
    const payload = {
      name: form.name, slug,
      description: form.description || null,
      price_monthly: parseFloat(form.price_monthly) || 0,
      price_yearly: parseFloat(form.price_yearly) || 0,
      currency: form.currency,
      max_users: form.max_users ? parseInt(form.max_users) : null,
      max_branches: form.max_branches ? parseInt(form.max_branches) : null,
      max_trips: form.max_trips ? parseInt(form.max_trips) : null,
      features: selectedFeatures,
      sort_order: parseInt(form.sort_order) || 0,
    };
    if (selectedPlan) {
      const { error } = await supabase.from("plans").update(payload).eq("id", selectedPlan.id);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else toast({ title: "Plan updated" });
    } else {
      const { error } = await supabase.from("plans").insert(payload);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else toast({ title: "Plan created" });
    }
    setSaving(false);
    setEditDialog(false);
    fetchPlans();
  };

  const handleDelete = async (plan: Plan) => {
    await supabase.from("plans").update({ deleted_at: new Date().toISOString() }).eq("id", plan.id);
    toast({ title: "Plan archived" });
    fetchPlans();
  };

  const toggleActive = async (plan: Plan) => {
    await supabase.from("plans").update({ is_active: !plan.is_active }).eq("id", plan.id);
    fetchPlans();
  };

  const filtered = plans.filter((p) => p.name.toLowerCase().includes(search.toLowerCase()));

  const yearlyDiscount = (monthly: number, yearly: number) => {
    if (!monthly || !yearly) return null;
    const annualFromMonthly = monthly * 12;
    const pct = Math.round(((annualFromMonthly - yearly) / annualFromMonthly) * 100);
    return pct > 0 ? pct : null;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Subscription Plans</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {plans.length} plan{plans.length !== 1 ? "s" : ""} configured · {plans.filter((p) => p.is_active).length} active
          </p>
        </div>
        <Button onClick={() => openEdit()} className="gold-gradient border-0 text-accent-foreground font-semibold hover:opacity-90 gap-2">
          <Plus className="w-4 h-4" /> New Plan
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" style={{ insetInlineStart: 12 }} />
        <input type="text" placeholder="Search plans…" value={search} onChange={(e) => setSearch(e.target.value)}
          className="luxury-input w-full h-9 text-sm" style={{ paddingInlineStart: 36 }} />
      </div>

      {/* Plans grid */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gold" /></div>
      ) : filtered.length === 0 ? (
        <div className="luxury-card p-12 text-center">
          <DollarSign className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No plans found. Create your first subscription plan.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
          {filtered.map((plan) => {
            const discount = yearlyDiscount(plan.price_monthly, plan.price_yearly);
            const subs = subscriberCounts[plan.id] || 0;
            return (
              <div key={plan.id} className={`luxury-card flex flex-col relative overflow-hidden ${!plan.is_active ? "opacity-60" : ""}`}>
                {/* Top accent bar */}
                <div className="h-1 gold-gradient" />
                <div className="p-6 flex flex-col flex-1">
                  {/* Header */}
                  <div className="flex items-start justify-between mb-5">
                    <div className="flex items-center gap-3">
                      <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center">
                        <Star className="w-5 h-5 text-accent" />
                      </div>
                      <div>
                        <h3 className="font-bold font-display text-foreground text-lg leading-tight">{plan.name}</h3>
                        <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{plan.slug}</p>
                      </div>
                    </div>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => openEdit(plan)}><Pencil className="w-4 h-4 me-2" /> Edit</DropdownMenuItem>
                        <DropdownMenuItem onClick={() => toggleActive(plan)}>
                          {plan.is_active ? <XCircle className="w-4 h-4 me-2" /> : <CheckCircle className="w-4 h-4 me-2" />}
                          {plan.is_active ? "Deactivate" : "Activate"}
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => handleDelete(plan)} className="text-destructive">
                          <Trash2 className="w-4 h-4 me-2" /> Archive
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>

                  {plan.description && <p className="text-sm text-muted-foreground mb-5 leading-relaxed">{plan.description}</p>}

                  {/* Pricing */}
                  <div className="mb-5">
                    <div className="flex items-baseline gap-1">
                      <span className="text-[32px] font-extrabold font-display text-foreground leading-none">
                        ${plan.price_monthly}
                      </span>
                      <span className="text-sm text-muted-foreground font-medium">/mo</span>
                    </div>
                    {plan.price_yearly > 0 && (
                      <div className="flex items-center gap-2 mt-1.5">
                        <span className="text-sm text-muted-foreground">${plan.price_yearly}/yr</span>
                        {discount && (
                          <span className="text-[10px] font-bold bg-emerald-500/10 text-emerald-700 px-2 py-0.5 rounded-full">
                            Save {discount}%
                          </span>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Limits */}
                  <div className="space-y-3 flex-1 mb-5">
                    {[
                      { icon: Users, label: "Users", value: plan.max_users },
                      { icon: Building2, label: "Branches", value: plan.max_branches },
                      { icon: Map, label: "Trips/mo", value: plan.max_trips },
                    ].map((limit) => (
                      <div key={limit.label} className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <limit.icon className="w-3.5 h-3.5" />
                          {limit.label}
                        </div>
                        <span className="text-sm font-semibold text-foreground">
                          {limit.value !== null ? limit.value : <span className="text-emerald-600">Unlimited</span>}
                        </span>
                      </div>
                    ))}
                  </div>

                  {/* Feature flags */}
                  {Array.isArray(plan.features) && plan.features.length > 0 && (
                    <div className="mb-5">
                      <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Features</p>
                      <div className="flex flex-wrap gap-1.5">
                        {(plan.features as string[]).map((f, i) => (
                          <span key={i} className="inline-flex items-center gap-1 text-[11px] font-medium bg-accent/8 text-accent border border-accent/15 px-2 py-0.5 rounded-full">
                            <Zap className="w-2.5 h-2.5" />{f}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Footer */}
                  <div className="pt-4 border-t border-border flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      {plan.is_active ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-500/10 px-2.5 py-1 rounded-full">
                          <CheckCircle className="w-3 h-3" /> Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-destructive bg-destructive/10 px-2.5 py-1 rounded-full">
                          <XCircle className="w-3 h-3" /> Inactive
                        </span>
                      )}
                    </div>
                    <span className="text-xs text-muted-foreground">
                      {subs} subscriber{subs !== 1 ? "s" : ""}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">
              {selectedPlan ? "Edit Plan" : "Create Plan"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-5 pt-2">
            {/* Name & Slug */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Plan Name *</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: selectedPlan ? form.slug : generateSlug(e.target.value) })}
                  className="luxury-input w-full" required maxLength={100} />
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Slug</label>
                <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  className="luxury-input w-full font-mono text-sm" />
              </div>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })}
                className="luxury-input w-full min-h-[60px] resize-none" maxLength={500} />
            </div>

            {/* Pricing */}
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Pricing</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-muted-foreground">Monthly ($)</label>
                  <input type="number" step="0.01" min="0" value={form.price_monthly} onChange={(e) => setForm({ ...form, price_monthly: e.target.value })}
                    className="luxury-input w-full" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-muted-foreground">Yearly ($)</label>
                  <input type="number" step="0.01" min="0" value={form.price_yearly} onChange={(e) => setForm({ ...form, price_yearly: e.target.value })}
                    className="luxury-input w-full" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-muted-foreground">Currency</label>
                  <input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value.toUpperCase() })}
                    className="luxury-input w-full" maxLength={3} />
                </div>
              </div>
            </div>

            {/* Limits */}
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Usage Limits</p>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-[10px] text-muted-foreground flex items-center gap-1"><Users className="w-3 h-3" /> Max Users</label>
                  <input type="number" min="0" value={form.max_users} onChange={(e) => setForm({ ...form, max_users: e.target.value })}
                    className="luxury-input w-full" placeholder="Unlimited" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-muted-foreground flex items-center gap-1"><Building2 className="w-3 h-3" /> Max Branches</label>
                  <input type="number" min="0" value={form.max_branches} onChange={(e) => setForm({ ...form, max_branches: e.target.value })}
                    className="luxury-input w-full" placeholder="Unlimited" />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[10px] text-muted-foreground flex items-center gap-1"><Map className="w-3 h-3" /> Max Trips/mo</label>
                  <input type="number" min="0" value={form.max_trips} onChange={(e) => setForm({ ...form, max_trips: e.target.value })}
                    className="luxury-input w-full" placeholder="Unlimited" />
                </div>
              </div>
            </div>

            {/* Feature flags */}
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Feature Flags</p>
              <div className="flex flex-wrap gap-2">
                {AVAILABLE_FEATURES.map((f) => {
                  const active = selectedFeatures.includes(f);
                  return (
                    <button key={f} type="button" onClick={() => toggleFeature(f)}
                      className={`text-xs font-medium px-3 py-1.5 rounded-full border transition-all duration-150 ${
                        active
                          ? "bg-accent/15 text-accent border-accent/30"
                          : "bg-muted/50 text-muted-foreground border-border hover:border-accent/30"
                      }`}>
                      {active && <CheckCircle className="w-3 h-3 inline me-1" />}
                      {f}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Sort */}
            <div className="space-y-1.5 max-w-[120px]">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Sort Order</label>
              <input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })}
                className="luxury-input w-full" />
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-3 border-t border-border">
              <Button variant="ghost" onClick={() => setEditDialog(false)} className="flex-1">Cancel</Button>
              <Button onClick={handleSave} disabled={saving || !form.name.trim()}
                className="flex-1 gold-gradient border-0 text-accent-foreground font-semibold hover:opacity-90">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : selectedPlan ? "Update Plan" : "Create Plan"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
