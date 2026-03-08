import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import {
  Plus, Search, DollarSign, MoreHorizontal, Pencil, Trash2,
  CheckCircle, XCircle, Loader2, Star
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
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

const defaultForm = {
  name: "",
  slug: "",
  description: "",
  price_monthly: "0",
  price_yearly: "0",
  currency: "USD",
  max_users: "5",
  max_branches: "1",
  max_trips: "",
  features: "",
  sort_order: "0",
};

export default function PlansPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [plans, setPlans] = useState<Plan[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editDialog, setEditDialog] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<Plan | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(defaultForm);

  const fetchPlans = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("plans")
      .select("*")
      .is("deleted_at", null)
      .order("sort_order", { ascending: true });
    if (!error && data) setPlans(data as Plan[]);
    setLoading(false);
  };

  useEffect(() => { fetchPlans(); }, []);

  const generateSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const openEdit = (plan?: Plan) => {
    if (plan) {
      setSelectedPlan(plan);
      setForm({
        name: plan.name,
        slug: plan.slug,
        description: plan.description || "",
        price_monthly: String(plan.price_monthly),
        price_yearly: String(plan.price_yearly),
        currency: plan.currency,
        max_users: plan.max_users !== null ? String(plan.max_users) : "",
        max_branches: plan.max_branches !== null ? String(plan.max_branches) : "",
        max_trips: plan.max_trips !== null ? String(plan.max_trips) : "",
        features: Array.isArray(plan.features) ? plan.features.join(", ") : "",
        sort_order: String(plan.sort_order),
      });
    } else {
      setSelectedPlan(null);
      setForm(defaultForm);
    }
    setEditDialog(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const slug = form.slug || generateSlug(form.name);
    const features = form.features ? form.features.split(",").map((f) => f.trim()).filter(Boolean) : [];
    const payload = {
      name: form.name,
      slug,
      description: form.description || null,
      price_monthly: parseFloat(form.price_monthly) || 0,
      price_yearly: parseFloat(form.price_yearly) || 0,
      currency: form.currency,
      max_users: form.max_users ? parseInt(form.max_users) : null,
      max_branches: form.max_branches ? parseInt(form.max_branches) : null,
      max_trips: form.max_trips ? parseInt(form.max_trips) : null,
      features,
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

  const filtered = plans.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Subscription Plans</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage pricing plans and feature tiers</p>
        </div>
        <Button onClick={() => openEdit()} className="gold-gradient border-0 text-accent-foreground font-semibold hover:opacity-90 gap-2">
          <Plus className="w-4 h-4" />
          Add Plan
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" style={{ insetInlineStart: 12 }} />
        <input
          type="text"
          placeholder="Search plans..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="luxury-input w-full h-10"
          style={{ paddingInlineStart: 36 }}
        />
      </div>

      {/* Plans cards */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gold" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="luxury-card p-12 text-center">
          <DollarSign className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No plans found. Create your first subscription plan.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((plan) => (
            <div key={plan.id} className="luxury-card p-6 flex flex-col">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-gold/10 flex items-center justify-center">
                    <Star className="w-5 h-5 text-gold" />
                  </div>
                  <div>
                    <h3 className="font-semibold font-display text-foreground">{plan.name}</h3>
                    <p className="text-xs text-muted-foreground font-mono">{plan.slug}</p>
                  </div>
                </div>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreHorizontal className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEdit(plan)}>
                      <Pencil className="w-4 h-4 me-2" /> Edit
                    </DropdownMenuItem>
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

              {plan.description && (
                <p className="text-sm text-muted-foreground mb-4">{plan.description}</p>
              )}

              {/* Pricing */}
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-3xl font-bold font-display text-foreground">
                  ${plan.price_monthly}
                </span>
                <span className="text-sm text-muted-foreground">/mo</span>
                {plan.price_yearly > 0 && (
                  <span className="text-xs text-muted-foreground ms-2">
                    (${plan.price_yearly}/yr)
                  </span>
                )}
              </div>

              {/* Limits */}
              <div className="space-y-2 flex-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Users</span>
                  <span className="font-medium text-foreground">{plan.max_users ?? "Unlimited"}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Branches</span>
                  <span className="font-medium text-foreground">{plan.max_branches ?? "Unlimited"}</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Trips</span>
                  <span className="font-medium text-foreground">{plan.max_trips ?? "Unlimited"}</span>
                </div>
              </div>

              {/* Features */}
              {Array.isArray(plan.features) && plan.features.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <div className="flex flex-wrap gap-1.5">
                    {(plan.features as string[]).map((f, i) => (
                      <span key={i} className="text-[10px] bg-muted text-muted-foreground px-2 py-0.5 rounded-full">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Status */}
              <div className="mt-4 pt-3 border-t border-border flex items-center justify-between">
                {plan.is_active ? (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-gold-dark bg-gold/10 px-2.5 py-1 rounded-full">
                    <CheckCircle className="w-3 h-3" /> Active
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive bg-destructive/10 px-2.5 py-1 rounded-full">
                    <XCircle className="w-3 h-3" /> Inactive
                  </span>
                )}
                <span className="text-xs text-muted-foreground">Order: {plan.sort_order}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit/Create Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              {selectedPlan ? "Edit Plan" : "Create Plan"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground/80 uppercase tracking-wider">Plan Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: generateSlug(e.target.value) })} className="luxury-input w-full" required maxLength={100} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground/80 uppercase tracking-wider">Slug</label>
              <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="luxury-input w-full font-mono text-sm" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground/80 uppercase tracking-wider">Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="luxury-input w-full min-h-[60px] resize-none" maxLength={500} />
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground/80 uppercase tracking-wider">Monthly $</label>
                <input type="number" step="0.01" value={form.price_monthly} onChange={(e) => setForm({ ...form, price_monthly: e.target.value })} className="luxury-input w-full" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground/80 uppercase tracking-wider">Yearly $</label>
                <input type="number" step="0.01" value={form.price_yearly} onChange={(e) => setForm({ ...form, price_yearly: e.target.value })} className="luxury-input w-full" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground/80 uppercase tracking-wider">Currency</label>
                <input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="luxury-input w-full" maxLength={3} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground/80 uppercase tracking-wider">Max Users</label>
                <input type="number" value={form.max_users} onChange={(e) => setForm({ ...form, max_users: e.target.value })} className="luxury-input w-full" placeholder="∞" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground/80 uppercase tracking-wider">Max Branches</label>
                <input type="number" value={form.max_branches} onChange={(e) => setForm({ ...form, max_branches: e.target.value })} className="luxury-input w-full" placeholder="∞" />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground/80 uppercase tracking-wider">Max Trips</label>
                <input type="number" value={form.max_trips} onChange={(e) => setForm({ ...form, max_trips: e.target.value })} className="luxury-input w-full" placeholder="∞" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground/80 uppercase tracking-wider">Features (comma-separated)</label>
              <input value={form.features} onChange={(e) => setForm({ ...form, features: e.target.value })} className="luxury-input w-full" placeholder="Analytics, API Access, Priority Support" />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground/80 uppercase tracking-wider">Sort Order</label>
              <input type="number" value={form.sort_order} onChange={(e) => setForm({ ...form, sort_order: e.target.value })} className="luxury-input w-full" />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="ghost" onClick={() => setEditDialog(false)} className="flex-1">Cancel</Button>
              <Button onClick={handleSave} disabled={saving || !form.name.trim()} className="flex-1 gold-gradient border-0 text-accent-foreground font-semibold hover:opacity-90">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : selectedPlan ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
