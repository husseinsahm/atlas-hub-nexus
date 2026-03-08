import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import {
  Search, Filter, Plus, Calendar, Users, DollarSign, MapPin,
  Loader2, Briefcase, ChevronRight, Clock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

type BookingStatus = "tentative" | "confirmed" | "in_operation" | "completed" | "cancelled";

const STATUS_CONFIG: Record<BookingStatus, { label: string; color: string; bg: string; dot: string }> = {
  tentative: { label: "Tentative", color: "text-slate-700", bg: "bg-slate-100", dot: "bg-slate-400" },
  confirmed: { label: "Confirmed", color: "text-blue-700", bg: "bg-blue-50", dot: "bg-blue-500" },
  in_operation: { label: "In Operation", color: "text-amber-700", bg: "bg-amber-50", dot: "bg-amber-500" },
  completed: { label: "Completed", color: "text-emerald-700", bg: "bg-emerald-50", dot: "bg-emerald-500" },
  cancelled: { label: "Cancelled", color: "text-red-700", bg: "bg-red-50", dot: "bg-red-500" },
};

export default function BookingsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const companyId = user?.activeMembership?.companyId;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: bookings = [], isLoading } = useQuery({
    queryKey: ["bookings", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, customers(full_name, email)")
        .eq("company_id", companyId!)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const filtered = useMemo(() => {
    let list = bookings;
    if (statusFilter !== "all") list = list.filter((b: any) => b.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((b: any) =>
        b.title?.toLowerCase().includes(q) ||
        b.booking_number?.toLowerCase().includes(q) ||
        (b as any).customers?.full_name?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [bookings, statusFilter, search]);

  const stats = useMemo(() => {
    const s: Record<string, number> = { tentative: 0, confirmed: 0, in_operation: 0, completed: 0, cancelled: 0 };
    bookings.forEach((b: any) => { if (s[b.status] !== undefined) s[b.status]++; });
    return s;
  }, [bookings]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Bookings</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Manage confirmed trips and operational bookings</p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-5 gap-3">
        {(Object.entries(STATUS_CONFIG) as [BookingStatus, typeof STATUS_CONFIG[BookingStatus]][]).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => setStatusFilter(statusFilter === key ? "all" : key)}
            className={cn(
              "rounded-xl border p-3 text-left transition-all",
              statusFilter === key ? "border-accent bg-accent/5 shadow-sm" : "border-border bg-card hover:bg-muted/50"
            )}
          >
            <div className="flex items-center gap-2">
              <div className={cn("w-2 h-2 rounded-full", cfg.dot)} />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{cfg.label}</span>
            </div>
            <div className="text-xl font-bold font-display text-foreground mt-1">{stats[key] || 0}</div>
          </button>
        ))}
      </div>

      {/* Filters */}
      <div className="flex gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input placeholder="Search bookings..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <Filter className="w-3.5 h-3.5 mr-2" />
            <SelectValue placeholder="All statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            {Object.entries(STATUS_CONFIG).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v.label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* List */}
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Briefcase className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
          <h3 className="text-sm font-semibold text-foreground">No bookings yet</h3>
          <p className="text-xs text-muted-foreground mt-1 max-w-xs mx-auto">
            Bookings are created when you convert an approved trip. Go to Trips → approve a trip → Convert to Booking.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((booking: any, idx: number) => {
            const sc = STATUS_CONFIG[booking.status as BookingStatus] || STATUS_CONFIG.tentative;
            return (
              <motion.div
                key={booking.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
              >
                <Card
                  className="border-border hover:shadow-md hover:border-foreground/10 transition-all cursor-pointer group"
                  onClick={() => navigate(`/dashboard/bookings/${booking.id}`)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      {/* Status dot & booking icon */}
                      <div className="relative">
                        <div className="w-11 h-11 rounded-xl bg-accent/10 flex items-center justify-center">
                          <Briefcase className="w-5 h-5 text-accent" />
                        </div>
                        <div className={cn("absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-card", sc.dot)} />
                      </div>

                      {/* Info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-muted-foreground">{booking.booking_number}</span>
                          <Badge className={cn("border-0 text-[10px]", sc.bg, sc.color)}>{sc.label}</Badge>
                          {booking.payment_status !== "unpaid" && (
                            <Badge variant="outline" className="text-[9px]">
                              <DollarSign className="w-2.5 h-2.5 mr-0.5" />
                              {booking.payment_status}
                            </Badge>
                          )}
                        </div>
                        <h3 className="text-sm font-semibold text-foreground truncate mt-0.5">{booking.title}</h3>
                        <div className="flex items-center gap-3 mt-1 text-[10px] text-muted-foreground">
                          {(booking as any).customers?.full_name && (
                            <span className="flex items-center gap-0.5">
                              <Users className="w-2.5 h-2.5" /> {(booking as any).customers.full_name}
                            </span>
                          )}
                          <span className="flex items-center gap-0.5">
                            <Calendar className="w-2.5 h-2.5" /> {booking.total_days} days
                          </span>
                          {booking.start_date && (
                            <span>{format(new Date(booking.start_date), "MMM d")} → {booking.end_date ? format(new Date(booking.end_date), "MMM d") : "..."}</span>
                          )}
                          <span className="flex items-center gap-0.5">
                            <Users className="w-2.5 h-2.5" /> {booking.adults}A{booking.children > 0 ? ` ${booking.children}C` : ""}
                          </span>
                        </div>
                      </div>

                      {/* Price & arrow */}
                      <div className="text-right shrink-0">
                        {booking.selling_price > 0 && (
                          <div className="text-sm font-bold font-mono text-foreground">
                            {Number(booking.selling_price).toLocaleString()} <span className="text-[10px] font-normal text-muted-foreground">{booking.currency}</span>
                          </div>
                        )}
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          {format(new Date(booking.created_at), "MMM d, yyyy")}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
