import { useState, useEffect, useMemo } from "react";
import { createNotification } from "@/hooks/useNotifications";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Users, UserPlus, Search, Filter, Eye, Edit2, Phone, Mail,
  MapPin, Calendar, DollarSign, TrendingUp, UserCheck, Clock,
  Trophy, XCircle, MessageSquare, Sparkles,
} from "lucide-react";
import { format } from "date-fns";

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
  nationality: "",
  travel_date: "",
  adults: 1,
  children: 0,
  destinations: "",
  budget_min: "",
  budget_max: "",
  budget_currency: "USD",
  source: "other" as LeadSource,
  status: "new" as LeadStatus,
  assigned_to: "",
  notes: "",
};

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
      nationality: lead.nationality || "",
      travel_date: lead.travel_date || "",
      adults: lead.adults,
      children: lead.children,
      destinations: lead.destinations.join(", "),
      budget_min: lead.budget_min?.toString() || "",
      budget_max: lead.budget_max?.toString() || "",
      budget_currency: lead.budget_currency,
      source: lead.source,
      status: lead.status,
      assigned_to: lead.assigned_to || "",
      notes: lead.notes || "",
    });
    setFormOpen(true);
  }

  async function handleSave() {
    if (!companyId || !user) return;
    if (!form.full_name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (form.full_name.trim().length > 200) {
      toast({ title: "Name too long", variant: "destructive" });
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
      nationality: form.nationality.trim() || null,
      travel_date: form.travel_date || null,
      adults: form.adults,
      children: form.children,
      destinations,
      budget_min: form.budget_min ? parseFloat(form.budget_min) : null,
      budget_max: form.budget_max ? parseFloat(form.budget_max) : null,
      budget_currency: form.budget_currency,
      source: form.source,
      status: form.status,
      assigned_to: form.assigned_to || null,
      notes: form.notes.trim() || null,
    };

    try {
      if (editingId) {
        const { error } = await supabase.from("leads").update(payload).eq("id", editingId);
        if (error) throw error;
        // Log activity
        await supabase.from("lead_activities").insert({
          lead_id: editingId,
          user_id: user.id,
          activity_type: "updated",
          description: "Lead details updated",
        });
        toast({ title: "Lead updated" });
      } else {
        const { data: newLead, error } = await supabase
          .from("leads")
          .insert({ ...payload, created_by: user.id })
          .select("id")
          .single();
        if (error) throw error;
        // Log activity
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

  // Stats
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
    { key: "new", label: "New", count: statusCounts.new || 0, icon: Sparkles, color: "text-blue-600" },
    { key: "contacted", label: "Contacted", count: statusCounts.contacted || 0, icon: Phone, color: "text-cyan-600" },
    { key: "planning", label: "Planning", count: statusCounts.planning || 0, icon: MapPin, color: "text-amber-600" },
    { key: "awaiting_client", label: "Awaiting", count: statusCounts.awaiting_client || 0, icon: Clock, color: "text-purple-600" },
    { key: "won", label: "Won", count: statusCounts.won || 0, icon: Trophy, color: "text-emerald-600" },
    { key: "lost", label: "Lost", count: statusCounts.lost || 0, icon: XCircle, color: "text-red-500" },
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
        {isAdminOrAgent && (
          <Button onClick={openCreate} className="gold-gradient text-accent-foreground gap-2 shadow-md">
            <UserPlus className="w-4 h-4" /> New Lead
          </Button>
        )}
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
              <s.icon className={`w-5 h-5 mx-auto mb-1 ${s.color}`} />
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

      {/* Leads Table */}
      <Card className="border border-border bg-card">
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
              <Users className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm font-medium">No leads found</p>
              <p className="text-xs mt-1">Create your first lead or adjust the filters</p>
            </div>
          ) : (
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
                  return (
                    <TableRow
                      key={lead.id}
                      className="cursor-pointer"
                      onClick={() => navigate(`/dashboard/leads/${lead.id}`)}
                    >
                      <TableCell>
                        <div>
                          <p className="font-medium text-foreground text-sm">{lead.full_name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            {lead.email && (
                              <span className="flex items-center gap-1">
                                <Mail className="w-3 h-3" /> {lead.email}
                              </span>
                            )}
                            {lead.phone && (
                              <span className="flex items-center gap-1">
                                <Phone className="w-3 h-3" /> {lead.phone}
                              </span>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={`${sc.color} border font-medium`}>{sc.label}</Badge>
                      </TableCell>
                      <TableCell className="hidden md:table-cell text-sm text-muted-foreground">
                        {lead.travel_date ? format(new Date(lead.travel_date), "MMM d, yyyy") : "—"}
                        {(lead.adults > 0 || lead.children > 0) && (
                          <span className="block text-xs">
                            {lead.adults}A{lead.children > 0 ? ` + ${lead.children}C` : ""}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {lead.budget_min || lead.budget_max ? (
                          <span>
                            {lead.budget_currency}{" "}
                            {lead.budget_min?.toLocaleString()}
                            {lead.budget_max ? ` – ${lead.budget_max.toLocaleString()}` : "+"}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                      <TableCell className="hidden md:table-cell">
                        <Badge variant="outline" className="text-xs capitalize">
                          {lead.source.replace("_", " ")}
                        </Badge>
                      </TableCell>
                      <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                        {lead.assigned_to ? agentNameMap[lead.assigned_to] || "—" : "Unassigned"}
                      </TableCell>
                      <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">
                        {format(new Date(lead.created_at), "MMM d")}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end gap-1" onClick={(e) => e.stopPropagation()}>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => navigate(`/dashboard/leads/${lead.id}`)}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>
                          {isAdminOrAgent && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => openEdit(lead)}
                            >
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
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              {editingId ? "Edit Lead" : "New Lead"}
            </DialogTitle>
            <DialogDescription>
              {editingId ? "Update lead information" : "Add a new potential customer to your pipeline"}
            </DialogDescription>
          </DialogHeader>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 py-2">
            {/* Full Name */}
            <div className="space-y-1.5">
              <Label>Full Name *</Label>
              <Input
                value={form.full_name}
                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                placeholder="John Smith"
                maxLength={200}
              />
            </div>
            {/* Email */}
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
            {/* Phone */}
            <div className="space-y-1.5">
              <Label>Phone</Label>
              <Input
                value={form.phone}
                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                placeholder="+1 555 123 4567"
                maxLength={30}
              />
            </div>
            {/* Nationality */}
            <div className="space-y-1.5">
              <Label>Nationality</Label>
              <Input
                value={form.nationality}
                onChange={(e) => setForm({ ...form, nationality: e.target.value })}
                placeholder="American"
                maxLength={100}
              />
            </div>
            {/* Travel Date */}
            <div className="space-y-1.5">
              <Label>Travel Date</Label>
              <Input
                type="date"
                value={form.travel_date}
                onChange={(e) => setForm({ ...form, travel_date: e.target.value })}
              />
            </div>
            {/* Pax */}
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
            {/* Destinations */}
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Destination Interests</Label>
              <Input
                value={form.destinations}
                onChange={(e) => setForm({ ...form, destinations: e.target.value })}
                placeholder="Paris, Rome, Barcelona"
                maxLength={500}
              />
              <p className="text-xs text-muted-foreground">Separate multiple destinations with commas</p>
            </div>
            {/* Budget */}
            <div className="space-y-1.5">
              <Label>Budget Min</Label>
              <Input
                type="number"
                min={0}
                value={form.budget_min}
                onChange={(e) => setForm({ ...form, budget_min: e.target.value })}
                placeholder="1000"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Budget Max</Label>
              <Input
                type="number"
                min={0}
                value={form.budget_max}
                onChange={(e) => setForm({ ...form, budget_max: e.target.value })}
                placeholder="5000"
              />
            </div>
            {/* Source */}
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
            {/* Status */}
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
            {/* Assigned Agent */}
            <div className="sm:col-span-2 space-y-1.5">
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
            {/* Notes */}
            <div className="sm:col-span-2 space-y-1.5">
              <Label>Notes</Label>
              <Textarea
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                placeholder="Any additional notes about this lead..."
                rows={3}
                maxLength={2000}
              />
            </div>
          </div>

          <DialogFooter>
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
