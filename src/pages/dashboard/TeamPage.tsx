import { useState, useEffect } from "react";
import { useAuth, type AppRole } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import {
  Users, UserPlus, Mail, Shield, MoreHorizontal, Search,
  CheckCircle2, XCircle, Clock, Send, Edit2, UserCog, Activity,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";

type CompanyRole = "company_admin" | "agent" | "operations" | "finance" | "viewer";

const COMPANY_ROLES: { value: CompanyRole; label: string; color: string }[] = [
  { value: "company_admin", label: "Company Admin", color: "bg-amber-100 text-amber-800 border-amber-200" },
  { value: "agent", label: "Agent", color: "bg-blue-100 text-blue-800 border-blue-200" },
  { value: "operations", label: "Operations", color: "bg-emerald-100 text-emerald-800 border-emerald-200" },
  { value: "finance", label: "Finance", color: "bg-violet-100 text-violet-800 border-violet-200" },
  { value: "viewer", label: "Viewer", color: "bg-slate-100 text-slate-600 border-slate-200" },
];

function getRoleBadge(role: string) {
  const r = COMPANY_ROLES.find((cr) => cr.value === role);
  if (!r) return <Badge variant="outline">{role}</Badge>;
  return <Badge className={`${r.color} border font-medium`}>{r.label}</Badge>;
}

interface TeamMember {
  membershipId: string;
  userId: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  role: CompanyRole;
  isActive: boolean;
  joinedAt: string;
}

interface Invitation {
  id: string;
  email: string;
  role: CompanyRole;
  createdAt: string;
  expiresAt: string;
  acceptedAt: string | null;
  invitedByName: string;
}

export default function TeamPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const companyId = user?.activeMembership?.companyId;
  const isAdmin = user?.isSuperAdmin || user?.activeMembership?.role === "company_admin";

  const [members, setMembers] = useState<TeamMember[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  // Invite dialog
  const [inviteOpen, setInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<CompanyRole>("agent");
  const [inviting, setInviting] = useState(false);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editMember, setEditMember] = useState<TeamMember | null>(null);
  const [editRole, setEditRole] = useState<CompanyRole>("agent");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (companyId) fetchTeam();
  }, [companyId]);

  async function fetchTeam() {
    if (!companyId) return;
    setLoading(true);
    try {
      // Fetch memberships with profiles
      const { data: membershipsData, error: mErr } = await supabase
        .from("company_memberships")
        .select("id, user_id, role, is_active, created_at")
        .eq("company_id", companyId);

      if (mErr) throw mErr;

      // Fetch profiles for all member user_ids
      const userIds = (membershipsData || []).map((m) => m.user_id);
      let profilesMap: Record<string, any> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from("profiles")
          .select("id, full_name, avatar_url, phone")
          .in("id", userIds);
        (profiles || []).forEach((p) => { profilesMap[p.id] = p; });
      }

      const mapped: TeamMember[] = (membershipsData || []).map((m) => ({
        membershipId: m.id,
        userId: m.user_id,
        email: "", // We'll try to show name instead
        fullName: profilesMap[m.user_id]?.full_name || "Unknown",
        avatarUrl: profilesMap[m.user_id]?.avatar_url,
        role: m.role as CompanyRole,
        isActive: m.is_active,
        joinedAt: m.created_at,
      }));

      setMembers(mapped);

      // Fetch invitations
      const { data: invData } = await supabase
        .from("invitations")
        .select("id, email, role, created_at, expires_at, accepted_at, invited_by")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });

      const invMapped: Invitation[] = (invData || []).map((inv) => ({
        id: inv.id,
        email: inv.email,
        role: inv.role as CompanyRole,
        createdAt: inv.created_at,
        expiresAt: inv.expires_at,
        acceptedAt: inv.accepted_at,
        invitedByName: "",
      }));
      setInvitations(invMapped);
    } catch (err: any) {
      console.error(err);
      toast({ title: "Error loading team", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleInvite() {
    if (!companyId || !user) return;
    setInviting(true);
    try {
      const { error } = await supabase.from("invitations").insert({
        company_id: companyId,
        email: inviteEmail.toLowerCase().trim(),
        role: inviteRole,
        invited_by: user.id,
      });
      if (error) throw error;
      toast({ title: "Invitation sent", description: `Invited ${inviteEmail} as ${inviteRole}` });
      setInviteOpen(false);
      setInviteEmail("");
      setInviteRole("agent");
      fetchTeam();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setInviting(false);
    }
  }

  async function handleUpdateRole() {
    if (!editMember) return;
    setSaving(true);
    try {
      const { error } = await supabase
        .from("company_memberships")
        .update({ role: editRole })
        .eq("id", editMember.membershipId);
      if (error) throw error;
      toast({ title: "Role updated" });
      setEditOpen(false);
      fetchTeam();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(member: TeamMember) {
    try {
      const { error } = await supabase
        .from("company_memberships")
        .update({ is_active: !member.isActive })
        .eq("id", member.membershipId);
      if (error) throw error;
      toast({ title: member.isActive ? "Member deactivated" : "Member activated" });
      fetchTeam();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  async function cancelInvitation(id: string) {
    try {
      const { error } = await supabase.from("invitations").delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Invitation cancelled" });
      fetchTeam();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  const filteredMembers = members.filter(
    (m) =>
      m.fullName.toLowerCase().includes(search.toLowerCase()) ||
      m.role.toLowerCase().includes(search.toLowerCase())
  );

  const activeCount = members.filter((m) => m.isActive).length;
  const pendingInvites = invitations.filter((i) => !i.acceptedAt && new Date(i.expiresAt) > new Date()).length;

  const stats = [
    { label: "Total Members", value: members.length, icon: Users, color: "text-primary" },
    { label: "Active", value: activeCount, icon: CheckCircle2, color: "text-emerald-600" },
    { label: "Inactive", value: members.length - activeCount, icon: XCircle, color: "text-red-500" },
    { label: "Pending Invites", value: pendingInvites, icon: Clock, color: "text-amber-600" },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-display">Team Management</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your team members, roles and invitations</p>
        </div>
        {isAdmin && (
          <Button onClick={() => setInviteOpen(true)} className="gold-gradient text-accent-foreground gap-2 shadow-md">
            <UserPlus className="w-4 h-4" /> Invite Member
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => (
          <Card key={s.label} className="border border-border bg-card">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Members Table */}
      <Card className="border border-border bg-card">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-lg font-display">Team Members</CardTitle>
              <CardDescription>All members of this company</CardDescription>
            </div>
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name or role..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="flex items-center justify-center py-16">
              <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            </div>
          ) : filteredMembers.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
              <Users className="w-10 h-10 mb-3 opacity-40" />
              <p className="text-sm">No team members found</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Member</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Joined</TableHead>
                  {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredMembers.map((m) => (
                  <TableRow key={m.membershipId}>
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-sm font-semibold text-foreground shrink-0">
                          {m.fullName.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-foreground text-sm">{m.fullName}</p>
                          <p className="text-xs text-muted-foreground">{m.userId.slice(0, 8)}...</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>{getRoleBadge(m.role)}</TableCell>
                    <TableCell>
                      {m.isActive ? (
                        <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200">Active</Badge>
                      ) : (
                        <Badge className="bg-red-50 text-red-600 border border-red-200">Inactive</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(m.joinedAt), "MMM d, yyyy")}
                    </TableCell>
                    {isAdmin && (
                      <TableCell className="text-right">
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreHorizontal className="w-4 h-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() => {
                                setEditMember(m);
                                setEditRole(m.role);
                                setEditOpen(true);
                              }}
                            >
                              <Edit2 className="w-4 h-4 mr-2" /> Change Role
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem onClick={() => toggleActive(m)}>
                              {m.isActive ? (
                                <><XCircle className="w-4 h-4 mr-2" /> Deactivate</>
                              ) : (
                                <><CheckCircle2 className="w-4 h-4 mr-2" /> Activate</>
                              )}
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Invitations */}
      <Card className="border border-border bg-card">
        <CardHeader>
          <CardTitle className="text-lg font-display flex items-center gap-2">
            <Mail className="w-5 h-5 text-accent" /> Pending Invitations
          </CardTitle>
          <CardDescription>Invitations sent to join this company</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {invitations.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Send className="w-8 h-8 mb-2 opacity-40" />
              <p className="text-sm">No invitations sent yet</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Email</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Sent</TableHead>
                  <TableHead>Expires</TableHead>
                  {isAdmin && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {invitations.map((inv) => {
                  const expired = new Date(inv.expiresAt) < new Date();
                  const accepted = !!inv.acceptedAt;
                  return (
                    <TableRow key={inv.id}>
                      <TableCell className="font-medium text-sm text-foreground">{inv.email}</TableCell>
                      <TableCell>{getRoleBadge(inv.role)}</TableCell>
                      <TableCell>
                        {accepted ? (
                          <Badge className="bg-emerald-50 text-emerald-700 border border-emerald-200">Accepted</Badge>
                        ) : expired ? (
                          <Badge className="bg-red-50 text-red-600 border border-red-200">Expired</Badge>
                        ) : (
                          <Badge className="bg-amber-50 text-amber-700 border border-amber-200">Pending</Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(inv.createdAt), "MMM d, yyyy")}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {format(new Date(inv.expiresAt), "MMM d, yyyy")}
                      </TableCell>
                      {isAdmin && (
                        <TableCell className="text-right">
                          {!accepted && !expired && (
                            <Button variant="ghost" size="sm" onClick={() => cancelInvitation(inv.id)} className="text-destructive hover:text-destructive">
                              Cancel
                            </Button>
                          )}
                        </TableCell>
                      )}
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Invite Dialog */}
      <Dialog open={inviteOpen} onOpenChange={setInviteOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Invite Team Member</DialogTitle>
            <DialogDescription>Send an invitation email to join your company</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Email Address</Label>
              <Input
                type="email"
                placeholder="colleague@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={inviteRole} onValueChange={(v) => setInviteRole(v as CompanyRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMPANY_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      <div className="flex items-center gap-2">
                        <Shield className="w-3.5 h-3.5" />
                        {r.label}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <h4 className="text-xs font-semibold text-foreground mb-1.5">Role Permissions</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {inviteRole === "company_admin" && "Full access to company settings, team management, and all modules."}
                {inviteRole === "agent" && "Can manage trips, clients, and itineraries. Cannot access billing or team settings."}
                {inviteRole === "operations" && "Can manage trip operations, logistics, and supplier coordination."}
                {inviteRole === "finance" && "Access to invoices, payments, and financial reports."}
                {inviteRole === "viewer" && "Read-only access to dashboards and reports. Cannot create or modify data."}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setInviteOpen(false)}>Cancel</Button>
            <Button
              onClick={handleInvite}
              disabled={!inviteEmail || inviting}
              className="gold-gradient text-accent-foreground gap-2"
            >
              {inviting ? "Sending..." : <><Send className="w-4 h-4" /> Send Invitation</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Role Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">Change Member Role</DialogTitle>
            <DialogDescription>
              Update the role for <span className="font-medium text-foreground">{editMember?.fullName}</span>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Current Role</Label>
              <div>{editMember && getRoleBadge(editMember.role)}</div>
            </div>
            <div className="space-y-2">
              <Label>New Role</Label>
              <Select value={editRole} onValueChange={(v) => setEditRole(v as CompanyRole)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {COMPANY_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleUpdateRole} disabled={saving}>
              {saving ? "Saving..." : "Update Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
