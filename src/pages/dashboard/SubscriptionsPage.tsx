import { useState, useEffect, useMemo } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Plus, Search, CreditCard, MoreHorizontal, Pencil, Eye,
  CheckCircle, XCircle, Clock, AlertTriangle, Loader2,
  Building2, Filter, Calendar, RefreshCcw, DollarSign,
  ChevronRight, ArrowUpRight
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow, isPast, addDays } from "date-fns";

interface SubscriptionRow {
  id: string;
  company_id: string;
  plan_id: string;
  status: string;
  billing_cycle: string;
  payment_status: string;
  current_period_start: string;
  current_period_end: string;
  trial_starts_at: string | null;
  trial_ends_at: string | null;
  canceled_at: string | null;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  created_at: string;
  company?: { id: string; name: string; slug: string; is_active: boolean } | null;
  plan?: { id: string; name: string; price_monthly: number; price_yearly: number; currency: string } | null;
}

interface PlanOption {
  id: string;
  name: string;
  price_monthly: number;
  price_yearly: number;
}

interface CompanyOption {
  id: string;
  name: string;
  slug: string;
}

const STATUS_OPTIONS = ["active", "trialing", "past_due", "canceled", "expired"];
const PAYMENT_STATUS_OPTIONS = ["pending", "paid", "failed", "refunded"];
const BILLING_CYCLE_OPTIONS = ["monthly", "yearly"];

function StatusBadge({ status }: { status: string }) {
  const config: Record<string, { className: string; icon: React.ElementType }> = {
    active: { className: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20", icon: CheckCircle },
    trialing: { className: "bg-accent/10 text-accent border-accent/20", icon: Clock },
    past_due: { className: "bg-orange-500/10 text-orange-700 border-orange-500/20", icon: AlertTriangle },
    canceled: { className: "bg-muted text-muted-foreground border-border", icon: XCircle },
    expired: { className: "bg-destructive/10 text-destructive border-destructive/20", icon: XCircle },
  };
  const c = config[status] || config.expired;
  const IconComp = c.icon;
  return (
    <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-1 rounded-full border ${c.className}`}>
      <IconComp className="w-3 h-3" />
      {status.charAt(0).toUpperCase() + status.slice(1).replace("_", " ")}
    </span>
  );
}

function PaymentBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    paid: "bg-emerald-500/10 text-emerald-700",
    pending: "bg-accent/10 text-accent",
    failed: "bg-destructive/10 text-destructive",
    refunded: "bg-muted text-muted-foreground",
  };
  return (
    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-full ${colors[status] || colors.pending}`}>
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

const defaultForm = {
  company_id: "", plan_id: "", status: "active",
  billing_cycle: "monthly", payment_status: "pending",
  trial_days: "14",
  use_trial: false,
};

export default function SubscriptionsPage() {
  const { toast } = useToast();
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [companies, setCompanies] = useState<CompanyOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");

  const [editDialog, setEditDialog] = useState(false);
  const [detailDialog, setDetailDialog] = useState(false);
  const [selectedSub, setSelectedSub] = useState<SubscriptionRow | null>(null);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(defaultForm);

  const fetchData = async () => {
    setLoading(true);
    const [subsRes, plansRes, companiesRes] = await Promise.all([
      supabase.from("subscriptions").select("*, companies(id, name, slug, is_active), plans(id, name, price_monthly, price_yearly, currency)")
        .order("created_at", { ascending: false }),
      supabase.from("plans").select("id, name, price_monthly, price_yearly").is("deleted_at", null).eq("is_active", true).order("sort_order"),
      supabase.from("companies").select("id, name, slug").is("deleted_at", null).order("name"),
    ]);
    if (subsRes.data) setSubscriptions(subsRes.data as any[]);
    if (plansRes.data) setPlans(plansRes.data);
    if (companiesRes.data) setCompanies(companiesRes.data);
    setLoading(false);
  };

  useEffect(() => { fetchData(); }, []);

  // Stats
  const stats = useMemo(() => {
    const active = subscriptions.filter((s) => s.status === "active").length;
    const trial = subscriptions.filter((s) => s.status === "trialing").length;
    const pastDue = subscriptions.filter((s) => s.status === "past_due").length;
    const mrr = subscriptions
      .filter((s) => s.status === "active" && s.plan)
      .reduce((sum, s) => sum + (s.billing_cycle === "yearly" ? (s.plan!.price_yearly / 12) : s.plan!.price_monthly), 0);
    return { active, trial, pastDue, total: subscriptions.length, mrr };
  }, [subscriptions]);

  const filtered = useMemo(() => {
    return subscriptions.filter((s) => {
      const matchSearch = !search ||
        s.company?.name?.toLowerCase().includes(search.toLowerCase()) ||
        s.plan?.name?.toLowerCase().includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || s.status === statusFilter;
      const matchPayment = paymentFilter === "all" || s.payment_status === paymentFilter;
      return matchSearch && matchStatus && matchPayment;
    });
  }, [subscriptions, search, statusFilter, paymentFilter]);

  // Companies without a subscription (for new sub creation)
  const unsubscribedCompanies = useMemo(() => {
    const subCompanyIds = new Set(subscriptions.map((s) => s.company_id));
    return companies.filter((c) => !subCompanyIds.has(c.id));
  }, [companies, subscriptions]);

  const openCreate = () => {
    setSelectedSub(null);
    setForm(defaultForm);
    setEditDialog(true);
  };

  const openEdit = (sub: SubscriptionRow) => {
    setSelectedSub(sub);
    setForm({
      company_id: sub.company_id,
      plan_id: sub.plan_id,
      status: sub.status,
      billing_cycle: sub.billing_cycle,
      payment_status: sub.payment_status || "pending",
      trial_days: "14",
      use_trial: !!sub.trial_starts_at,
    });
    setEditDialog(true);
  };

  const openDetail = (sub: SubscriptionRow) => {
    setSelectedSub(sub);
    setDetailDialog(true);
  };

  const handleSave = async () => {
    setSaving(true);
    const now = new Date();

    if (selectedSub) {
      // Update
      const { error } = await supabase.from("subscriptions").update({
        plan_id: form.plan_id,
        status: form.status,
        billing_cycle: form.billing_cycle,
        payment_status: form.payment_status,
      }).eq("id", selectedSub.id);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else toast({ title: "Subscription updated" });
    } else {
      // Create
      const trialDays = form.use_trial ? parseInt(form.trial_days) || 14 : 0;
      const periodEnd = form.billing_cycle === "yearly"
        ? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
        : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

      const payload: any = {
        company_id: form.company_id,
        plan_id: form.plan_id,
        status: form.use_trial ? "trialing" : form.status,
        billing_cycle: form.billing_cycle,
        payment_status: form.payment_status,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
      };

      if (form.use_trial) {
        payload.trial_starts_at = now.toISOString();
        payload.trial_ends_at = addDays(now, trialDays).toISOString();
      }

      const { error } = await supabase.from("subscriptions").insert(payload);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else toast({ title: "Subscription created" });
    }
    setSaving(false);
    setEditDialog(false);
    fetchData();
  };

  const handleCancel = async (sub: SubscriptionRow) => {
    const { error } = await supabase.from("subscriptions").update({
      status: "canceled", canceled_at: new Date().toISOString(),
    }).eq("id", sub.id);
    if (!error) { toast({ title: "Subscription canceled" }); fetchData(); }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Subscriptions</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage company subscriptions and billing</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={fetchData} className="gap-1.5 text-xs">
            <RefreshCcw className="w-3.5 h-3.5" /> Refresh
          </Button>
          <Button onClick={openCreate} className="gold-gradient border-0 text-accent-foreground font-semibold hover:opacity-90 gap-2 text-sm">
            <Plus className="w-4 h-4" /> New Subscription
          </Button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: "Active", value: stats.active, icon: CheckCircle, color: "text-emerald-600" },
          { label: "Trial", value: stats.trial, icon: Clock, color: "text-accent" },
          { label: "Past Due", value: stats.pastDue, icon: AlertTriangle, color: "text-orange-600" },
          { label: "Est. MRR", value: `$${stats.mrr.toLocaleString(undefined, { maximumFractionDigits: 0 })}`, icon: DollarSign, color: "text-accent" },
        ].map((item) => (
          <div key={item.label} className="luxury-card p-4 flex items-center gap-3">
            <item.icon className={`w-5 h-5 ${item.color} shrink-0`} />
            <div>
              <p className="text-lg font-bold font-display text-foreground leading-none">{item.value}</p>
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider mt-0.5">{item.label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" style={{ insetInlineStart: 12 }} />
          <input type="text" placeholder="Search by company or plan…" value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="luxury-input w-full h-9 text-sm" style={{ paddingInlineStart: 36 }} />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[150px] h-9 text-xs">
            <Filter className="w-3.5 h-3.5 me-1.5 text-muted-foreground" /><SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Status</SelectItem>
            {STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1).replace("_", " ")}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={paymentFilter} onValueChange={setPaymentFilter}>
          <SelectTrigger className="w-[150px] h-9 text-xs">
            <DollarSign className="w-3.5 h-3.5 me-1.5 text-muted-foreground" /><SelectValue placeholder="Payment" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Payments</SelectItem>
            {PAYMENT_STATUS_OPTIONS.map((s) => <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-gold" /></div>
      ) : filtered.length === 0 ? (
        <div className="luxury-card p-12 text-center">
          <CreditCard className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No subscriptions match your filters</p>
        </div>
      ) : (
        <div className="luxury-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  {["Company", "Plan", "Billing", "Status", "Payment", "Period End", ""].map((h) => (
                    <th key={h} className="text-start text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((sub) => {
                  const isExpiringSoon = sub.current_period_end && !isPast(new Date(sub.current_period_end)) &&
                    new Date(sub.current_period_end).getTime() - Date.now() < 7 * 24 * 60 * 60 * 1000;
                  return (
                    <tr key={sub.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center shrink-0">
                            <Building2 className="w-4 h-4 text-primary" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-foreground truncate">{sub.company?.name || "Unknown"}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{sub.company?.slug}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <p className="text-sm font-medium text-foreground">{sub.plan?.name || "—"}</p>
                        <p className="text-[10px] text-muted-foreground">
                          ${sub.billing_cycle === "yearly" ? sub.plan?.price_yearly : sub.plan?.price_monthly}/{sub.billing_cycle === "yearly" ? "yr" : "mo"}
                        </p>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="text-xs font-medium text-foreground capitalize flex items-center gap-1">
                          <RefreshCcw className="w-3 h-3 text-muted-foreground" />
                          {sub.billing_cycle}
                        </span>
                      </td>
                      <td className="px-4 py-3.5"><StatusBadge status={sub.status} /></td>
                      <td className="px-4 py-3.5"><PaymentBadge status={sub.payment_status || "pending"} /></td>
                      <td className="px-4 py-3.5">
                        <div>
                          <p className={`text-sm ${isExpiringSoon ? "text-orange-600 font-semibold" : "text-muted-foreground"}`}>
                            {sub.current_period_end ? format(new Date(sub.current_period_end), "MMM d, yyyy") : "—"}
                          </p>
                          {isExpiringSoon && <p className="text-[10px] text-orange-600">Expiring soon</p>}
                        </div>
                      </td>
                      <td className="px-4 py-3.5 text-end">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8"><MoreHorizontal className="w-4 h-4" /></Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => openDetail(sub)}><Eye className="w-4 h-4 me-2" /> View Details</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => openEdit(sub)}><Pencil className="w-4 h-4 me-2" /> Edit</DropdownMenuItem>
                            {sub.status !== "canceled" && (
                              <DropdownMenuItem onClick={() => handleCancel(sub)} className="text-destructive">
                                <XCircle className="w-4 h-4 me-2" /> Cancel
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <div className="px-4 py-3 border-t border-border bg-muted/20">
            <p className="text-xs text-muted-foreground">Showing {filtered.length} of {subscriptions.length} subscriptions</p>
          </div>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">{selectedSub ? "Edit Subscription" : "New Subscription"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Company */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Company *</label>
              {selectedSub ? (
                <div className="luxury-input flex items-center gap-2 bg-muted/30">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{selectedSub.company?.name}</span>
                </div>
              ) : (
                <Select value={form.company_id} onValueChange={(v) => setForm({ ...form, company_id: v })}>
                  <SelectTrigger className="w-full"><SelectValue placeholder="Select company" /></SelectTrigger>
                  <SelectContent>
                    {unsubscribedCompanies.map((c) => (
                      <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                    ))}
                    {unsubscribedCompanies.length === 0 && (
                      <div className="px-3 py-2 text-xs text-muted-foreground">All companies have subscriptions</div>
                    )}
                  </SelectContent>
                </Select>
              )}
            </div>

            {/* Plan */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Plan *</label>
              <Select value={form.plan_id} onValueChange={(v) => setForm({ ...form, plan_id: v })}>
                <SelectTrigger className="w-full"><SelectValue placeholder="Select plan" /></SelectTrigger>
                <SelectContent>
                  {plans.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name} — ${p.price_monthly}/mo
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Billing & Status */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Billing Cycle</label>
                <Select value={form.billing_cycle} onValueChange={(v) => setForm({ ...form, billing_cycle: v })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {BILLING_CYCLE_OPTIONS.map((b) => (
                      <SelectItem key={b} value={b}>{b.charAt(0).toUpperCase() + b.slice(1)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Status</label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((s) => (
                      <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1).replace("_", " ")}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Payment status */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Payment Status</label>
              <Select value={form.payment_status} onValueChange={(v) => setForm({ ...form, payment_status: v })}>
                <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_STATUS_OPTIONS.map((s) => (
                    <SelectItem key={s} value={s}>{s.charAt(0).toUpperCase() + s.slice(1)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Trial toggle (create only) */}
            {!selectedSub && (
              <div className="p-4 rounded-lg bg-muted/30 border border-border space-y-3">
                <label className="flex items-center gap-3 cursor-pointer">
                  <input type="checkbox" checked={form.use_trial}
                    onChange={(e) => setForm({ ...form, use_trial: e.target.checked })}
                    className="accent-[hsl(var(--accent))] w-4 h-4" />
                  <div>
                    <span className="text-sm font-medium text-foreground">Start with trial period</span>
                    <p className="text-[11px] text-muted-foreground">Company will have full access during the trial</p>
                  </div>
                </label>
                {form.use_trial && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] text-muted-foreground">Trial Duration (days)</label>
                    <input type="number" min="1" max="90" value={form.trial_days}
                      onChange={(e) => setForm({ ...form, trial_days: e.target.value })}
                      className="luxury-input w-24" />
                  </div>
                )}
              </div>
            )}

            {/* Stripe placeholder */}
            <div className="p-3 rounded-lg border border-dashed border-border bg-muted/20 flex items-center gap-3">
              <CreditCard className="w-5 h-5 text-muted-foreground shrink-0" />
              <div>
                <p className="text-xs font-medium text-muted-foreground">Stripe Integration</p>
                <p className="text-[10px] text-muted-foreground/70">Payment processing will be connected in a future update</p>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3 pt-2">
              <Button variant="ghost" onClick={() => setEditDialog(false)} className="flex-1">Cancel</Button>
              <Button onClick={handleSave}
                disabled={saving || !form.plan_id || (!selectedSub && !form.company_id)}
                className="flex-1 gold-gradient border-0 text-accent-foreground font-semibold hover:opacity-90">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : selectedSub ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailDialog} onOpenChange={setDetailDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Subscription Details</DialogTitle>
          </DialogHeader>
          {selectedSub && (
            <div className="space-y-5 pt-2">
              {/* Company header */}
              <div className="flex items-center gap-3 p-4 rounded-xl bg-muted/30 border border-border">
                <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-5 h-5 text-primary" />
                </div>
                <div>
                  <p className="font-bold text-foreground">{selectedSub.company?.name}</p>
                  <p className="text-xs text-muted-foreground font-mono">{selectedSub.company?.slug}</p>
                </div>
              </div>

              {/* Plan & Pricing */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Plan</p>
                  <p className="text-sm font-semibold text-foreground">{selectedSub.plan?.name}</p>
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Price</p>
                  <p className="text-sm font-semibold text-foreground">
                    ${selectedSub.billing_cycle === "yearly" ? selectedSub.plan?.price_yearly : selectedSub.plan?.price_monthly}
                    <span className="text-muted-foreground font-normal">/{selectedSub.billing_cycle === "yearly" ? "yr" : "mo"}</span>
                  </p>
                </div>
              </div>

              {/* Status row */}
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Status</p>
                  <StatusBadge status={selectedSub.status} />
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Payment</p>
                  <PaymentBadge status={selectedSub.payment_status || "pending"} />
                </div>
                <div>
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-1.5">Cycle</p>
                  <p className="text-sm font-medium text-foreground capitalize">{selectedSub.billing_cycle}</p>
                </div>
              </div>

              {/* Dates */}
              <div className="space-y-2 p-4 rounded-xl bg-muted/20 border border-border">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Timeline</p>
                {[
                  { label: "Period Start", value: selectedSub.current_period_start },
                  { label: "Period End", value: selectedSub.current_period_end },
                  { label: "Trial Start", value: selectedSub.trial_starts_at },
                  { label: "Trial End", value: selectedSub.trial_ends_at },
                  { label: "Canceled At", value: selectedSub.canceled_at },
                  { label: "Created", value: selectedSub.created_at },
                ].filter((d) => d.value).map((d) => (
                  <div key={d.label} className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">{d.label}</span>
                    <span className="font-medium text-foreground">{format(new Date(d.value!), "MMM d, yyyy")}</span>
                  </div>
                ))}
              </div>

              {/* Stripe placeholder */}
              {(selectedSub.stripe_customer_id || selectedSub.stripe_subscription_id) && (
                <div className="space-y-1.5 p-3 rounded-lg bg-muted/20 border border-border">
                  <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Stripe IDs</p>
                  {selectedSub.stripe_customer_id && (
                    <p className="text-xs text-muted-foreground font-mono">Customer: {selectedSub.stripe_customer_id}</p>
                  )}
                  {selectedSub.stripe_subscription_id && (
                    <p className="text-xs text-muted-foreground font-mono">Subscription: {selectedSub.stripe_subscription_id}</p>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
