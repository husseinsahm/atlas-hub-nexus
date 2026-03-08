import { useState, useMemo, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Calendar, Users, DollarSign, MapPin,
  Loader2, Briefcase, CheckCircle2, Clock,
  FileText, StickyNote, Pencil, Upload,
  UserCheck, Phone, Mail, Globe,
  Plus, Trash2, Download, MessageSquare,
  TrendingUp, CreditCard, Send, ChevronDown, ChevronUp,
  User, Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface Traveler {
  id: string;
  full_name: string;
  gender: string;
  date_of_birth: string;
  nationality: string;
  passport_number: string;
  passport_expiry: string;
  room_notes: string;
}

type BookingStatus = "tentative" | "confirmed" | "in_operation" | "completed" | "cancelled";

const STATUS_CONFIG: Record<BookingStatus, { label: string; color: string; bg: string; next?: BookingStatus }> = {
  tentative: { label: "Tentative", color: "text-slate-700", bg: "bg-slate-100", next: "confirmed" },
  confirmed: { label: "Confirmed", color: "text-blue-700", bg: "bg-blue-50", next: "in_operation" },
  in_operation: { label: "In Operation", color: "text-amber-700", bg: "bg-amber-50", next: "completed" },
  completed: { label: "Completed", color: "text-emerald-700", bg: "bg-emerald-50" },
  cancelled: { label: "Cancelled", color: "text-red-700", bg: "bg-red-50" },
};

const PAYMENT_STATUSES = ["unpaid", "partial", "paid", "refunded"];
const GENDERS = ["male", "female", "other"];

const emptyTraveler = (): Traveler => ({
  id: crypto.randomUUID(),
  full_name: "",
  gender: "",
  date_of_birth: "",
  nationality: "",
  passport_number: "",
  passport_expiry: "",
  room_notes: "",
});

export default function BookingDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"overview" | "services" | "timeline">("overview");
  const [commentText, setCommentText] = useState("");
  const [expandedTraveler, setExpandedTraveler] = useState<string | null>(null);
  const [showTravelerDialog, setShowTravelerDialog] = useState(false);
  const [editingTraveler, setEditingTraveler] = useState<Traveler | null>(null);

  // Fetch booking
  const { data: booking, isLoading } = useQuery({
    queryKey: ["booking", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, customers(full_name, email, phone, nationality, passport_number)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch trip days & items if linked
  const { data: tripDays = [] } = useQuery({
    queryKey: ["booking-trip-days", booking?.trip_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("trip_days")
        .select("*, trip_day_items(*)")
        .eq("trip_id", booking!.trip_id!)
        .order("day_number");
      if (error) throw error;
      return data;
    },
    enabled: !!booking?.trip_id,
  });

  // Fetch activities
  const { data: activities = [] } = useQuery({
    queryKey: ["booking-activities", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_activities")
        .select("*")
        .eq("booking_id", id!)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch profiles for user names
  const companyId = user?.activeMembership?.companyId;
  const { data: profiles = [] } = useQuery({
    queryKey: ["company-profiles-booking", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data: memberships } = await supabase
        .from("company_memberships")
        .select("user_id")
        .eq("company_id", companyId)
        .eq("is_active", true);
      if (!memberships) return [];
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", memberships.map(m => m.user_id));
      return data || [];
    },
    enabled: !!companyId,
  });

  const getProfileName = useCallback((userId: string | null) => {
    if (!userId) return "System";
    return profiles.find(p => p.id === userId)?.full_name || "Team member";
  }, [profiles]);

  // Mutations
  const updateBooking = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const { error } = await supabase.from("bookings").update(updates).eq("id", id!);
      if (error) throw error;
      // Track activity for status changes
      if (updates.status) {
        await supabase.from("booking_activities").insert({
          booking_id: id!,
          activity_type: "status_change",
          title: `Status changed to ${STATUS_CONFIG[updates.status as BookingStatus]?.label || updates.status}`,
          user_id: user?.id,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking", id] });
      queryClient.invalidateQueries({ queryKey: ["booking-activities", id] });
    },
  });

  const addComment = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("booking_activities").insert({
        booking_id: id!,
        activity_type: "comment",
        title: "Internal comment",
        description: commentText.trim(),
        user_id: user?.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-activities", id] });
      setCommentText("");
      toast({ title: "Comment added" });
    },
  });

  const advanceStatus = useCallback(() => {
    if (!booking) return;
    const next = STATUS_CONFIG[booking.status as BookingStatus]?.next;
    if (next) {
      updateBooking.mutate({ status: next });
      toast({ title: `Status updated to ${STATUS_CONFIG[next].label}` });
    }
  }, [booking, updateBooking, toast]);

  // Services summary
  const servicesSummary = useMemo(() => {
    if (!tripDays.length) return { total: 0, byCategory: {} as Record<string, number>, items: [] as any[] };
    const items: any[] = [];
    const byCategory: Record<string, number> = {};
    let total = 0;
    tripDays.forEach((day: any) => {
      (day.trip_day_items || []).forEach((item: any) => {
        items.push({ ...item, day_number: day.day_number, day_title: day.title });
        total += item.total_price || 0;
        byCategory[item.category] = (byCategory[item.category] || 0) + (item.total_price || 0);
      });
    });
    return { total, byCategory, items };
  }, [tripDays]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  if (!booking) {
    return (
      <div className="text-center py-20">
        <h2 className="text-lg font-semibold">Booking not found</h2>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/dashboard/bookings")}>
          <ArrowLeft className="w-4 h-4 mr-2" /> Back to bookings
        </Button>
      </div>
    );
  }

  const sc = STATUS_CONFIG[booking.status as BookingStatus] || STATUS_CONFIG.tentative;
  const customer = (booking as any).customers;
  const balance = (booking.selling_price || 0) - (booking.amount_paid || 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3 min-w-0">
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/bookings")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono text-muted-foreground">{booking.booking_number}</span>
              <Badge className={cn("border-0 text-[10px]", sc.bg, sc.color)}>{sc.label}</Badge>
            </div>
            <h1 className="text-xl font-bold font-display text-foreground truncate">{booking.title}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {sc.next && (
            <Button size="sm" onClick={advanceStatus} className="gold-gradient text-accent-foreground text-xs gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5" />
              {STATUS_CONFIG[sc.next].label}
            </Button>
          )}
        </div>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-4 gap-3">
        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Duration</p>
              <p className="text-sm font-bold text-foreground">{booking.total_days} days</p>
              {booking.start_date && <p className="text-[10px] text-muted-foreground">{format(new Date(booking.start_date), "MMM d")} → {booking.end_date ? format(new Date(booking.end_date), "MMM d") : "..."}</p>}
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Travelers</p>
              <p className="text-sm font-bold text-foreground">{booking.adults}A {booking.children > 0 ? `${booking.children}C` : ""}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-accent" />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Total Price</p>
              <p className="text-sm font-bold text-foreground">{Number(booking.selling_price || 0).toLocaleString()} {booking.currency}</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border">
          <CardContent className="p-4 flex items-center gap-3">
            <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center", balance > 0 ? "bg-amber-50" : "bg-emerald-50")}>
              <CreditCard className={cn("w-5 h-5", balance > 0 ? "text-amber-600" : "text-emerald-600")} />
            </div>
            <div>
              <p className="text-[10px] text-muted-foreground uppercase">Balance</p>
              <p className={cn("text-sm font-bold", balance > 0 ? "text-amber-600" : "text-emerald-600")}>
                {balance > 0 ? `${balance.toLocaleString()} ${booking.currency}` : "Paid"}
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={v => setActiveTab(v as any)}>
        <TabsList>
          <TabsTrigger value="overview" className="gap-1.5">
            <Briefcase className="w-3.5 h-3.5" /> Overview
          </TabsTrigger>
          <TabsTrigger value="services" className="gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Services
          </TabsTrigger>
          <TabsTrigger value="timeline" className="gap-1.5">
            <Clock className="w-3.5 h-3.5" /> Timeline
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {activeTab === "overview" && (
        <div className="grid grid-cols-3 gap-6">
          {/* Left col: Customer + Financial */}
          <div className="col-span-2 space-y-6">
            {/* Customer Info */}
            {customer && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold flex items-center gap-2">
                    <UserCheck className="w-4 h-4 text-accent" /> Customer Information
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label className="text-[10px] text-muted-foreground uppercase">Full Name</Label>
                      <p className="text-sm font-medium text-foreground">{customer.full_name}</p>
                    </div>
                    {customer.email && (
                      <div>
                        <Label className="text-[10px] text-muted-foreground uppercase">Email</Label>
                        <p className="text-sm text-foreground flex items-center gap-1"><Mail className="w-3 h-3" /> {customer.email}</p>
                      </div>
                    )}
                    {customer.phone && (
                      <div>
                        <Label className="text-[10px] text-muted-foreground uppercase">Phone</Label>
                        <p className="text-sm text-foreground flex items-center gap-1"><Phone className="w-3 h-3" /> {customer.phone}</p>
                      </div>
                    )}
                    {customer.nationality && (
                      <div>
                        <Label className="text-[10px] text-muted-foreground uppercase">Nationality</Label>
                        <p className="text-sm text-foreground">{customer.nationality}</p>
                      </div>
                    )}
                    {customer.passport_number && (
                      <div>
                        <Label className="text-[10px] text-muted-foreground uppercase">Passport</Label>
                        <p className="text-sm text-foreground font-mono">{customer.passport_number}</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Financial Summary */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <DollarSign className="w-4 h-4 text-accent" /> Financial Summary
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-3">
                    <div>
                      <Label className="text-[10px] text-muted-foreground uppercase">Total Cost</Label>
                      <p className="text-sm font-mono font-semibold text-foreground">{Number(booking.total_cost || 0).toLocaleString()} {booking.currency}</p>
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground uppercase">Selling Price</Label>
                      <p className="text-lg font-mono font-bold text-foreground">{Number(booking.selling_price || 0).toLocaleString()} {booking.currency}</p>
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground uppercase">Profit</Label>
                      <p className={cn("text-sm font-mono font-bold", (booking.selling_price || 0) - (booking.total_cost || 0) >= 0 ? "text-emerald-600" : "text-destructive")}>
                        {((booking.selling_price || 0) - (booking.total_cost || 0)).toLocaleString()} {booking.currency}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <Label className="text-[10px] text-muted-foreground uppercase">Amount Paid</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={booking.amount_paid || ""}
                        onChange={e => updateBooking.mutate({ amount_paid: parseFloat(e.target.value) || 0 })}
                        className="font-mono text-sm h-9"
                      />
                    </div>
                    <div>
                      <Label className="text-[10px] text-muted-foreground uppercase">Payment Status</Label>
                      <Select value={booking.payment_status} onValueChange={v => updateBooking.mutate({ payment_status: v })}>
                        <SelectTrigger className="h-9 text-sm capitalize"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {PAYMENT_STATUSES.map(s => (
                            <SelectItem key={s} value={s} className="capitalize">{s}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Travelers */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Users className="w-4 h-4 text-accent" /> Travelers
                </CardTitle>
              </CardHeader>
              <CardContent>
                {Array.isArray(booking.travelers) && (booking.travelers as any[]).length > 0 ? (
                  <div className="space-y-2">
                    {(booking.travelers as any[]).map((t: any, i: number) => (
                      <div key={i} className="flex items-center gap-3 p-2 rounded-lg bg-muted/30 border border-border">
                        <div className="w-8 h-8 rounded-full bg-accent/10 flex items-center justify-center text-xs font-bold text-accent">{i + 1}</div>
                        <div>
                          <p className="text-xs font-medium text-foreground">{t.name || `Traveler ${i + 1}`}</p>
                          {t.passport && <p className="text-[10px] text-muted-foreground font-mono">{t.passport}</p>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-muted-foreground">
                    {booking.adults} adult{booking.adults > 1 ? "s" : ""}{booking.children > 0 ? `, ${booking.children} child${booking.children > 1 ? "ren" : ""}` : ""}. No individual traveler details added yet.
                  </p>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right col: Notes */}
          <div className="space-y-6">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <StickyNote className="w-4 h-4 text-accent" /> Operations Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={booking.operations_notes || ""}
                  onChange={e => updateBooking.mutate({ operations_notes: e.target.value })}
                  placeholder="Operations notes — driver assignments, hotel confirmations, supplier contacts..."
                  rows={4}
                  className="text-xs"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="w-4 h-4 text-accent" /> Internal Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={booking.internal_notes || ""}
                  onChange={e => updateBooking.mutate({ internal_notes: e.target.value })}
                  placeholder="Internal notes..."
                  rows={4}
                  className="text-xs"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <MessageSquare className="w-4 h-4 text-accent" /> Client Notes
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={booking.client_notes || ""}
                  onChange={e => updateBooking.mutate({ client_notes: e.target.value })}
                  placeholder="Notes for the client..."
                  rows={3}
                  className="text-xs"
                />
              </CardContent>
            </Card>

            {booking.trip_id && (
              <Button variant="outline" size="sm" className="w-full text-xs" onClick={() => navigate(`/dashboard/trips/${booking.trip_id}`)}>
                <FileText className="w-3.5 h-3.5 mr-1.5" /> View Original Trip
              </Button>
            )}
          </div>
        </div>
      )}

      {activeTab === "services" && (
        <div className="space-y-4">
          {tripDays.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No linked trip services found</p>
            </div>
          ) : (
            tripDays.map((day: any) => (
              <Card key={day.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg gold-gradient flex items-center justify-center text-accent-foreground font-bold text-sm">
                      {day.day_number}
                    </div>
                    <div>
                      <CardTitle className="text-sm">{day.title || `Day ${day.day_number}`}</CardTitle>
                      {day.city && <p className="text-[10px] text-muted-foreground flex items-center gap-0.5"><MapPin className="w-2.5 h-2.5" /> {day.city}</p>}
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {(day.trip_day_items || []).length === 0 ? (
                    <p className="text-xs text-muted-foreground">No services</p>
                  ) : (
                    <div className="space-y-1.5">
                      {(day.trip_day_items as any[]).sort((a: any, b: any) => a.sort_order - b.sort_order).map((item: any) => (
                        <div key={item.id} className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border border-border">
                          <div className="flex items-center gap-2 min-w-0">
                            <Badge variant="outline" className="text-[9px] capitalize shrink-0">{item.category}</Badge>
                            <span className="text-xs font-medium text-foreground truncate">{item.custom_title}</span>
                            {item.start_time && <span className="text-[10px] text-muted-foreground font-mono shrink-0">{item.start_time}</span>}
                          </div>
                          <span className="text-xs font-mono font-semibold text-foreground shrink-0 ml-2">
                            {Number(item.total_price || 0).toLocaleString()} {item.currency}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}

          {/* Services total */}
          {servicesSummary.total > 0 && (
            <Card className="border-accent/20">
              <CardContent className="p-4 flex items-center justify-between">
                <span className="text-sm font-semibold text-foreground">Services Total</span>
                <span className="text-lg font-bold font-mono text-foreground">{servicesSummary.total.toLocaleString()} {booking.currency}</span>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {activeTab === "timeline" && (
        <div className="space-y-4">
          {/* Add comment */}
          <Card>
            <CardContent className="p-4">
              <div className="flex gap-2">
                <Textarea
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  placeholder="Add an internal comment or update..."
                  rows={2}
                  className="text-xs flex-1"
                />
                <Button
                  size="sm"
                  className="h-auto self-end"
                  disabled={!commentText.trim() || addComment.isPending}
                  onClick={() => addComment.mutate()}
                >
                  {addComment.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Send className="w-3.5 h-3.5" />}
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Activity timeline */}
          {activities.length === 0 ? (
            <div className="text-center py-12">
              <Clock className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
              <p className="text-sm text-muted-foreground">No activity yet</p>
            </div>
          ) : (
            <div className="relative ml-3">
              <div className="absolute left-3 top-2 bottom-2 w-px bg-border" />
              <div className="space-y-4">
                {activities.map((act: any, idx: number) => {
                  const typeIcons: Record<string, { icon: React.ElementType; color: string }> = {
                    status_change: { icon: CheckCircle2, color: "bg-emerald-100 text-emerald-600" },
                    comment: { icon: MessageSquare, color: "bg-blue-100 text-blue-600" },
                    created: { icon: Plus, color: "bg-accent/20 text-accent" },
                    note: { icon: StickyNote, color: "bg-muted text-muted-foreground" },
                  };
                  const cfg = typeIcons[act.activity_type] || typeIcons.note;
                  const Icon = cfg.icon;

                  return (
                    <motion.div
                      key={act.id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: idx * 0.03 }}
                      className="relative pl-8"
                    >
                      <div className={cn("absolute left-0 top-0.5 w-6 h-6 rounded-full flex items-center justify-center z-10 border-2 border-card", cfg.color)}>
                        <Icon className="w-3 h-3" />
                      </div>
                      <div className="space-y-1">
                        <p className="text-xs font-medium text-foreground">{act.title}</p>
                        {act.description && (
                          <p className="text-[10px] text-muted-foreground bg-muted/30 rounded px-2 py-1 whitespace-pre-line">{act.description}</p>
                        )}
                        <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                          <span>{format(new Date(act.created_at), "MMM d, h:mm a")}</span>
                          <span>· {getProfileName(act.user_id)}</span>
                        </div>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
