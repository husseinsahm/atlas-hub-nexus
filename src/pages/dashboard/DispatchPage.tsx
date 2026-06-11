import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { format, addDays, startOfDay, endOfDay, isSameDay, parseISO, differenceInMinutes } from "date-fns";
import {
  Calendar as CalendarIcon, ChevronLeft, ChevronRight, Plus, AlertTriangle,
  Bus, Users, Loader2, Clock, MapPin, Trash2, ExternalLink, Compass,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

type ViewMode = "day" | "week";

interface Assignment {
  id: string;
  vehicle_id: string | null;
  driver_id: string | null;
  booking_id: string | null;
  scheduled_start: string;
  scheduled_end: string;
  status: string;
  pickup_location: string | null;
  dropoff_location: string | null;
  passenger_count: number;
  notes: string | null;
  bookings?: { booking_number: string; title: string } | null;
}

const STATUS_COLORS: Record<string, string> = {
  scheduled:  "bg-blue-100 text-blue-800 border-blue-300",
  en_route:   "bg-violet-100 text-violet-800 border-violet-300",
  in_progress:"bg-amber-100 text-amber-800 border-amber-300",
  completed:  "bg-emerald-100 text-emerald-800 border-emerald-300",
  cancelled:  "bg-red-100 text-red-800 border-red-300",
};

export default function DispatchPage() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { toast } = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const companyId = user?.activeMembership?.companyId;

  const [view, setView] = useState<ViewMode>("day");
  const [anchor, setAnchor] = useState<Date>(new Date());
  const [resource, setResource] = useState<"vehicle" | "driver">("vehicle");
  const [createOpen, setCreateOpen] = useState(false);
  const [editing, setEditing] = useState<Assignment | null>(null);

  const days = useMemo(() => {
    if (view === "day") return [anchor];
    return Array.from({ length: 7 }, (_, i) => addDays(anchor, i));
  }, [anchor, view]);

  const rangeStart = startOfDay(days[0]);
  const rangeEnd = endOfDay(days[days.length - 1]);

  const { data: vehicles = [] } = useQuery({
    queryKey: ["dispatch-vehicles", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("vehicles").select("id, name, vehicle_type, plate_number, capacity_passengers")
        .eq("company_id", companyId!).is("deleted_at", null).eq("is_active", true).order("name");
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: drivers = [] } = useQuery({
    queryKey: ["dispatch-drivers", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("drivers").select("id, full_name, phone, status")
        .eq("company_id", companyId!).is("deleted_at", null).eq("is_active", true).order("full_name");
      return data || [];
    },
    enabled: !!companyId,
  });

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["dispatch-assignments", companyId, rangeStart.toISOString(), rangeEnd.toISOString()],
    queryFn: async () => {
      const { data, error } = await supabase.from("service_assignments")
        .select("*, bookings(booking_number, title)")
        .eq("company_id", companyId!)
        .gte("scheduled_start", rangeStart.toISOString())
        .lte("scheduled_start", rangeEnd.toISOString())
        .order("scheduled_start");
      if (error) throw error;
      return (data || []) as Assignment[];
    },
    enabled: !!companyId,
  });

  // Detect conflicts: same vehicle or driver with overlapping time windows
  const conflicts = useMemo(() => {
    const conflictIds = new Set<string>();
    const check = (key: "vehicle_id" | "driver_id") => {
      const grouped: Record<string, Assignment[]> = {};
      assignments.forEach(a => {
        const v = a[key];
        if (!v) return;
        if (!grouped[v]) grouped[v] = [];
        grouped[v].push(a);
      });
      Object.values(grouped).forEach(list => {
        for (let i = 0; i < list.length; i++) {
          for (let j = i + 1; j < list.length; j++) {
            const aS = new Date(list[i].scheduled_start).getTime();
            const aE = new Date(list[i].scheduled_end).getTime();
            const bS = new Date(list[j].scheduled_start).getTime();
            const bE = new Date(list[j].scheduled_end).getTime();
            if (aS < bE && bS < aE) {
              conflictIds.add(list[i].id);
              conflictIds.add(list[j].id);
            }
          }
        }
      });
    };
    check("vehicle_id");
    check("driver_id");
    return conflictIds;
  }, [assignments]);

  const rows = resource === "vehicle" ? vehicles : drivers;

  const deleteAssign = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("service_assignments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["dispatch-assignments"] });
      setEditing(null);
      toast({ title: "Assignment removed" });
    },
  });

  // Layout: hours 6 → 24 (18 hours)
  const HOUR_START = 6, HOUR_END = 24;
  const totalHours = HOUR_END - HOUR_START;

  const positionOf = (start: string, end: string, day: Date) => {
    const s = new Date(start);
    const e = new Date(end);
    const dayStart = startOfDay(day);
    const startH = (s.getTime() - dayStart.getTime()) / 3600000;
    const endH = (e.getTime() - dayStart.getTime()) / 3600000;
    const clampedStart = Math.max(HOUR_START, Math.min(HOUR_END, startH));
    const clampedEnd = Math.max(HOUR_START, Math.min(HOUR_END, endH));
    return {
      left: `${((clampedStart - HOUR_START) / totalHours) * 100}%`,
      width: `${Math.max(2, ((clampedEnd - clampedStart) / totalHours) * 100)}%`,
    };
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display flex items-center gap-2">
            <div className="w-10 h-10 rounded-xl gold-gradient flex items-center justify-center">
              <Compass className="w-5 h-5 text-accent-foreground" />
            </div>
            {t("dispatch.title")}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {t("dispatch.subtitle")}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1 bg-card border border-border rounded-lg p-1">
            <Button size="sm" variant={view === "day" ? "default" : "ghost"} onClick={() => setView("day")}>{t("dispatch.day")}</Button>
            <Button size="sm" variant={view === "week" ? "default" : "ghost"} onClick={() => setView("week")}>{t("dispatch.week")}</Button>
          </div>
          <Select value={resource} onValueChange={v => setResource(v as any)}>
            <SelectTrigger className="w-32"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="vehicle">{t("dispatch.byVehicle")}</SelectItem>
              <SelectItem value="driver">{t("dispatch.byDriver")}</SelectItem>
            </SelectContent>
          </Select>
          <Button onClick={() => { setEditing(null); setCreateOpen(true); }} className="gold-gradient text-accent-foreground">
            <Plus className="w-4 h-4 mr-2" />{t("dispatch.assign")}
          </Button>
        </div>
      </div>

      {/* Date nav */}
      <div className="flex items-center justify-between bg-card border border-border rounded-lg px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Button size="icon" variant="ghost" onClick={() => setAnchor(d => addDays(d, view === "day" ? -1 : -7))}>
            <ChevronLeft className="w-4 h-4" />
          </Button>
          <CalendarIcon className="w-4 h-4 text-muted-foreground" />
          <span className="font-semibold">
            {view === "day"
              ? format(anchor, "EEEE, MMM d, yyyy")
              : `${format(days[0], "MMM d")} – ${format(days[6], "MMM d, yyyy")}`}
          </span>
          <Button size="icon" variant="ghost" onClick={() => setAnchor(d => addDays(d, view === "day" ? 1 : 7))}>
            <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
        <Button size="sm" variant="outline" onClick={() => setAnchor(new Date())}>{t("dispatch.today")}</Button>
      </div>

      {/* Conflict warning */}
      {conflicts.size > 0 && (
        <div className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-50 border border-red-200 text-sm text-red-800">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span className="font-medium">{conflicts.size / 2} {t("dispatch.conflicts")}</span>
          <span className="text-red-600">{t("dispatch.conflictHint")}</span>
        </div>
      )}

      {/* Board */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          {isLoading ? (
            <Loader2 className="w-8 h-8 animate-spin text-accent mx-auto my-20" />
          ) : (
            <div className="overflow-x-auto">
              {/* day headers (only for week view) */}
              {view === "week" && (
                <div className="grid border-b border-border bg-muted/40" style={{ gridTemplateColumns: `200px repeat(${days.length}, minmax(180px, 1fr))` }}>
                  <div className="p-3 text-xs font-semibold uppercase text-muted-foreground">{resource === "vehicle" ? "Vehicle" : "Driver"}</div>
                  {days.map(d => (
                    <div key={d.toISOString()} className={cn("p-3 text-xs font-semibold border-l border-border text-center",
                      isSameDay(d, new Date()) && "bg-accent/10 text-accent-foreground")}>
                      <div>{format(d, "EEE")}</div>
                      <div className="text-base font-bold">{format(d, "d")}</div>
                    </div>
                  ))}
                </div>
              )}

              {/* day view: hour ruler */}
              {view === "day" && (
                <div className="grid border-b border-border bg-muted/40" style={{ gridTemplateColumns: "200px 1fr" }}>
                  <div className="p-3 text-xs font-semibold uppercase text-muted-foreground">{resource === "vehicle" ? "Vehicle" : "Driver"}</div>
                  <div className="relative h-10">
                    {Array.from({ length: totalHours + 1 }, (_, i) => HOUR_START + i).map(h => (
                      <div key={h} className="absolute top-0 bottom-0 text-[10px] text-muted-foreground border-l border-border/60 pl-1"
                        style={{ left: `${((h - HOUR_START) / totalHours) * 100}%` }}>
                        {h % 24}:00
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* rows */}
              {rows.length === 0 ? (
                <div className="text-center py-16 text-muted-foreground text-sm">
                  No {resource === "vehicle" ? "vehicles" : "drivers"} yet. Add some in Fleet.
                </div>
              ) : (
                rows.map((row: any) => {
                  const rowAssigns = assignments.filter(a =>
                    resource === "vehicle" ? a.vehicle_id === row.id : a.driver_id === row.id
                  );
                  return (
                    <div key={row.id} className="border-b border-border last:border-b-0"
                      style={{ display: "grid", gridTemplateColumns: view === "day" ? "200px 1fr" : `200px repeat(${days.length}, minmax(180px, 1fr))` }}>
                      {/* row label */}
                      <div className="p-3 flex items-center gap-2 bg-muted/20">
                        <div className="w-8 h-8 rounded-lg bg-card flex items-center justify-center">
                          {resource === "vehicle" ? <Bus className="w-4 h-4" /> : <Users className="w-4 h-4" />}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-medium truncate">{row.name || row.full_name}</div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {resource === "vehicle" ? (row.plate_number || `${row.capacity_passengers} pax`) : (row.phone || row.status)}
                          </div>
                        </div>
                      </div>

                      {/* day cells */}
                      {days.map(day => {
                        const dayAssigns = rowAssigns.filter(a => isSameDay(parseISO(a.scheduled_start), day));
                        return (
                          <div key={day.toISOString()} className="relative h-20 border-l border-border bg-background hover:bg-muted/20 transition-colors group">
                            {/* hour grid lines for day view */}
                            {view === "day" && Array.from({ length: totalHours }, (_, i) => (
                              <div key={i} className="absolute top-0 bottom-0 border-l border-border/40"
                                style={{ left: `${(i / totalHours) * 100}%` }} />
                            ))}
                            {dayAssigns.map(a => {
                              const pos = view === "day" ? positionOf(a.scheduled_start, a.scheduled_end, day) : { left: "4%", width: "92%" };
                              const isConflict = conflicts.has(a.id);
                              return (
                                <button
                                  key={a.id}
                                  onClick={() => setEditing(a)}
                                  className={cn(
                                    "absolute top-1.5 bottom-1.5 rounded-md border px-2 py-1 text-left overflow-hidden hover:shadow-md transition-all",
                                    STATUS_COLORS[a.status] || STATUS_COLORS.scheduled,
                                    isConflict && "ring-2 ring-red-500 ring-offset-1"
                                  )}
                                  style={pos}
                                >
                                  <div className="text-[10px] font-semibold flex items-center gap-1 truncate">
                                    {isConflict && <AlertTriangle className="w-2.5 h-2.5 shrink-0" />}
                                    {format(parseISO(a.scheduled_start), "HH:mm")}
                                    {view === "day" && ` – ${format(parseISO(a.scheduled_end), "HH:mm")}`}
                                  </div>
                                  <div className="text-[11px] font-medium truncate leading-tight">
                                    {a.bookings?.booking_number || "Trip"}
                                  </div>
                                  {a.pickup_location && view === "day" && (
                                    <div className="text-[10px] truncate opacity-80">→ {a.pickup_location}</div>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        );
                      })}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Create / Edit Dialog */}
      <AssignmentDialog
        open={createOpen || !!editing}
        editing={editing}
        defaultDate={anchor}
        vehicles={vehicles}
        drivers={drivers}
        onClose={() => { setCreateOpen(false); setEditing(null); }}
        onSaved={() => qc.invalidateQueries({ queryKey: ["dispatch-assignments"] })}
        onDelete={(id) => deleteAssign.mutate(id)}
      />
    </div>
  );
}

function AssignmentDialog({ open, editing, defaultDate, vehicles, drivers, onClose, onSaved, onDelete }: any) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const companyId = user?.activeMembership?.companyId;

  const [form, setForm] = useState<any>({});

  useMemo(() => {
    if (open) {
      if (editing) {
        setForm({
          ...editing,
          scheduled_start: format(parseISO(editing.scheduled_start), "yyyy-MM-dd'T'HH:mm"),
          scheduled_end: format(parseISO(editing.scheduled_end), "yyyy-MM-dd'T'HH:mm"),
        });
      } else {
        const d = format(defaultDate, "yyyy-MM-dd");
        setForm({
          vehicle_id: null,
          driver_id: null,
          scheduled_start: `${d}T09:00`,
          scheduled_end: `${d}T11:00`,
          status: "scheduled",
          passenger_count: 1,
        });
      }
    }
  }, [open, editing, defaultDate]);

  const { data: bookings = [] } = useQuery({
    queryKey: ["dispatch-bookings", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("bookings").select("id, booking_number, title")
        .eq("company_id", companyId!).is("deleted_at", null).order("created_at", { ascending: false }).limit(100);
      return data || [];
    },
    enabled: !!companyId && open,
  });

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {
        company_id: companyId,
        vehicle_id: form.vehicle_id || null,
        driver_id: form.driver_id || null,
        booking_id: form.booking_id || null,
        scheduled_start: new Date(form.scheduled_start).toISOString(),
        scheduled_end: new Date(form.scheduled_end).toISOString(),
        status: form.status || "scheduled",
        pickup_location: form.pickup_location || null,
        dropoff_location: form.dropoff_location || null,
        passenger_count: form.passenger_count || 0,
        notes: form.notes || null,
      };
      if (editing) {
        const { error } = await supabase.from("service_assignments").update(payload).eq("id", editing.id);
        if (error) throw error;
      } else {
        payload.created_by = user?.id;
        const { error } = await supabase.from("service_assignments").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      onSaved();
      onClose();
      toast({ title: "Assignment saved" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Compass className="w-5 h-5 text-accent" />
            {editing ? "Edit Assignment" : "New Assignment"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Vehicle</Label>
              <Select value={form.vehicle_id || "_"} onValueChange={v => setForm({ ...form, vehicle_id: v === "_" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Choose..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_">— None —</SelectItem>
                  {vehicles.map((v: any) => <SelectItem key={v.id} value={v.id}>{v.name} {v.plate_number && `(${v.plate_number})`}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Driver</Label>
              <Select value={form.driver_id || "_"} onValueChange={v => setForm({ ...form, driver_id: v === "_" ? null : v })}>
                <SelectTrigger><SelectValue placeholder="Choose..." /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_">— None —</SelectItem>
                  {drivers.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.full_name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Booking File</Label>
            <Select value={form.booking_id || "_"} onValueChange={v => setForm({ ...form, booking_id: v === "_" ? null : v })}>
              <SelectTrigger><SelectValue placeholder="Optional..." /></SelectTrigger>
              <SelectContent>
                <SelectItem value="_">— None —</SelectItem>
                {bookings.map((b: any) => <SelectItem key={b.id} value={b.id}>{b.booking_number} — {b.title}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Start</Label>
              <Input type="datetime-local" value={form.scheduled_start || ""} onChange={e => setForm({ ...form, scheduled_start: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">End</Label>
              <Input type="datetime-local" value={form.scheduled_end || ""} onChange={e => setForm({ ...form, scheduled_end: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Pickup</Label>
              <Input value={form.pickup_location || ""} onChange={e => setForm({ ...form, pickup_location: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Dropoff</Label>
              <Input value={form.dropoff_location || ""} onChange={e => setForm({ ...form, dropoff_location: e.target.value })} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Passengers</Label>
              <Input type="number" min="0" value={form.passenger_count || ""} onChange={e => setForm({ ...form, passenger_count: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Status</Label>
              <Select value={form.status || "scheduled"} onValueChange={v => setForm({ ...form, status: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="en_route">En Route</SelectItem>
                  <SelectItem value="in_progress">In Progress</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="cancelled">Cancelled</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Notes</Label>
            <Textarea rows={2} value={form.notes || ""} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>

          {editing?.booking_id && (
            <Button variant="outline" size="sm" onClick={() => { onClose(); navigate(`/dashboard/bookings/${editing.booking_id}`); }}>
              <ExternalLink className="w-3.5 h-3.5 mr-2" /> Open Booking File
            </Button>
          )}
        </div>

        <DialogFooter className="flex justify-between sm:justify-between gap-2">
          <div>
            {editing && (
              <Button variant="ghost" size="sm" className="text-destructive hover:bg-red-50"
                onClick={() => onDelete(editing.id)}>
                <Trash2 className="w-4 h-4 mr-2" />Delete
              </Button>
            )}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={onClose}>Cancel</Button>
            <Button className="gold-gradient text-accent-foreground" disabled={save.isPending} onClick={() => save.mutate()}>
              {save.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Save
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
