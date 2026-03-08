import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { ModalDarkHeader } from "@/components/ui/modal-dark-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Bell, Phone, MessageCircle, Mail, Users as UsersIcon, CheckSquare, Clock,
  Calendar, AlertTriangle, CheckCircle2, Trash2, Edit2, RotateCcw,
  Flame, ArrowRight, Loader2, Plus,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, formatDistanceToNow, isPast, addDays, addWeeks, isToday, isTomorrow } from "date-fns";

const FOLLOWUP_TYPES = [
  { value: "call", label: "Call", icon: Phone, color: "text-blue-600 bg-blue-50" },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle, color: "text-emerald-600 bg-emerald-50" },
  { value: "email", label: "Email", icon: Mail, color: "text-purple-600 bg-purple-50" },
  { value: "meeting", label: "Meeting", icon: UsersIcon, color: "text-amber-600 bg-amber-50" },
  { value: "task", label: "Task", icon: CheckSquare, color: "text-cyan-600 bg-cyan-50" },
  { value: "reminder", label: "Reminder", icon: Bell, color: "text-rose-600 bg-rose-50" },
] as const;

const PRIORITY_OPTIONS = [
  { value: "low", label: "Low", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { value: "normal", label: "Normal", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "high", label: "High", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "urgent", label: "Urgent", color: "bg-red-100 text-red-700 border-red-200" },
];

interface FollowUp {
  id: string;
  followup_type: string;
  scheduled_date: string;
  scheduled_time: string | null;
  priority: string;
  assigned_to: string | null;
  description: string | null;
  expected_outcome: string | null;
  is_completed: boolean;
  completed_at: string | null;
  is_recurring: boolean;
  recurrence_pattern: string | null;
  created_at: string;
}

interface AgentInfo {
  userId: string;
  fullName: string;
  role: string;
}

interface FollowUpManagerProps {
  leadId: string;
  companyId: string;
  userId: string;
  agents: AgentInfo[];
  isAdminOrAgent: boolean;
}

export function FollowUpTimeline({ leadId, companyId, userId, agents, isAdminOrAgent }: FollowUpManagerProps) {
  const { toast } = useToast();
  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // Form state
  const [fType, setFType] = useState("call");
  const [fDate, setFDate] = useState("");
  const [fTime, setFTime] = useState("");
  const [fPriority, setFPriority] = useState("normal");
  const [fAssignedTo, setFAssignedTo] = useState(userId);
  const [fDescription, setFDescription] = useState("");
  const [fOutcome, setFOutcome] = useState("");
  const [saving, setSaving] = useState(false);

  const agentMap: Record<string, string> = {};
  agents.forEach(a => { agentMap[a.userId] = a.fullName; });

  useEffect(() => {
    fetchFollowUps();
  }, [leadId]);

  async function fetchFollowUps() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("lead_followups")
        .select("*")
        .eq("lead_id", leadId)
        .order("scheduled_date", { ascending: true });
      if (error) throw error;
      setFollowUps((data || []) as FollowUp[]);
    } catch {
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setEditingId(null);
    setFType("call");
    setFDate(format(new Date(), "yyyy-MM-dd"));
    setFTime("");
    setFPriority("normal");
    setFAssignedTo(userId);
    setFDescription("");
    setFOutcome("");
  }

  function openCreate() {
    resetForm();
    setFDate(format(new Date(), "yyyy-MM-dd"));
    setDialogOpen(true);
  }

  function openEdit(f: FollowUp) {
    setEditingId(f.id);
    setFType(f.followup_type);
    setFDate(f.scheduled_date);
    setFTime(f.scheduled_time || "");
    setFPriority(f.priority);
    setFAssignedTo(f.assigned_to || userId);
    setFDescription(f.description || "");
    setFOutcome(f.expected_outcome || "");
    setDialogOpen(true);
  }

  function quickSchedule(daysFromNow: number) {
    resetForm();
    setFDate(format(addDays(new Date(), daysFromNow), "yyyy-MM-dd"));
    setDialogOpen(true);
  }

  async function handleSave() {
    if (!fDate) return;
    setSaving(true);
    try {
      const payload = {
        lead_id: leadId,
        company_id: companyId,
        followup_type: fType,
        scheduled_date: fDate,
        scheduled_time: fTime || null,
        priority: fPriority,
        assigned_to: fAssignedTo || null,
        description: fDescription.trim() || null,
        expected_outcome: fOutcome.trim() || null,
        created_by: userId,
      };

      if (editingId) {
        const { error } = await supabase.from("lead_followups").update(payload).eq("id", editingId);
        if (error) throw error;
        toast({ title: "Follow-up updated" });
      } else {
        const { error } = await supabase.from("lead_followups").insert(payload);
        if (error) throw error;
        // Log activity
        await supabase.from("lead_activities").insert({
          lead_id: leadId,
          user_id: userId,
          activity_type: "follow_up",
          description: `${FOLLOWUP_TYPES.find(t => t.value === fType)?.label || "Follow-up"} scheduled for ${format(new Date(fDate), "MMM d, yyyy")}`,
          metadata: { followup_type: fType, scheduled_date: fDate, priority: fPriority },
        });
        toast({ title: "Follow-up scheduled" });
      }
      setDialogOpen(false);
      fetchFollowUps();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  async function toggleComplete(f: FollowUp) {
    try {
      const newCompleted = !f.is_completed;
      const { error } = await supabase
        .from("lead_followups")
        .update({
          is_completed: newCompleted,
          completed_at: newCompleted ? new Date().toISOString() : null,
          completed_by: newCompleted ? userId : null,
        })
        .eq("id", f.id);
      if (error) throw error;

      if (newCompleted) {
        await supabase.from("lead_activities").insert({
          lead_id: leadId,
          user_id: userId,
          activity_type: "follow_up",
          description: `${FOLLOWUP_TYPES.find(t => t.value === f.followup_type)?.label || "Follow-up"} completed`,
          metadata: { followup_id: f.id, action: "completed" },
        });
      }

      fetchFollowUps();
      toast({ title: newCompleted ? "Marked complete" : "Marked incomplete" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  async function deleteFollowUp(id: string) {
    try {
      const { error } = await supabase.from("lead_followups").delete().eq("id", id);
      if (error) throw error;
      fetchFollowUps();
      toast({ title: "Follow-up deleted" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  const overdueCount = followUps.filter(f => !f.is_completed && isPast(new Date(f.scheduled_date + "T23:59:59"))).length;
  const pendingFollowUps = followUps.filter(f => !f.is_completed);
  const completedFollowUps = followUps.filter(f => f.is_completed);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Quick actions + create */}
      {isAdminOrAgent && (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={openCreate} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> New Follow-up
          </Button>
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" onClick={() => quickSchedule(0)} className="text-xs h-8">
              Today
            </Button>
            <Button size="sm" variant="outline" onClick={() => quickSchedule(1)} className="text-xs h-8">
              Tomorrow
            </Button>
            <Button size="sm" variant="outline" onClick={() => quickSchedule(7)} className="text-xs h-8">
              Next Week
            </Button>
          </div>
        </div>
      )}

      {/* Overdue alert */}
      {overdueCount > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-destructive/30 bg-destructive/5">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
          <div>
            <p className="text-sm font-medium text-destructive">
              {overdueCount} overdue follow-up{overdueCount > 1 ? "s" : ""}
            </p>
            <p className="text-xs text-destructive/80">Please take action on overdue items</p>
          </div>
        </div>
      )}

      {/* Pending */}
      {pendingFollowUps.length === 0 && completedFollowUps.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Bell className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No follow-ups scheduled</p>
          <p className="text-xs mt-1">Use the buttons above to schedule one</p>
        </div>
      ) : (
        <>
          {pendingFollowUps.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Pending ({pendingFollowUps.length})</h4>
              {pendingFollowUps.map(f => <FollowUpCard key={f.id} followUp={f} agentMap={agentMap} onToggle={toggleComplete} onEdit={openEdit} onDelete={deleteFollowUp} isAdminOrAgent={isAdminOrAgent} />)}
            </div>
          )}
          {completedFollowUps.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Completed ({completedFollowUps.length})</h4>
              {completedFollowUps.map(f => <FollowUpCard key={f.id} followUp={f} agentMap={agentMap} onToggle={toggleComplete} onEdit={openEdit} onDelete={deleteFollowUp} isAdminOrAgent={isAdminOrAgent} />)}
            </div>
          )}
        </>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[520px] p-0 gap-0 overflow-hidden border-border">
          <div className="h-1.5 gold-gradient w-full" />
          <div className="px-6 pt-5 pb-3">
            <DialogHeader>
              <DialogTitle className="font-display flex items-center gap-2">
                <Bell className="w-5 h-5 text-accent" />
                {editingId ? "Edit Follow-up" : "Schedule Follow-up"}
              </DialogTitle>
              <DialogDescription className="text-xs">
                {editingId ? "Update follow-up details" : "Create a new follow-up reminder"}
              </DialogDescription>
            </DialogHeader>
          </div>

          <div className="px-6 pb-4 space-y-4">
            {/* Type selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium">Follow-up Type</Label>
              <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5">
                {FOLLOWUP_TYPES.map(t => {
                  const isActive = fType === t.value;
                  return (
                    <button
                      key={t.value}
                      onClick={() => setFType(t.value)}
                      className={cn(
                        "flex flex-col items-center gap-1 py-2.5 px-2 rounded-lg border transition-all text-xs font-medium",
                        isActive
                          ? "border-accent bg-accent/10 text-accent"
                          : "border-border bg-card text-muted-foreground hover:bg-muted/50"
                      )}
                    >
                      <t.icon className="w-4 h-4" />
                      <span>{t.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Date</Label>
                <Input type="date" value={fDate} onChange={e => setFDate(e.target.value)} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Time (optional)</Label>
                <Input type="time" value={fTime} onChange={e => setFTime(e.target.value)} className="h-9" />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">Priority</Label>
                <Select value={fPriority} onValueChange={setFPriority}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRIORITY_OPTIONS.map(p => (
                      <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Assigned Agent</Label>
                <Select value={fAssignedTo} onValueChange={setFAssignedTo}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {agents.map(a => (
                      <SelectItem key={a.userId} value={a.userId}>{a.fullName}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Description</Label>
              <Textarea
                value={fDescription}
                onChange={e => setFDescription(e.target.value)}
                placeholder="What needs to be done?"
                rows={2}
                maxLength={1000}
                className="text-sm"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">Expected Outcome</Label>
              <Input
                value={fOutcome}
                onChange={e => setFOutcome(e.target.value)}
                placeholder="e.g. Confirm travel dates"
                className="h-9"
                maxLength={500}
              />
            </div>
          </div>

          <div className="px-6 py-4 border-t border-border bg-muted/30 flex items-center justify-between">
            <Button variant="ghost" onClick={() => setDialogOpen(false)} className="text-muted-foreground">Cancel</Button>
            <Button onClick={handleSave} disabled={!fDate || saving} className="gold-gradient text-accent-foreground gap-1.5 px-6">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              {editingId ? "Update" : "Schedule"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function FollowUpCard({
  followUp: f,
  agentMap,
  onToggle,
  onEdit,
  onDelete,
  isAdminOrAgent,
}: {
  followUp: FollowUp;
  agentMap: Record<string, string>;
  onToggle: (f: FollowUp) => void;
  onEdit: (f: FollowUp) => void;
  onDelete: (id: string) => void;
  isAdminOrAgent: boolean;
}) {
  const typeConfig = FOLLOWUP_TYPES.find(t => t.value === f.followup_type) || FOLLOWUP_TYPES[0];
  const priorityConfig = PRIORITY_OPTIONS.find(p => p.value === f.priority) || PRIORITY_OPTIONS[1];
  const isOverdue = !f.is_completed && isPast(new Date(f.scheduled_date + "T23:59:59"));
  const TypeIcon = typeConfig.icon;

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg border transition-all",
        f.is_completed
          ? "border-border bg-muted/30 opacity-70"
          : isOverdue
          ? "border-destructive/30 bg-destructive/5"
          : "border-border bg-card hover:shadow-sm"
      )}
    >
      {/* Type icon */}
      <button
        onClick={() => onToggle(f)}
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors",
          f.is_completed
            ? "bg-emerald-100"
            : typeConfig.color
        )}
        title={f.is_completed ? "Mark incomplete" : "Mark complete"}
      >
        {f.is_completed ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        ) : (
          <TypeIcon className="w-4 h-4" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn("text-sm font-medium", f.is_completed && "line-through text-muted-foreground")}>
            {typeConfig.label}
          </span>
          <Badge className={cn("text-[10px] border", priorityConfig.color)}>
            {priorityConfig.label}
          </Badge>
          {isOverdue && (
            <Badge variant="destructive" className="text-[10px]">Overdue</Badge>
          )}
        </div>
        {f.description && (
          <p className={cn("text-xs mt-1", f.is_completed ? "text-muted-foreground" : "text-foreground")}>
            {f.description}
          </p>
        )}
        {f.expected_outcome && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Expected: {f.expected_outcome}
          </p>
        )}
        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-0.5">
            <Calendar className="w-2.5 h-2.5" />
            {format(new Date(f.scheduled_date), "MMM d, yyyy")}
            {f.scheduled_time && ` at ${f.scheduled_time.slice(0, 5)}`}
          </span>
          {f.assigned_to && agentMap[f.assigned_to] && (
            <span>{agentMap[f.assigned_to]}</span>
          )}
        </div>
      </div>

      {/* Actions */}
      {isAdminOrAgent && (
        <div className="flex items-center gap-0.5 shrink-0">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => onEdit(f)} title="Edit">
            <Edit2 className="w-3 h-3" />
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive/60 hover:text-destructive" onClick={() => onDelete(f.id)} title="Delete">
            <Trash2 className="w-3 h-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

// Badge component for leads list showing follow-up count
export function FollowUpBadge({ count, overdueCount }: { count: number; overdueCount: number }) {
  if (count === 0) return null;
  return (
    <span className={cn(
      "inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full",
      overdueCount > 0 ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
    )}>
      <Bell className="w-2.5 h-2.5" />
      {count}
    </span>
  );
}
