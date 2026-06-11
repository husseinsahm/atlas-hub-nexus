import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format, formatDistanceToNow } from "date-fns";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import {
  Activity, MessageSquare, CreditCard, Car, Share2, CheckCircle2,
  Plus, StickyNote, Clock, User, Truck, ThumbsUp, AlertCircle,
} from "lucide-react";

interface Props {
  bookingId: string;
  companyId: string;
  isArabic?: boolean;
  getProfileName: (id: string | null) => string;
}

type EventKind = "activity" | "comment" | "payment" | "driver" | "share" | "feedback";

interface TimelineEvent {
  id: string;
  kind: EventKind;
  title: string;
  description?: string;
  created_at: string;
  actor?: string | null;
  meta?: any;
}

const KIND_CONFIG: Record<EventKind, { icon: any; color: string; label: string; labelAr: string }> = {
  activity:  { icon: Activity,      color: "bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-400",       label: "Activity",  labelAr: "نشاط" },
  comment:   { icon: MessageSquare, color: "bg-violet-100 text-violet-600 dark:bg-violet-900/40 dark:text-violet-400", label: "Comment",  labelAr: "تعليق" },
  payment:   { icon: CreditCard,    color: "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400", label: "Payment", labelAr: "دفعة" },
  driver:    { icon: Truck,         color: "bg-orange-100 text-orange-600 dark:bg-orange-900/40 dark:text-orange-400", label: "Driver",  labelAr: "سائق" },
  share:     { icon: Share2,        color: "bg-cyan-100 text-cyan-600 dark:bg-cyan-900/40 dark:text-cyan-400",         label: "Share",    labelAr: "مشاركة" },
  feedback:  { icon: ThumbsUp,      color: "bg-pink-100 text-pink-600 dark:bg-pink-900/40 dark:text-pink-400",         label: "Feedback", labelAr: "ملاحظات" },
};

export function UnifiedTimeline({ bookingId, companyId, isArabic, getProfileName }: Props) {
  const [filter, setFilter] = useState<EventKind | "all">("all");

  const { data: activities = [] } = useQuery({
    queryKey: ["unified-activities", bookingId],
    queryFn: async () => {
      const { data } = await supabase
        .from("booking_activities")
        .select("*")
        .eq("booking_id", bookingId)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!bookingId,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["unified-payments", bookingId],
    queryFn: async () => {
      const { data } = await supabase
        .from("payment_records")
        .select("*")
        .eq("booking_id", bookingId)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!bookingId,
  });

  const { data: driverLogs = [] } = useQuery({
    queryKey: ["unified-driver-logs", bookingId],
    queryFn: async () => {
      const { data: assignments } = await supabase
        .from("service_assignments")
        .select("id")
        .eq("booking_id", bookingId);
      const ids = (assignments || []).map((a: any) => a.id);
      if (ids.length === 0) return [];
      const { data } = await supabase
        .from("driver_trip_logs")
        .select("*")
        .in("assignment_id", ids)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!bookingId,
  });

  const { data: shareTokens = [] } = useQuery({
    queryKey: ["unified-share-tokens", bookingId],
    queryFn: async () => {
      const { data } = await supabase
        .from("booking_share_tokens")
        .select("*")
        .eq("booking_id", bookingId)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!bookingId,
  });

  const { data: feedback = [] } = useQuery({
    queryKey: ["unified-feedback", bookingId],
    queryFn: async () => {
      const { data } = await supabase
        .from("booking_feedback")
        .select("*")
        .eq("booking_id", bookingId)
        .order("created_at", { ascending: false });
      return data || [];
    },
    enabled: !!bookingId,
  });

  const events = useMemo<TimelineEvent[]>(() => {
    const list: TimelineEvent[] = [];

    activities.forEach((a: any) => {
      const isComment = a.activity_type === "comment";
      list.push({
        id: `a-${a.id}`,
        kind: isComment ? "comment" : "activity",
        title: a.title || a.activity_type,
        description: a.description || undefined,
        created_at: a.created_at,
        actor: a.user_id,
      });
    });

    payments.forEach((p: any) => {
      list.push({
        id: `p-${p.id}`,
        kind: "payment",
        title: `${isArabic ? "دفعة" : "Payment"}: ${Number(p.amount).toLocaleString()} ${p.currency}`,
        description: [
          p.payment_method ? `${isArabic ? "طريقة" : "Method"}: ${p.payment_method.replace("_", " ")}` : null,
          p.reference_number ? `Ref: ${p.reference_number}` : null,
          p.notes,
        ].filter(Boolean).join(" · "),
        created_at: p.created_at,
        actor: p.recorded_by,
      });
    });

    driverLogs.forEach((l: any) => {
      const typeMap: Record<string, string> = {
        check_in: isArabic ? "تسجيل وصول" : "Check-in",
        check_out: isArabic ? "تسجيل مغادرة" : "Check-out",
        fuel: isArabic ? "تزود وقود" : "Fuel stop",
        incident: isArabic ? "حادث" : "Incident",
        note: isArabic ? "ملاحظة" : "Note",
      };
      list.push({
        id: `d-${l.id}`,
        kind: "driver",
        title: typeMap[l.log_type] || l.log_type,
        description: [
          l.odometer ? `${l.odometer} km` : null,
          l.fuel_liters ? `${l.fuel_liters} L` : null,
          l.cost ? `${l.cost} ${l.currency || ""}` : null,
          l.notes,
        ].filter(Boolean).join(" · "),
        created_at: l.created_at,
        actor: null,
      });
    });

    shareTokens.forEach((t: any) => {
      list.push({
        id: `s-${t.id}`,
        kind: "share",
        title: isArabic ? "تم إنشاء رابط مشاركة" : "Share link created",
        description: t.is_active ? (isArabic ? "نشط" : "Active") : (isArabic ? "غير نشط" : "Inactive"),
        created_at: t.created_at,
        actor: t.created_by,
      });
    });

    feedback.forEach((f: any) => {
      const map: Record<string, string> = {
        approval: isArabic ? "موافقة العميل" : "Client approval",
        change_request: isArabic ? "طلب تعديل" : "Change request",
        comment: isArabic ? "تعليق عميل" : "Client comment",
      };
      list.push({
        id: `f-${f.id}`,
        kind: "feedback",
        title: map[f.feedback_type] || f.feedback_type,
        description: f.message || undefined,
        created_at: f.created_at,
        actor: null,
        meta: { isClient: true },
      });
    });

    return list.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [activities, payments, driverLogs, shareTokens, feedback, isArabic]);

  const filtered = filter === "all" ? events : events.filter(e => e.kind === filter);

  const grouped = useMemo(() => {
    const groups: Record<string, TimelineEvent[]> = {};
    filtered.forEach(e => {
      const date = format(new Date(e.created_at), "yyyy-MM-dd");
      (groups[date] ??= []).push(e);
    });
    return groups;
  }, [filtered]);

  const filterChips: Array<{ key: EventKind | "all"; label: string; count: number }> = [
    { key: "all",      label: isArabic ? "الكل" : "All",                count: events.length },
    { key: "activity", label: isArabic ? "نشاط" : "Activity",           count: events.filter(e => e.kind === "activity").length },
    { key: "comment",  label: isArabic ? "تعليقات" : "Comments",        count: events.filter(e => e.kind === "comment").length },
    { key: "payment",  label: isArabic ? "مدفوعات" : "Payments",        count: events.filter(e => e.kind === "payment").length },
    { key: "driver",   label: isArabic ? "السائق" : "Driver",           count: events.filter(e => e.kind === "driver").length },
    { key: "share",    label: isArabic ? "مشاركة" : "Share",            count: events.filter(e => e.kind === "share").length },
    { key: "feedback", label: isArabic ? "ملاحظات" : "Feedback",        count: events.filter(e => e.kind === "feedback").length },
  ];

  return (
    <div className="space-y-4">
      {/* Filter chips */}
      <div className="flex gap-1.5 flex-wrap">
        {filterChips.map(c => (
          <button
            key={c.key}
            onClick={() => setFilter(c.key)}
            className={cn(
              "px-3 py-1.5 text-[11px] font-medium rounded-full border transition-all gap-1.5 inline-flex items-center",
              filter === c.key
                ? "border-accent bg-accent/10 text-accent"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            {c.label}
            {c.count > 0 && (
              <span className={cn(
                "px-1.5 rounded-full text-[9px] font-bold",
                filter === c.key ? "bg-accent/20" : "bg-muted-foreground/15"
              )}>
                {c.count}
              </span>
            )}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="text-center py-16 rounded-xl border border-dashed border-border bg-muted/20">
          <Clock className="w-10 h-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">{isArabic ? "لا يوجد نشاط بعد" : "No activity yet"}</p>
        </div>
      ) : (
        <div className="space-y-6">
          {Object.entries(grouped).map(([date, evts]) => (
            <div key={date}>
              <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider mb-3">
                {format(new Date(date), "EEEE, MMM d, yyyy")}
              </p>
              <div className="relative ms-3">
                <div className="absolute start-3 top-2 bottom-2 w-px bg-border" />
                <div className="space-y-3">
                  {evts.map((e, idx) => {
                    const cfg = KIND_CONFIG[e.kind];
                    const Icon = cfg.icon;
                    return (
                      <motion.div
                        key={e.id}
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: idx * 0.02 }}
                        className="relative ps-8"
                      >
                        <div className={cn(
                          "absolute start-0 top-0.5 w-6 h-6 rounded-full flex items-center justify-center z-10 border-2 border-card",
                          cfg.color
                        )}>
                          <Icon className="w-3 h-3" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-baseline gap-2 flex-wrap">
                            <p className="text-xs font-semibold text-foreground">{e.title}</p>
                            <span className="text-[10px] text-muted-foreground">
                              {format(new Date(e.created_at), "HH:mm")}
                            </span>
                          </div>
                          {e.description && (
                            <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded-lg whitespace-pre-wrap">
                              {e.description}
                            </p>
                          )}
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                            <User className="w-2.5 h-2.5" />
                            {e.meta?.isClient ? (isArabic ? "العميل" : "Client") : getProfileName(e.actor || null)}
                            <span className="text-muted-foreground/60">·</span>
                            {formatDistanceToNow(new Date(e.created_at), { addSuffix: true })}
                          </p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
