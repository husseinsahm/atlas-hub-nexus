import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Search, Map, Calendar, Users, DollarSign,
  MoreHorizontal, Pencil, Trash2, Copy, Share2, ExternalLink,
  Loader2, Plane, ArrowRight, Clock, Filter,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { UpgradeBanner, UsageIndicator } from "@/components/plan/UpgradeBanner";
import { LimitReachedDialog } from "@/components/plan/LimitReachedDialog";

type TripStatus = "draft" | "under_review" | "awaiting_approval" | "approved" | "converted" | "cancelled";

const STATUS_CONFIG: Record<TripStatus, { label: string; color: string; bg: string }> = {
  draft: { label: "Draft", color: "text-slate-700", bg: "bg-slate-100" },
  under_review: { label: "Under Review", color: "text-amber-700", bg: "bg-amber-50" },
  awaiting_approval: { label: "Awaiting Approval", color: "text-orange-700", bg: "bg-orange-50" },
  approved: { label: "Approved", color: "text-emerald-700", bg: "bg-emerald-50" },
  converted: { label: "Converted", color: "text-blue-700", bg: "bg-blue-50" },
  cancelled: { label: "Cancelled", color: "text-red-700", bg: "bg-red-50" },
};

interface Trip {
  id: string;
  trip_number: string;
  title: string;
  description: string | null;
  status: TripStatus;
  start_date: string | null;
  end_date: string | null;
  total_days: number;
  adults: number;
  children: number;
  currency: string;
  total_cost: number;
  selling_price: number;
  customer_id: string | null;
  share_token: string | null;
  created_at: string;
  customers?: { full_name: string } | null;
}

export default function TripsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const companyId = user?.activeMembership?.companyId;

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [createOpen, setCreateOpen] = useState(false);
  const [newTrip, setNewTrip] = useState({ title: "", description: "", total_days: "3", adults: "2", children: "0", currency: "USD" });

  // Plan limits
  const { limits, refetch: refetchLimits } = usePlanLimits();
  const [limitDialogOpen, setLimitDialogOpen] = useState(false);

  const handleCreateClick = () => {
    if (!limits.canCreateTrip) {
      setLimitDialogOpen(true);
      return;
    }
    setCreateOpen(true);
  };

  const { data: trips = [], isLoading } = useQuery({
    queryKey: ["trips", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("trips")
        .select("*, customers(full_name)")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Trip[];
    },
    enabled: !!companyId,
  });

  const filtered = useMemo(() => {
    let list = trips;
    if (statusFilter !== "all") list = list.filter(t => t.status === statusFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(t =>
        t.title.toLowerCase().includes(q) ||
        t.trip_number.toLowerCase().includes(q) ||
        t.customers?.full_name?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [trips, statusFilter, search]);

  const statusCounts = useMemo(() => {
    const c: Record<string, number> = { all: trips.length };
    Object.keys(STATUS_CONFIG).forEach(s => { c[s] = trips.filter(t => t.status === s).length; });
    return c;
  }, [trips]);

  const createMutation = useMutation({
    mutationFn: async () => {
      // Get next trip number
      const { data: settings } = await supabase
        .from("company_settings")
        .select("trip_prefix, trip_next_number")
        .eq("company_id", companyId!)
        .single();

      const prefix = settings?.trip_prefix || "TRP";
      const nextNum = settings?.trip_next_number || 1;
      const tripNumber = `${prefix}-${String(nextNum).padStart(4, "0")}`;

      const totalDays = parseInt(newTrip.total_days) || 3;

      const { data: trip, error } = await supabase
        .from("trips")
        .insert({
          company_id: companyId!,
          trip_number: tripNumber,
          title: newTrip.title || `New Trip ${tripNumber}`,
          description: newTrip.description || null,
          total_days: totalDays,
          adults: parseInt(newTrip.adults) || 2,
          children: parseInt(newTrip.children) || 0,
          currency: newTrip.currency,
          created_by: user?.id,
          assigned_to: user?.id,
        })
        .select()
        .single();
      if (error) throw error;

      // Create day shells
      const days = Array.from({ length: totalDays }, (_, i) => ({
        trip_id: trip.id,
        day_number: i + 1,
        title: `Day ${i + 1}`,
      }));
      const { error: dayError } = await supabase.from("trip_days").insert(days);
      if (dayError) throw dayError;

      // Increment trip_next_number
      await supabase
        .from("company_settings")
        .update({ trip_next_number: nextNum + 1 })
        .eq("company_id", companyId!);

      return trip;
    },
    onSuccess: (trip) => {
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      setCreateOpen(false);
      setNewTrip({ title: "", description: "", total_days: "3", adults: "2", children: "0", currency: "USD" });
      navigate(`/dashboard/trips/${trip.id}`);
    },
    onError: (e: any) => toast({ title: "Error creating trip", description: e.message, variant: "destructive" }),
  });

  const softDelete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("trips").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      toast({ title: "Trip deleted" });
    },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl gold-gradient flex items-center justify-center">
              <Plane className="w-5 h-5 text-accent-foreground" />
            </div>
            Trip Builder
          </h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-sm text-muted-foreground">Create and manage custom travel itineraries</p>
            {limits.maxTripsPerMonth !== null && <UsageIndicator type="trips" />}
          </div>
        </div>
        <Button onClick={handleCreateClick} className="gold-gradient text-accent-foreground shadow-md hover:shadow-lg transition-shadow">
          <Plus className="w-4 h-4 mr-2" /> New Trip
        </Button>
      </div>

      {/* Plan limit warning */}
      <UpgradeBanner type="trips" />

      {/* Status pipeline */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        <button
          onClick={() => setStatusFilter("all")}
          className={cn(
            "px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
            statusFilter === "all"
              ? "bg-primary text-primary-foreground shadow-sm"
              : "bg-card border border-border text-muted-foreground hover:text-foreground hover:border-foreground/20"
          )}
        >
          All Trips <span className="ml-1 opacity-70">{statusCounts.all}</span>
        </button>
        {Object.entries(STATUS_CONFIG).map(([key, cfg]) => (
          <button
            key={key}
            onClick={() => setStatusFilter(key)}
            className={cn(
              "px-4 py-2 rounded-lg text-sm font-medium transition-all whitespace-nowrap",
              statusFilter === key
                ? `${cfg.bg} ${cfg.color} shadow-sm`
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            )}
          >
            {cfg.label} <span className="ml-1 opacity-70">{statusCounts[key] || 0}</span>
          </button>
        ))}
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <Input placeholder="Search trips..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
      </div>

      {/* Grid */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-accent" /></div>
      ) : filtered.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-20">
          <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <Map className="w-10 h-10 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">No trips yet</h3>
          <p className="text-sm text-muted-foreground mb-4">Create your first custom travel itinerary</p>
          <Button onClick={() => setCreateOpen(true)} className="gold-gradient text-accent-foreground">
            <Plus className="w-4 h-4 mr-2" /> Create Trip
          </Button>
        </motion.div>
      ) : (
        <motion.div layout className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          <AnimatePresence mode="popLayout">
            {filtered.map((trip, i) => {
              const sc = STATUS_CONFIG[trip.status];
              return (
                <motion.div
                  key={trip.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Card
                    className="group cursor-pointer hover:shadow-lg transition-all duration-300 border-border overflow-hidden"
                    onClick={() => navigate(`/dashboard/trips/${trip.id}`)}
                  >
                    {/* Top color band */}
                    <div className={cn("h-1.5", sc.bg)} />
                    <CardContent className="p-5 space-y-4">
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-1">
                            <span className="text-xs font-mono text-muted-foreground">{trip.trip_number}</span>
                            <Badge className={cn("border-0 text-[10px]", sc.bg, sc.color)}>{sc.label}</Badge>
                          </div>
                          <h3 className="font-semibold text-foreground truncate">{trip.title}</h3>
                          {trip.customers?.full_name && (
                            <p className="text-xs text-muted-foreground mt-0.5">{trip.customers.full_name}</p>
                          )}
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                            <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1.5 rounded-md hover:bg-muted">
                              <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={e => { e.stopPropagation(); navigate(`/dashboard/trips/${trip.id}`); }}>
                              <Pencil className="w-3.5 h-3.5 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={e => { e.stopPropagation(); navigator.clipboard.writeText(`${window.location.origin}/trip/${trip.share_token}`); toast({ title: "Link copied!" }); }}>
                              <Share2 className="w-3.5 h-3.5 mr-2" /> Copy Share Link
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={e => { e.stopPropagation(); softDelete.mutate(trip.id); }}>
                              <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {/* Meta */}
                      <div className="grid grid-cols-3 gap-3 text-xs">
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Calendar className="w-3.5 h-3.5" />
                          <span>{trip.total_days} days</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-muted-foreground">
                          <Users className="w-3.5 h-3.5" />
                          <span>{trip.adults}A {trip.children > 0 ? `${trip.children}C` : ""}</span>
                        </div>
                        <div className="flex items-center gap-1.5 font-medium text-foreground">
                          <DollarSign className="w-3.5 h-3.5" />
                          <span>{trip.selling_price > 0 ? `${trip.selling_price.toLocaleString()}` : "—"} {trip.currency}</span>
                        </div>
                      </div>

                      {trip.start_date && (
                        <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 border-t border-border">
                          <span>{format(new Date(trip.start_date), "MMM d, yyyy")}</span>
                          {trip.end_date && (
                            <>
                              <ArrowRight className="w-3 h-3" />
                              <span>{format(new Date(trip.end_date), "MMM d, yyyy")}</span>
                            </>
                          )}
                        </div>
                      )}

                      {/* Open arrow */}
                      <div className="flex justify-end pt-1">
                        <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
                          <ArrowRight className="w-4 h-4" />
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Create dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-lg flex items-center gap-2">
              <Plane className="w-5 h-5 text-accent" /> New Trip
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Trip Title</Label>
              <Input value={newTrip.title} onChange={e => setNewTrip(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Dubai Family Adventure" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Description</Label>
              <Textarea value={newTrip.description} onChange={e => setNewTrip(f => ({ ...f, description: e.target.value }))} placeholder="Optional trip description..." rows={2} />
            </div>
            <div className="grid grid-cols-4 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Days</Label>
                <Input type="number" min="1" max="30" value={newTrip.total_days} onChange={e => setNewTrip(f => ({ ...f, total_days: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Adults</Label>
                <Input type="number" min="1" value={newTrip.adults} onChange={e => setNewTrip(f => ({ ...f, adults: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Children</Label>
                <Input type="number" min="0" value={newTrip.children} onChange={e => setNewTrip(f => ({ ...f, children: e.target.value }))} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Currency</Label>
                <Select value={newTrip.currency} onValueChange={v => setNewTrip(f => ({ ...f, currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["USD", "EUR", "GBP", "AED", "SAR", "TRY"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={() => createMutation.mutate()}
              disabled={createMutation.isPending}
              className="gold-gradient text-accent-foreground"
            >
              {createMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              Create & Open Builder
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
