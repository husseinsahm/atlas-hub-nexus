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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Users, UserPlus, Mail, Shield, MoreHorizontal, Search,
  CheckCircle2, XCircle, Clock, Send, Edit2, Trash2, Eye, EyeOff, Lock, Pencil,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { UpgradeBanner, UsageIndicator } from "@/components/plan/UpgradeBanner";
import { LimitReachedDialog } from "@/components/plan/LimitReachedDialog";

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
  phone?: string;
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

  // Create member dialog
  const [createOpen, setCreateOpen] = useState(false);
  const [createEmail, setCreateEmail] = useState("");
  const [createPassword, setCreatePassword] = useState("");
  const [createName, setCreateName] = useState("");
  const [createRole, setCreateRole] = useState<CompanyRole>("agent");
  const [creating, setCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Edit dialog
  const [editOpen, setEditOpen] = useState(false);
  const [editMember, setEditMember] = useState<TeamMember | null>(null);
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<CompanyRole>("agent");
  const [saving, setSaving] = useState(false);

  // Delete dialog
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteMember, setDeleteMember] = useState<TeamMember | null>(null);
  const [deleting, setDeleting] = useState(false);

  // Plan limits
  const { limits, refetch: refetchLimits } = usePlanLimits();
  const [limitDialogOpen, setLimitDialogOpen] = useState(false);

  const handleCreateClick = () => {
    if (!limits.canAddUser) {
      setLimitDialogOpen(true);
      return;
    }
    setCreateOpen(true);
  };

  useEffect(() => {
    if (companyId) fetchTeam();
  }, [companyId]);

  async function fetchTeam() {
    if (!companyId) return;
    setLoading(true);
    try {
      // Fetch members via edge function (includes emails from auth)
      const { data, error } = await supabase.functions.invoke("list-team-members", {
        body: { companyId },
      });

      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      const mapped: TeamMember[] = (data?.members || []).map((m: any) => ({
        membershipId: m.membershipId,
        userId: m.userId,
        email: m.email || "",
        fullName: m.fullName || "Unknown",
        avatarUrl: m.avatarUrl,
        phone: m.phone,
        role: m.role as CompanyRole,
        isActive: m.isActive,
        joinedAt: m.joinedAt,
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

  async function handleCreateMember() {
    if (!companyId || !user) return;
    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-team-member", {
        body: {
          email: createEmail.toLowerCase().trim(),
          password: createPassword,
          fullName: createName.trim(),
          role: createRole,
          companyId,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast({
        title: "Team member created ✓",
        description: `${createName} can now log in with their email and password`,
      });
      setCreateOpen(false);
      setCreateEmail("");
      setCreatePassword("");
      setCreateName("");
      setCreateRole("agent");
      setShowPassword(false);
      fetchTeam();
      refetchLimits();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  }

  function openEditDialog(m: TeamMember) {
    setEditMember(m);
    setEditName(m.fullName);
    setEditRole(m.role);
    setEditOpen(true);
  }

  async function handleEditMember() {
    if (!editMember) return;
    setSaving(true);
    try {
      // Update role in membership
      const { error: roleErr } = await supabase
        .from("company_memberships")
        .update({ role: editRole })
        .eq("id", editMember.membershipId);
      if (roleErr) throw roleErr;

      // Update name in profile
      if (editName.trim() !== editMember.fullName) {
        const { error: profileErr } = await supabase
          .from("profiles")
          .update({ full_name: editName.trim() })
          .eq("id", editMember.userId);
        if (profileErr) throw profileErr;
      }

      toast({ title: "Member updated ✓" });
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

  async function handleDeleteMember() {
    if (!deleteMember || !companyId) return;
    setDeleting(true);
    try {
      const { data, error } = await supabase.functions.invoke("delete-team-member", {
        body: {
          membershipId: deleteMember.membershipId,
          companyId,
          deleteUser: true,
        },
      });
      if (error) throw new Error(error.message);
      if (data?.error) throw new Error(data.error);

      toast({ title: "Member removed", description: `${deleteMember.fullName} has been removed from the team` });
      setDeleteOpen(false);
      setDeleteMember(null);
      fetchTeam();
      refetchLimits();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setDeleting(false);
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
      m.email.toLowerCase().includes(search.toLowerCase()) ||
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
          <h1 className="text-[22px] font-bold text-foreground font-display leading-tight">Team Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage your team members, roles and invitations
            {limits.maxUsers !== null && (
              <span className="ms-2 text-xs">
                · <UsageIndicator type="users" />
              </span>
            )}
          </p>
        </div>
        {isAdmin && (
          <Button onClick={handleCreateClick} className="gold-gradient text-accent-foreground gap-2 shadow-md">
            <UserPlus className="w-4 h-4" /> Create Member
          </Button>
        )}
      </div>

      <UpgradeBanner type="users" />

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
                placeholder="Search by name, email or role..."
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
                {filteredMembers.map((m) => {
                  const isSelf = m.userId === user?.id;
                  return (
                    <TableRow key={m.membershipId}>
                      <TableCell>
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-sm font-semibold text-foreground shrink-0">
                            {m.fullName.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <p className="font-medium text-foreground text-sm">
                              {m.fullName}
                              {isSelf && <span className="text-xs text-muted-foreground ms-1.5">(You)</span>}
                            </p>
                            <p className="text-xs text-muted-foreground">{m.email || "—"}</p>
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
                              <DropdownMenuItem onClick={() => openEditDialog(m)}>
                                <Pencil className="w-4 h-4 mr-2" /> Edit Member
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => toggleActive(m)}>
                                {m.isActive ? (
                                  <><XCircle className="w-4 h-4 mr-2" /> Deactivate</>
                                ) : (
                                  <><CheckCircle2 className="w-4 h-4 mr-2" /> Activate</>
                                )}
                              </DropdownMenuItem>
                              {!isSelf && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive focus:text-destructive"
                                    onClick={() => {
                                      setDeleteMember(m);
                                      setDeleteOpen(true);
                                    }}
                                  >
                                    <Trash2 className="w-4 h-4 mr-2" /> Delete Member
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
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

      {/* Create Member Dialog */}
      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <UserPlus className="w-5 h-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="font-display">Create Team Member</DialogTitle>
                <DialogDescription>Create a new account with login credentials</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input placeholder="e.g. Ahmed Hassan" value={createName} onChange={(e) => setCreateName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Email Address</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input type="email" placeholder="colleague@example.com" value={createEmail} onChange={(e) => setCreateEmail(e.target.value)} className="pl-9" />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder="Min 6 characters"
                  value={createPassword}
                  onChange={(e) => setCreatePassword(e.target.value)}
                  className="pl-9 pr-10"
                />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground">
                Share these credentials with the team member. They can change their password later from Settings.
              </p>
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={createRole} onValueChange={(v) => setCreateRole(v as CompanyRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COMPANY_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      <div className="flex items-center gap-2"><Shield className="w-3.5 h-3.5" />{r.label}</div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <h4 className="text-xs font-semibold text-foreground mb-1.5">Role Permissions</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {createRole === "company_admin" && "Full access to company settings, team management, and all modules."}
                {createRole === "agent" && "Can manage trips, clients, and itineraries. Cannot access billing or team settings."}
                {createRole === "operations" && "Can manage trip operations, logistics, and supplier coordination."}
                {createRole === "finance" && "Access to invoices, payments, and financial reports."}
                {createRole === "viewer" && "Read-only access to dashboards and reports. Cannot create or modify data."}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button
              onClick={handleCreateMember}
              disabled={!createEmail || !createPassword || !createName || createPassword.length < 6 || creating}
              className="gold-gradient text-accent-foreground gap-2"
            >
              {creating ? "Creating..." : <><UserPlus className="w-4 h-4" /> Create Member</>}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Member Dialog */}
      <Dialog open={editOpen} onOpenChange={setEditOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Pencil className="w-5 h-5 text-primary" />
              </div>
              <div>
                <DialogTitle className="font-display">Edit Team Member</DialogTitle>
                <DialogDescription>Update member details and role</DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <div className="space-y-4 py-2">
            {editMember && (
              <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border">
                <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-sm font-bold text-foreground">
                  {editMember.fullName.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">{editMember.email || "—"}</p>
                  <p className="text-xs text-muted-foreground">Joined {format(new Date(editMember.joinedAt), "MMM d, yyyy")}</p>
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label>Full Name</Label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label>Role</Label>
              <Select value={editRole} onValueChange={(v) => setEditRole(v as CompanyRole)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {COMPANY_ROLES.map((r) => (
                    <SelectItem key={r.value} value={r.value}>
                      <div className="flex items-center gap-2"><Shield className="w-3.5 h-3.5" />{r.label}</div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="rounded-lg bg-muted p-3">
              <h4 className="text-xs font-semibold text-foreground mb-1.5">Role Permissions</h4>
              <p className="text-xs text-muted-foreground leading-relaxed">
                {editRole === "company_admin" && "Full access to company settings, team management, and all modules."}
                {editRole === "agent" && "Can manage trips, clients, and itineraries. Cannot access billing or team settings."}
                {editRole === "operations" && "Can manage trip operations, logistics, and supplier coordination."}
                {editRole === "finance" && "Access to invoices, payments, and financial reports."}
                {editRole === "viewer" && "Read-only access to dashboards and reports. Cannot create or modify data."}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={handleEditMember} disabled={!editName.trim() || saving}>
              {saving ? "Saving..." : "Save Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Member Confirmation */}
      <AlertDialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="w-5 h-5" /> Delete Team Member
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                Are you sure you want to permanently remove{" "}
                <span className="font-semibold text-foreground">{deleteMember?.fullName}</span> from the team?
              </p>
              <p className="text-xs text-destructive/80">
                This will delete their account and all access. This action cannot be undone.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteMember}
              disabled={deleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Deleting..." : "Delete Member"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Plan limit reached dialog */}
      <LimitReachedDialog
        open={limitDialogOpen}
        onOpenChange={setLimitDialogOpen}
        type="users"
      />
    </div>
  );
}
