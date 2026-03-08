import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, Mail, Phone, Globe, Calendar, Users, MapPin, DollarSign,
  Clock, Trophy, XCircle, Sparkles, MessageSquare, UserCheck, Edit2,
  Send, Activity, CheckCircle2,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";

type LeadStatus = "new" | "contacted" | "planning" | "awaiting_client" | "won" | "lost";

const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; icon: React.ElementType }> = {
  new: { label: "New", color: "bg-blue-100 text-blue-800 border-blue-200", icon: Sparkles },
  contacted: { label: "Contacted", color: "bg-cyan-100 text-cyan-800 border-cyan-200", icon: Phone },
  planning: { label: "Planning", color: "bg-amber-100 text-amber-800 border-amber-200", icon: MapPin },
  awaiting_client: { label: "Awaiting Client", color: "bg-purple-100 text-purple-800 border-purple-200", icon: Clock },
  won: { label: "Won", color: "bg-emerald-100 text-emerald-800 border-emerald-200", icon: Trophy },
  lost: { label: "Lost", color: "bg-red-100 text-red-600 border-red-200", icon: XCircle },
};

const STATUS_ORDER: LeadStatus[] = ["new", "contacted", "planning", "awaiting_client", "won", "lost"];

const ACTIVITY_ICONS: Record<string, React.ElementType> = {
  created: Sparkles,
  updated: Edit2,
  status_changed: CheckCircle2,
  note_added: MessageSquare,
  assigned: UserCheck,
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

  // Quick note
  const [note, setNote] = useState("");
  const [addingNote, setAddingNote] = useState(false);

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
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      setLead({
        ...data,
        destinations: Array.isArray(data.destinations) ? data.destinations : [],
      } as LeadDetail);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      navigate("/dashboard/leads");
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

      // Get user names
      const userIds = [...new Set((data || []).map((a) => a.user_id).filter(Boolean))] as string[];
      let nameMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name")
          .in("id", userIds);
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

      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      const profileMap: Record<string, string> = {};
      (profiles || []).forEach((p) => { profileMap[p.id] = p.full_name || "Unknown"; });

      setAgents(
        (data || []).map((m) => ({
          userId: m.user_id,
          fullName: profileMap[m.user_id] || "Unknown",
          role: m.role,
        }))
      );
    } catch {}
  }

  async function updateStatus(newStatus: LeadStatus) {
    if (!lead || !user) return;
    const oldStatus = lead.status;
    try {
      const { error } = await supabase.from("leads").update({ status: newStatus }).eq("id", lead.id);
      if (error) throw error;
      await supabase.from("lead_activities").insert({
        lead_id: lead.id,
        user_id: user.id,
        activity_type: "status_changed",
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
        lead_id: lead.id,
        user_id: user.id,
        activity_type: "assigned",
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
    if (!lead || !user || !note.trim()) return;
    setAddingNote(true);
    try {
      await supabase.from("lead_activities").insert({
        lead_id: lead.id,
        user_id: user.id,
        activity_type: "note_added",
        description: note.trim(),
      });
      setNote("");
      fetchActivities();
      toast({ title: "Note added" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
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

  return (
    <div className="space-y-6">
      {/* Back + Header */}
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard/leads")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground font-display">{lead.full_name}</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Created {format(new Date(lead.created_at), "MMM d, yyyy")} · Last updated{" "}
            {formatDistanceToNow(new Date(lead.updated_at), { addSuffix: true })}
          </p>
        </div>
        <Badge className={`${sc.color} border font-medium text-sm px-3 py-1`}>{sc.label}</Badge>
      </div>

      {/* Status Pipeline */}
      {isAdminOrAgent && (
        <Card className="border border-border bg-card">
          <CardContent className="p-4">
            <p className="text-xs font-semibold text-muted-foreground mb-3 uppercase tracking-wider">Pipeline Stage</p>
            <div className="flex gap-2 flex-wrap">
              {STATUS_ORDER.map((s) => {
                const cfg = STATUS_CONFIG[s];
                const isCurrent = lead.status === s;
                return (
                  <Button
                    key={s}
                    size="sm"
                    variant={isCurrent ? "default" : "outline"}
                    className={isCurrent ? "gold-gradient text-accent-foreground" : ""}
                    onClick={() => updateStatus(s)}
                  >
                    <cfg.icon className="w-3.5 h-3.5 mr-1.5" />
                    {cfg.label}
                  </Button>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Info */}
          <Card className="border border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-display">Contact Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {lead.email && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                      <Mail className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Email</p>
                      <p className="text-sm font-medium text-foreground">{lead.email}</p>
                    </div>
                  </div>
                )}
                {lead.phone && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                      <Phone className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Phone</p>
                      <p className="text-sm font-medium text-foreground">{lead.phone}</p>
                    </div>
                  </div>
                )}
                {lead.nationality && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                      <Globe className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Nationality</p>
                      <p className="text-sm font-medium text-foreground">{lead.nationality}</p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                    <Activity className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Source</p>
                    <p className="text-sm font-medium text-foreground capitalize">{lead.source.replace("_", " ")}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Travel Details */}
          <Card className="border border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-display">Travel Details</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {lead.travel_date && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                      <Calendar className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Travel Date</p>
                      <p className="text-sm font-medium text-foreground">
                        {format(new Date(lead.travel_date), "MMM d, yyyy")}
                      </p>
                    </div>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                    <Users className="w-4 h-4 text-muted-foreground" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">Travelers</p>
                    <p className="text-sm font-medium text-foreground">
                      {lead.adults} Adult{lead.adults !== 1 ? "s" : ""}
                      {lead.children > 0 ? `, ${lead.children} Child${lead.children !== 1 ? "ren" : ""}` : ""}
                    </p>
                  </div>
                </div>
                {lead.destinations.length > 0 && (
                  <div className="sm:col-span-2 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
                      <MapPin className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Destinations</p>
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {lead.destinations.map((d, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">{String(d)}</Badge>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
                {(lead.budget_min || lead.budget_max) && (
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
                      <DollarSign className="w-4 h-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-xs text-muted-foreground">Budget</p>
                      <p className="text-sm font-medium text-foreground">
                        {lead.budget_currency}{" "}
                        {lead.budget_min?.toLocaleString() || "0"}
                        {lead.budget_max ? ` – ${lead.budget_max.toLocaleString()}` : "+"}
                      </p>
                    </div>
                  </div>
                )}
              </div>
              {lead.notes && (
                <>
                  <Separator className="my-4" />
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Notes</p>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{lead.notes}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Activity Timeline */}
          <Card className="border border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base font-display flex items-center gap-2">
                <Activity className="w-4 h-4 text-accent" /> Activity Timeline
              </CardTitle>
            </CardHeader>
            <CardContent>
              {/* Add Note */}
              {isAdminOrAgent && (
                <div className="mb-5">
                  <Textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Add a note or comment..."
                    rows={2}
                    maxLength={1000}
                    className="mb-2"
                  />
                  <Button
                    size="sm"
                    onClick={addNote}
                    disabled={!note.trim() || addingNote}
                    className="gap-1.5"
                  >
                    <Send className="w-3.5 h-3.5" />
                    {addingNote ? "Adding..." : "Add Note"}
                  </Button>
                </div>
              )}

              {activities.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">No activity yet</p>
              ) : (
                <div className="relative">
                  <div className="absolute left-4 top-0 bottom-0 w-px bg-border" />
                  <div className="space-y-4">
                    {activities.map((a) => {
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
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-4">
          {/* Assign Agent */}
          {isAdminOrAgent && (
            <Card className="border border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-display flex items-center gap-2">
                  <UserCheck className="w-4 h-4 text-accent" /> Assigned Agent
                </CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  value={lead.assigned_to || "none"}
                  onValueChange={(v) => assignAgent(v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Unassigned" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {agents.map((a) => (
                      <SelectItem key={a.userId} value={a.userId}>{a.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                {lead.email && (
                  <Button variant="outline" size="sm" className="w-full justify-start gap-2" asChild>
                    <a href={`mailto:${lead.email}`}>
                      <Mail className="w-4 h-4" /> Send Email
                    </a>
                  </Button>
                )}
                {lead.phone && (
                  <Button variant="outline" size="sm" className="w-full justify-start gap-2" asChild>
                    <a href={`tel:${lead.phone}`}>
                      <Phone className="w-4 h-4" /> Call
                    </a>
                  </Button>
                )}
                {lead.phone && (
                  <Button variant="outline" size="sm" className="w-full justify-start gap-2" asChild>
                    <a
                      href={`https://wa.me/${encodeURIComponent(lead.phone.replace(/[\s\-()]/g, ""))}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <MessageSquare className="w-4 h-4" /> WhatsApp
                    </a>
                  </Button>
                )}
              </CardContent>
            </Card>
          )}

          {/* Lead Summary */}
          <Card className="border border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-display">Summary</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
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
                <span className="text-muted-foreground">Activities</span>
                <span className="text-foreground">{activities.length}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Days Open</span>
                <span className="text-foreground">
                  {Math.floor((Date.now() - new Date(lead.created_at).getTime()) / 86400000)}
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
