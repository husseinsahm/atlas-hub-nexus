import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { LockOverlay } from "@/components/plan/LockOverlay";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search, FileText, Loader2, Calendar, DollarSign, Eye, Plus, TrendingUp,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

type QuotationStatus = "draft" | "sent" | "viewed" | "negotiating" | "accepted" | "rejected" | "expired" | "cancelled";

const STATUS_CONFIG: Record<QuotationStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
  sent: { label: "Sent", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  viewed: { label: "Viewed", className: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400" },
  negotiating: { label: "Negotiating", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" },
  accepted: { label: "Accepted", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" },
  expired: { label: "Expired", className: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
};

export default function QuotationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { direction } = useLanguage();
  const { limits, hasFeature } = usePlanLimits();
  const companyId = user?.activeMembership?.companyId;
  const isInvoicingLocked = !hasFeature("invoicing") && limits.planSlug === "free";

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");

  const { data: quotations = [], isLoading } = useQuery({
    queryKey: ["quotations", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("quotations")
        .select("*, customers(full_name), trips(trip_number, title)")
        .eq("company_id", companyId!)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  const filtered = useMemo(() => {
    return quotations.filter((q: any) => {
      if (filterStatus !== "all" && q.status !== filterStatus) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          q.quotation_number.toLowerCase().includes(s) ||
          (q.customers?.full_name || "").toLowerCase().includes(s) ||
          (q.trips?.title || "").toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [quotations, search, filterStatus]);

  // Summary stats
  const stats = useMemo(() => {
    const total = quotations.length;
    const accepted = quotations.filter((q: any) => q.status === "accepted").length;
    const pending = quotations.filter((q: any) => q.status === "sent").length;
    const totalValue = quotations.reduce((s: number, q: any) => s + Number(q.total_amount || 0), 0);
    return { total, accepted, pending, totalValue };
  }, [quotations]);

  return (
    <div className="space-y-6 relative">
      {isInvoicingLocked && (
        <LockOverlay planRequired="Starter" featureName="Quotations & Invoicing" />
      )}
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-[22px] font-bold font-display text-foreground leading-tight">Quotations</h1>
          <p className="text-[13px] text-muted-foreground mt-1">Manage price quotations generated from trips</p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <Card className="border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                <FileText className="w-4 h-4 text-accent" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total</p>
                <p className="text-lg font-bold font-display text-foreground leading-none">{stats.total}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <Card className="border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                <Calendar className="w-4 h-4 text-blue-500" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Pending</p>
                <p className="text-lg font-bold font-display text-foreground leading-none">{stats.pending}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <Card className="border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Accepted</p>
                <p className="text-lg font-bold font-display text-foreground leading-none">{stats.accepted}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}>
          <Card className="border-border">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                <DollarSign className="w-4 h-4 text-accent" />
              </div>
              <div>
                <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Total Value</p>
                <p className="text-lg font-bold font-display text-foreground leading-none">{stats.totalValue.toLocaleString()}</p>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Filters + Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by number, customer, or trip..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="ps-9 h-9"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-36 h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full rounded-lg" />
              ))}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <FileText className="w-7 h-7 text-muted-foreground/30" />
              </div>
              {quotations.length === 0 ? (
                <>
                  <p className="text-sm font-medium text-foreground">No quotations yet</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-[280px] mx-auto">
                    Quotations are generated from trips in the Trip Builder. Open a trip and click "Create Quotation" to get started.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-foreground">No matching quotations</p>
                  <p className="text-xs text-muted-foreground mt-1">Try adjusting your search or filter criteria</p>
                  <Button variant="outline" size="sm" className="mt-3 text-xs" onClick={() => { setSearch(""); setFilterStatus("all"); }}>
                    Clear Filters
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Quotation #</TableHead>
                    <TableHead className="text-xs">Customer</TableHead>
                    <TableHead className="text-xs hidden md:table-cell">Trip</TableHead>
                    <TableHead className="text-xs text-end">Total</TableHead>
                    <TableHead className="text-xs hidden sm:table-cell">Valid Until</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((q: any, i: number) => {
                    const sc = STATUS_CONFIG[q.status as QuotationStatus] || STATUS_CONFIG.draft;
                    const isExpired = q.valid_until && new Date(q.valid_until) < new Date() && q.status === "sent";
                    return (
                      <TableRow
                        key={q.id}
                        className="cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => navigate(`/dashboard/quotations/${q.id}`)}
                      >
                        <TableCell className="font-mono text-xs font-medium">{q.quotation_number}</TableCell>
                        <TableCell className="text-xs">{q.customers?.full_name || <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell className="text-xs text-muted-foreground hidden md:table-cell">
                          {q.trips ? (
                            <span className="truncate max-w-[200px] block">{q.trips.trip_number} · {q.trips.title}</span>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-end font-mono text-xs font-semibold">
                          {q.currency} {Number(q.total_amount || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground hidden sm:table-cell">
                          {q.valid_until ? (
                            <span className={cn(isExpired && "text-destructive")}>
                              {format(new Date(q.valid_until), "MMM d, yyyy")}
                              {isExpired && " (expired)"}
                            </span>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("text-[10px] border-0", sc.className)}>{sc.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <Button size="icon" variant="ghost" className="h-7 w-7">
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
