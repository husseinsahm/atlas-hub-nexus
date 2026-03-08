import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Search, FileText, Loader2, Calendar, DollarSign, Eye,
} from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

type QuotationStatus = "draft" | "sent" | "accepted" | "rejected" | "expired" | "cancelled";

const STATUS_CONFIG: Record<QuotationStatus, { label: string; className: string }> = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground" },
  sent: { label: "Sent", className: "bg-blue-100 text-blue-700" },
  accepted: { label: "Accepted", className: "bg-emerald-100 text-emerald-700" },
  rejected: { label: "Rejected", className: "bg-red-100 text-red-700" },
  expired: { label: "Expired", className: "bg-orange-100 text-orange-700" },
  cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground" },
};

export default function QuotationsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const companyId = user?.activeMembership?.companyId;

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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Quotations</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage price quotations generated from trips</p>
        </div>
      </div>

      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search quotations..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="ps-9 h-9"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-36 h-9">
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
          {filtered.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-12 h-12 text-muted-foreground/20 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No quotations yet</p>
              <p className="text-xs text-muted-foreground mt-1">Create quotations from the Trip Builder</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Quotation #</TableHead>
                  <TableHead>Customer</TableHead>
                  <TableHead>Trip</TableHead>
                  <TableHead className="text-end">Total</TableHead>
                  <TableHead>Valid Until</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((q: any) => {
                  const sc = STATUS_CONFIG[q.status as QuotationStatus] || STATUS_CONFIG.draft;
                  return (
                    <TableRow
                      key={q.id}
                      className="cursor-pointer hover:bg-muted/30"
                      onClick={() => navigate(`/dashboard/quotations/${q.id}`)}
                    >
                      <TableCell className="font-mono text-sm font-medium">{q.quotation_number}</TableCell>
                      <TableCell className="text-sm">{q.customers?.full_name || "—"}</TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {q.trips ? `${q.trips.trip_number} · ${q.trips.title}` : "—"}
                      </TableCell>
                      <TableCell className="text-end font-mono text-sm">
                        {q.currency} {Number(q.total_amount || 0).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {q.valid_until ? format(new Date(q.valid_until), "MMM d, yyyy") : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge className={cn("text-[10px]", sc.className)}>{sc.label}</Badge>
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
