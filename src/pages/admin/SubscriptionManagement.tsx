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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Loader2, Search, CreditCard, Clock, XCircle, AlertTriangle, Eye,
  RefreshCw, Calendar, ArrowUpDown,
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

  const { data: subscriptions = [], isLoading } = useQuery({
    queryKey: ["admin-subscriptions"],
    queryFn: async () => {
      const { data } = await supabase.from("subscriptions").select(`
        *, plans(id, name, slug, price_monthly, price_yearly),
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

  const handleAction = () => {
    if (!selectedSub) return;
    const id = selectedSub.id;
    switch (actionDialog) {
      case "change_plan":
        updateSub.mutate({ id, updates: { plan_id: actionValue } });
        break;
      case "extend_trial":
        updateSub.mutate({ id, updates: { trial_ends_at: new Date(actionValue).toISOString(), status: "trialing" } });
        break;
      case "cancel":
        updateSub.mutate({ id, updates: { status: "canceled", canceled_at: new Date().toISOString() } });
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

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search company..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-10" />
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
                <TableHead>Company</TableHead>
                <TableHead>Plan</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Billing</TableHead>
                <TableHead>Period End</TableHead>
                <TableHead>Trial Ends</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((sub: any) => (
                <TableRow key={sub.id}>
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
                    <div className="flex gap-1">
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
              <p className="text-sm">This will mark the subscription as cancelled. The company will retain access until the end of the current period.</p>
            )}
            {actionDialog === "reactivate" && (
              <p className="text-sm">This will reactivate the subscription and set status to active.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setActionDialog(null); setSelectedSub(null); }}>Cancel</Button>
            <Button onClick={handleAction} disabled={updateSub.isPending || (actionDialog === "change_plan" && !actionValue) || (actionDialog === "extend_trial" && !actionValue)}>
              {updateSub.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
