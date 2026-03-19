import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, Mail, Phone, Globe, Calendar, Users, MapPin, DollarSign,
  Clock, Trophy, XCircle, Sparkles, MessageSquare, UserCheck, Edit2,
  Send, Activity, CheckCircle2, Plane, Bell, AlertTriangle, Bookmark,
  FileText, ArrowRight, MessageCircle, Flame, Languages,
} from "lucide-react";
import { format, formatDistanceToNow, isPast } from "date-fns";
import { InternalComments } from "@/components/InternalComments";
import { FileAttachments } from "@/components/FileAttachments";
import ConvertToBookingModal from "@/components/leads/ConvertToBookingModal";
import { TaskTimeline } from "@/components/tasks/TaskTimeline";
import { createNotification } from "@/hooks/useNotifications";
import { getMutationErrorMessage, isNetworkMutationError, runMutationWithRetry } from "@/lib/supabaseMutation";

type LeadStatus = "new" | "contacted" | "planning" | "awaiting_client" | "won" | "lost";

const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; dotColor: string; icon: React.ElementType }> = {
  new: { label: "New", color: "bg-primary/10 text-primary border-primary/20", dotColor: "bg-primary", icon: Sparkles },
  contacted: { label: "Contacted", color: "bg-secondary/10 text-secondary border-secondary/20", dotColor: "bg-secondary", icon: Phone },
  planning: { label: "Planning", color: "bg-warning/10 text-warning border-warning/20", dotColor: "bg-warning", icon: MapPin },
  awaiting_client: { label: "Awaiting Client", color: "bg-muted text-muted-foreground border-border", dotColor: "bg-muted-foreground/50", icon: Clock },
  won: { label: "Won", color: "bg-success/10 text-success border-success/20", dotColor: "bg-success", icon: Trophy },
  lost: { label: "Lost", color: "bg-destructive/10 text-destructive border-destructive/20", dotColor: "bg-destructive", icon: XCircle },
};

const STATUS_ORDER: LeadStatus[] = ["new", "contacted", "planning", "awaiting_client", "won", "lost"];

const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  created: Sparkles,
  updated: Edit2,
  status_changed: CheckCircle2,
  note_added: MessageSquare,
  assigned: UserCheck,
  comment: MessageSquare,
  follow_up: Bell,
  converted: Plane,
};

interface LeadDetail {
  id: string;
  company_id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  nationality: string | null;
  preferred_language: string | null;
  trip_type: string | null;
  urgency: string | null;
  travel_date: string | null;
  adults: number;
  children: number;
  destinations: string[];
  budget_min: number | null;
  budget_max: number | null;
  budget_currency: string;
  source: string;
  status: LeadStatus;
  assigned_to: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface LeadActivity {
  id: string;
  activity_type: string;
  description: string;
  metadata: any;
  created_at: string;
  user_id: string | null;
  userName?: string;
}

interface AgentInfo {
  userId: string;
  fullName: string;
  role: string;
}

export default function LeadDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const companyId = user?.activeMembership?.companyId;
  const isAdminOrAgent =
    user?.isSuperAdmin ||
    user?.activeMembership?.role === "company_admin" ||
    user?.activeMembership?.role === "agent";

  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [agents, setAgents] = useState<AgentInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const [activeTab, setActiveTab] = useState("notes");
  const [noteText, setNoteText] = useState("");
  const [addingNote, setAddingNote] = useState(false);

  // Convert dialog
  const [convertOpen, setConvertOpen] = useState(false);

  useEffect(() => {
    if (id) {
      fetchLead();
      fetchActivities();
      if (companyId) fetchAgents();
    }
  }, [id, companyId]);

  async function fetchLead() {
    if (!id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.from("leads").select("*").eq("id", id).single();
      if (error) throw error;
      setLead({
        ...data,
        destinations: Array.isArray(data.destinations) ? data.destinations : [],
      } as LeadDetail);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      navigate("/dashboard/clients");
    } finally {
      setLoading(false);
    }
  }

  async function fetchActivities() {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from("lead_activities")
        .select("*")
        .eq("lead_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const userIds = [...new Set((data || []).map((a) => a.user_id).filter(Boolean))] as string[];
      let nameMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
        (profiles || []).forEach((p) => { nameMap[p.id] = p.full_name || "Unknown"; });
      }

      setActivities(
        (data || []).map((a) => ({
          ...a,
          userName: a.user_id ? nameMap[a.user_id] || "Unknown" : "System",
        }))
      );
    } catch {}
  }

  async function fetchAgents() {
    if (!companyId) return;
    try {
      const { data } = await supabase
        .from("company_memberships")
        .select("user_id, role")
        .eq("company_id", companyId)
        .eq("is_active", true)
        .in("role", ["company_admin", "agent"]);
      const userIds = (data || []).map((m) => m.user_id);
      if (userIds.length === 0) return;
      const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
      const profileMap: Record<string, string> = {};
      (profiles || []).forEach((p) => { profileMap[p.id] = p.full_name || "Unknown"; });
      setAgents((data || []).map((m) => ({ userId: m.user_id, fullName: profileMap[m.user_id] || "Unknown", role: m.role })));
    } catch {}
  }

  async function updateStatus(newStatus: LeadStatus) {
    if (!lead || !user) return;
    if (newStatus === lead.status) return;

    const leadId = lead.id;
    if (!leadId || !/^[0-9a-fA-F-]{36}$/.test(leadId)) {
      console.error("[updateStatus] Invalid leadId", { leadId, newStatus });
      toast({ title: "Invalid lead reference", variant: "destructive" });
      return;
    }

    const oldStatus = lead.status;
    const requestPayload = {
      leadId,
      companyId: lead.company_id,
      oldStatus,
      newStatus,
      userId: user.id,
    };

    const updateViaFunctionFallback = async () => {
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      console.log("SESSION", {
        hasSession: !!sessionData.session,
        hasAccessToken: !!sessionData.session?.access_token,
        expiresAt: sessionData.session?.expires_at,
        refreshError: sessionError?.message || null,
      });

      if (sessionError || !sessionData.session?.access_token) {
        throw new Error("Session expired. Please log in again.");
      }

      let lastError: unknown = null;
      for (let attempt = 1; attempt <= 3; attempt++) {
        console.log("REQUEST START", {
          table: "update-lead-status",
          operation: "update",
          payload: { leadId, status: newStatus },
          userId: user.id,
          companyId: lead.company_id,
          attempt,
          maxRetries: 3,
        });

        try {
          const { data, error } = await supabase.functions.invoke("update-lead-status", {
            body: { leadId, status: newStatus },
          });

          console.log("RESPONSE", {
            table: "update-lead-status",
            operation: "update",
            attempt,
            status: error ? "error" : "ok",
            statusText: error?.message || "ok",
            data,
            error,
          });

          if (error) throw new Error(error.message || "Fallback update failed");
          if (data?.error) throw new Error(data.error);
          return data?.data;
        } catch (err) {
          lastError = err;
          console.error("NETWORK ERROR", {
            table: "update-lead-status",
            operation: "update",
            attempt,
            rootCause: isNetworkMutationError(err) ? "possible_cors_or_preview_network" : "unknown",
            error: err,
          });
          if (!isNetworkMutationError(err) || attempt === 3) break;
          await new Promise((resolve) => setTimeout(resolve, 500 * 2 ** (attempt - 1)));
        }
      }

      throw lastError instanceof Error ? lastError : new Error("Fallback update failed");
    };

    setLead({ ...lead, status: newStatus });

    try {
      let updatedLead: any = null;

      try {
        updatedLead = await runMutationWithRetry(
          {
            table: "leads",
            operation: "update",
            payload: { status: newStatus },
            userId: user.id,
            companyId: lead.company_id,
            fallback: {
              filters: [{ column: "id", value: leadId }],
              select: "id, status, company_id, updated_at",
              single: true,
            },
          },
          async () =>
            (await supabase
              .from("leads")
              .update({ status: newStatus })
              .eq("id", leadId)
              .select("id, status, company_id, updated_at")
              .single()) as any,
        );
      } catch (directError) {
        if (!isNetworkMutationError(directError)) {
          throw directError;
        }
        updatedLead = await updateViaFunctionFallback();
      }

      await runMutationWithRetry(
        {
          table: "lead_activities",
          operation: "insert",
          payload: {
            lead_id: leadId,
            activity_type: "status_changed",
            oldStatus,
            newStatus,
          },
          userId: user.id,
          companyId: lead.company_id,
          fallback: {
            select: "id",
            single: true,
          },
        },
        async () =>
          (await supabase
            .from("lead_activities")
            .insert({
              lead_id: leadId,
              user_id: user.id,
              activity_type: "status_changed",
              description: `Status changed from ${STATUS_CONFIG[oldStatus].label} to ${STATUS_CONFIG[newStatus].label}`,
            })
            .select("id")
            .single()) as any,
      );

      console.log("[updateStatus] Final success", { requestPayload, updatedLead });
      fetchActivities();
      toast({ title: "Status updated" });
    } catch (err) {
      setLead({ ...lead, status: oldStatus });

      console.error("NETWORK ERROR", {
        table: "leads",
        operation: "update",
        rootCause: isNetworkMutationError(err) ? "possible_cors_or_preview_network" : "unknown",
        error: err,
      });

      toast({
        title: isNetworkMutationError(err) ? "Network error" : "Error updating status",
        description: getMutationErrorMessage(err),
        variant: "destructive",
      });
    }
  }

  async function assignAgent(agentId: string) {
    if (!lead || !user || !companyId) return;
    const assignedTo = agentId === "none" ? null : agentId;
    const agentName = agents.find((a) => a.userId === agentId)?.fullName || "Unassigned";
    try {
      await runMutationWithRetry(
        {
          table: "leads",
          operation: "update",
          payload: { assigned_to: assignedTo },
          userId: user.id,
          companyId,
          fallback: {
            filters: [{ column: "id", value: lead.id }],
            select: "id",
            single: true,
          },
        },
        async () =>
          (await supabase
            .from("leads")
            .update({ assigned_to: assignedTo })
            .eq("id", lead.id)
            .select("id")
            .single()) as any,
      );

      await runMutationWithRetry(
        {
          table: "lead_activities",
          operation: "insert",
          payload: { lead_id: lead.id, activity_type: "assigned", assigned_to: assignedTo },
          userId: user.id,
          companyId,
          fallback: {
            select: "id",
            single: true,
          },
        },
        async () =>
          (await supabase
            .from("lead_activities")
            .insert({
              lead_id: lead.id,
              user_id: user.id,
              activity_type: "assigned",
              description: assignedTo ? `Assigned to ${agentName}` : "Unassigned",
            })
            .select("id")
            .single()) as any,
      );

      if (assignedTo && assignedTo !== user.id) {
        await createNotification({
          userId: assignedTo,
          companyId,
          type: "lead_assigned",
          title: `📋 New lead assigned to you: ${lead.full_name}`,
          message: lead.destinations?.length
            ? `Destinations: ${lead.destinations.join(", ")} · ${lead.adults} adults${lead.children ? `, ${lead.children} children` : ""}`
            : `${lead.adults} adults${lead.children ? `, ${lead.children} children` : ""}`,
          entityType: "lead",
          entityId: lead.id,
          metadata: { assignedBy: user.profile?.fullName || "Team member", leadName: lead.full_name },
        });
      }

      setLead({ ...lead, assigned_to: assignedTo });
      fetchActivities();
      toast({ title: assignedTo ? `Assigned to ${agentName}` : "Unassigned" });
    } catch (err: unknown) {
      toast({ title: "Error", description: getMutationErrorMessage(err), variant: "destructive" });
    }
  }

  async function addNote() {
    if (!lead || !user || !noteText.trim()) return;
    setAddingNote(true);
    try {
      await runMutationWithRetry(
        {
          table: "lead_activities",
          operation: "insert",
          payload: { lead_id: lead.id, activity_type: "note_added" },
          userId: user.id,
          companyId: lead.company_id,
          fallback: {
            select: "id",
            single: true,
          },
        },
        async () =>
          (await supabase
            .from("lead_activities")
            .insert({
              lead_id: lead.id,
              user_id: user.id,
              activity_type: "note_added",
              description: noteText.trim(),
            })
            .select("id")
            .single()) as any,
      );
      setNoteText("");
      fetchActivities();
      toast({ title: "Note added" });
    } catch (err: unknown) {
      toast({ title: "Error", description: getMutationErrorMessage(err), variant: "destructive" });
    } finally {
      setAddingNote(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!lead) return null;

  const sc = STATUS_CONFIG[lead.status];
  const assignedAgent = agents.find((a) => a.userId === lead.assigned_to);
  const daysOpen = Math.floor((Date.now() - new Date(lead.created_at).getTime()) / 86400000);
  const noteActivities = activities.filter((a) => a.activity_type === "note_added");
  const commentActivities = activities.filter((a) => a.activity_type === "comment");

  return (
    <div className="space-y-6">
      {/* ─── Premium Header ─── */}
      <div className="relative -mx-6 -mt-6 px-6 pt-5 pb-5 mb-2 overflow-hidden border-b border-border bg-gradient-to-br from-card via-card to-muted/30">
        <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-primary via-secondary to-primary/40" />
        <div className="absolute -top-16 -end-16 w-48 h-48 rounded-full bg-primary/[0.03] blur-3xl pointer-events-none" />

        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <Button variant="ghost" size="icon" className="mt-1 shrink-0" onClick={() => navigate("/dashboard/clients")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="relative shrink-0 hidden sm:block">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-br from-primary/20 to-primary/40 flex items-center justify-center text-lg font-bold text-primary font-display shadow-sm border border-primary/10">
                {lead.full_name.charAt(0).toUpperCase()}
              </div>
              <div className={cn("absolute -bottom-0.5 -end-0.5 w-4 h-4 rounded-full border-2 border-card", sc.dotColor)} />
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-[22px] font-bold text-foreground font-display leading-tight">{lead.full_name}</h1>
                <Badge className={`${sc.color} border font-medium`}>{sc.label}</Badge>
              </div>
              <div className="flex items-center gap-4 mt-1.5 text-[13px] text-muted-foreground">
                {lead.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {lead.email}</span>}
                {lead.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {lead.phone}</span>}
                <span className="flex items-center gap-1">
                  <Calendar className="w-3.5 h-3.5" /> {format(new Date(lead.created_at), "MMM d, yyyy")}
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {isAdminOrAgent && lead.status !== "won" && lead.status !== "lost" && (
              <Button
                onClick={() => setConvertOpen(true)}
                className="gap-2"
                size="lg"
              >
                <Plane className="w-5 h-5" />
                Convert to Booking
              </Button>
            )}
            {lead.status === "won" && (
              <Badge className="bg-success/10 text-success border border-success/20 px-4 py-2 text-sm">
                <Trophy className="w-4 h-4 mr-1.5 inline" /> Converted
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Status Pipeline */}
      {isAdminOrAgent && (
        <Card className="border border-border bg-card overflow-hidden">
          <CardContent className="p-0">
            <div className="flex">
              {STATUS_ORDER.map((s, i) => {
                const cfg = STATUS_CONFIG[s];
                const isCurrent = lead.status === s;
                const currentIdx = STATUS_ORDER.indexOf(lead.status);
                const isPassed = i < currentIdx;
                return (
                  <button
                    key={s}
                    onClick={() => updateStatus(s)}
                    className={`flex-1 flex items-center justify-center gap-1.5 py-3 px-2 text-xs font-medium transition-all border-b-2 ${
                      isCurrent
                        ? "border-primary bg-primary/5 text-primary"
                        : isPassed
                        ? "border-success bg-success/5 text-success"
                        : "border-transparent text-muted-foreground hover:bg-muted/50"
                    }`}
                  >
                    {isPassed ? (
                      <CheckCircle2 className="w-3.5 h-3.5" />
                    ) : (
                      <cfg.icon className="w-3.5 h-3.5" />
                    )}
                    <span className="hidden sm:inline">{cfg.label}</span>
                  </button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column */}
        <div className="lg:col-span-8 space-y-6">

          {/* Lead Summary Card — Enhanced with mini stat pills */}
          <Card className="border border-border bg-card shadow-card overflow-hidden">
            <CardHeader className="pb-3 bg-muted/20 border-b border-border/50">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Bookmark className="w-3.5 h-3.5" /> Lead Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="p-5">
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
                {[
                  { label: "Status", content: <Badge className={`${sc.color} border`}>{sc.label}</Badge> },
                  { label: "Source", content: <p className="text-sm font-medium text-foreground capitalize">{lead.source.replace("_", " ")}</p> },
                  { label: "Urgency", content: (
                    <div className="flex items-center gap-1.5">
                      <span className={`w-2.5 h-2.5 rounded-full ${lead.urgency === "high" ? "bg-destructive" : lead.urgency === "low" ? "bg-success" : "bg-warning"}`} />
                      <p className="text-sm font-medium text-foreground capitalize">{lead.urgency || "Normal"}</p>
                    </div>
                  )},
                  { label: "Trip Type", content: <p className="text-sm font-medium text-foreground">{lead.trip_type || "—"}</p> },
                  { label: "Days Open", content: <p className="text-sm font-bold font-display text-foreground">{daysOpen}</p> },
                  { label: "Agent", content: <p className="text-sm font-medium text-foreground">{assignedAgent?.fullName || "Unassigned"}</p> },
                ].map((item, idx) => (
                  <div key={idx} className="space-y-1.5 p-2.5 rounded-lg bg-muted/30 border border-border/40">
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold">{item.label}</p>
                    {item.content}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          {/* Customer Request Details */}
          <Card className="border border-border bg-card shadow-card overflow-hidden">
            <CardHeader className="pb-3 bg-muted/20 border-b border-border/50">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <FileText className="w-3.5 h-3.5" /> Customer Request
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                {lead.email && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0"><Mail className="w-4 h-4 text-muted-foreground" /></div>
                    <div><p className="text-[11px] text-muted-foreground uppercase tracking-wider">Email</p><p className="text-sm font-medium text-foreground">{lead.email}</p></div>
                  </div>
                )}
                {lead.phone && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0"><Phone className="w-4 h-4 text-muted-foreground" /></div>
                    <div><p className="text-[11px] text-muted-foreground uppercase tracking-wider">Phone</p><p className="text-sm font-medium text-foreground">{lead.phone}</p></div>
                  </div>
                )}
                {lead.whatsapp && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0"><MessageCircle className="w-4 h-4 text-muted-foreground" /></div>
                    <div><p className="text-[11px] text-muted-foreground uppercase tracking-wider">WhatsApp</p><p className="text-sm font-medium text-foreground">{lead.whatsapp}</p></div>
                  </div>
                )}
                {lead.nationality && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0"><Globe className="w-4 h-4 text-muted-foreground" /></div>
                    <div><p className="text-[11px] text-muted-foreground uppercase tracking-wider">Nationality</p><p className="text-sm font-medium text-foreground">{lead.nationality}</p></div>
                  </div>
                )}
                {lead.preferred_language && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0"><Languages className="w-4 h-4 text-muted-foreground" /></div>
                    <div><p className="text-[11px] text-muted-foreground uppercase tracking-wider">Language</p><p className="text-sm font-medium text-foreground capitalize">{lead.preferred_language}</p></div>
                  </div>
                )}
                {lead.travel_date && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0"><Calendar className="w-4 h-4 text-muted-foreground" /></div>
                    <div><p className="text-[11px] text-muted-foreground uppercase tracking-wider">Travel Date</p><p className="text-sm font-medium text-foreground">{format(new Date(lead.travel_date), "MMM d, yyyy")}</p></div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0"><Users className="w-4 h-4 text-muted-foreground" /></div>
                  <div>
                    <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Travelers</p>
                    <p className="text-sm font-medium text-foreground">
                      {lead.adults} Adult{lead.adults !== 1 ? "s" : ""}
                      {lead.children > 0 ? `, ${lead.children} Child${lead.children !== 1 ? "ren" : ""}` : ""}
                    </p>
                  </div>
                </div>
                {(lead.budget_min || lead.budget_max) && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0"><DollarSign className="w-4 h-4 text-muted-foreground" /></div>
                    <div>
                      <p className="text-[11px] text-muted-foreground uppercase tracking-wider">Budget</p>
                      <p className="text-sm font-medium text-foreground">
                        {lead.budget_currency} {lead.budget_min?.toLocaleString() || "0"}
                        {lead.budget_max ? ` – ${lead.budget_max.toLocaleString()}` : "+"}
                      </p>
                    </div>
                  </div>
                )}
              </div>

              {lead.destinations.length > 0 && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-2">Destinations</p>
                  <div className="flex flex-wrap gap-1.5">
                    {lead.destinations.map((d, i) => (
                      <Badge key={i} variant="secondary" className="text-xs gap-1">
                        <MapPin className="w-3 h-3" /> {String(d)}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {lead.notes && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5">Client Notes</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap bg-muted/50 rounded-lg p-3">{lead.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tabbed Section */}
          <Card className="border border-border bg-card shadow-card overflow-hidden">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <CardHeader className="pb-0 bg-muted/20 border-b border-border/50">
                <TabsList className="w-full justify-start bg-transparent rounded-none p-0 h-auto">
                  {[
                    { value: "notes", label: `Notes (${noteActivities.length})` },
                    { value: "comments", label: "Internal Comments" },
                    { value: "followups", label: "Tasks" },
                    { value: "attachments", label: "Attachments" },
                    { value: "timeline", label: `All Activity (${activities.length})` },
                  ].map(tab => (
                    <TabsTrigger key={tab.value} value={tab.value} className="rounded-none border-b-[3px] border-transparent data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-xs font-medium">
                      {tab.label}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </CardHeader>
              <CardContent className="pt-4">
                {/* Notes Tab */}
                <TabsContent value="notes" className="mt-0">
                  {isAdminOrAgent && (
                    <div className="mb-4 p-3 rounded-lg border border-border bg-muted/30">
                      <Textarea
                        value={noteText}
                        onChange={(e) => setNoteText(e.target.value)}
                        placeholder="Add a note about this lead..."
                        rows={2}
                        maxLength={1000}
                        className="mb-2 bg-card"
                      />
                      <Button size="sm" onClick={addNote} disabled={!noteText.trim() || addingNote} className="gap-1.5">
                        <Send className="w-3.5 h-3.5" /> {addingNote ? "Adding..." : "Add Note"}
                      </Button>
                    </div>
                  )}
                  {renderActivityList(noteActivities)}
                </TabsContent>

                {/* Internal Comments Tab */}
                <TabsContent value="comments" className="mt-0">
                  <InternalComments
                    entityType="lead"
                    entityId={lead.id}
                    companyId={companyId || ""}
                  />
                </TabsContent>

                {/* Tasks Tab */}
                <TabsContent value="followups" className="mt-0">
                  <TaskTimeline
                    relatedType="lead"
                    relatedId={lead.id}
                    companyId={companyId || ""}
                    userId={user?.id || ""}
                    agents={agents}
                    isAdminOrAgent={!!isAdminOrAgent}
                  />
                </TabsContent>

                {/* Attachments Tab */}
                <TabsContent value="attachments" className="mt-0">
                  <FileAttachments
                    entityType="lead"
                    entityId={lead.id}
                    companyId={companyId || ""}
                  />
                </TabsContent>

                {/* All Activity Timeline */}
                <TabsContent value="timeline" className="mt-0">
                  {renderActivityList(activities)}
                </TabsContent>
              </CardContent>
            </Tabs>
          </Card>
        </div>

        {/* Right Sidebar */}
        <div className="lg:col-span-4 space-y-4">
          {/* Assign Agent */}
          {isAdminOrAgent && (
            <Card className="border border-border bg-card shadow-card overflow-hidden">
              <CardHeader className="pb-3 bg-muted/20 border-b border-border/50">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <UserCheck className="w-3.5 h-3.5" /> Assigned Agent
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Select value={lead.assigned_to || "none"} onValueChange={(v) => assignAgent(v)}>
                  <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {agents.map((a) => (
                      <SelectItem key={a.userId} value={a.userId}>{a.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {assignedAgent && (
                  <div className="flex items-center gap-2 mt-3 p-2 rounded-md bg-muted/50">
                    <div className="w-7 h-7 rounded-full bg-accent/10 flex items-center justify-center text-xs font-bold text-accent">
                      {assignedAgent.fullName.charAt(0)}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-foreground">{assignedAgent.fullName}</p>
                      <p className="text-[10px] text-muted-foreground capitalize">{assignedAgent.role.replace("_", " ")}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Quick Actions */}
          {isAdminOrAgent && (
            <Card className="border border-border bg-card shadow-card overflow-hidden">
              <CardHeader className="pb-3 bg-muted/20 border-b border-border/50">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {lead.status !== "won" && lead.status !== "lost" && (
                  <Button
                    size="sm"
                    className="w-full justify-start gap-2 gold-gradient text-accent-foreground"
                    onClick={() => setConvertOpen(true)}
                  >
                    <Plane className="w-4 h-4" /> Convert to Booking File
                  </Button>
                )}
                <Button size="sm" variant="outline" className="w-full justify-start gap-2" onClick={() => setActiveTab("followups")}>
                  <Bell className="w-4 h-4" /> Schedule Follow-up
                </Button>
                {lead.email && (
                  <Button variant="outline" size="sm" className="w-full justify-start gap-2" asChild>
                    <a href={`mailto:${lead.email}`}><Mail className="w-4 h-4" /> Send Email</a>
                  </Button>
                )}
                {lead.phone && (
                  <Button variant="outline" size="sm" className="w-full justify-start gap-2" asChild>
                    <a href={`tel:${lead.phone}`}><Phone className="w-4 h-4" /> Call</a>
                  </Button>
                )}
                {(lead.whatsapp || lead.phone) && (
                  <Button variant="outline" size="sm" className="w-full justify-start gap-2" asChild>
                    <a href={`https://wa.me/${encodeURIComponent((lead.whatsapp || lead.phone || "").replace(/[\s\-()]/g, ""))}`} target="_blank" rel="noopener noreferrer">
                      <MessageCircle className="w-4 h-4" /> WhatsApp
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Summary Stats */}
          <Card className="border border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-display">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between items-center">
                <span className="text-muted-foreground">Status</span>
                <Badge className={`${sc.color} border text-xs`}>{sc.label}</Badge>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Source</span>
                <span className="text-foreground capitalize">{lead.source.replace("_", " ")}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Notes</span>
                <span className="text-foreground">{noteActivities.length}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Days Open</span>
                <span className="text-foreground">{daysOpen}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Update</span>
                <span className="text-foreground text-xs">{formatDistanceToNow(new Date(lead.updated_at), { addSuffix: true })}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Convert to Booking Modal */}
      {lead && companyId && user && (
        <ConvertToBookingModal
          open={convertOpen}
          onOpenChange={setConvertOpen}
          lead={lead}
          agents={agents}
          companyId={companyId}
          userId={user.id}
        />
      )}
    </div>
  );

  function renderActivityList(items: LeadActivity[]) {
    if (items.length === 0) {
      return (
        <div className="text-center py-8 text-muted-foreground">
          <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No activity yet</p>
        </div>
      );
    }
    return (
      <div className="relative">
        <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
        <div className="space-y-4">
          {items.map((a) => {
            const Icon = ACTIVITY_ICONS[a.activity_type] || Activity;
            return (
              <div key={a.id} className="flex items-start gap-3 relative">
                <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center shrink-0 z-10 border-2 border-card">
                  <Icon className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className="text-sm text-foreground">{a.description}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {a.userName} · {formatDistanceToNow(new Date(a.created_at), { addSuffix: true })}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  }
}
