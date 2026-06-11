import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { CompanyUsageTab } from "@/components/admin/CompanyUsageTab";
import {
  Loader2, Search, CreditCard, Clock, XCircle, AlertTriangle, Eye,
  RefreshCw, Calendar, ArrowUpDown, BarChart3, Mail, CheckCircle2, XOctagon, Inbox,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  active: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300",
  trialing: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300",
  canceled: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300",
  past_due: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
  unpaid: "bg-muted text-muted-foreground",
};

export default function SubscriptionManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [selectedSub, setSelectedSub] = useState<any>(null);
  const [actionDialog, setActionDialog] = useState<string | null>(null);
  const [actionValue, setActionValue] = useState("");
  const [detailSub, setDetailSub] = useState<any>(null);

  const { data: subscriptions = [], isLoading } = useQuery({
    queryKey: ["admin-subscriptions"],
    queryFn: async () => {
      const { data } = await supabase.from("subscriptions").select(`
        *, plans(id, name, slug, price_monthly, price_yearly, max_users, max_branches, max_trips),
        companies(id, name, slug, email)
      `).order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: allPlans = [] } = useQuery({
    queryKey: ["admin-plans-list"],
    queryFn: async () => {
      const { data } = await supabase.from("plans").select("id, name, slug").eq("is_active", true).is("deleted_at", null).order("sort_order");
      return data || [];
    },
  });

  // Fetch upgrade requests
  const { data: upgradeRequests = [] } = useQuery({
    queryKey: ["admin-upgrade-requests"],
    queryFn: async () => {
      const { data } = await supabase
        .from("upgrade_requests")
        .select(`
          *,
          companies(id, name, slug, email),
          requested_plan:plans!upgrade_requests_requested_plan_id_fkey(id, name, slug, price_monthly, price_yearly),
          current_plan:plans!upgrade_requests_current_plan_id_fkey(id, name, slug)
        `)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  const pendingRequests = useMemo(() => upgradeRequests.filter((r: any) => r.status === "pending"), [upgradeRequests]);

  const [reviewDialog, setReviewDialog] = useState<any>(null);
  const [reviewNotes, setReviewNotes] = useState("");

  const approveRequest = useMutation({
    mutationFn: async ({ request, approved }: { request: any; approved: boolean }) => {
      const { data: authData } = await supabase.auth.getUser();
      const reviewerId = authData?.user?.id ?? null;

      // Resolve subscription — fall back to company's active subscription if missing on the request
      let subscriptionId: string | null = request.subscription_id ?? null;
      if (approved && !subscriptionId) {
        const { data: sub } = await supabase
          .from("subscriptions")
          .select("id")
          .eq("company_id", request.company_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();
        subscriptionId = sub?.id ?? null;
      }

      // Update the request status (and backfill subscription_id if we just resolved it)
      const { error: reqError } = await supabase
        .from("upgrade_requests")
        .update({
          status: approved ? "approved" : "rejected",
          admin_notes: reviewNotes || null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: reviewerId,
          subscription_id: subscriptionId,
        })
        .eq("id", request.id);
      if (reqError) throw reqError;

      if (approved) {
        if (!subscriptionId) {
          throw new Error("No subscription found for this company. Cannot apply plan change.");
        }

        const now = new Date();
        const periodEnd = request.requested_billing_cycle === "yearly"
          ? new Date(now.getTime() + 365 * 24 * 60 * 60 * 1000)
          : new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

        const targetPlan = request.requested_plan;
        const price = request.requested_billing_cycle === "yearly"
          ? targetPlan?.price_yearly : targetPlan?.price_monthly;

        const { error: subError } = await supabase
          .from("subscriptions")
          .update({
            plan_id: request.requested_plan_id,
            status: "active",
            billing_cycle: request.requested_billing_cycle,
            current_period_start: now.toISOString(),
            current_period_end: periodEnd.toISOString(),
            trial_starts_at: null,
            trial_ends_at: null,
            canceled_at: null,
            payment_status: "paid",
          })
          .eq("id", subscriptionId);
        if (subError) throw subError;

        // Insert billing history
        await supabase.from("billing_history").insert({
          company_id: request.company_id,
          invoice_date: now.toISOString(),
          amount: price || 0,
          currency: "USD",
          status: "paid",
          description: `Plan changed to ${targetPlan?.name} - ${request.requested_billing_cycle === "yearly" ? "Annual" : "Monthly"} (Admin approved)`,
          subscription_id: subscriptionId,
        });

        // Send notification email (non-blocking)
        supabase.functions.invoke("subscription-emails", {
          body: {
            type: "upgrade",
            companyId: request.company_id,
            metadata: { newPlanName: targetPlan?.name, approved: true },
          },
        }).catch(console.error);
      }
    },
    onSuccess: (_, { approved }) => {
      queryClient.invalidateQueries({ queryKey: ["admin-upgrade-requests"] });
      queryClient.invalidateQueries({ queryKey: ["admin-subscriptions"] });
      setReviewDialog(null);
      setReviewNotes("");
      toast({ title: approved ? "Request approved ✅" : "Request rejected", description: approved ? "The subscription has been updated." : "The company has been notified." });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const filtered = useMemo(() => {
    let list = subscriptions;
    if (statusFilter !== "all") list = list.filter((s: any) => s.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((s: any) => (s.companies as any)?.name?.toLowerCase().includes(q));
    }
    return list;
  }, [subscriptions, statusFilter, search]);

  const stats = useMemo(() => {
    const active = subscriptions.filter((s: any) => s.status === "active").length;
    const trialing = subscriptions.filter((s: any) => s.status === "trialing").length;
    const canceled = subscriptions.filter((s: any) => s.status === "canceled").length;
    const mrr = subscriptions.filter((s: any) => s.status === "active").reduce((sum: number, s: any) => {
      if (!s.plans) return sum;
      return sum + (s.billing_cycle === "yearly" ? (s.plans as any).price_yearly / 12 : (s.plans as any).price_monthly);
    }, 0);
    return { active, trialing, canceled, mrr: Math.round(mrr), arr: Math.round(mrr * 12) };
  }, [subscriptions]);

  const updateSub = useMutation({
    mutationFn: async ({ id, updates }: { id: string; updates: any }) => {
      const { error } = await supabase.from("subscriptions").update(updates).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-subscriptions"] });
      setActionDialog(null);
      setSelectedSub(null);
      toast({ title: "Subscription updated" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const sendEmail = useMutation({
    mutationFn: async ({ type, companyId, metadata }: { type: string; companyId: string; metadata?: any }) => {
      const { error } = await supabase.functions.invoke("subscription-emails", {
        body: { type, companyId, metadata },
      });
      if (error) throw error;
    },
    onSuccess: () => toast({ title: "Notification sent" }),
    onError: (e: any) => toast({ title: "Error sending notification", description: e.message, variant: "destructive" }),
  });

  const handleAction = () => {
    if (!selectedSub) return;
    const id = selectedSub.id;
    const companyId = (selectedSub.companies as any)?.id;
    switch (actionDialog) {
      case "change_plan":
        updateSub.mutate({ id, updates: { plan_id: actionValue } });
        break;
      case "extend_trial":
        updateSub.mutate({ id, updates: { trial_ends_at: new Date(actionValue).toISOString(), status: "trialing" } });
        break;
      case "cancel":
        updateSub.mutate({ id, updates: { status: "canceled", canceled_at: new Date().toISOString() } });
        if (companyId) sendEmail.mutate({ type: "cancellation", companyId });
        break;
      case "reactivate":
        updateSub.mutate({ id, updates: { status: "active", canceled_at: null } });
        break;
    }
  };

  if (isLoading) return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">Subscription Management</h1>
        <p className="text-sm text-muted-foreground">Manage all company subscriptions</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {[
          { label: "Active", value: stats.active, icon: CreditCard, color: "text-emerald-600" },
          { label: "Trialing", value: stats.trialing, icon: Clock, color: "text-amber-600" },
          { label: "Cancelled", value: stats.canceled, icon: XCircle, color: "text-red-600" },
          { label: "MRR", value: `$${stats.mrr}`, icon: CreditCard, color: "text-blue-600" },
          { label: "ARR", value: `$${stats.arr}`, icon: CreditCard, color: "text-purple-600" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-4 flex items-center gap-3">
              <s.icon className={cn("w-5 h-5", s.color)} />
              <div>
                <p className="text-lg font-bold">{s.value}</p>
                <p className="text-[10px] text-muted-foreground uppercase">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      {/* Pending Requests Alert */}
      {pendingRequests.length > 0 && (
        <div className="p-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/20 flex items-center gap-4">
          <div className="w-10 h-10 rounded-full bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0">
            <Inbox className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-foreground">
              {pendingRequests.length} pending upgrade request{pendingRequests.length > 1 ? "s" : ""}
            </p>
            <p className="text-xs text-muted-foreground">Companies are waiting for your approval to change their plans.</p>
          </div>
        </div>
      )}

      <Tabs defaultValue={pendingRequests.length > 0 ? "requests" : "subscriptions"} className="space-y-4">
        <TabsList>
          <TabsTrigger value="subscriptions" className="text-xs gap-1.5">
            <CreditCard className="w-3.5 h-3.5" /> Subscriptions
          </TabsTrigger>
          <TabsTrigger value="requests" className="text-xs gap-1.5 relative">
            <Inbox className="w-3.5 h-3.5" /> Requests
            {pendingRequests.length > 0 && (
              <span className="ms-1 inline-flex items-center justify-center w-5 h-5 text-[10px] font-bold rounded-full bg-amber-500 text-white">
                {pendingRequests.length}
              </span>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="subscriptions" className="space-y-4">

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute inset-inline-start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search company..." value={search} onChange={(e) => setSearch(e.target.value)} className="ps-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="trialing">Trialing</SelectItem>
            <SelectItem value="canceled">Cancelled</SelectItem>
            <SelectItem value="past_due">Past Due</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="text-start">Company</TableHead>
                <TableHead className="text-start">Plan</TableHead>
                <TableHead className="text-start">Status</TableHead>
                <TableHead className="text-start">Billing</TableHead>
                <TableHead className="text-start">Period End</TableHead>
                <TableHead className="text-start">Trial Ends</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((sub: any) => (
                <TableRow key={sub.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setDetailSub(sub)}>
                  <TableCell>
                    <div>
                      <p className="font-medium text-sm">{(sub.companies as any)?.name || "—"}</p>
                      <p className="text-[10px] text-muted-foreground">{(sub.companies as any)?.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="text-xs">{(sub.plans as any)?.name || "—"}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className={cn("text-[10px] border-0", STATUS_COLORS[sub.status] || "bg-muted text-muted-foreground")}>
                      {sub.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm capitalize">{sub.billing_cycle}</TableCell>
                  <TableCell className="text-sm">{sub.current_period_end ? format(new Date(sub.current_period_end), "MMM d, yyyy") : "—"}</TableCell>
                  <TableCell className="text-sm">{sub.trial_ends_at ? format(new Date(sub.trial_ends_at), "MMM d, yyyy") : "—"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="sm" className="text-xs h-7"
                        onClick={() => { setSelectedSub(sub); setActionDialog("change_plan"); setActionValue(""); }}>
                        Change Plan
                      </Button>
                      {sub.status === "trialing" && (
                        <Button variant="ghost" size="sm" className="text-xs h-7"
                          onClick={() => { setSelectedSub(sub); setActionDialog("extend_trial"); setActionValue(""); }}>
                          Extend Trial
                        </Button>
                      )}
                      {sub.status !== "canceled" ? (
                        <Button variant="ghost" size="sm" className="text-xs h-7 text-destructive"
                          onClick={() => { setSelectedSub(sub); setActionDialog("cancel"); }}>
                          Cancel
                        </Button>
                      ) : (
                        <Button variant="ghost" size="sm" className="text-xs h-7 text-emerald-600"
                          onClick={() => { setSelectedSub(sub); setActionDialog("reactivate"); }}>
                          Reactivate
                        </Button>
                      )}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
        </TabsContent>

        {/* Requests Tab */}
        <TabsContent value="requests" className="space-y-4">
          {upgradeRequests.length === 0 ? (
            <Card>
              <CardContent className="p-12 text-center">
                <Inbox className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No upgrade requests yet</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardContent className="p-0">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-start">Company</TableHead>
                      <TableHead className="text-start">Current Plan</TableHead>
                      <TableHead className="text-start">Requested Plan</TableHead>
                      <TableHead className="text-start">Billing</TableHead>
                      <TableHead className="text-start">Status</TableHead>
                      <TableHead className="text-start">Requested</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {upgradeRequests.map((req: any) => (
                      <TableRow key={req.id}>
                        <TableCell>
                          <p className="font-medium text-sm">{req.companies?.name || "—"}</p>
                        </TableCell>
                        <TableCell>
                          <Badge variant="secondary" className="text-xs">{req.current_plan?.name || "—"}</Badge>
                        </TableCell>
                        <TableCell>
                          <Badge className="text-xs bg-accent/10 text-accent border-0">{req.requested_plan?.name || "—"}</Badge>
                        </TableCell>
                        <TableCell className="text-sm capitalize">{req.requested_billing_cycle}</TableCell>
                        <TableCell>
                          <Badge className={cn("text-[10px] border-0",
                            req.status === "pending" ? "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300" :
                            req.status === "approved" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300" :
                            "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300"
                          )}>
                            {req.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{format(new Date(req.created_at), "MMM d, yyyy HH:mm")}</TableCell>
                        <TableCell>
                          {req.status === "pending" && (
                            <div className="flex gap-1">
                              <Button
                                variant="ghost" size="sm"
                                className="text-xs h-7 text-emerald-600"
                                onClick={() => { setReviewDialog(req); setReviewNotes(""); }}
                              >
                                <CheckCircle2 className="w-3.5 h-3.5 me-1" /> Review
                              </Button>
                            </div>
                          )}
                          {req.status !== "pending" && req.admin_notes && (
                            <span className="text-xs text-muted-foreground" title={req.admin_notes}>📝 Has notes</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Review Request Dialog */}
      <Dialog open={!!reviewDialog} onOpenChange={() => { setReviewDialog(null); setReviewNotes(""); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Inbox className="w-5 h-5" /> Review Upgrade Request
            </DialogTitle>
          </DialogHeader>
          {reviewDialog && (
            <div className="space-y-4 py-2">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-[10px] text-muted-foreground uppercase mb-1">Company</p>
                  <p className="font-semibold">{reviewDialog.companies?.name}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-[10px] text-muted-foreground uppercase mb-1">Current Plan</p>
                  <p className="font-semibold">{reviewDialog.current_plan?.name || "—"}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-[10px] text-muted-foreground uppercase mb-1">Requested Plan</p>
                  <p className="font-semibold text-accent">{reviewDialog.requested_plan?.name}</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/30">
                  <p className="text-[10px] text-muted-foreground uppercase mb-1">Billing Cycle</p>
                  <p className="font-semibold capitalize">{reviewDialog.requested_billing_cycle}</p>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-accent/5 border border-accent/20 text-center">
                <p className="text-sm font-semibold">
                  New price: ${reviewDialog.requested_billing_cycle === "yearly"
                    ? reviewDialog.requested_plan?.price_yearly
                    : reviewDialog.requested_plan?.price_monthly
                  }/{reviewDialog.requested_billing_cycle === "yearly" ? "yr" : "mo"}
                </p>
              </div>

              <div>
                <Label className="text-xs">Admin Notes (optional)</Label>
                <Textarea
                  value={reviewNotes}
                  onChange={(e) => setReviewNotes(e.target.value)}
                  placeholder="Add a note about this decision..."
                  className="mt-1 text-sm"
                  rows={2}
                />
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="destructive"
              size="sm"
              disabled={approveRequest.isPending}
              onClick={() => reviewDialog && approveRequest.mutate({ request: reviewDialog, approved: false })}
              className="gap-1.5"
            >
              {approveRequest.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <XOctagon className="w-3.5 h-3.5" />}
              Reject
            </Button>
            <Button
              size="sm"
              disabled={approveRequest.isPending}
              onClick={() => reviewDialog && approveRequest.mutate({ request: reviewDialog, approved: true })}
              className="gap-1.5 bg-gradient-to-r from-accent to-amber-500 text-white border-0"
            >
              {approveRequest.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
              Approve & Apply
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog with Usage Tab */}
      <Dialog open={!!detailSub} onOpenChange={() => setDetailSub(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="w-5 h-5" />
              {(detailSub?.companies as any)?.name || "Company"} — Subscription
            </DialogTitle>
          </DialogHeader>
          {detailSub && (
            <Tabs defaultValue="details" className="mt-2">
              <TabsList>
                <TabsTrigger value="details" className="text-xs gap-1.5">
                  <CreditCard className="w-3.5 h-3.5" /> Details
                </TabsTrigger>
                <TabsTrigger value="usage" className="text-xs gap-1.5">
                  <BarChart3 className="w-3.5 h-3.5" /> Usage
                </TabsTrigger>
              </TabsList>

              <TabsContent value="details" className="space-y-3 mt-3">
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-[10px] text-muted-foreground uppercase mb-1">Plan</p>
                    <p className="font-semibold">{(detailSub.plans as any)?.name}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-[10px] text-muted-foreground uppercase mb-1">Status</p>
                    <Badge className={cn("text-[10px] border-0", STATUS_COLORS[detailSub.status] || "bg-muted")}>{detailSub.status}</Badge>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-[10px] text-muted-foreground uppercase mb-1">Billing</p>
                    <p className="font-semibold capitalize">{detailSub.billing_cycle}</p>
                  </div>
                  <div className="p-3 rounded-lg bg-muted/30">
                    <p className="text-[10px] text-muted-foreground uppercase mb-1">Period End</p>
                    <p className="font-semibold">{detailSub.current_period_end ? format(new Date(detailSub.current_period_end), "MMM d, yyyy") : "—"}</p>
                  </div>
                </div>

                {/* Send notification button */}
                <div className="flex gap-2 pt-2">
                  {detailSub.status === "trialing" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs gap-1.5"
                      disabled={sendEmail.isPending}
                      onClick={() => sendEmail.mutate({
                        type: "trial_expiring",
                        companyId: (detailSub.companies as any)?.id,
                        metadata: { daysLeft: 3 },
                      })}
                    >
                      <Mail className="w-3.5 h-3.5" /> Send Trial Warning
                    </Button>
                  )}
                  {detailSub.status === "active" && detailSub.billing_cycle === "monthly" && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs gap-1.5"
                      disabled={sendEmail.isPending}
                      onClick={() => sendEmail.mutate({
                        type: "upgrade",
                        companyId: (detailSub.companies as any)?.id,
                        metadata: { newPlanName: (detailSub.plans as any)?.name },
                      })}
                    >
                      <Mail className="w-3.5 h-3.5" /> Send Annual Prompt
                    </Button>
                  )}
                </div>
              </TabsContent>

              <TabsContent value="usage" className="mt-3">
                <CompanyUsageTab
                  companyId={(detailSub.companies as any)?.id}
                  companyName={(detailSub.companies as any)?.name}
                  planSlug={(detailSub.plans as any)?.slug}
                  maxUsers={(detailSub.plans as any)?.max_users}
                  maxBranches={(detailSub.plans as any)?.max_branches}
                  maxTrips={(detailSub.plans as any)?.max_trips}
                />
              </TabsContent>
            </Tabs>
          )}
        </DialogContent>
      </Dialog>

      {/* Action Dialog */}
      <Dialog open={!!actionDialog} onOpenChange={() => { setActionDialog(null); setSelectedSub(null); }}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {actionDialog === "change_plan" && "Change Plan"}
              {actionDialog === "extend_trial" && "Extend Trial"}
              {actionDialog === "cancel" && "Cancel Subscription"}
              {actionDialog === "reactivate" && "Reactivate Subscription"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            {selectedSub && (
              <p className="text-sm text-muted-foreground mb-4">Company: <strong>{(selectedSub.companies as any)?.name}</strong></p>
            )}
            {actionDialog === "change_plan" && (
              <div>
                <Label className="text-xs">Select New Plan</Label>
                <Select value={actionValue} onValueChange={setActionValue}>
                  <SelectTrigger className="mt-1"><SelectValue placeholder="Choose plan" /></SelectTrigger>
                  <SelectContent>
                    {allPlans.map((p: any) => (
                      <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {actionDialog === "extend_trial" && (
              <div>
                <Label className="text-xs">New Trial End Date</Label>
                <Input type="date" value={actionValue} onChange={(e) => setActionValue(e.target.value)} className="mt-1" />
              </div>
            )}
            {actionDialog === "cancel" && (
              <p className="text-sm">This will mark the subscription as cancelled and send a notification email to the company admins.</p>
            )}
            {actionDialog === "reactivate" && (
              <p className="text-sm">This will reactivate the subscription and set status to active.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setActionDialog(null); setSelectedSub(null); }}>Cancel</Button>
            <Button onClick={handleAction} disabled={updateSub.isPending || (actionDialog === "change_plan" && !actionValue) || (actionDialog === "extend_trial" && !actionValue)}>
              {updateSub.isPending && <Loader2 className="w-4 h-4 animate-spin me-2" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
