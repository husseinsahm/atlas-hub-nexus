import { useState, useEffect, useMemo } from "react";
import { createNotification } from "@/hooks/useNotifications";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Users, UserPlus, Search, Eye, Edit2, Phone, Mail,
  MapPin, Calendar, DollarSign, Clock,
  Trophy, XCircle, Sparkles, LayoutGrid, List,
  User, Globe, MessageCircle, Flame, Plane, FileText, UserCheck,
} from "lucide-react";
import { NationalitySelect } from "@/components/ui/country-select";
import { PhoneInput } from "@/components/ui/phone-input";
import { NoLeadsEmptyState, NoSearchResultsEmptyState } from "@/components/ui/empty-state";
import { TableLoadingState } from "@/components/ui/loading-state";
import { format } from "date-fns";
import LeadKanban from "@/components/leads/LeadKanban";
import LeadWizard, { type LeadFormData } from "@/components/leads/LeadWizard";

type LeadStatus = "new" | "contacted" | "planning" | "awaiting_client" | "won" | "lost";
type LeadSource = "website" | "referral" | "social_media" | "walk_in" | "phone" | "email" | "partner" | "other";

const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; icon: React.ElementType }> = {
  new: { label: "New", color: "bg-blue-100 text-blue-800 border-blue-200", icon: Sparkles },
  contacted: { label: "Contacted", color: "bg-cyan-100 text-cyan-800 border-cyan-200", icon: Phone },
  planning: { label: "Planning", color: "bg-amber-100 text-amber-800 border-amber-200", icon: MapPin },
  awaiting_client: { label: "Awaiting Client", color: "bg-purple-100 text-purple-800 border-purple-200", icon: Clock },
  won: { label: "Won", color: "bg-emerald-100 text-emerald-800 border-emerald-200", icon: Trophy },
  lost: { label: "Lost", color: "bg-red-100 text-red-600 border-red-200", icon: XCircle },
};

const SOURCE_OPTIONS: { value: LeadSource; label: string }[] = [
  { value: "website", label: "Website" },
  { value: "referral", label: "Referral" },
  { value: "social_media", label: "Social Media" },
  { value: "walk_in", label: "Walk-in" },
  { value: "phone", label: "Phone" },
  { value: "email", label: "Email" },
  { value: "partner", label: "Partner" },
  { value: "other", label: "Other" },
];

const TRIP_TYPES = [
  "Leisure", "Honeymoon", "Family", "Adventure", "Business", "Group", "Luxury", "Budget", "Pilgrimage", "Other",
];

const URGENCY_OPTIONS = [
  { value: "low", label: "Low", color: "text-green-600" },
  { value: "normal", label: "Normal", color: "text-amber-600" },
  { value: "high", label: "High", color: "text-red-600" },
];

const LANGUAGE_OPTIONS = [
  { value: "en", label: "English" },
  { value: "ar", label: "Arabic" },
  { value: "fr", label: "French" },
  { value: "es", label: "Spanish" },
  { value: "de", label: "German" },
  { value: "tr", label: "Turkish" },
  { value: "ru", label: "Russian" },
  { value: "zh", label: "Chinese" },
];

interface Lead {
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
  source: LeadSource;
  status: LeadStatus;
  assigned_to: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  preferred_language: string | null;
  trip_type: string | null;
  urgency: string | null;
  whatsapp: string | null;
}

interface TeamMember {
  userId: string;
  fullName: string;
  role: string;
}

const emptyForm = {
  full_name: "",
  email: "",
  phone: "",
  whatsapp: "",
  nationality: "",
  preferred_language: "en",
  travel_date: "",
  adults: 1,
  children: 0,
  destinations: "",
  trip_type: "",
  budget_min: "",
  budget_max: "",
  budget_currency: "USD",
  source: "other" as LeadSource,
  status: "new" as LeadStatus,
  urgency: "normal",
  assigned_to: "",
  notes: "",
};

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

function getInitialColor(name: string) {
  const colors = [
    "bg-blue-100 text-blue-700",
    "bg-emerald-100 text-emerald-700",
    "bg-amber-100 text-amber-700",
    "bg-purple-100 text-purple-700",
    "bg-rose-100 text-rose-700",
    "bg-cyan-100 text-cyan-700",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

export default function LeadsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const companyId = user?.activeMembership?.companyId;
  const isAdminOrAgent =
    user?.isSuperAdmin ||
    user?.activeMembership?.role === "company_admin" ||
    user?.activeMembership?.role === "agent";

  const [leads, setLeads] = useState<Lead[]>([]);
  const [agents, setAgents] = useState<TeamMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterSource, setFilterSource] = useState<string>("all");
  const [filterAgent, setFilterAgent] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"table" | "kanban">("table");

  // Form
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (companyId) {
      fetchLeads();
      fetchAgents();
    }
  }, [companyId]);

  async function fetchLeads() {
    if (!companyId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("leads")
        .select("*")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setLeads(
        (data || []).map((d: any) => ({
          ...d,
          destinations: Array.isArray(d.destinations) ? d.destinations : [],
        }))
      );
    } catch (err: any) {
      toast({ title: "Error loading leads", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function fetchAgents() {
    if (!companyId) return;
    try {
      const { data } = await supabase
        .from("company_memberships")
        .select("user_id, role")
        .eq("company_id", companyId)
        .eq("is_active", true);

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

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEdit(lead: Lead) {
    setEditingId(lead.id);
    setForm({
      full_name: lead.full_name,
      email: lead.email || "",
      phone: lead.phone || "",
      whatsapp: lead.whatsapp || "",
      nationality: lead.nationality || "",
      preferred_language: lead.preferred_language || "en",
      travel_date: lead.travel_date || "",
      adults: lead.adults,
      children: lead.children,
      destinations: lead.destinations.join(", "),
      trip_type: lead.trip_type || "",
      budget_min: lead.budget_min?.toString() || "",
      budget_max: lead.budget_max?.toString() || "",
      budget_currency: lead.budget_currency,
      source: lead.source,
      status: lead.status,
      urgency: lead.urgency || "normal",
      assigned_to: lead.assigned_to || "",
      notes: lead.notes || "",
    });
    setFormOpen(true);
  }

  async function handleMoveStatus(leadId: string, newStatus: LeadStatus) {
    try {
      const { error } = await supabase.from("leads").update({ status: newStatus }).eq("id", leadId);
      if (error) throw error;
      setLeads(prev => prev.map(l => l.id === leadId ? { ...l, status: newStatus } : l));
      toast({ title: `Lead moved to ${STATUS_CONFIG[newStatus].label}` });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  async function handleSave() {
    if (!companyId || !user) return;
    if (!form.full_name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      toast({ title: "Invalid email", variant: "destructive" });
      return;
    }

    setSaving(true);
    const destinations = form.destinations
      .split(",")
      .map((d) => d.trim())
      .filter(Boolean);

    const payload = {
      company_id: companyId,
      full_name: form.full_name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      whatsapp: form.whatsapp.trim() || null,
      nationality: form.nationality.trim() || null,
      preferred_language: form.preferred_language || "en",
      travel_date: form.travel_date || null,
      adults: form.adults,
      children: form.children,
      destinations,
      trip_type: form.trip_type || null,
      budget_min: form.budget_min ? parseFloat(form.budget_min) : null,
      budget_max: form.budget_max ? parseFloat(form.budget_max) : null,
      budget_currency: form.budget_currency,
      source: form.source,
      status: form.status,
      urgency: form.urgency || "normal",
      assigned_to: form.assigned_to || null,
      notes: form.notes.trim() || null,
    };

    try {
      if (editingId) {
        const { error } = await supabase.from("leads").update(payload).eq("id", editingId);
        if (error) throw error;
        await supabase.from("lead_activities").insert({
          lead_id: editingId,
          user_id: user.id,
          activity_type: "updated",
          description: "Lead details updated",
        });
        toast({ title: "Lead updated" });
        if (payload.assigned_to && payload.assigned_to !== user.id) {
          createNotification({
            userId: payload.assigned_to,
            companyId: companyId,
            type: "lead_assigned",
            title: "New lead assigned to you",
            message: `Lead "${payload.full_name}" has been assigned to you.`,
            entityType: "lead",
            entityId: editingId,
          });
        }
      } else {
        const { data: newLead, error } = await supabase
          .from("leads")
          .insert({ ...payload, created_by: user.id })
          .select("id")
          .single();
        if (error) throw error;
        if (newLead) {
          await supabase.from("lead_activities").insert({
            lead_id: newLead.id,
            user_id: user.id,
            activity_type: "created",
            description: "Lead created",
          });
        }
        toast({ title: "Lead created" });
      }
      setFormOpen(false);
      fetchLeads();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const filtered = useMemo(() => {
    return leads.filter((l) => {
      if (filterStatus !== "all" && l.status !== filterStatus) return false;
      if (filterSource !== "all" && l.source !== filterSource) return false;
      if (filterAgent !== "all" && l.assigned_to !== filterAgent) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          l.full_name.toLowerCase().includes(q) ||
          (l.email && l.email.toLowerCase().includes(q)) ||
          (l.phone && l.phone.includes(q))
        );
      }
      return true;
    });
  }, [leads, filterStatus, filterSource, filterAgent, search]);

  const statusCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    leads.forEach((l) => { counts[l.status] = (counts[l.status] || 0) + 1; });
    return counts;
  }, [leads]);

  const agentNameMap = useMemo(() => {
    const m: Record<string, string> = {};
    agents.forEach((a) => { m[a.userId] = a.fullName; });
    return m;
  }, [agents]);

  const pipelineStats = [
    { key: "new", label: "New", count: statusCounts.new || 0, icon: Sparkles, color: "text-blue-600", bg: "bg-blue-50" },
    { key: "contacted", label: "Contacted", count: statusCounts.contacted || 0, icon: Phone, color: "text-cyan-600", bg: "bg-cyan-50" },
    { key: "planning", label: "Planning", count: statusCounts.planning || 0, icon: MapPin, color: "text-amber-600", bg: "bg-amber-50" },
    { key: "awaiting_client", label: "Awaiting", count: statusCounts.awaiting_client || 0, icon: Clock, color: "text-purple-600", bg: "bg-purple-50" },
    { key: "won", label: "Won", count: statusCounts.won || 0, icon: Trophy, color: "text-emerald-600", bg: "bg-emerald-50" },
    { key: "lost", label: "Lost", count: statusCounts.lost || 0, icon: XCircle, color: "text-red-500", bg: "bg-red-50" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-display">Leads</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage potential customers and track your sales pipeline
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center border border-border rounded-lg overflow-hidden">
            <button
              onClick={() => setViewMode("table")}
              className={`p-2 transition-colors ${viewMode === "table" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"}`}
              title="Table view"
            >
              <List className="w-4 h-4" />
            </button>
            <button
              onClick={() => setViewMode("kanban")}
              className={`p-2 transition-colors ${viewMode === "kanban" ? "bg-accent text-accent-foreground" : "text-muted-foreground hover:bg-muted"}`}
              title="Kanban view"
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
          </div>
          {isAdminOrAgent && (
            <Button onClick={openCreate} className="gold-gradient text-accent-foreground gap-2 shadow-md">
              <UserPlus className="w-4 h-4" /> New Lead
            </Button>
          )}
        </div>
      </div>

      {/* Pipeline Stats */}
      <div className="grid grid-cols-3 lg:grid-cols-6 gap-3">
        {pipelineStats.map((s) => (
          <Card
            key={s.key}
            className={`border cursor-pointer transition-all hover:shadow-md ${filterStatus === s.key ? "ring-2 ring-accent border-accent" : "border-border"}`}
            onClick={() => setFilterStatus(filterStatus === s.key ? "all" : s.key)}
          >
            <CardContent className="p-3 text-center">
              <div className={`w-8 h-8 rounded-full ${s.bg} flex items-center justify-center mx-auto mb-1.5`}>
                <s.icon className={`w-4 h-4 ${s.color}`} />
              </div>
              <p className="text-xl font-bold text-foreground">{s.count}</p>
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{s.label}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="border border-border bg-card">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email or phone..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterSource} onValueChange={setFilterSource}>
              <SelectTrigger className="w-full sm:w-40">
                <SelectValue placeholder="Source" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Sources</SelectItem>
                {SOURCE_OPTIONS.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterAgent} onValueChange={setFilterAgent}>
              <SelectTrigger className="w-full sm:w-44">
                <SelectValue placeholder="Agent" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Agents</SelectItem>
                {agents
                  .filter((a) => ["company_admin", "agent"].includes(a.role))
                  .map((a) => (
                    <SelectItem key={a.userId} value={a.userId}>{a.fullName}</SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Content */}
      {loading ? (
        <Card className="border border-border bg-card">
          <CardContent className="p-0">
            <TableLoadingState rows={5} columns={7} />
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="border border-border bg-card">
          <CardContent className="p-8">
            {search.trim() ? (
              <NoSearchResultsEmptyState query={search} onClear={() => setSearch("")} />
            ) : (
              <NoLeadsEmptyState onAction={isAdminOrAgent ? openCreate : undefined} />
            )}
          </CardContent>
        </Card>
      ) : viewMode === "kanban" ? (
        <LeadKanban
          leads={filtered}
          agentNameMap={agentNameMap}
          onView={(id) => navigate(`/dashboard/leads/${id}`)}
          onEdit={openEdit}
          onMoveStatus={handleMoveStatus}
        />
      ) : (
        /* Enhanced Table View */
        <Card className="border border-border bg-card">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Lead</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="hidden md:table-cell">Travel</TableHead>
                  <TableHead className="hidden lg:table-cell">Budget</TableHead>
                  <TableHead className="hidden md:table-cell">Source</TableHead>
                  <TableHead className="hidden lg:table-cell">Agent</TableHead>
                  <TableHead className="hidden xl:table-cell">Created</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((lead) => {
                  const sc = STATUS_CONFIG[lead.status];
                  const urgencyDot = lead.urgency === "high" ? "bg-red-500" : lead.urgency === "low" ? "bg-green-400" : "";
                  return (
                    <TableRow
                      key={lead.id}
                      className="cursor-pointer group"
                      onClick={() => navigate(`/dashboard/leads/${lead.id}`)}
                    >
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${getInitialColor(lead.full_name)}`}>
                            {getInitials(lead.full_name)}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <p className="font-medium text-foreground text-sm truncate">{lead.full_name}</p>
                              {urgencyDot && <div className={`w-2 h-2 rounded-full flex-shrink-0 ${urgencyDot}`} />}
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                              {lead.email && (
                                <span className="flex items-center gap-1 truncate">
                                  <Mail className="w-3 h-3 flex-shrink-0" /> {lead.email}
                                </span>
                              )}
                              {lead.phone && !lead.email && (
                                <span className="flex items-center gap-1">
                                  <Phone className="w-3 h-3 flex-shrink-0" /> {lead.phone}
                                </span>
                              )}
                            </div>
                            {lead.destinations.length > 0 && (
                              <div className="flex items-center gap-1 mt-1">
                                {lead.destinations.slice(0, 2).map((d, i) => (
                                  <span key={i} className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">{d}</span>
                                ))}
                                {lead.destinations.length > 2 && (
                                  <span className="text-[10px] text-muted-foreground">+{lead.destinations.length - 2}</span>
                                )}
                              </div>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${sc.color} border font-medium text-xs`}>
                          <sc.icon className="w-3 h-3 mr-1" />
                          {sc.label}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {lead.travel_date ? (
                          <div>
                            <span className="flex items-center gap-1">
                              <Calendar className="w-3 h-3" />
                              {format(new Date(lead.travel_date), "MMM d, yyyy")}
                            </span>
                            <span className="text-xs flex items-center gap-1 mt-0.5">
                              <Users className="w-3 h-3" />
                              {lead.adults}A{lead.children > 0 ? ` + ${lead.children}C` : ""}
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs">
                            <Users className="w-3 h-3 inline mr-1" />
                            {lead.adults}A{lead.children > 0 ? ` + ${lead.children}C` : ""}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {lead.budget_min || lead.budget_max ? (
                          <span className="flex items-center gap-1">
                            <DollarSign className="w-3 h-3" />
                            {lead.budget_currency} {lead.budget_min?.toLocaleString()}
                            {lead.budget_max ? ` – ${lead.budget_max.toLocaleString()}` : "+"}
                          </span>
                        ) : "—"}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="outline" className="text-xs capitalize">{lead.source.replace("_", " ")}</Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {lead.assigned_to ? (
                          <span className="flex items-center gap-1.5">
                            <div className="w-5 h-5 rounded-full bg-muted flex items-center justify-center">
                              <UserCheck className="w-3 h-3" />
                            </div>
                            {agentNameMap[lead.assigned_to] || "—"}
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground/60">Unassigned</span>
                        )}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">
                        {format(new Date(lead.created_at), "MMM d")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/dashboard/leads/${lead.id}`)}>
                            <Eye className="w-4 h-4" />
                          </Button>
                          {isAdminOrAgent && (
                            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(lead)}>
                              <Edit2 className="w-4 h-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog — Sectioned Layout */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-accent/10 flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-accent-foreground" />
              </div>
              <div>
                <DialogTitle className="font-display">
                  {editingId ? "Edit Lead" : "New Lead"}
                </DialogTitle>
                <DialogDescription>
                  {editingId ? "Update lead information" : "Add a new potential customer to your pipeline"}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

          {/* Section: Personal Information */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <User className="w-4 h-4 text-muted-foreground" />
              Personal Information
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-6">
              <div className="space-y-1.5">
                <Label>Full Name *</Label>
                <Input
                  value={form.full_name}
                  onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                  placeholder="John Smith"
                  maxLength={200}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Nationality</Label>
                <NationalitySelect
                  value={form.nationality}
                  onValueChange={(v) => setForm({ ...form, nationality: v })}
                  placeholder="Select nationality"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Preferred Language</Label>
                <Select value={form.preferred_language} onValueChange={(v) => setForm({ ...form, preferred_language: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {LANGUAGE_OPTIONS.map(l => (
                      <SelectItem key={l.value} value={l.value}>{l.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Section: Contact Details */}
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground pt-2">
              <Phone className="w-4 h-4 text-muted-foreground" />
              Contact Details
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-6">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input
                  type="email"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  placeholder="john@example.com"
                  maxLength={255}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Phone</Label>
                <PhoneInput
                  value={form.phone}
                  onValueChange={(v) => setForm({ ...form, phone: v })}
                  defaultCountry="AE"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="flex items-center gap-1.5">
                  <MessageCircle className="w-3.5 h-3.5" /> WhatsApp
                </Label>
                <PhoneInput
                  value={form.whatsapp}
                  onValueChange={(v) => setForm({ ...form, whatsapp: v })}
                  defaultCountry="AE"
                />
              </div>
            </div>

            {/* Section: Travel Details */}
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground pt-2">
              <Plane className="w-4 h-4 text-muted-foreground" />
              Travel Details
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-6">
              <div className="space-y-1.5">
                <Label>Travel Date</Label>
                <Input
                  type="date"
                  value={form.travel_date}
                  onChange={(e) => setForm({ ...form, travel_date: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Trip Type</Label>
                <Select value={form.trip_type || "none"} onValueChange={(v) => setForm({ ...form, trip_type: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Select type" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Not specified</SelectItem>
                    {TRIP_TYPES.map(t => (
                      <SelectItem key={t} value={t}>{t}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>Adults</Label>
                  <Input
                    type="number"
                    min={1}
                    max={50}
                    value={form.adults}
                    onChange={(e) => setForm({ ...form, adults: parseInt(e.target.value) || 1 })}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Children</Label>
                  <Input
                    type="number"
                    min={0}
                    max={50}
                    value={form.children}
                    onChange={(e) => setForm({ ...form, children: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label>Destination Interests</Label>
                <Input
                  value={form.destinations}
                  onChange={(e) => setForm({ ...form, destinations: e.target.value })}
                  placeholder="Paris, Rome, Barcelona"
                  maxLength={500}
                />
                <p className="text-xs text-muted-foreground">Separate with commas</p>
              </div>
            </div>

            {/* Section: Budget */}
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground pt-2">
              <DollarSign className="w-4 h-4 text-muted-foreground" />
              Budget
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pl-6">
              <div className="space-y-1.5">
                <Label>Currency</Label>
                <Select value={form.budget_currency} onValueChange={(v) => setForm({ ...form, budget_currency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["USD", "EUR", "GBP", "SAR", "AED", "EGP"].map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Min</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.budget_min}
                  onChange={(e) => setForm({ ...form, budget_min: e.target.value })}
                  placeholder="1000"
                />
              </div>
              <div className="space-y-1.5">
                <Label>Max</Label>
                <Input
                  type="number"
                  min={0}
                  value={form.budget_max}
                  onChange={(e) => setForm({ ...form, budget_max: e.target.value })}
                  placeholder="5000"
                />
              </div>
            </div>

            {/* Section: Pipeline & Assignment */}
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground pt-2">
              <Flame className="w-4 h-4 text-muted-foreground" />
              Pipeline & Assignment
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pl-6">
              <div className="space-y-1.5">
                <Label>Source</Label>
                <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v as LeadSource })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {SOURCE_OPTIONS.map((s) => (
                      <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as LeadStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Urgency</Label>
                <Select value={form.urgency} onValueChange={(v) => setForm({ ...form, urgency: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {URGENCY_OPTIONS.map(u => (
                      <SelectItem key={u.value} value={u.value}>
                        <span className={u.color}>{u.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Assigned Agent</Label>
                <Select value={form.assigned_to || "none"} onValueChange={(v) => setForm({ ...form, assigned_to: v === "none" ? "" : v })}>
                  <SelectTrigger><SelectValue placeholder="Unassigned" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Unassigned</SelectItem>
                    {agents
                      .filter((a) => ["company_admin", "agent"].includes(a.role))
                      .map((a) => (
                        <SelectItem key={a.userId} value={a.userId}>{a.fullName}</SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Section: Notes */}
            <div className="flex items-center gap-2 text-sm font-semibold text-foreground pt-2">
              <FileText className="w-4 h-4 text-muted-foreground" />
              Notes
            </div>
            <div className="pl-6">
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Any additional notes about this lead..."
                rows={3}
                maxLength={2000}
              />
            </div>
          </div>

          <DialogFooter className="pt-4">
            <Button variant="outline" onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={saving} className="gold-gradient text-accent-foreground">
              {saving ? "Saving..." : editingId ? "Update Lead" : "Create Lead"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
