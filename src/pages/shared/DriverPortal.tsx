import { useState, useMemo, useRef, useEffect } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format, parseISO, isToday, isTomorrow, addDays, startOfDay, endOfDay } from "date-fns";
import {
  Bus, MapPin, Clock, Users, CheckCircle2, PlayCircle, StopCircle, Fuel,
  Camera, AlertCircle, Loader2, Calendar, Phone, ChevronRight, Signature,
  ArrowLeft, FileText, Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

interface DriverInfo {
  id: string;
  company_id: string;
  full_name: string;
  phone: string | null;
  rating: number;
  total_trips: number;
  avatar_url: string | null;
}

interface Trip {
  id: string;
  booking_id: string | null;
  booking_number: string | null;
  booking_title: string | null;
  vehicle_name: string | null;
  vehicle_plate: string | null;
  scheduled_start: string;
  scheduled_end: string;
  actual_start: string | null;
  actual_end: string | null;
  pickup_location: string | null;
  dropoff_location: string | null;
  passenger_count: number;
  status: string;
  notes: string | null;
}

export default function DriverPortal() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);

  const { data: driver, isLoading: loadingDriver, error: driverError } = useQuery({
    queryKey: ["driver-portal", token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_driver_by_token", { _token: token });
      if (error) throw error;
      if (!data || data.length === 0) throw new Error("Invalid driver link");
      return data[0] as DriverInfo;
    },
    enabled: !!token,
    retry: false,
  });

  const { data: trips = [], isLoading: loadingTrips } = useQuery({
    queryKey: ["driver-trips", token],
    queryFn: async () => {
      const from = startOfDay(new Date()).toISOString();
      const to = endOfDay(addDays(new Date(), 7)).toISOString();
      const { data, error } = await supabase.rpc("get_driver_assignments", {
        _token: token, _from: from, _to: to,
      });
      if (error) throw error;
      return (data || []) as Trip[];
    },
    enabled: !!driver,
  });

  const grouped = useMemo(() => {
    const map: Record<string, Trip[]> = { today: [], tomorrow: [], upcoming: [] };
    trips.forEach(t => {
      const d = parseISO(t.scheduled_start);
      if (isToday(d)) map.today.push(t);
      else if (isTomorrow(d)) map.tomorrow.push(t);
      else map.upcoming.push(t);
    });
    return map;
  }, [trips]);

  if (loadingDriver) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-white to-amber-50">
        <Loader2 className="w-10 h-10 animate-spin text-amber-600" />
      </div>
    );
  }

  if (driverError || !driver) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-amber-50 via-white to-amber-50 p-6">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertCircle className="w-12 h-12 text-red-500 mx-auto mb-3" />
            <h2 className="text-lg font-bold mb-1">Link not valid</h2>
            <p className="text-sm text-muted-foreground">
              This driver link is invalid or has been deactivated. Please contact your dispatcher.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-white to-amber-50">
      {/* Header */}
      <div className="bg-white border-b border-amber-200 sticky top-0 z-10 shadow-sm">
        <div className="max-w-3xl mx-auto px-4 py-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-amber-300 to-amber-500 flex items-center justify-center text-amber-900 font-bold text-lg shadow-sm">
            {driver.full_name.charAt(0).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-bold text-base truncate">{driver.full_name}</h1>
            <div className="flex items-center gap-3 text-xs text-muted-foreground">
              <span className="flex items-center gap-1"><Sparkles className="w-3 h-3 text-amber-500" /> Driver Portal</span>
              {driver.rating > 0 && <span>★ {driver.rating.toFixed(1)}</span>}
              <span>{driver.total_trips} trips</span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-3xl mx-auto p-4 space-y-6">
        {loadingTrips ? (
          <Loader2 className="w-8 h-8 animate-spin text-amber-600 mx-auto mt-12" />
        ) : trips.length === 0 ? (
          <Card>
            <CardContent className="p-10 text-center">
              <Calendar className="w-12 h-12 text-muted-foreground mx-auto mb-3" />
              <h3 className="font-semibold mb-1">No trips scheduled</h3>
              <p className="text-sm text-muted-foreground">You have no assignments in the next 7 days.</p>
            </CardContent>
          </Card>
        ) : (
          <>
            <Section title="Today" trips={grouped.today} highlight onOpen={setActiveTrip} />
            <Section title="Tomorrow" trips={grouped.tomorrow} onOpen={setActiveTrip} />
            <Section title="Upcoming" trips={grouped.upcoming} onOpen={setActiveTrip} />
          </>
        )}
      </div>

      <TripDetailSheet
        trip={activeTrip}
        token={token!}
        driverId={driver.id}
        companyId={driver.company_id}
        onClose={() => setActiveTrip(null)}
        onUpdated={() => {
          qc.invalidateQueries({ queryKey: ["driver-trips", token] });
          setActiveTrip(null);
        }}
      />
    </div>
  );
}

function Section({ title, trips, highlight, onOpen }: { title: string; trips: Trip[]; highlight?: boolean; onOpen: (t: Trip) => void }) {
  if (trips.length === 0) return null;
  return (
    <div>
      <h2 className={cn("text-sm font-bold uppercase tracking-wide mb-2 px-1",
        highlight ? "text-amber-700" : "text-muted-foreground")}>
        {title} · {trips.length}
      </h2>
      <div className="space-y-2">
        {trips.map(t => <TripCard key={t.id} trip={t} onClick={() => onOpen(t)} />)}
      </div>
    </div>
  );
}

function TripCard({ trip, onClick }: { trip: Trip; onClick: () => void }) {
  const statusColor: Record<string, string> = {
    scheduled: "bg-blue-100 text-blue-800",
    en_route: "bg-violet-100 text-violet-800",
    in_progress: "bg-amber-100 text-amber-800",
    completed: "bg-emerald-100 text-emerald-800",
    cancelled: "bg-red-100 text-red-800",
  };
  return (
    <button
      onClick={onClick}
      className="w-full text-left bg-white rounded-xl border border-border hover:border-amber-300 hover:shadow-md transition-all p-4 group"
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <Clock className="w-4 h-4 text-amber-600 shrink-0" />
          <span className="font-bold text-sm">
            {format(parseISO(trip.scheduled_start), "HH:mm")} – {format(parseISO(trip.scheduled_end), "HH:mm")}
          </span>
        </div>
        <Badge className={cn("border-0 text-[10px]", statusColor[trip.status] || statusColor.scheduled)}>
          {trip.status.replace("_", " ")}
        </Badge>
      </div>

      {trip.booking_number && (
        <div className="text-xs font-mono text-muted-foreground mb-1">{trip.booking_number}</div>
      )}
      <div className="font-semibold text-sm mb-2 truncate">{trip.booking_title || "Trip"}</div>

      <div className="space-y-1 text-xs text-muted-foreground">
        {trip.pickup_location && (
          <div className="flex items-start gap-1.5"><MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" /><span className="truncate">{trip.pickup_location}</span></div>
        )}
        {trip.dropoff_location && (
          <div className="flex items-start gap-1.5"><MapPin className="w-3.5 h-3.5 text-red-600 shrink-0 mt-0.5" /><span className="truncate">{trip.dropoff_location}</span></div>
        )}
        <div className="flex items-center gap-3 pt-1">
          {trip.vehicle_name && (
            <span className="flex items-center gap-1"><Bus className="w-3.5 h-3.5" />{trip.vehicle_name}{trip.vehicle_plate ? ` · ${trip.vehicle_plate}` : ""}</span>
          )}
          {trip.passenger_count > 0 && (
            <span className="flex items-center gap-1"><Users className="w-3.5 h-3.5" />{trip.passenger_count}</span>
          )}
        </div>
      </div>

      <div className="flex justify-end mt-2">
        <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:text-amber-600 transition-colors" />
      </div>
    </button>
  );
}

function TripDetailSheet({ trip, token, driverId, companyId, onClose, onUpdated }: any) {
  const { toast } = useToast();
  const [logDialog, setLogDialog] = useState<{ type: string; open: boolean } | null>(null);

  const checkAction = useMutation({
    mutationFn: async ({ status, time }: { status: string; time?: Date }) => {
      const payload: any = { _token: token, _assignment_id: trip.id, _new_status: status };
      if (status === "in_progress" || status === "en_route") payload._actual_start = (time || new Date()).toISOString();
      if (status === "completed") payload._actual_end = (time || new Date()).toISOString();
      const { error } = await supabase.rpc("driver_update_assignment", payload);
      if (error) throw error;
      // Add log entry
      await supabase.from("driver_trip_logs").insert({
        company_id: companyId,
        assignment_id: trip.id,
        driver_id: driverId,
        event_type: status === "completed" ? "check_out" : "check_in",
        notes: `Status: ${status}`,
      });
    },
    onSuccess: () => { toast({ title: "Updated" }); onUpdated(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (!trip) return null;

  return (
    <>
      <Dialog open={!!trip} onOpenChange={(o) => !o && onClose()}>
        <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto p-0 gap-0">
          <DialogHeader className="p-5 pb-3 border-b border-border bg-gradient-to-br from-amber-50 to-white">
            <DialogTitle className="font-display flex items-center gap-2 text-base">
              <Calendar className="w-5 h-5 text-amber-600" />
              {trip.booking_number || "Trip"}
            </DialogTitle>
            <p className="text-sm text-muted-foreground">{trip.booking_title}</p>
          </DialogHeader>

          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 gap-3 text-sm">
              <Info label="Start" value={format(parseISO(trip.scheduled_start), "MMM d · HH:mm")} />
              <Info label="End" value={format(parseISO(trip.scheduled_end), "MMM d · HH:mm")} />
              {trip.vehicle_name && <Info label="Vehicle" value={`${trip.vehicle_name}${trip.vehicle_plate ? ` (${trip.vehicle_plate})` : ""}`} />}
              {trip.passenger_count > 0 && <Info label="Passengers" value={trip.passenger_count} />}
            </div>

            {trip.pickup_location && (
              <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3">
                <div className="text-[10px] font-bold text-emerald-700 uppercase mb-1">Pickup</div>
                <div className="text-sm flex items-start gap-2"><MapPin className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />{trip.pickup_location}</div>
                <a href={`https://maps.google.com/?q=${encodeURIComponent(trip.pickup_location)}`} target="_blank" rel="noreferrer" className="text-xs text-emerald-700 underline mt-1 inline-block">Open in Maps →</a>
              </div>
            )}

            {trip.dropoff_location && (
              <div className="rounded-lg bg-red-50 border border-red-200 p-3">
                <div className="text-[10px] font-bold text-red-700 uppercase mb-1">Dropoff</div>
                <div className="text-sm flex items-start gap-2"><MapPin className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />{trip.dropoff_location}</div>
                <a href={`https://maps.google.com/?q=${encodeURIComponent(trip.dropoff_location)}`} target="_blank" rel="noreferrer" className="text-xs text-red-700 underline mt-1 inline-block">Open in Maps →</a>
              </div>
            )}

            {trip.notes && (
              <div className="rounded-lg bg-muted p-3 text-sm">
                <div className="text-[10px] font-bold uppercase text-muted-foreground mb-1">Notes</div>
                {trip.notes}
              </div>
            )}

            {/* Timeline of actions */}
            <div className="space-y-2 pt-2">
              <div className="text-[10px] font-bold uppercase text-muted-foreground">Actions</div>

              {trip.status === "scheduled" && (
                <Button className="w-full bg-violet-600 hover:bg-violet-700 text-white" disabled={checkAction.isPending}
                  onClick={() => checkAction.mutate({ status: "en_route" })}>
                  <PlayCircle className="w-4 h-4 mr-2" /> Start Trip (En Route)
                </Button>
              )}

              {trip.status === "en_route" && (
                <Button className="w-full bg-amber-600 hover:bg-amber-700 text-white" disabled={checkAction.isPending}
                  onClick={() => checkAction.mutate({ status: "in_progress" })}>
                  <CheckCircle2 className="w-4 h-4 mr-2" /> Picked Up Passengers
                </Button>
              )}

              {trip.status === "in_progress" && (
                <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white" disabled={checkAction.isPending}
                  onClick={() => setLogDialog({ type: "complete", open: true })}>
                  <StopCircle className="w-4 h-4 mr-2" /> Complete Trip
                </Button>
              )}

              {trip.status === "completed" && (
                <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-center text-sm text-emerald-700 flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-5 h-5" /> Trip Completed
                </div>
              )}

              <div className="grid grid-cols-2 gap-2">
                <Button variant="outline" size="sm" onClick={() => setLogDialog({ type: "fuel", open: true })}>
                  <Fuel className="w-4 h-4 mr-1" /> Log Fuel
                </Button>
                <Button variant="outline" size="sm" onClick={() => setLogDialog({ type: "incident", open: true })}>
                  <AlertCircle className="w-4 h-4 mr-1" /> Incident
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Log dialog (fuel / incident / complete with signature) */}
      <LogDialog
        open={!!logDialog?.open}
        type={logDialog?.type || ""}
        trip={trip}
        token={token}
        driverId={driverId}
        companyId={companyId}
        onClose={() => setLogDialog(null)}
        onSaved={() => { setLogDialog(null); onUpdated(); }}
      />
    </>
  );
}

function Info({ label, value }: { label: string; value: any }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase text-muted-foreground">{label}</div>
      <div className="font-medium">{value}</div>
    </div>
  );
}

function LogDialog({ open, type, trip, token, driverId, companyId, onClose, onSaved }: any) {
  const { toast } = useToast();
  const [form, setForm] = useState<any>({});
  const sigRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);

  useEffect(() => {
    if (open) setForm({});
  }, [open, type]);

  // Signature drawing via pointer events (works for mouse + touch + pen)
  const getCtx = () => {
    const c = sigRef.current;
    if (!c) return null;
    // Lazy-size the backing store once to match displayed size
    const rect = c.getBoundingClientRect();
    if (c.width !== Math.floor(rect.width) || c.height !== Math.floor(rect.height)) {
      c.width = Math.floor(rect.width);
      c.height = Math.floor(rect.height);
    }
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    ctx.strokeStyle = "#000";
    ctx.lineWidth = 2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    return ctx;
  };

  const pointerPos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = sigRef.current!;
    const rect = c.getBoundingClientRect();
    return {
      x: ((e.clientX - rect.left) * c.width) / rect.width,
      y: ((e.clientY - rect.top) * c.height) / rect.height,
    };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const ctx = getCtx();
    if (!ctx) return;
    (e.target as HTMLCanvasElement).setPointerCapture(e.pointerId);
    drawing.current = true;
    const { x, y } = pointerPos(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current) return;
    const ctx = sigRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = pointerPos(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  };
  const onPointerUp = () => { drawing.current = false; };

  const clearSig = () => {
    const c = sigRef.current;
    if (c) c.getContext("2d")?.clearRect(0, 0, c.width, c.height);
  };


  const save = useMutation({
    mutationFn: async () => {
      const isComplete = type === "complete";
      const sig = isComplete && sigRef.current ? sigRef.current.toDataURL("image/png") : null;

      // Insert log
      await supabase.from("driver_trip_logs").insert({
        company_id: companyId,
        assignment_id: trip.id,
        driver_id: driverId,
        event_type: type === "complete" ? "check_out" : type,
        mileage_km: form.mileage_km ? parseFloat(form.mileage_km) : null,
        fuel_amount: form.fuel_amount ? parseFloat(form.fuel_amount) : null,
        fuel_cost: form.fuel_cost ? parseFloat(form.fuel_cost) : null,
        signature_data: sig,
        customer_signature_name: form.signer_name || null,
        notes: form.notes || null,
      });

      if (isComplete) {
        await supabase.rpc("driver_update_assignment", {
          _token: token, _assignment_id: trip.id,
          _new_status: "completed", _actual_end: new Date().toISOString(),
        });
      }
    },
    onSuccess: () => { toast({ title: "Saved" }); onSaved(); },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const titles: Record<string, string> = { fuel: "Log Fuel", incident: "Report Incident", complete: "Complete Trip" };
  const icons: Record<string, any> = { fuel: Fuel, incident: AlertCircle, complete: StopCircle };
  const Icon = icons[type] || FileText;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-md max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display flex items-center gap-2">
            <Icon className="w-5 h-5 text-amber-600" /> {titles[type]}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2">
          {(type === "fuel" || type === "complete") && (
            <div className="space-y-1.5">
              <Label className="text-xs">Mileage (km)</Label>
              <Input type="number" value={form.mileage_km || ""} onChange={e => setForm({ ...form, mileage_km: e.target.value })} />
            </div>
          )}

          {type === "fuel" && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Liters</Label>
                <Input type="number" value={form.fuel_amount || ""} onChange={e => setForm({ ...form, fuel_amount: e.target.value })} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Cost</Label>
                <Input type="number" value={form.fuel_cost || ""} onChange={e => setForm({ ...form, fuel_cost: e.target.value })} />
              </div>
            </div>
          )}

          {type === "complete" && (
            <>
              <div className="space-y-1.5">
                <Label className="text-xs">Customer Signature</Label>
                <div className="rounded-lg border-2 border-dashed border-amber-300 bg-amber-50/30">
                  <canvas ref={sigRef} width={400} height={160} className="w-full h-40 touch-none rounded-lg" />
                </div>
                <div className="flex justify-between items-center">
                  <Button type="button" variant="ghost" size="sm" onClick={clearSig}>Clear</Button>
                  <span className="text-[10px] text-muted-foreground flex items-center gap-1"><Signature className="w-3 h-3" /> Sign above</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Signed by (name)</Label>
                <Input value={form.signer_name || ""} onChange={e => setForm({ ...form, signer_name: e.target.value })} placeholder="Customer full name" />
              </div>
            </>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs">Notes</Label>
            <Textarea rows={2} value={form.notes || ""} onChange={e => setForm({ ...form, notes: e.target.value })} />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button className="bg-amber-600 hover:bg-amber-700 text-white" disabled={save.isPending} onClick={() => save.mutate()}>
            {save.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
