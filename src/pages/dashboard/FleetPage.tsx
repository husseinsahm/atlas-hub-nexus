import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Search, Bus, Car, Ship, Truck, Loader2, Pencil, Trash2,
  MoreHorizontal, Users, Gauge, AlertTriangle, Wrench, Fuel,
  Calendar, Phone, Star, BadgeCheck, ChevronRight, Anchor, Link2, Copy,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { format, differenceInDays, parseISO } from "date-fns";

type VehicleType = "bus" | "minibus" | "car" | "suv" | "van" | "boat" | "yacht" | "other";
type VehicleStatus = "available" | "assigned" | "maintenance" | "out_of_service";
type DriverStatus = "available" | "on_trip" | "off_duty" | "on_leave";

const VEHICLE_ICONS: Record<VehicleType, any> = {
  bus: Bus, minibus: Bus, car: Car, suv: Car, van: Truck,
  boat: Ship, yacht: Anchor, other: Car,
};

const VEHICLE_STATUS_CFG: Record<VehicleStatus, { label: string; color: string; bg: string }> = {
  available:      { label: "Available", color: "text-emerald-700", bg: "bg-emerald-50" },
  assigned:       { label: "Assigned",  color: "text-blue-700",    bg: "bg-blue-50" },
  maintenance:    { label: "Maintenance", color: "text-amber-700", bg: "bg-amber-50" },
  out_of_service: { label: "Out of Service", color: "text-red-700", bg: "bg-red-50" },
};

const DRIVER_STATUS_CFG: Record<DriverStatus, { label: string; color: string; bg: string }> = {
  available: { label: "Available", color: "text-emerald-700", bg: "bg-emerald-50" },
  on_trip:   { label: "On Trip",   color: "text-blue-700",    bg: "bg-blue-50" },
  off_duty:  { label: "Off Duty",  color: "text-slate-700",   bg: "bg-slate-100" },
  on_leave:  { label: "On Leave",  color: "text-amber-700",   bg: "bg-amber-50" },
};

interface Vehicle {
  id: string; name: string; vehicle_type: VehicleType; plate_number: string | null;
  make: string | null; model: string | null; year: number | null;
  capacity_passengers: number; status: VehicleStatus; current_mileage_km: number;
  daily_rate: number; currency: string; notes: string | null; images: any;
}

interface Driver {
  id: string; full_name: string; phone: string | null; email: string | null;
  license_number: string | null; license_expiry: string | null;
  status: DriverStatus; rating: number; total_trips: number; avatar_url: string | null;
  daily_rate: number; currency: string; share_token: string | null;
}

export default function FleetPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const qc = useQueryClient();
  const companyId = user?.activeMembership?.companyId;

  const [tab, setTab] = useState("vehicles");
  const [search, setSearch] = useState("");
  const [vehicleDialog, setVehicleDialog] = useState<{ open: boolean; data?: Partial<Vehicle> }>({ open: false });
  const [driverDialog, setDriverDialog] = useState<{ open: boolean; data?: Partial<Driver> }>({ open: false });
  const [maintDialog, setMaintDialog] = useState<{ open: boolean; data?: any }>({ open: false });
  const [docDialog, setDocDialog] = useState<{ open: boolean; data?: any }>({ open: false });
  const [expDialog, setExpDialog] = useState<{ open: boolean; data?: any }>({ open: false });

  const { data: vehicles = [], isLoading: loadV } = useQuery({
    queryKey: ["fleet-vehicles", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicles").select("*")
        .eq("company_id", companyId!).is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Vehicle[];
    },
    enabled: !!companyId,
  });

  const { data: drivers = [], isLoading: loadD } = useQuery({
    queryKey: ["fleet-drivers", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("drivers").select("*")
        .eq("company_id", companyId!).is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Driver[];
    },
    enabled: !!companyId,
  });

  // Maintenance alerts: vehicles with documents expiring < 30 days, license expiry
  const { data: alerts = [] } = useQuery({
    queryKey: ["fleet-alerts", companyId],
    queryFn: async () => {
      const out: { type: string; label: string; daysLeft: number; entityId: string }[] = [];
      drivers.forEach(d => {
        if (d.license_expiry) {
          const days = differenceInDays(parseISO(d.license_expiry), new Date());
          if (days <= 30) out.push({ type: "driver_license", label: `${d.full_name} license`, daysLeft: days, entityId: d.id });
        }
      });
      const { data: docs } = await supabase.from("vehicle_documents")
        .select("vehicle_id, doc_type, expiry_date, vehicles(name)")
        .eq("company_id", companyId!).not("expiry_date", "is", null);
      (docs || []).forEach((d: any) => {
        const days = differenceInDays(parseISO(d.expiry_date), new Date());
        if (days <= 30) out.push({ type: "doc", label: `${d.vehicles?.name} - ${d.doc_type}`, daysLeft: days, entityId: d.vehicle_id });
      });
      return out.sort((a, b) => a.daysLeft - b.daysLeft);
    },
    enabled: !!companyId && drivers.length >= 0,
  });

  const stats = useMemo(() => ({
    total: vehicles.length,
    available: vehicles.filter(v => v.status === "available").length,
    inUse: vehicles.filter(v => v.status === "assigned").length,
    maintenance: vehicles.filter(v => v.status === "maintenance").length,
    drivers: drivers.length,
    driversAvail: drivers.filter(d => d.status === "available").length,
  }), [vehicles, drivers]);

  const filteredVehicles = useMemo(() => {
    if (!search.trim()) return vehicles;
    const q = search.toLowerCase();
    return vehicles.filter(v =>
      v.name.toLowerCase().includes(q) ||
      v.plate_number?.toLowerCase().includes(q) ||
      v.model?.toLowerCase().includes(q)
    );
  }, [vehicles, search]);

  const filteredDrivers = useMemo(() => {
    if (!search.trim()) return drivers;
    const q = search.toLowerCase();
    return drivers.filter(d =>
      d.full_name.toLowerCase().includes(q) ||
      d.phone?.toLowerCase().includes(q)
    );
  }, [drivers, search]);

  const saveVehicle = useMutation({
    mutationFn: async (v: Partial<Vehicle>) => {
      const payload: any = {
        company_id: companyId,
        name: v.name,
        vehicle_type: v.vehicle_type || "car",
        plate_number: v.plate_number || null,
        make: v.make || null,
        model: v.model || null,
        year: v.year || null,
        capacity_passengers: v.capacity_passengers || 4,
        status: v.status || "available",
        daily_rate: v.daily_rate || 0,
        currency: v.currency || "USD",
        current_mileage_km: v.current_mileage_km || 0,
        notes: v.notes || null,
      };
      if (v.id) {
        const { error } = await supabase.from("vehicles").update(payload).eq("id", v.id);
        if (error) throw error;
      } else {
        payload.created_by = user?.id;
        const { error } = await supabase.from("vehicles").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fleet-vehicles"] });
      setVehicleDialog({ open: false });
      toast({ title: "Vehicle saved" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const saveDriver = useMutation({
    mutationFn: async (d: Partial<Driver>) => {
      const payload: any = {
        company_id: companyId,
        full_name: d.full_name,
        phone: d.phone || null,
        email: d.email || null,
        license_number: d.license_number || null,
        license_expiry: d.license_expiry || null,
        status: d.status || "available",
        daily_rate: d.daily_rate || 0,
        currency: d.currency || "USD",
      };
      if (d.id) {
        const { error } = await supabase.from("drivers").update(payload).eq("id", d.id);
        if (error) throw error;
      } else {
        payload.created_by = user?.id;
        const { error } = await supabase.from("drivers").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["fleet-drivers"] });
      setDriverDialog({ open: false });
      toast({ title: "Driver saved" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const softDeleteVehicle = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vehicles").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fleet-vehicles"] }); toast({ title: "Vehicle removed" }); },
  });

  const softDeleteDriver = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("drivers").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fleet-drivers"] }); toast({ title: "Driver removed" }); },
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl gold-gradient flex items-center justify-center">
              <Bus className="w-5 h-5 text-accent-foreground" />
            </div>
            {t("fleet.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("fleet.subtitle")}
          </p>
        </div>
        <div className="flex gap-2">
          {tab === "vehicles" && (
            <Button onClick={() => setVehicleDialog({ open: true, data: {} })} className="gold-gradient text-accent-foreground">
              <Plus className="w-4 h-4 mr-2" /> {t("fleet.newVehicle")}
            </Button>
          )}
          {tab === "drivers" && (
            <Button onClick={() => setDriverDialog({ open: true, data: {} })} className="gold-gradient text-accent-foreground">
              <Plus className="w-4 h-4 mr-2" /> {t("fleet.newDriver")}
            </Button>
          )}
          {tab === "maintenance" && (
            <Button onClick={() => setMaintDialog({ open: true, data: {} })} className="gold-gradient text-accent-foreground">
              <Plus className="w-4 h-4 mr-2" /> {t("fleet.logMaintenance")}
            </Button>
          )}
          {tab === "documents" && (
            <Button onClick={() => setDocDialog({ open: true, data: {} })} className="gold-gradient text-accent-foreground">
              <Plus className="w-4 h-4 mr-2" /> {t("fleet.addDocument")}
            </Button>
          )}
          {tab === "expenses" && (
            <Button onClick={() => setExpDialog({ open: true, data: {} })} className="gold-gradient text-accent-foreground">
              <Plus className="w-4 h-4 mr-2" /> {t("fleet.logExpense")}
            </Button>
          )}
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard icon={Bus} label="Total Vehicles" value={stats.total} tone="primary" />
        <StatCard icon={BadgeCheck} label="Available" value={stats.available} tone="emerald" />
        <StatCard icon={Gauge} label="In Use" value={stats.inUse} tone="blue" />
        <StatCard icon={Wrench} label="Maintenance" value={stats.maintenance} tone="amber" />
        <StatCard icon={Users} label="Drivers" value={stats.drivers} tone="primary" />
        <StatCard icon={BadgeCheck} label="Drivers Free" value={stats.driversAvail} tone="emerald" />
      </div>

      {/* Alerts */}
      {alerts.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/40">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-amber-900 text-sm mb-2">
                  {alerts.length} expiring document{alerts.length !== 1 ? "s" : ""}
                </h3>
                <div className="flex flex-wrap gap-2">
                  {alerts.slice(0, 6).map((a, i) => (
                    <Badge key={i} className={cn(
                      "border-0",
                      a.daysLeft < 0 ? "bg-red-100 text-red-700" :
                      a.daysLeft <= 7 ? "bg-orange-100 text-orange-700" :
                      "bg-amber-100 text-amber-700"
                    )}>
                      {a.label} – {a.daysLeft < 0 ? `${Math.abs(a.daysLeft)}d overdue` : `${a.daysLeft}d`}
                    </Badge>
                  ))}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="vehicles"><Bus className="w-4 h-4 mr-2" />Vehicles</TabsTrigger>
            <TabsTrigger value="drivers"><Users className="w-4 h-4 mr-2" />Drivers</TabsTrigger>
            <TabsTrigger value="maintenance"><Wrench className="w-4 h-4 mr-2" />Maintenance</TabsTrigger>
            <TabsTrigger value="documents"><BadgeCheck className="w-4 h-4 mr-2" />Documents</TabsTrigger>
            <TabsTrigger value="expenses"><Fuel className="w-4 h-4 mr-2" />Expenses</TabsTrigger>
          </TabsList>
          <div className="relative max-w-xs w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input placeholder="Search..." value={search} onChange={e => setSearch(e.target.value)} className="pl-10" />
          </div>
        </div>

        {/* VEHICLES TAB */}
        <TabsContent value="vehicles" className="mt-5">
          {loadV ? (
            <Loader2 className="w-8 h-8 animate-spin text-accent mx-auto my-20" />
          ) : filteredVehicles.length === 0 ? (
            <EmptyState icon={Bus} title="No vehicles yet" desc="Add buses, cars, or boats to your fleet"
              cta="Add Vehicle" onClick={() => setVehicleDialog({ open: true, data: {} })} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              <AnimatePresence mode="popLayout">
                {filteredVehicles.map((v, i) => {
                  const Icon = VEHICLE_ICONS[v.vehicle_type];
                  const sc = VEHICLE_STATUS_CFG[v.status];
                  return (
                    <motion.div key={v.id} layout initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }} transition={{ delay: i * 0.03 }}>
                      <Card className="group hover:shadow-lg transition-all overflow-hidden">
                        <div className={cn("h-1.5", sc.bg)} />
                        <CardContent className="p-5 space-y-4">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-12 h-12 rounded-xl bg-muted flex items-center justify-center shrink-0">
                                <Icon className="w-6 h-6 text-foreground" />
                              </div>
                              <div className="min-w-0">
                                <h3 className="font-semibold truncate">{v.name}</h3>
                                <div className="flex items-center gap-2 mt-0.5">
                                  <Badge className={cn("border-0 text-[10px]", sc.bg, sc.color)}>{sc.label}</Badge>
                                  {v.plate_number && (
                                    <span className="text-[11px] font-mono text-muted-foreground">{v.plate_number}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <button className="opacity-0 group-hover:opacity-100 transition p-1.5 rounded-md hover:bg-muted">
                                  <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                                </button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuItem onClick={() => setVehicleDialog({ open: true, data: v })}>
                                  <Pencil className="w-3.5 h-3.5 mr-2" /> Edit
                                </DropdownMenuItem>
                                <DropdownMenuSeparator />
                                <DropdownMenuItem className="text-destructive" onClick={() => softDeleteVehicle.mutate(v.id)}>
                                  <Trash2 className="w-3.5 h-3.5 mr-2" /> Remove
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </div>

                          <div className="grid grid-cols-3 gap-3 text-xs">
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Users className="w-3.5 h-3.5" />
                              <span>{v.capacity_passengers} pax</span>
                            </div>
                            <div className="flex items-center gap-1.5 text-muted-foreground">
                              <Gauge className="w-3.5 h-3.5" />
                              <span>{Math.round(v.current_mileage_km || 0).toLocaleString()} km</span>
                            </div>
                            <div className="flex items-center gap-1.5 font-medium text-foreground">
                              <span>{v.daily_rate > 0 ? `${v.daily_rate}/day` : "—"}</span>
                            </div>
                          </div>

                          {(v.make || v.model || v.year) && (
                            <div className="text-xs text-muted-foreground pt-2 border-t border-border">
                              {[v.make, v.model, v.year].filter(Boolean).join(" • ")}
                            </div>
                          )}
                        </CardContent>
                      </Card>
                    </motion.div>
                  );
                })}
              </AnimatePresence>
            </div>
          )}
        </TabsContent>

        {/* DRIVERS TAB */}
        <TabsContent value="drivers" className="mt-5">
          {loadD ? (
            <Loader2 className="w-8 h-8 animate-spin text-accent mx-auto my-20" />
          ) : filteredDrivers.length === 0 ? (
            <EmptyState icon={Users} title="No drivers yet" desc="Add drivers to assign trips"
              cta="Add Driver" onClick={() => setDriverDialog({ open: true, data: {} })} />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredDrivers.map(d => {
                const sc = DRIVER_STATUS_CFG[d.status];
                const licenseDays = d.license_expiry ? differenceInDays(parseISO(d.license_expiry), new Date()) : null;
                return (
                  <Card key={d.id} className="group hover:shadow-lg transition-all overflow-hidden">
                    <div className={cn("h-1.5", sc.bg)} />
                    <CardContent className="p-5 space-y-4">
                      <div className="flex items-start justify-between">
                        <div className="flex items-center gap-3 min-w-0">
                          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-200 to-amber-400 flex items-center justify-center text-amber-900 font-semibold shrink-0">
                            {d.full_name.charAt(0).toUpperCase()}
                          </div>
                          <div className="min-w-0">
                            <h3 className="font-semibold truncate">{d.full_name}</h3>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge className={cn("border-0 text-[10px]", sc.bg, sc.color)}>{sc.label}</Badge>
                              {d.rating > 0 && (
                                <span className="flex items-center gap-0.5 text-[11px] text-amber-600">
                                  <Star className="w-3 h-3 fill-current" />{d.rating.toFixed(1)}
                                </span>
                              )}
                            </div>
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <button className="opacity-0 group-hover:opacity-100 transition p-1.5 rounded-md hover:bg-muted">
                              <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => setDriverDialog({ open: true, data: d })}>
                              <Pencil className="w-3.5 h-3.5 mr-2" /> Edit
                            </DropdownMenuItem>
                            {d.share_token && (
                              <DropdownMenuItem onClick={() => {
                                const url = `${window.location.origin}/driver/${d.share_token}`;
                                navigator.clipboard.writeText(url);
                                toast({ title: "Driver portal link copied", description: url });
                              }}>
                                <Link2 className="w-3.5 h-3.5 mr-2" /> Copy Portal Link
                              </DropdownMenuItem>
                            )}
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive" onClick={() => softDeleteDriver.mutate(d.id)}>
                              <Trash2 className="w-3.5 h-3.5 mr-2" /> Remove
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      <div className="space-y-1.5 text-xs">
                        {d.phone && (
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <Phone className="w-3.5 h-3.5" /><span>{d.phone}</span>
                          </div>
                        )}
                        {d.license_number && (
                          <div className="flex items-center gap-1.5 text-muted-foreground">
                            <BadgeCheck className="w-3.5 h-3.5" />
                            <span>License: {d.license_number}</span>
                            {licenseDays !== null && licenseDays <= 60 && (
                              <Badge className={cn("ml-1 border-0 text-[10px]",
                                licenseDays < 0 ? "bg-red-100 text-red-700" :
                                licenseDays <= 30 ? "bg-amber-100 text-amber-700" : "bg-blue-50 text-blue-700"
                              )}>
                                {licenseDays < 0 ? "Expired" : `${licenseDays}d`}
                              </Badge>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center justify-between pt-2 border-t border-border text-xs">
                        <span className="text-muted-foreground">{d.total_trips} trips</span>
                        <span className="font-medium">{d.daily_rate > 0 ? `${d.daily_rate} ${d.currency}/day` : "—"}</span>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* MAINTENANCE TAB */}
        <TabsContent value="maintenance" className="mt-5">
          <MaintenanceTab companyId={companyId!} vehicles={vehicles} search={search}
            onEdit={(m) => setMaintDialog({ open: true, data: m })} />
        </TabsContent>

        {/* DOCUMENTS TAB */}
        <TabsContent value="documents" className="mt-5">
          <DocumentsTab companyId={companyId!} vehicles={vehicles} search={search}
            onEdit={(d) => setDocDialog({ open: true, data: d })} />
        </TabsContent>

        {/* EXPENSES TAB */}
        <TabsContent value="expenses" className="mt-5">
          <ExpensesTab companyId={companyId!} vehicles={vehicles} search={search}
            onEdit={(e) => setExpDialog({ open: true, data: e })} />
        </TabsContent>
      </Tabs>

      {/* Vehicle Dialog */}
      <VehicleDialog
        open={vehicleDialog.open}
        initial={vehicleDialog.data}
        onClose={() => setVehicleDialog({ open: false })}
        onSave={(v) => saveVehicle.mutate(v)}
        loading={saveVehicle.isPending}
      />

      {/* Driver Dialog */}
      <DriverDialog
        open={driverDialog.open}
        initial={driverDialog.data}
        onClose={() => setDriverDialog({ open: false })}
        onSave={(d) => saveDriver.mutate(d)}
        loading={saveDriver.isPending}
      />

      {/* Maintenance / Documents / Expenses Dialogs */}
      <MaintenanceDialog open={maintDialog.open} initial={maintDialog.data}
        vehicles={vehicles} companyId={companyId!} userId={user?.id}
        onClose={() => setMaintDialog({ open: false })} />
      <DocumentDialog open={docDialog.open} initial={docDialog.data}
        vehicles={vehicles} companyId={companyId!} userId={user?.id}
        onClose={() => setDocDialog({ open: false })} />
      <ExpenseDialog open={expDialog.open} initial={expDialog.data}
        vehicles={vehicles} companyId={companyId!} userId={user?.id}
        onClose={() => setExpDialog({ open: false })} />
    </div>
  );
}

function StatCard({ icon: Icon, label, value, tone }: any) {
  const tones: Record<string, string> = {
    primary: "bg-card text-foreground",
    emerald: "bg-emerald-50 text-emerald-700",
    blue: "bg-blue-50 text-blue-700",
    amber: "bg-amber-50 text-amber-700",
  };
  return (
    <Card className="overflow-hidden">
      <CardContent className={cn("p-4", tones[tone])}>
        <Icon className="w-5 h-5 mb-2 opacity-70" />
        <div className="text-2xl font-bold">{value}</div>
        <div className="text-[11px] uppercase tracking-wide opacity-80">{label}</div>
      </CardContent>
    </Card>
  );
}

function EmptyState({ icon: Icon, title, desc, cta, onClick }: any) {
  return (
    <div className="text-center py-20">
      <div className="w-20 h-20 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
        <Icon className="w-10 h-10 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold mb-1">{title}</h3>
      <p className="text-sm text-muted-foreground mb-4">{desc}</p>
      <Button onClick={onClick} className="gold-gradient text-accent-foreground">
        <Plus className="w-4 h-4 mr-2" />{cta}
      </Button>
    </div>
  );
}

function VehicleDialog({ open, initial, onClose, onSave, loading }: any) {
  const [v, setV] = useState<Partial<Vehicle>>(initial || {});
  // reset on open
  useMemo(() => { if (open) setV(initial || {}); }, [open, initial]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Bus className="w-5 h-5 text-accent" />
            {v.id ? "Edit Vehicle" : "New Vehicle"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Name *">
              <Input value={v.name || ""} onChange={e => setV({ ...v, name: e.target.value })} placeholder="e.g. Mercedes Sprinter 01" />
            </Field>
            <Field label="Type">
              <Select value={v.vehicle_type || "car"} onValueChange={x => setV({ ...v, vehicle_type: x as VehicleType })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bus">Bus</SelectItem>
                  <SelectItem value="minibus">Minibus</SelectItem>
                  <SelectItem value="car">Car</SelectItem>
                  <SelectItem value="suv">SUV</SelectItem>
                  <SelectItem value="van">Van</SelectItem>
                  <SelectItem value="boat">Boat</SelectItem>
                  <SelectItem value="yacht">Yacht / Golden Boat</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Plate Number"><Input value={v.plate_number || ""} onChange={e => setV({ ...v, plate_number: e.target.value })} /></Field>
            <Field label="Make"><Input value={v.make || ""} onChange={e => setV({ ...v, make: e.target.value })} /></Field>
            <Field label="Model"><Input value={v.model || ""} onChange={e => setV({ ...v, model: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <Field label="Year"><Input type="number" value={v.year || ""} onChange={e => setV({ ...v, year: parseInt(e.target.value) || undefined })} /></Field>
            <Field label="Capacity"><Input type="number" min="1" value={v.capacity_passengers || ""} onChange={e => setV({ ...v, capacity_passengers: parseInt(e.target.value) || 0 })} /></Field>
            <Field label="Mileage (km)"><Input type="number" value={v.current_mileage_km || ""} onChange={e => setV({ ...v, current_mileage_km: parseFloat(e.target.value) || 0 })} /></Field>
            <Field label="Daily Rate"><Input type="number" value={v.daily_rate || ""} onChange={e => setV({ ...v, daily_rate: parseFloat(e.target.value) || 0 })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Currency">
              <Select value={v.currency || "USD"} onValueChange={x => setV({ ...v, currency: x })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["USD","EUR","GBP","AED","SAR","EGP","TRY"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
            <Field label="Status">
              <Select value={v.status || "available"} onValueChange={x => setV({ ...v, status: x as VehicleStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(VEHICLE_STATUS_CFG).map(([k, c]) => <SelectItem key={k} value={k}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Notes">
            <Textarea rows={2} value={v.notes || ""} onChange={e => setV({ ...v, notes: e.target.value })} />
          </Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="gold-gradient text-accent-foreground" disabled={!v.name || loading} onClick={() => onSave(v)}>
            {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DriverDialog({ open, initial, onClose, onSave, loading }: any) {
  const [d, setD] = useState<Partial<Driver>>(initial || {});
  useMemo(() => { if (open) setD(initial || {}); }, [open, initial]);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Users className="w-5 h-5 text-accent" />
            {d.id ? "Edit Driver" : "New Driver"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 py-2">
          <Field label="Full Name *">
            <Input value={d.full_name || ""} onChange={e => setD({ ...d, full_name: e.target.value })} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone"><Input value={d.phone || ""} onChange={e => setD({ ...d, phone: e.target.value })} /></Field>
            <Field label="Email"><Input type="email" value={d.email || ""} onChange={e => setD({ ...d, email: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="License Number"><Input value={d.license_number || ""} onChange={e => setD({ ...d, license_number: e.target.value })} /></Field>
            <Field label="License Expiry"><Input type="date" value={d.license_expiry || ""} onChange={e => setD({ ...d, license_expiry: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Status">
              <Select value={d.status || "available"} onValueChange={x => setD({ ...d, status: x as DriverStatus })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(DRIVER_STATUS_CFG).map(([k, c]) => <SelectItem key={k} value={k}>{c.label}</SelectItem>)}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Daily Rate"><Input type="number" value={d.daily_rate || ""} onChange={e => setD({ ...d, daily_rate: parseFloat(e.target.value) || 0 })} /></Field>
            <Field label="Currency">
              <Select value={d.currency || "USD"} onValueChange={x => setD({ ...d, currency: x })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["USD","EUR","GBP","AED","SAR","EGP","TRY"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="gold-gradient text-accent-foreground" disabled={!d.full_name || loading} onClick={() => onSave(d)}>
            {loading && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs font-medium">{label}</Label>
      {children}
    </div>
  );
}

// ============== MAINTENANCE TAB ==============
function MaintenanceTab({ companyId, vehicles, search, onEdit }: any) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["fleet-maintenance", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicle_maintenance")
        .select("*, vehicles(name, plate_number)")
        .eq("company_id", companyId).order("service_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vehicle_maintenance").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fleet-maintenance"] }); toast({ title: "Removed" }); },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r: any) =>
      r.vehicles?.name?.toLowerCase().includes(q) ||
      r.maintenance_type?.toLowerCase().includes(q) ||
      r.description?.toLowerCase().includes(q)
    );
  }, [rows, search]);

  if (isLoading) return <Loader2 className="w-8 h-8 animate-spin text-accent mx-auto my-20" />;
  if (filtered.length === 0) return (
    <div className="text-center py-20">
      <Wrench className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
      <p className="text-sm text-muted-foreground">No maintenance records yet</p>
    </div>
  );

  return (
    <div className="space-y-2">
      {filtered.map((m: any) => {
        const nextDays = m.next_service_date ? differenceInDays(parseISO(m.next_service_date), new Date()) : null;
        return (
          <Card key={m.id} className="hover:shadow-md transition">
            <CardContent className="p-4 flex items-start gap-4">
              <div className="w-10 h-10 rounded-lg bg-amber-50 flex items-center justify-center shrink-0">
                <Wrench className="w-5 h-5 text-amber-700" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm">{m.maintenance_type}</span>
                  <Badge className="bg-slate-100 text-slate-700 border-0 text-[10px]">
                    {m.vehicles?.name} {m.vehicles?.plate_number && `· ${m.vehicles.plate_number}`}
                  </Badge>
                  {nextDays !== null && nextDays <= 30 && (
                    <Badge className={cn("border-0 text-[10px]",
                      nextDays < 0 ? "bg-red-100 text-red-700" :
                      nextDays <= 7 ? "bg-orange-100 text-orange-700" : "bg-amber-100 text-amber-700")}>
                      Next: {nextDays < 0 ? `${Math.abs(nextDays)}d overdue` : `in ${nextDays}d`}
                    </Badge>
                  )}
                </div>
                {m.description && <p className="text-xs text-muted-foreground mt-1">{m.description}</p>}
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
                  <span>{format(parseISO(m.service_date), "MMM d, yyyy")}</span>
                  {m.mileage_km && <span>{Math.round(m.mileage_km).toLocaleString()} km</span>}
                  {m.cost > 0 && <span className="font-medium text-foreground">{m.cost} {m.currency}</span>}
                  {m.provider && <span>by {m.provider}</span>}
                </div>
              </div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => onEdit(m)}>
                  <Pencil className="w-3.5 h-3.5" />
                </Button>
                <Button size="icon" variant="ghost" className="text-destructive" onClick={() => del.mutate(m.id)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ============== DOCUMENTS TAB ==============
function DocumentsTab({ companyId, vehicles, search, onEdit }: any) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["fleet-documents", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicle_documents")
        .select("*, vehicles(name, plate_number)")
        .eq("company_id", companyId).order("expiry_date", { ascending: true });
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vehicle_documents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fleet-documents"] }); qc.invalidateQueries({ queryKey: ["fleet-alerts"] }); toast({ title: "Removed" }); },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r: any) =>
      r.vehicles?.name?.toLowerCase().includes(q) ||
      r.doc_type?.toLowerCase().includes(q)
    );
  }, [rows, search]);

  if (isLoading) return <Loader2 className="w-8 h-8 animate-spin text-accent mx-auto my-20" />;
  if (filtered.length === 0) return (
    <div className="text-center py-20">
      <BadgeCheck className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
      <p className="text-sm text-muted-foreground">No documents yet</p>
    </div>
  );

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
      {filtered.map((d: any) => {
        const days = d.expiry_date ? differenceInDays(parseISO(d.expiry_date), new Date()) : null;
        const tone = days === null ? "slate" : days < 0 ? "red" : days <= 7 ? "orange" : days <= 30 ? "amber" : "emerald";
        const toneClass: Record<string, string> = {
          slate: "bg-slate-50 text-slate-700 border-slate-200",
          red: "bg-red-50 text-red-700 border-red-200",
          orange: "bg-orange-50 text-orange-700 border-orange-200",
          amber: "bg-amber-50 text-amber-700 border-amber-200",
          emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
        };
        return (
          <Card key={d.id} className={cn("border-l-4", toneClass[tone].replace("bg-", "border-l-"))}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-xs text-muted-foreground">{d.vehicles?.name} {d.vehicles?.plate_number && `· ${d.vehicles.plate_number}`}</div>
                  <h4 className="font-semibold text-sm mt-0.5">{d.doc_type}</h4>
                  {d.doc_number && <p className="text-xs text-muted-foreground font-mono">#{d.doc_number}</p>}
                </div>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => onEdit(d)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => del.mutate(d.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
              {d.expiry_date && (
                <div className={cn("mt-3 px-2 py-1.5 rounded text-xs flex items-center justify-between", toneClass[tone])}>
                  <span>Expires {format(parseISO(d.expiry_date), "MMM d, yyyy")}</span>
                  <span className="font-bold">
                    {days! < 0 ? `${Math.abs(days!)}d overdue` : `${days}d left`}
                  </span>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// ============== EXPENSES TAB ==============
function ExpensesTab({ companyId, vehicles, search, onEdit }: any) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["fleet-expenses", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("vehicle_expenses")
        .select("*, vehicles(name, plate_number), bookings(booking_number)")
        .eq("company_id", companyId).order("expense_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });
  const del = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vehicle_expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fleet-expenses"] }); toast({ title: "Removed" }); },
  });

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((r: any) =>
      r.vehicles?.name?.toLowerCase().includes(q) ||
      r.expense_type?.toLowerCase().includes(q) ||
      r.description?.toLowerCase().includes(q)
    );
  }, [rows, search]);

  const total = useMemo(() => filtered.reduce((s: number, r: any) => s + (r.amount || 0), 0), [filtered]);

  if (isLoading) return <Loader2 className="w-8 h-8 animate-spin text-accent mx-auto my-20" />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between bg-card border border-border rounded-lg p-3 text-sm">
        <span className="text-muted-foreground">Total ({filtered.length} entries)</span>
        <span className="font-bold text-base">{total.toLocaleString()} {filtered[0]?.currency || "USD"}</span>
      </div>
      {filtered.length === 0 ? (
        <div className="text-center py-16">
          <Fuel className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No expenses yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((e: any) => (
            <Card key={e.id} className="hover:shadow-md transition">
              <CardContent className="p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                  <Fuel className="w-4 h-4 text-blue-700" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-sm capitalize">{e.expense_type}</span>
                    <Badge className="bg-slate-100 text-slate-700 border-0 text-[10px]">
                      {e.vehicles?.name}
                    </Badge>
                    {e.bookings?.booking_number && (
                      <Badge className="bg-blue-50 text-blue-700 border-0 text-[10px]">{e.bookings.booking_number}</Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {format(parseISO(e.expense_date), "MMM d, yyyy")}
                    {e.description && ` · ${e.description}`}
                  </div>
                </div>
                <span className="font-bold text-sm">{e.amount} {e.currency}</span>
                <div className="flex gap-1">
                  <Button size="icon" variant="ghost" onClick={() => onEdit(e)}>
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button size="icon" variant="ghost" className="text-destructive" onClick={() => del.mutate(e.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ============== DIALOGS ==============
function MaintenanceDialog({ open, initial, vehicles, companyId, userId, onClose }: any) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [f, setF] = useState<any>({});
  useMemo(() => { if (open) setF(initial || { service_date: format(new Date(), "yyyy-MM-dd"), status: "completed", currency: "USD" }); }, [open, initial]);

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {
        company_id: companyId,
        vehicle_id: f.vehicle_id,
        maintenance_type: f.maintenance_type,
        description: f.description || null,
        service_date: f.service_date,
        mileage_km: f.mileage_km ? parseFloat(f.mileage_km) : null,
        cost: f.cost ? parseFloat(f.cost) : 0,
        currency: f.currency || "USD",
        next_service_date: f.next_service_date || null,
        next_service_mileage_km: f.next_service_mileage_km ? parseFloat(f.next_service_mileage_km) : null,
        provider: f.provider || null,
        status: f.status || "completed",
        notes: f.notes || null,
      };
      if (f.id) {
        const { error } = await supabase.from("vehicle_maintenance").update(payload).eq("id", f.id);
        if (error) throw error;
      } else {
        payload.created_by = userId;
        const { error } = await supabase.from("vehicle_maintenance").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fleet-maintenance"] }); toast({ title: "Saved" }); onClose(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Wrench className="w-5 h-5 text-accent" /> {f.id ? "Edit Maintenance" : "Log Maintenance"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Field label="Vehicle *">
            <Select value={f.vehicle_id || ""} onValueChange={v => setF({ ...f, vehicle_id: v })}>
              <SelectTrigger><SelectValue placeholder="Choose..." /></SelectTrigger>
              <SelectContent>{vehicles.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type *"><Input value={f.maintenance_type || ""} onChange={e => setF({ ...f, maintenance_type: e.target.value })} placeholder="Oil change, brakes..." /></Field>
            <Field label="Service Date *"><Input type="date" value={f.service_date || ""} onChange={e => setF({ ...f, service_date: e.target.value })} /></Field>
          </div>
          <Field label="Description"><Textarea rows={2} value={f.description || ""} onChange={e => setF({ ...f, description: e.target.value })} /></Field>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Mileage (km)"><Input type="number" value={f.mileage_km || ""} onChange={e => setF({ ...f, mileage_km: e.target.value })} /></Field>
            <Field label="Cost"><Input type="number" value={f.cost || ""} onChange={e => setF({ ...f, cost: e.target.value })} /></Field>
            <Field label="Currency">
              <Select value={f.currency || "USD"} onValueChange={v => setF({ ...f, currency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["USD","EUR","GBP","AED","SAR","EGP","TRY"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Next Service Date"><Input type="date" value={f.next_service_date || ""} onChange={e => setF({ ...f, next_service_date: e.target.value })} /></Field>
            <Field label="Next at (km)"><Input type="number" value={f.next_service_mileage_km || ""} onChange={e => setF({ ...f, next_service_mileage_km: e.target.value })} /></Field>
          </div>
          <Field label="Provider"><Input value={f.provider || ""} onChange={e => setF({ ...f, provider: e.target.value })} placeholder="Garage / workshop" /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="gold-gradient text-accent-foreground" disabled={!f.vehicle_id || !f.maintenance_type || !f.service_date || save.isPending} onClick={() => save.mutate()}>
            {save.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DocumentDialog({ open, initial, vehicles, companyId, userId, onClose }: any) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [f, setF] = useState<any>({});
  useMemo(() => { if (open) setF(initial || {}); }, [open, initial]);

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {
        company_id: companyId,
        vehicle_id: f.vehicle_id,
        doc_type: f.doc_type,
        doc_number: f.doc_number || null,
        issue_date: f.issue_date || null,
        expiry_date: f.expiry_date || null,
        file_url: f.file_url || null,
        notes: f.notes || null,
      };
      if (f.id) {
        const { error } = await supabase.from("vehicle_documents").update(payload).eq("id", f.id);
        if (error) throw error;
      } else {
        payload.created_by = userId;
        const { error } = await supabase.from("vehicle_documents").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fleet-documents"] }); qc.invalidateQueries({ queryKey: ["fleet-alerts"] }); toast({ title: "Saved" }); onClose(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <BadgeCheck className="w-5 h-5 text-accent" /> {f.id ? "Edit Document" : "Add Document"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Field label="Vehicle *">
            <Select value={f.vehicle_id || ""} onValueChange={v => setF({ ...f, vehicle_id: v })}>
              <SelectTrigger><SelectValue placeholder="Choose..." /></SelectTrigger>
              <SelectContent>{vehicles.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Document Type *">
              <Select value={f.doc_type || ""} onValueChange={v => setF({ ...f, doc_type: v })}>
                <SelectTrigger><SelectValue placeholder="Choose..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="Registration">Registration</SelectItem>
                  <SelectItem value="Insurance">Insurance</SelectItem>
                  <SelectItem value="Inspection">Inspection</SelectItem>
                  <SelectItem value="Permit">Operating Permit</SelectItem>
                  <SelectItem value="License">License</SelectItem>
                  <SelectItem value="Other">Other</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Document Number"><Input value={f.doc_number || ""} onChange={e => setF({ ...f, doc_number: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Issue Date"><Input type="date" value={f.issue_date || ""} onChange={e => setF({ ...f, issue_date: e.target.value })} /></Field>
            <Field label="Expiry Date"><Input type="date" value={f.expiry_date || ""} onChange={e => setF({ ...f, expiry_date: e.target.value })} /></Field>
          </div>
          <Field label="File URL"><Input value={f.file_url || ""} onChange={e => setF({ ...f, file_url: e.target.value })} placeholder="Link to scan/PDF" /></Field>
          <Field label="Notes"><Textarea rows={2} value={f.notes || ""} onChange={e => setF({ ...f, notes: e.target.value })} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="gold-gradient text-accent-foreground" disabled={!f.vehicle_id || !f.doc_type || save.isPending} onClick={() => save.mutate()}>
            {save.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExpenseDialog({ open, initial, vehicles, companyId, userId, onClose }: any) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const [f, setF] = useState<any>({});
  useMemo(() => { if (open) setF(initial || { expense_date: format(new Date(), "yyyy-MM-dd"), expense_type: "fuel", currency: "USD" }); }, [open, initial]);

  // load bookings (lightweight)
  const { data: bookings = [] } = useQuery({
    queryKey: ["exp-bookings", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("bookings").select("id, booking_number, title")
        .eq("company_id", companyId).is("deleted_at", null).order("created_at", { ascending: false }).limit(50);
      return data || [];
    },
    enabled: !!companyId && open,
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {
        company_id: companyId,
        vehicle_id: f.vehicle_id,
        booking_id: f.booking_id || null,
        expense_type: f.expense_type,
        description: f.description || null,
        expense_date: f.expense_date,
        amount: parseFloat(f.amount) || 0,
        currency: f.currency || "USD",
        notes: f.notes || null,
      };
      if (f.id) {
        const { error } = await supabase.from("vehicle_expenses").update(payload).eq("id", f.id);
        if (error) throw error;
      } else {
        payload.created_by = userId;
        const { error } = await supabase.from("vehicle_expenses").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["fleet-expenses"] }); toast({ title: "Saved" }); onClose(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Fuel className="w-5 h-5 text-accent" /> {f.id ? "Edit Expense" : "Log Expense"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <Field label="Vehicle *">
            <Select value={f.vehicle_id || ""} onValueChange={v => setF({ ...f, vehicle_id: v })}>
              <SelectTrigger><SelectValue placeholder="Choose..." /></SelectTrigger>
              <SelectContent>{vehicles.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>)}</SelectContent>
            </Select>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Type *">
              <Select value={f.expense_type || "fuel"} onValueChange={v => setF({ ...f, expense_type: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="fuel">Fuel</SelectItem>
                  <SelectItem value="toll">Toll</SelectItem>
                  <SelectItem value="parking">Parking</SelectItem>
                  <SelectItem value="fine">Fine</SelectItem>
                  <SelectItem value="cleaning">Cleaning</SelectItem>
                  <SelectItem value="repair">Repair</SelectItem>
                  <SelectItem value="other">Other</SelectItem>
                </SelectContent>
              </Select>
            </Field>
            <Field label="Date *"><Input type="date" value={f.expense_date || ""} onChange={e => setF({ ...f, expense_date: e.target.value })} /></Field>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Amount *"><Input type="number" value={f.amount || ""} onChange={e => setF({ ...f, amount: e.target.value })} /></Field>
            <Field label="Currency">
              <Select value={f.currency || "USD"} onValueChange={v => setF({ ...f, currency: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>{["USD","EUR","GBP","AED","SAR","EGP","TRY"].map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
              </Select>
            </Field>
          </div>
          <Field label="Linked Booking (optional)">
            <Select value={f.booking_id || "_"} onValueChange={v => setF({ ...f, booking_id: v === "_" ? null : v })}>
              <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_">— None —</SelectItem>
                {bookings.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.booking_number} — {b.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Description"><Input value={f.description || ""} onChange={e => setF({ ...f, description: e.target.value })} /></Field>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="gold-gradient text-accent-foreground" disabled={!f.vehicle_id || !f.amount || save.isPending} onClick={() => save.mutate()}>
            {save.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

