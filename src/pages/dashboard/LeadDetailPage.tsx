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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import {
  ArrowLeft, Mail, Phone, Globe, Calendar, Users, MapPin, DollarSign,
  Clock, Trophy, XCircle, Sparkles, MessageSquare, UserCheck, Edit2,
  Send, Activity, CheckCircle2, Plane, Bell, AlertTriangle, Bookmark,
  FileText, ArrowRight,
} from "lucide-react";
import { format, formatDistanceToNow, addDays, isPast } from "date-fns";
import { InternalComments } from "@/components/InternalComments";
import { FileAttachments } from "@/components/FileAttachments";

type LeadStatus = "new" | "contacted" | "planning" | "awaiting_client" | "won" | "lost";

const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; dotColor: string; icon: React.ElementType }> = {
  new: { label: "New", color: "bg-blue-100 text-blue-800 border-blue-200", dotColor: "bg-blue-500", icon: Sparkles },
  contacted: { label: "Contacted", color: "bg-cyan-100 text-cyan-800 border-cyan-200", dotColor: "bg-cyan-500", icon: Phone },
  planning: { label: "Planning", color: "bg-amber-100 text-amber-800 border-amber-200", dotColor: "bg-amber-500", icon: MapPin },
  awaiting_client: { label: "Awaiting Client", color: "bg-purple-100 text-purple-800 border-purple-200", dotColor: "bg-purple-500", icon: Clock },
  won: { label: "Won", color: "bg-emerald-100 text-emerald-800 border-emerald-200", dotColor: "bg-emerald-500", icon: Trophy },
  lost: { label: "Lost", color: "bg-red-100 text-red-600 border-red-200", dotColor: "bg-red-500", icon: XCircle },
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
  full_name: string;
  email: string | null;
  phone: string | null;
  nationality: string | null;
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

  // Tabs
  const [activeTab, setActiveTab] = useState("notes");

  // Note/comment input
  const [noteText, setNoteText] = useState("");
  const [commentText, setCommentText] = useState("");
  const [addingNote, setAddingNote] = useState(false);
  const [addingComment, setAddingComment] = useState(false);

  // Follow-up
  const [followUpOpen, setFollowUpOpen] = useState(false);
  const [followUpDate, setFollowUpDate] = useState("");
  const [followUpNote, setFollowUpNote] = useState("");
  const [addingFollowUp, setAddingFollowUp] = useState(false);

  // Convert dialog
  const [convertOpen, setConvertOpen] = useState(false);
  const [converting, setConverting] = useState(false);

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
    const oldStatus = lead.status;
    try {
      const { error } = await supabase.from("leads").update({ status: newStatus }).eq("id", lead.id);
      if (error) throw error;
      await supabase.from("lead_activities").insert({
        lead_id: lead.id, user_id: user.id, activity_type: "status_changed",
        description: `Status changed from ${STATUS_CONFIG[oldStatus].label} to ${STATUS_CONFIG[newStatus].label}`,
      });
      setLead({ ...lead, status: newStatus });
      fetchActivities();
      toast({ title: "Status updated" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  async function assignAgent(agentId: string) {
    if (!lead || !user) return;
    const assignedTo = agentId === "none" ? null : agentId;
    const agentName = agents.find((a) => a.userId === agentId)?.fullName || "Unassigned";
    try {
      const { error } = await supabase.from("leads").update({ assigned_to: assignedTo }).eq("id", lead.id);
      if (error) throw error;
      await supabase.from("lead_activities").insert({
        lead_id: lead.id, user_id: user.id, activity_type: "assigned",
        description: assignedTo ? `Assigned to ${agentName}` : "Unassigned",
      });
      setLead({ ...lead, assigned_to: assignedTo });
      fetchActivities();
      toast({ title: assignedTo ? `Assigned to ${agentName}` : "Unassigned" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  async function addNote() {
    if (!lead || !user || !noteText.trim()) return;
    setAddingNote(true);
    try {
      await supabase.from("lead_activities").insert({
        lead_id: lead.id, user_id: user.id, activity_type: "note_added",
        description: noteText.trim(),
      });
      setNoteText("");
      fetchActivities();
      toast({ title: "Note added" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setAddingNote(false);
    }
  }

  async function addComment() {
    if (!lead || !user || !commentText.trim()) return;
    setAddingComment(true);
    try {
      await supabase.from("lead_activities").insert({
        lead_id: lead.id, user_id: user.id, activity_type: "comment",
        description: commentText.trim(),
        metadata: { internal: true },
      });
      setCommentText("");
      fetchActivities();
      toast({ title: "Comment added" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setAddingComment(false);
    }
  }

  async function addFollowUp() {
    if (!lead || !user || !followUpDate) return;
    setAddingFollowUp(true);
    try {
      await supabase.from("lead_activities").insert({
        lead_id: lead.id, user_id: user.id, activity_type: "follow_up",
        description: followUpNote.trim() || `Follow-up scheduled for ${format(new Date(followUpDate), "MMM d, yyyy")}`,
        metadata: { follow_up_date: followUpDate },
      });
      setFollowUpOpen(false);
      setFollowUpDate("");
      setFollowUpNote("");
      fetchActivities();
      toast({ title: "Follow-up reminder added" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setAddingFollowUp(false);
    }
  }

  async function convertToBooking() {
    if (!lead || !user || !companyId) return;
    setConverting(true);
    try {
      // Get company settings for booking number
      const { data: settings } = await supabase
        .from("company_settings")
        .select("booking_prefix, booking_next_number")
        .eq("company_id", companyId)
        .single();
      
      const prefix = settings?.booking_prefix || "BKG";
      const nextNum = settings?.booking_next_number || 1;
      const bookingNumber = `${prefix}-${String(nextNum).padStart(4, "0")}`;

      // Create customer from lead
      const { data: customer, error: custErr } = await supabase
        .from("customers")
        .insert({
          company_id: companyId,
          full_name: lead.full_name,
          email: lead.email,
          phone: lead.phone,
          nationality: lead.nationality,
          lead_id: lead.id,
          created_by: user.id,
          source: lead.source,
        })
        .select("id")
        .single();
      if (custErr) throw custErr;

      // Create booking file
      const { data: booking, error: bookErr } = await supabase
        .from("bookings")
        .insert({
          company_id: companyId,
          booking_number: bookingNumber,
          title: `${lead.full_name} - ${lead.destinations?.join(", ") || "Trip"}`,
          customer_id: customer.id,
          lead_id: lead.id,
          source: lead.source,
          arrival_date: lead.travel_date,
          adults: lead.adults,
          children: lead.children,
          internal_notes: lead.notes,
          status: "tentative",
          created_by: user.id,
          assigned_to: lead.assigned_to || user.id,
        })
        .select("id")
        .single();
      if (bookErr) throw bookErr;

      // Update booking number counter
      await supabase
        .from("company_settings")
        .update({ booking_next_number: nextNum + 1 })
        .eq("company_id", companyId);

      // Mark lead as won
      await supabase.from("leads").update({ status: "won" }).eq("id", lead.id);
      
      // Log the conversion activity
      await supabase.from("lead_activities").insert({
        lead_id: lead.id, user_id: user.id, activity_type: "converted",
        description: `Lead converted to Booking File ${bookingNumber}`,
        metadata: { converted_at: new Date().toISOString(), booking_id: booking.id },
      });

      // Create booking activity
      await supabase.from("booking_activities").insert({
        booking_id: booking.id,
        activity_type: "created",
        title: "Booking file created from lead conversion",
        user_id: user.id,
      });

      toast({
        title: "Lead converted to Booking!",
        description: `Booking file ${bookingNumber} has been created.`,
      });
      
      // Navigate to the new booking
      navigate(`/dashboard/bookings/${booking.id}`);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setConverting(false);
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
  const followUps = activities.filter((a) => a.activity_type === "follow_up");
  const overdueFollowUps = followUps.filter((f) => f.metadata?.follow_up_date && isPast(new Date(f.metadata.follow_up_date)));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" className="mt-1 shrink-0" onClick={() => navigate("/dashboard/clients")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-2xl font-bold text-foreground font-display">{lead.full_name}</h1>
              <Badge className={`${sc.color} border font-medium`}>{sc.label}</Badge>
            </div>
            <div className="flex items-center gap-4 mt-1.5 text-sm text-muted-foreground">
              {lead.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {lead.email}</span>}
              {lead.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {lead.phone}</span>}
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" /> {format(new Date(lead.created_at), "MMM d, yyyy")}
              </span>
            </div>
          </div>
        </div>

        {/* Primary CTA */}
        {isAdminOrAgent && lead.status !== "won" && lead.status !== "lost" && (
          <Button
            onClick={() => setConvertOpen(true)}
            className="gold-gradient text-accent-foreground gap-2 shadow-lg hover:shadow-xl transition-shadow shrink-0"
            size="lg"
          >
            <Plane className="w-5 h-5" />
            Convert to Booking
          </Button>
        )}
        {lead.status === "won" && (
          <Badge className="bg-emerald-100 text-emerald-800 border border-emerald-200 px-4 py-2 text-sm">
            <Trophy className="w-4 h-4 mr-1.5 inline" /> Converted
          </Badge>
        )}
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
                        ? "border-accent bg-accent/5 text-accent"
                        : isPassed
                        ? "border-emerald-400 bg-emerald-50/50 text-emerald-700"
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

      {/* Overdue Follow-ups Alert */}
      {overdueFollowUps.length > 0 && (
        <Card className="border-amber-200 bg-amber-50/50">
          <CardContent className="p-3 flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-900">
                {overdueFollowUps.length} overdue follow-up{overdueFollowUps.length > 1 ? "s" : ""}
              </p>
              <p className="text-xs text-amber-700 mt-0.5">
                {overdueFollowUps[0].description}
              </p>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column — Main Content */}
        <div className="lg:col-span-8 space-y-6">

          {/* Lead Summary Card */}
          <Card className="border border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-display flex items-center gap-2">
                <Bookmark className="w-4 h-4 text-accent" /> Lead Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Status</p>
                  <Badge className={`${sc.color} border`}>{sc.label}</Badge>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Source</p>
                  <p className="text-sm font-medium text-foreground capitalize">{lead.source.replace("_", " ")}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Days Open</p>
                  <p className="text-sm font-medium text-foreground">{daysOpen}</p>
                </div>
                <div className="space-y-1">
                  <p className="text-[11px] uppercase tracking-wider text-muted-foreground font-medium">Agent</p>
                  <p className="text-sm font-medium text-foreground">
                    {assignedAgent?.fullName || "Unassigned"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Customer Request Details */}
          <Card className="border border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-display flex items-center gap-2">
                <FileText className="w-4 h-4 text-accent" /> Customer Request
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                {/* Contact */}
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
                {lead.nationality && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0"><Globe className="w-4 h-4 text-muted-foreground" /></div>
                    <div><p className="text-[11px] text-muted-foreground uppercase tracking-wider">Nationality</p><p className="text-sm font-medium text-foreground">{lead.nationality}</p></div>
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

              {/* Destinations */}
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

              {/* Client Notes */}
              {lead.notes && (
                <div className="mt-4 pt-4 border-t border-border">
                  <p className="text-[11px] text-muted-foreground uppercase tracking-wider mb-1.5">Client Notes</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap bg-muted/50 rounded-lg p-3">{lead.notes}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Tabbed Section: Notes / Internal Comments / Follow-ups / All Activity */}
          <Card className="border border-border bg-card">
            <Tabs value={activeTab} onValueChange={setActiveTab}>
              <CardHeader className="pb-0">
                <TabsList className="w-full justify-start bg-transparent border-b border-border rounded-none p-0 h-auto">
                  <TabsTrigger value="notes" className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-sm">
                    Notes ({noteActivities.length})
                  </TabsTrigger>
                  <TabsTrigger value="comments" className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-sm">
                    Internal Comments ({commentActivities.length})
                  </TabsTrigger>
                  <TabsTrigger value="followups" className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-sm relative">
                    Follow-ups ({followUps.length})
                    {overdueFollowUps.length > 0 && (
                      <span className="absolute -top-0.5 -right-0.5 w-2 h-2 rounded-full bg-destructive" />
                    )}
                  </TabsTrigger>
                   <TabsTrigger value="attachments" className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-sm">
                    Attachments
                  </TabsTrigger>
                  <TabsTrigger value="timeline" className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-sm">
                    All Activity ({activities.length})
                  </TabsTrigger>
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

                {/* Follow-ups Tab */}
                <TabsContent value="followups" className="mt-0">
                  {isAdminOrAgent && (
                    <div className="mb-4">
                      <Button size="sm" variant="outline" onClick={() => setFollowUpOpen(true)} className="gap-1.5">
                        <Bell className="w-3.5 h-3.5" /> Schedule Follow-up
                      </Button>
                    </div>
                  )}
                  {followUps.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Bell className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-sm">No follow-ups scheduled</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {followUps.map((f) => {
                        const fDate = f.metadata?.follow_up_date;
                        const isOverdue = fDate && isPast(new Date(fDate));
                        return (
                          <div
                            key={f.id}
                            className={`flex items-start gap-3 p-3 rounded-lg border ${
                              isOverdue ? "border-destructive/30 bg-destructive/5" : "border-border bg-muted/30"
                            }`}
                          >
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${
                              isOverdue ? "bg-destructive/10" : "bg-muted"
                            }`}>
                              <Bell className={`w-4 h-4 ${isOverdue ? "text-destructive" : "text-muted-foreground"}`} />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-foreground">{f.description}</p>
                              <div className="flex items-center gap-2 mt-1">
                                {fDate && (
                                  <Badge variant={isOverdue ? "destructive" : "outline"} className="text-xs">
                                    {isOverdue ? "Overdue: " : ""}{format(new Date(fDate), "MMM d, yyyy")}
                                  </Badge>
                                )}
                                <span className="text-xs text-muted-foreground">
                                  by {f.userName} · {formatDistanceToNow(new Date(f.created_at), { addSuffix: true })}
                                </span>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
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
            <Card className="border border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-display flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-accent" /> Assigned Agent
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
            <Card className="border border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-display">Quick Actions</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {lead.status !== "won" && lead.status !== "lost" && (
                  <Button
                    size="sm"
                    className="w-full justify-start gap-2 gold-gradient text-accent-foreground"
                    onClick={() => setConvertOpen(true)}
                  >
                    <Plane className="w-4 h-4" /> Convert to Trip Draft
                  </Button>
                )}
                <Button size="sm" variant="outline" className="w-full justify-start gap-2" onClick={() => setFollowUpOpen(true)}>
                  <Bell className="w-4 h-4" /> Schedule Follow-up
                </Button>
                {lead.email && (
                  <Button variant="outline" size="sm" className="w-full justify-start gap-2" asChild>
                    <a href={`mailto:${lead.email}`}><Mail className="w-4 h-4" /> Send Email</a>
                  </Button>
                )}
                {lead.phone && (
                  <>
                    <Button variant="outline" size="sm" className="w-full justify-start gap-2" asChild>
                      <a href={`tel:${lead.phone}`}><Phone className="w-4 h-4" /> Call</a>
                    </Button>
                    <Button variant="outline" size="sm" className="w-full justify-start gap-2" asChild>
                      <a href={`https://wa.me/${encodeURIComponent(lead.phone.replace(/[\s\-()]/g, ""))}`} target="_blank" rel="noopener noreferrer">
                        <MessageSquare className="w-4 h-4" /> WhatsApp
                      </a>
                    </Button>
                  </>
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
                <span className="text-muted-foreground">Comments</span>
                <span className="text-foreground">{commentActivities.length}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Follow-ups</span>
                <span className="text-foreground">{followUps.length}</span>
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

      {/* Follow-up Dialog */}
      <Dialog open={followUpOpen} onOpenChange={setFollowUpOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Schedule Follow-up</DialogTitle>
            <DialogDescription>Set a reminder to follow up with this lead</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Follow-up Date</Label>
              <Input
                type="date"
                value={followUpDate}
                onChange={(e) => setFollowUpDate(e.target.value)}
                min={format(new Date(), "yyyy-MM-dd")}
              />
            </div>
            <div className="space-y-1.5">
              <Label>Reminder Note</Label>
              <Textarea
                value={followUpNote}
                onChange={(e) => setFollowUpNote(e.target.value)}
                placeholder="What should be done during follow-up?"
                rows={2}
                maxLength={500}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFollowUpOpen(false)}>Cancel</Button>
            <Button onClick={addFollowUp} disabled={!followUpDate || addingFollowUp}>
              {addingFollowUp ? "Scheduling..." : "Schedule"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Convert to Trip Draft Dialog */}
      <Dialog open={convertOpen} onOpenChange={setConvertOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display flex items-center gap-2">
              <Plane className="w-5 h-5 text-accent" /> Convert to Trip Draft
            </DialogTitle>
            <DialogDescription>
              This will mark <span className="font-medium text-foreground">{lead.full_name}</span> as a won lead and prepare the trip draft.
            </DialogDescription>
          </DialogHeader>
          <div className="py-3 space-y-3">
            <div className="rounded-lg border border-border p-4 bg-muted/30 space-y-2">
              <h4 className="text-sm font-semibold text-foreground">Trip Draft Summary</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div><span className="text-muted-foreground">Customer:</span> <span className="text-foreground font-medium">{lead.full_name}</span></div>
                {lead.travel_date && <div><span className="text-muted-foreground">Travel Date:</span> <span className="text-foreground font-medium">{format(new Date(lead.travel_date), "MMM d, yyyy")}</span></div>}
                <div><span className="text-muted-foreground">Travelers:</span> <span className="text-foreground font-medium">{lead.adults}A{lead.children > 0 ? ` + ${lead.children}C` : ""}</span></div>
                {lead.destinations.length > 0 && <div><span className="text-muted-foreground">Destinations:</span> <span className="text-foreground font-medium">{lead.destinations.join(", ")}</span></div>}
                {(lead.budget_min || lead.budget_max) && (
                  <div><span className="text-muted-foreground">Budget:</span> <span className="text-foreground font-medium">{lead.budget_currency} {lead.budget_min?.toLocaleString()}{lead.budget_max ? ` – ${lead.budget_max.toLocaleString()}` : "+"}</span></div>
                )}
              </div>
            </div>
            <p className="text-xs text-muted-foreground">
              The lead status will be changed to "Won" and a trip draft will be available to create in the Trips module.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConvertOpen(false)}>Cancel</Button>
            <Button onClick={convertToTripDraft} disabled={converting} className="gold-gradient text-accent-foreground gap-2">
              <Plane className="w-4 h-4" />
              {converting ? "Converting..." : "Convert & Create Draft"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
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
