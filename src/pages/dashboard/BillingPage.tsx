import { useState, useMemo, memo, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import { ConfettiEffect } from "@/components/plan/ConfettiEffect";
import { DeactivatedPlanBanner } from "@/components/plan/DeactivatedPlanBanner";
import {
  CreditCard, Crown, Users, Building2, Map, Sparkles, ArrowRight,
  Check, X, Zap, Shield, BarChart3, Globe, Mail, Phone, Star,
  FileText, Download, AlertTriangle, Clock, ChevronDown, Loader2,
  Receipt, HelpCircle, Minus, Lock, Rocket, Building, Headphones,
} from "lucide-react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";

// ─── Plan definitions ───
const PLAN_TIERS = [
  {
    slug: "free",
    name: "Free Trial",
    icon: Clock,
    color: "text-muted-foreground",
    bgColor: "bg-muted/30",
    borderColor: "border-border",
    badgeClass: "bg-muted text-muted-foreground",
    monthly: 0,
    yearly: 0,
    trialDays: 14,
    limits: { users: 1, branches: 0, bookings: 5 },
    features: [
      { name: "Basic Itinerary Builder", included: true },
      { name: "Client Portal", included: false },
      { name: "Invoicing", included: false },
      { name: "Reporting", included: false },
      { name: "Custom Branding", included: false },
      { name: "API Access", included: false },
      { name: "Priority Support", included: false },
    ],
  },
  {
    slug: "starter",
    name: "Starter",
    icon: Rocket,
    color: "text-blue-600",
    bgColor: "bg-blue-50 dark:bg-blue-950/20",
    borderColor: "border-blue-200 dark:border-blue-800",
    badgeClass: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
    monthly: 29,
    yearly: 290,
    limits: { users: 3, branches: 1, bookings: 50 },
    features: [
      { name: "Itinerary Builder", included: true },
      { name: "Client Portal", included: true },
      { name: "Invoicing", included: true },
      { name: "Basic Reporting", included: true },
      { name: "Email Support", included: true },
      { name: "Custom Branding", included: false },
      { name: "API Access", included: false },
      { name: "Advanced Analytics", included: false },
    ],
  },
  {
    slug: "professional",
    name: "Professional",
    icon: Crown,
    color: "text-accent",
    bgColor: "bg-amber-50 dark:bg-amber-950/20",
    borderColor: "border-accent/30",
    badgeClass: "bg-accent/10 text-accent",
    monthly: 79,
    yearly: 790,
    popular: true,
    limits: { users: 10, branches: 3, bookings: 200 },
    features: [
      { name: "Everything in Starter", included: true },
      { name: "Advanced Reporting & Analytics", included: true },
      { name: "Custom Branding", included: true },
      { name: "API Access", included: true },
      { name: "Operations Management", included: true },
      { name: "Custom Document Templates", included: true },
      { name: "Priority Email & Chat Support", included: true },
    ],
  },
  {
    slug: "enterprise",
    name: "Enterprise",
    icon: Building,
    color: "text-purple-600",
    bgColor: "bg-purple-50 dark:bg-purple-950/20",
    borderColor: "border-purple-200 dark:border-purple-800",
    badgeClass: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
    monthly: null,
    yearly: null,
    limits: { users: null, branches: null, bookings: null },
    features: [
      { name: "Everything in Professional", included: true },
      { name: "Unlimited Everything", included: true },
      { name: "Dedicated Account Manager", included: true },
      { name: "Custom Integrations", included: true },
      { name: "SLA Guarantee", included: true },
      { name: "White-label Solution", included: true },
      { name: "Phone Support", included: true },
      { name: "Custom Training & Onboarding", included: true },
    ],
  },
];

const COMPARISON_FEATURES = [
  { category: "Core", items: [
    { name: "Team Members", free: "1", starter: "3", professional: "10", enterprise: "Unlimited" },
    { name: "Branches", free: "0", starter: "1", professional: "3", enterprise: "Unlimited" },
    { name: "Bookings/month", free: "5", starter: "50", professional: "200", enterprise: "Unlimited" },
  ]},
  { category: "Features", items: [
    { name: "Itinerary Builder", free: true, starter: true, professional: true, enterprise: true },
    { name: "Client Portal", free: false, starter: true, professional: true, enterprise: true },
    { name: "Invoicing", free: false, starter: true, professional: true, enterprise: true },
    { name: "Basic Reporting", free: false, starter: true, professional: true, enterprise: true },
    { name: "Advanced Analytics", free: false, starter: false, professional: true, enterprise: true },
    { name: "Custom Branding", free: false, starter: false, professional: true, enterprise: true },
    { name: "API Access", free: false, starter: false, professional: true, enterprise: true },
    { name: "Operations Management", free: false, starter: false, professional: true, enterprise: true },
    { name: "Custom Templates", free: false, starter: false, professional: true, enterprise: true },
    { name: "White-label", free: false, starter: false, professional: false, enterprise: true },
    { name: "Custom Integrations", free: false, starter: false, professional: false, enterprise: true },
  ]},
  { category: "Support", items: [
    { name: "Email Support", free: false, starter: true, professional: true, enterprise: true },
    { name: "Priority Support", free: false, starter: false, professional: true, enterprise: true },
    { name: "Phone Support", free: false, starter: false, professional: false, enterprise: true },
    { name: "Dedicated Account Manager", free: false, starter: false, professional: false, enterprise: true },
  ]},
];

const FAQ_ITEMS = [
  { q: "Can I switch plans anytime?", a: "Yes! You can upgrade or downgrade your plan at any time. Upgrades take effect immediately with prorated billing. Downgrades take effect at the end of your current billing period." },
  { q: "How does billing work?", a: "We bill monthly or yearly depending on your chosen cycle. All payments are processed securely. You'll receive an invoice for each payment." },
  { q: "What happens when I downgrade?", a: "When you downgrade, your current plan stays active until the end of the billing period. You'll need to ensure your usage is within the new plan's limits before the switch happens." },
  { q: "Do you offer refunds?", a: "We offer a 14-day free trial so you can test everything before committing. For paid plans, we handle refund requests on a case-by-case basis. Contact support for assistance." },
];

// ─── Sub-components ───

const UsageBar = memo(({ label, icon: Icon, current, max, className }: {
  label: string; icon: any; current: number; max: number | null; className?: string;
}) => {
  const pct = max === null ? 0 : Math.min(100, (current / max) * 100);
  const colorClass = pct >= 90 ? "bg-destructive" : pct >= 70 ? "bg-amber-500" : "bg-accent";
  const textColor = pct >= 90 ? "text-destructive" : pct >= 70 ? "text-amber-600" : "text-foreground";

  return (
    <div className={cn("space-y-2", className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-muted/50 flex items-center justify-center">
            <Icon className="w-4 h-4 text-muted-foreground" />
          </div>
          <span className="text-sm font-medium text-foreground">{label}</span>
        </div>
        <span className={cn("text-sm font-bold tabular-nums", textColor)}>
          {current} / {max === null ? "∞" : max}
        </span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: max === null ? "10%" : `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
          className={cn("h-full rounded-full", max === null ? "bg-accent/40" : colorClass)}
        />
      </div>
      {pct >= 80 && max !== null && (
        <p className="text-[11px] text-amber-600 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          {pct >= 100 ? "Limit reached — upgrade to continue" : `${Math.round(pct)}% used — consider upgrading`}
        </p>
      )}
    </div>
  );
});
UsageBar.displayName = "UsageBar";

// ─── Main Component ───

export default function BillingPage() {
  const { limits, isLoading, refetch: refetchLimits } = usePlanLimits();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const companyId = user?.activeMembership?.companyId;

  const [billingCycle, setBillingCycle] = useState<"monthly" | "yearly">("monthly");
  const [upgradeDialog, setUpgradeDialog] = useState<string | null>(null);
  const [downgradeDialog, setDowngradeDialog] = useState<string | null>(null);
  const [cancelDialog, setCancelDialog] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [paymentDialog, setPaymentDialog] = useState(false);
  const [cardForm, setCardForm] = useState({ number: "", expiry: "", cvv: "", name: "" });
  const [showConfetti, setShowConfetti] = useState(false);
  const [priceKey, setPriceKey] = useState(0);

  // Fetch billing history
  const { data: billingHistory = [] } = useQuery({
    queryKey: ["billing-history", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data } = await supabase
        .from("billing_history")
        .select("*")
        .eq("company_id", companyId)
        .order("invoice_date", { ascending: false });
      return data || [];
    },
    enabled: !!companyId,
  });

  // Fetch all plans from DB
  const { data: dbPlans = [] } = useQuery({
    queryKey: ["plans-list"],
    queryFn: async () => {
      const { data } = await supabase
        .from("plans")
        .select("*")
        .eq("is_active", true)
        .is("deleted_at", null)
        .order("sort_order");
      return data || [];
    },
  });

  const currentPlanSlug = limits.planSlug;
  const planOrder = ["free", "starter", "professional", "enterprise"];
  const currentIdx = planOrder.indexOf(currentPlanSlug);

  const getPlanAction = (slug: string) => {
    const idx = planOrder.indexOf(slug);
    if (slug === currentPlanSlug) return "current";
    if (idx > currentIdx) return "upgrade";
    return "downgrade";
  };

  const handleUpgrade = async (targetSlug: string) => {
    setProcessing(true);
    const targetPlan = dbPlans.find((p: any) => p.slug === targetSlug);
    if (!targetPlan || !companyId) {
      toast({ title: "Error", description: "Plan not found", variant: "destructive" });
      setProcessing(false);
      return;
    }

    const now = new Date();
    const periodEnd = billingCycle === "yearly"
      ? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
      : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

    const price = billingCycle === "yearly" ? targetPlan.price_yearly : targetPlan.price_monthly;
    const isUpgrade = planOrder.indexOf(targetSlug) > currentIdx;

    if (limits.subscriptionId) {
      const { error } = await supabase.from("subscriptions").update({
        plan_id: targetPlan.id,
        status: "active",
        billing_cycle: billingCycle,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        trial_ends_at: null,
        canceled_at: null,
      }).eq("id", limits.subscriptionId);

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        // Insert billing history record
        await supabase.from("billing_history").insert({
          company_id: companyId,
          invoice_date: now.toISOString(),
          amount: price,
          currency: targetPlan.currency || "USD",
          status: "paid",
          description: `${isUpgrade ? "Upgraded" : "Downgraded"} to ${targetPlan.name} - ${billingCycle === "yearly" ? "Annual" : "Monthly"}`,
          subscription_id: limits.subscriptionId,
        });

        toast({ title: isUpgrade ? "Plan upgraded! 🎉" : "Plan changed", description: `Welcome to ${targetPlan.name}` });
        if (isUpgrade) setShowConfetti(true);
      }
    } else {
      const { data: newSub, error } = await supabase.from("subscriptions").insert({
        company_id: companyId,
        plan_id: targetPlan.id,
        status: "active",
        billing_cycle: billingCycle,
        current_period_start: now.toISOString(),
        current_period_end: periodEnd.toISOString(),
        payment_status: "paid",
      }).select("id").single();

      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } else {
        await supabase.from("billing_history").insert({
          company_id: companyId,
          invoice_date: now.toISOString(),
          amount: price,
          currency: targetPlan.currency || "USD",
          status: "paid",
          description: `Subscribed to ${targetPlan.name} - ${billingCycle === "yearly" ? "Annual" : "Monthly"}`,
          subscription_id: newSub?.id || null,
        });

        toast({ title: "Subscribed! 🎉", description: `Welcome to ${targetPlan.name}` });
        setShowConfetti(true);
      }
    }

    setProcessing(false);
    setUpgradeDialog(null);
    setDowngradeDialog(null);
    // Refresh plan limits without full page reload
    await refetchLimits();
  };

  const handleCancel = async () => {
    if (!limits.subscriptionId) return;
    setProcessing(true);
    const { error } = await supabase.from("subscriptions").update({
      status: "canceled",
      canceled_at: new Date().toISOString(),
    }).eq("id", limits.subscriptionId);

    if (!error) {
      toast({ title: "Subscription cancelled", description: "Your plan will remain active until the end of the current period." });
      await refetchLimits();
    }
    setProcessing(false);
    setCancelDialog(false);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-6xl">
      {showConfetti && <ConfettiEffect onComplete={() => setShowConfetti(false)} />}
      {limits.planDeactivated && <DeactivatedPlanBanner />}
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">Billing & Subscription</h1>
        <p className="text-sm text-muted-foreground mt-1">Manage your plan, usage, and billing</p>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList className="bg-muted/50 border border-border p-1 h-auto flex-wrap">
          <TabsTrigger value="overview" className="text-xs font-semibold data-[state=active]:bg-card data-[state=active]:shadow-sm gap-1.5">
            <CreditCard className="w-3.5 h-3.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="plans" className="text-xs font-semibold data-[state=active]:bg-card data-[state=active]:shadow-sm gap-1.5">
            <Crown className="w-3.5 h-3.5" /> Plans
          </TabsTrigger>
          <TabsTrigger value="history" className="text-xs font-semibold data-[state=active]:bg-card data-[state=active]:shadow-sm gap-1.5">
            <Receipt className="w-3.5 h-3.5" /> Billing History
          </TabsTrigger>
        </TabsList>

        {/* ─── Overview Tab ─── */}
        <TabsContent value="overview" className="space-y-6">
          {/* Trial Banner */}
          {limits.isTrialing && limits.trialDaysRemaining !== null && (
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className={cn(
                "p-4 rounded-xl border flex items-center gap-4",
                limits.trialDaysRemaining <= 3
                  ? "bg-destructive/5 border-destructive/20"
                  : "bg-amber-50 dark:bg-amber-950/20 border-amber-200 dark:border-amber-800"
              )}
            >
              <div className={cn(
                "w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                limits.trialDaysRemaining <= 3 ? "bg-destructive/10" : "bg-amber-100 dark:bg-amber-900/50"
              )}>
                <Clock className={cn("w-5 h-5", limits.trialDaysRemaining <= 3 ? "text-destructive" : "text-amber-600")} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-foreground">
                  Your free trial ends in {limits.trialDaysRemaining} day{limits.trialDaysRemaining !== 1 ? "s" : ""}
                </p>
                <p className="text-xs text-muted-foreground">
                  Upgrade now to keep your data and unlock all features.
                </p>
              </div>
              <Button
                size="sm"
                className="bg-gradient-to-r from-accent to-amber-500 text-white border-0 gap-1.5 shrink-0"
                onClick={() => {
                  const tabsList = document.querySelector('[value="plans"]') as HTMLElement;
                  tabsList?.click();
                }}
              >
                <Sparkles className="w-3.5 h-3.5" /> Upgrade Now
              </Button>
            </motion.div>
          )}

          {/* Cancellation Banner */}
          {limits.canceledAt && (
            <div className="p-4 rounded-xl border border-destructive/20 bg-destructive/5 flex items-center gap-4">
              <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">Subscription cancelled</p>
                <p className="text-xs text-muted-foreground">
                  Your plan will remain active until {limits.currentPeriodEnd ? new Date(limits.currentPeriodEnd).toLocaleDateString() : "end of period"}.
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={async () => {
                  if (!limits.subscriptionId) return;
                  await supabase.from("subscriptions").update({
                    status: "active", canceled_at: null,
                  }).eq("id", limits.subscriptionId);
                  toast({ title: "Subscription reactivated!" });
                  await refetchLimits();
                }}
              >
                Reactivate
              </Button>
            </div>
          )}

          {/* Current Plan Card */}
          <div className="luxury-card overflow-hidden">
            <div className="h-1.5 bg-gradient-to-r from-accent via-amber-500 to-orange-500" />
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-accent to-amber-500 flex items-center justify-center">
                    <Crown className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-lg font-bold font-display text-foreground">{limits.planName}</h3>
                      <Badge className={cn("text-[10px]",
                        limits.subscriptionStatus === "active" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" :
                        limits.subscriptionStatus === "trialing" ? "bg-accent/10 text-accent" :
                        "bg-muted text-muted-foreground"
                      )}>
                        {limits.subscriptionStatus === "trialing" ? "Trial" :
                         limits.subscriptionStatus === "active" ? "Active" :
                         limits.isOnFreeTier ? "Free" : limits.subscriptionStatus}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {limits.hasSubscription
                        ? `${limits.billingCycle === "yearly" ? "Annual" : "Monthly"} billing${limits.currentPeriodEnd ? ` · Renews ${new Date(limits.currentPeriodEnd).toLocaleDateString()}` : ""}`
                        : "No active subscription"}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {limits.planSlug !== "enterprise" && (
                    <Button
                      className="bg-gradient-to-r from-accent to-amber-500 text-white border-0 gap-1.5"
                      onClick={() => {
                        const tabsList = document.querySelector('[value="plans"]') as HTMLElement;
                        tabsList?.click();
                      }}
                    >
                      <Sparkles className="w-4 h-4" /> Change Plan
                    </Button>
                  )}
                  {limits.hasSubscription && !limits.canceledAt && (
                    <Button variant="ghost" size="sm" className="text-muted-foreground text-xs"
                      onClick={() => setCancelDialog(true)}>
                      Cancel
                    </Button>
                  )}
                </div>
              </div>

              {/* Usage Summary */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <UsageBar label="Team Members" icon={Users} current={limits.currentUsers} max={limits.maxUsers} />
                <UsageBar label="Branches" icon={Building2} current={limits.currentBranches} max={limits.maxBranches} />
                <UsageBar label="Bookings this month" icon={Map} current={limits.tripsThisMonth} max={limits.maxTripsPerMonth} />
              </div>
            </div>
          </div>

          {/* Payment Method */}
          <div className="luxury-card p-6">
            <h3 className="text-sm font-semibold text-foreground mb-4 flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-muted-foreground" />
              Payment Method
            </h3>
            <div className="flex items-center gap-4 p-4 rounded-lg border border-border bg-muted/20">
              <div className="w-12 h-8 rounded bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center">
                <span className="text-white text-[10px] font-bold">VISA</span>
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">•••• •••• •••• 4242</p>
                <p className="text-xs text-muted-foreground">Expires 12/2027</p>
              </div>
              <Button variant="outline" size="sm" className="text-xs" onClick={() => setPaymentDialog(true)}>Update</Button>
            </div>
          </div>
        </TabsContent>

        {/* ─── Plans Tab ─── */}
        <TabsContent value="plans" className="space-y-8">
          {/* Billing Toggle */}
          <div className="flex items-center justify-center gap-3">
            <span className={cn("text-sm font-medium", billingCycle === "monthly" ? "text-foreground" : "text-muted-foreground")}>Monthly</span>
            <Switch
              checked={billingCycle === "yearly"}
              onCheckedChange={(v) => {
                setBillingCycle(v ? "yearly" : "monthly");
                setPriceKey(prev => prev + 1);
              }}
            />
            <span className={cn("text-sm font-medium", billingCycle === "yearly" ? "text-foreground" : "text-muted-foreground")}>
              Yearly
            </span>
            {billingCycle === "yearly" && (
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 text-[10px]">
                Save ~17%
              </Badge>
            )}
          </div>

          {/* Plan Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
            {PLAN_TIERS.map((tier, i) => {
              const action = getPlanAction(tier.slug);
              const price = billingCycle === "yearly" ? tier.yearly : tier.monthly;
              const Icon = tier.icon;
              const isPopular = tier.popular;

              return (
                <motion.div
                  key={tier.slug}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className={cn(
                    "luxury-card relative flex flex-col overflow-hidden",
                    isPopular && "ring-2 ring-accent shadow-lg shadow-accent/10",
                    action === "current" && "ring-2 ring-emerald-500/50"
                  )}
                >
                  {isPopular && (
                    <div className="absolute top-0 inset-x-0 bg-gradient-to-r from-accent to-amber-500 text-center py-1">
                      <span className="text-[10px] font-bold text-white uppercase tracking-wider">Most Popular</span>
                    </div>
                  )}
                  {action === "current" && (
                    <div className="absolute top-0 inset-x-0 bg-emerald-500 text-center py-1">
                      <span className="text-[10px] font-bold text-white uppercase tracking-wider">Current Plan</span>
                    </div>
                  )}

                  <div className={cn("p-6 flex flex-col flex-1", (isPopular || action === "current") && "pt-10")}>
                    <div className="flex items-center gap-2 mb-4">
                      <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", tier.bgColor)}>
                        <Icon className={cn("w-5 h-5", tier.color)} />
                      </div>
                      <h3 className="text-lg font-bold font-display text-foreground">{tier.name}</h3>
                    </div>

                    {/* Price */}
                    <div className="mb-5 min-h-[60px]">
                      {price !== null ? (
                        <motion.div
                          key={`${tier.slug}-${priceKey}`}
                          initial={{ opacity: 0, y: -8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.3 }}
                        >
                          <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-extrabold font-display text-foreground tabular-nums">${price}</span>
                            <span className="text-sm text-muted-foreground">/{billingCycle === "yearly" ? "yr" : "mo"}</span>
                          </div>
                          {billingCycle === "yearly" && tier.monthly && (
                            <p className="text-xs text-muted-foreground mt-1">
                              ${Math.round(tier.yearly! / 12)}/mo billed annually
                            </p>
                          )}
                        </motion.div>
                      ) : (
                        <span className="text-2xl font-extrabold font-display text-foreground">Custom</span>
                      )}
                    </div>

                    {/* Limits */}
                    <div className="space-y-2 mb-5 pb-5 border-b border-border">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-1.5"><Users className="w-3.5 h-3.5" /> Team Members</span>
                        <span className="font-semibold text-foreground">{tier.limits.users === null ? "Unlimited" : tier.limits.users}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> Branches</span>
                        <span className="font-semibold text-foreground">{tier.limits.branches === null ? "Unlimited" : tier.limits.branches}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground flex items-center gap-1.5"><Map className="w-3.5 h-3.5" /> Bookings/mo</span>
                        <span className="font-semibold text-foreground">{tier.limits.bookings === null ? "Unlimited" : tier.limits.bookings}</span>
                      </div>
                    </div>

                    {/* Features */}
                    <div className="space-y-2 flex-1 mb-6">
                      {tier.features.map((f) => (
                        <div key={f.name} className="flex items-center gap-2 text-sm">
                          {f.included ? (
                            <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                          ) : (
                            <X className="w-4 h-4 text-muted-foreground/40 shrink-0" />
                          )}
                          <span className={cn(f.included ? "text-foreground" : "text-muted-foreground/60")}>{f.name}</span>
                        </div>
                      ))}
                    </div>

                    {/* CTA */}
                    {tier.slug === "enterprise" ? (
                      <Button variant="outline" className="w-full gap-2">
                        <Phone className="w-4 h-4" /> Contact Sales
                      </Button>
                    ) : action === "current" ? (
                      <Button disabled className="w-full">Current Plan</Button>
                    ) : action === "upgrade" ? (
                      <Button
                        className="w-full bg-gradient-to-r from-accent to-amber-500 text-white border-0 gap-2"
                        onClick={() => setUpgradeDialog(tier.slug)}
                      >
                        <Sparkles className="w-4 h-4" /> Upgrade
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full"
                        onClick={() => setDowngradeDialog(tier.slug)}
                      >
                        Downgrade
                      </Button>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>

          {/* Feature Comparison Table */}
          <div className="luxury-card overflow-hidden relative">
            <div className="p-6 border-b border-border">
              <h3 className="text-base font-bold font-display text-foreground">Feature Comparison</h3>
            </div>
            <div className="overflow-x-auto [-webkit-overflow-scrolling:touch]">
              <table className="w-full min-w-[600px]">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-start text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3 sticky inset-inline-start-0 bg-muted/30 z-10 min-w-[140px]">Feature</th>
                    {PLAN_TIERS.map((t) => (
                      <th key={t.slug} className="text-center text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">
                        {t.name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {COMPARISON_FEATURES.map((cat) => (
                    <>
                      <tr key={cat.category} className="bg-muted/20">
                        <td colSpan={5} className="px-6 py-2 text-[11px] font-bold text-muted-foreground uppercase tracking-wider sticky inset-inline-start-0 bg-muted/20 z-10">{cat.category}</td>
                      </tr>
                      {cat.items.map((item, idx) => {
                        const rowBg = idx % 2 === 0 ? "bg-background" : "bg-muted/10";
                        return (
                          <tr key={item.name} className={cn("border-b border-border last:border-0", rowBg)}>
                            <td className={cn("px-6 py-3 text-sm text-foreground sticky inset-inline-start-0 z-10 min-w-[140px]", rowBg)}>{item.name}</td>
                            {(["free", "starter", "professional", "enterprise"] as const).map((plan) => {
                              const val = item[plan];
                              return (
                                <td key={plan} className="px-4 py-3 text-center">
                                  {typeof val === "boolean" ? (
                                    val ? <Check className="w-4 h-4 text-emerald-500 mx-auto" /> : <Minus className="w-4 h-4 text-muted-foreground/30 mx-auto" />
                                  ) : (
                                    <span className="text-sm font-semibold text-foreground">{val}</span>
                                  )}
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* FAQ */}
          <div className="luxury-card p-6">
            <h3 className="text-base font-bold font-display text-foreground mb-4 flex items-center gap-2">
              <HelpCircle className="w-5 h-5 text-muted-foreground" />
              Frequently Asked Questions
            </h3>
            <Accordion type="single" collapsible className="w-full">
              {FAQ_ITEMS.map((faq, i) => (
                <AccordionItem key={i} value={`faq-${i}`}>
                  <AccordionTrigger className="text-sm font-medium text-foreground hover:no-underline">{faq.q}</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">{faq.a}</AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </div>
        </TabsContent>

        {/* ─── Billing History Tab ─── */}
        <TabsContent value="history" className="space-y-6">
          <div className="luxury-card overflow-hidden">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <h3 className="text-base font-bold font-display text-foreground">Invoices</h3>
              <Button variant="outline" size="sm" className="gap-1.5 text-xs">
                <Download className="w-3.5 h-3.5" /> Download All
              </Button>
            </div>
            {billingHistory.length === 0 ? (
              <div className="p-12 text-center">
                <Receipt className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No billing history yet</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      {["Date", "Description", "Amount", "Status", ""].map((h) => (
                        <th key={h} className="text-start text-[11px] font-semibold text-muted-foreground uppercase tracking-wider px-6 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {billingHistory.map((inv: any) => (
                      <tr key={inv.id} className="border-b border-border last:border-0 hover:bg-muted/20">
                        <td className="px-6 py-3 text-sm text-foreground">
                          {new Date(inv.invoice_date).toLocaleDateString()}
                        </td>
                        <td className="px-6 py-3 text-sm text-foreground">{inv.description || "Subscription payment"}</td>
                        <td className="px-6 py-3 text-sm font-semibold text-foreground tabular-nums">
                          {inv.currency} {inv.amount}
                        </td>
                        <td className="px-6 py-3">
                          <Badge className={cn("text-[10px]",
                            inv.status === "paid" ? "bg-emerald-100 text-emerald-700" :
                            inv.status === "failed" ? "bg-destructive/10 text-destructive" :
                            "bg-amber-100 text-amber-700"
                          )}>
                            {inv.status}
                          </Badge>
                        </td>
                        <td className="px-6 py-3 text-end">
                          {inv.pdf_url && (
                            <Button variant="ghost" size="sm" className="text-xs gap-1">
                              <Download className="w-3.5 h-3.5" /> PDF
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ─── Upgrade Dialog ─── */}
      <Dialog open={!!upgradeDialog} onOpenChange={() => setUpgradeDialog(null)}>
        <DialogContent className="sm:max-w-md max-sm:fixed max-sm:bottom-0 max-sm:top-auto max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-2xl max-sm:w-full max-sm:max-w-full">
          <div className="sm:hidden w-10 h-1 rounded-full bg-muted mx-auto mb-2" />
          <DialogHeader className="text-center sm:text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-gradient-to-br from-accent to-amber-500 flex items-center justify-center mb-4">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <DialogTitle className="text-xl">Upgrade to {PLAN_TIERS.find(t => t.slug === upgradeDialog)?.name}</DialogTitle>
            <DialogDescription className="text-center mt-2">
              Unlock more features and higher limits for your team.
            </DialogDescription>
          </DialogHeader>

          {upgradeDialog && (() => {
            const target = PLAN_TIERS.find(t => t.slug === upgradeDialog)!;
            const price = billingCycle === "yearly" ? target.yearly : target.monthly;
            return (
              <div className="space-y-4 my-4">
                <div className="p-4 rounded-lg bg-muted/30 border border-border space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Current plan</span>
                    <span className="font-semibold">{limits.planName}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">New plan</span>
                    <span className="font-semibold text-accent">{target.name}</span>
                  </div>
                  <div className="border-t border-border pt-2 flex justify-between text-sm">
                    <span className="text-muted-foreground">New billing amount</span>
                    <span className="font-bold text-foreground">${price}/{billingCycle === "yearly" ? "yr" : "mo"}</span>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">Features you'll gain</p>
                  {target.features.filter(f => f.included).slice(0, 5).map(f => (
                    <div key={f.name} className="flex items-center gap-2 text-sm">
                      <Check className="w-4 h-4 text-emerald-500" />
                      <span>{f.name}</span>
                    </div>
                  ))}
                </div>
              </div>
            );
          })()}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setUpgradeDialog(null)} className="flex-1">Maybe Later</Button>
            <Button
              onClick={() => upgradeDialog && handleUpgrade(upgradeDialog)}
              disabled={processing}
              className="flex-1 bg-gradient-to-r from-accent to-amber-500 text-white border-0 gap-2"
            >
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
              Confirm Upgrade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Downgrade Dialog ─── */}
      <Dialog open={!!downgradeDialog} onOpenChange={() => setDowngradeDialog(null)}>
        <DialogContent className="sm:max-w-md max-sm:fixed max-sm:bottom-0 max-sm:top-auto max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-2xl max-sm:w-full max-sm:max-w-full">
          <div className="sm:hidden w-10 h-1 rounded-full bg-muted mx-auto mb-2" />
          <DialogHeader className="text-center sm:text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
              <AlertTriangle className="w-7 h-7 text-amber-600" />
            </div>
            <DialogTitle className="text-xl">Downgrade Plan</DialogTitle>
            <DialogDescription className="text-center mt-2">
              You'll lose access to some features at the end of your current billing period.
            </DialogDescription>
          </DialogHeader>

          {downgradeDialog && (() => {
            const target = PLAN_TIERS.find(t => t.slug === downgradeDialog)!;
            // Check usage exceeds
            const exceedUsers = target.limits.users !== null && limits.currentUsers > target.limits.users;
            const exceedBranches = target.limits.branches !== null && limits.currentBranches > target.limits.branches;
            const exceedBookings = target.limits.bookings !== null && limits.tripsThisMonth > target.limits.bookings;
            const hasExceeds = exceedUsers || exceedBranches || exceedBookings;

            return (
              <div className="space-y-4 my-4">
                {hasExceeds && (
                  <div className="p-4 rounded-lg bg-destructive/5 border border-destructive/20">
                    <p className="text-sm font-semibold text-destructive mb-2">Usage exceeds new plan limits:</p>
                    {exceedUsers && (
                      <p className="text-xs text-destructive">• You have {limits.currentUsers} team members (limit: {target.limits.users}). Please remove {limits.currentUsers - target.limits.users!} before downgrading.</p>
                    )}
                    {exceedBranches && (
                      <p className="text-xs text-destructive">• You have {limits.currentBranches} branches (limit: {target.limits.branches}). Please remove {limits.currentBranches - target.limits.branches!} before downgrading.</p>
                    )}
                  </div>
                )}

                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">You'll lose access to</p>
                  {(() => {
                    const current = PLAN_TIERS.find(t => t.slug === currentPlanSlug);
                    const currentFeatures = current?.features.filter(f => f.included).map(f => f.name) || [];
                    const targetFeatures = target.features.filter(f => f.included).map(f => f.name);
                    const losing = currentFeatures.filter(f => !targetFeatures.includes(f));
                    return losing.map(f => (
                      <div key={f} className="flex items-center gap-2 text-sm text-destructive">
                        <X className="w-4 h-4" />
                        <span>{f}</span>
                      </div>
                    ));
                  })()}
                </div>
              </div>
            );
          })()}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setDowngradeDialog(null)} className="flex-1">Keep Current Plan</Button>
            <Button
              variant="destructive"
              onClick={() => downgradeDialog && handleUpgrade(downgradeDialog)}
              disabled={processing}
              className="flex-1 gap-2"
            >
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Confirm Downgrade
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Cancel Dialog ─── */}
      <Dialog open={cancelDialog} onOpenChange={setCancelDialog}>
        <DialogContent className="sm:max-w-md max-sm:fixed max-sm:bottom-0 max-sm:top-auto max-sm:translate-y-0 max-sm:rounded-b-none max-sm:rounded-t-2xl max-sm:w-full max-sm:max-w-full">
          <div className="sm:hidden w-10 h-1 rounded-full bg-muted mx-auto mb-2" />
          <DialogHeader className="text-center sm:text-center">
            <div className="mx-auto w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
              <AlertTriangle className="w-7 h-7 text-destructive" />
            </div>
            <DialogTitle className="text-xl">Cancel Subscription</DialogTitle>
            <DialogDescription className="text-center mt-2">
              We're sorry to see you go. Your plan will remain active until the end of the current billing period.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-4">
            <div className="p-4 rounded-lg bg-accent/5 border border-accent/20 text-center">
              <p className="text-sm font-semibold text-foreground mb-1">Before you cancel…</p>
              <p className="text-xs text-muted-foreground mb-3">Would you like to pause your subscription for 1 month instead?</p>
              <Button variant="outline" size="sm" className="gap-1.5">
                <Clock className="w-3.5 h-3.5" /> Pause for 1 Month
              </Button>
            </div>

            <div className="space-y-1.5">
              <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">You'll lose access to</p>
              <div className="text-sm text-muted-foreground space-y-1">
                <p>• All premium features</p>
                <p>• Your data will be kept but read-only</p>
                <p>• Team member access will be limited</p>
              </div>
            </div>
          </div>

          <DialogFooter className="flex-col sm:flex-row gap-2">
            <Button variant="outline" onClick={() => setCancelDialog(false)} className="flex-1">Keep Subscription</Button>
            <Button
              variant="destructive"
              onClick={handleCancel}
              disabled={processing}
              className="flex-1 gap-2"
            >
              {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
              Cancel Subscription
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Payment Method Modal */}
      <Dialog open={paymentDialog} onOpenChange={setPaymentDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Update Payment Method</DialogTitle>
            <DialogDescription>Enter your new card details below.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <label className="text-xs font-medium text-foreground">Card Number</label>
              <input className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1" placeholder="4242 4242 4242 4242" value={cardForm.number} onChange={(e) => setCardForm({ ...cardForm, number: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs font-medium text-foreground">Expiry</label>
                <input className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1" placeholder="MM/YY" value={cardForm.expiry} onChange={(e) => setCardForm({ ...cardForm, expiry: e.target.value })} />
              </div>
              <div>
                <label className="text-xs font-medium text-foreground">CVV</label>
                <input className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1" placeholder="123" value={cardForm.cvv} onChange={(e) => setCardForm({ ...cardForm, cvv: e.target.value })} />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-foreground">Name on Card</label>
              <input className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm mt-1" placeholder="John Doe" value={cardForm.name} onChange={(e) => setCardForm({ ...cardForm, name: e.target.value })} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPaymentDialog(false)}>Cancel</Button>
            <Button onClick={() => { setPaymentDialog(false); setCardForm({ number: "", expiry: "", cvv: "", name: "" }); toast({ title: "Payment method updated", description: "Your card details have been saved successfully." }); }}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
