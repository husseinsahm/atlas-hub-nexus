import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { ModalDarkHeader } from "@/components/ui/modal-dark-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CheckCircle2, Loader2, Wand2, ClipboardList } from "lucide-react";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { getMutationErrorMessage, runMutationWithRetry } from "@/lib/supabaseMutation";
import {
  TASK_TYPES, PRIORITY_OPTIONS, REMINDER_OPTIONS, REPEAT_OPTIONS,
  QUICK_TEMPLATES, type CrmTask, type AgentInfo,
} from "./taskConstants";

interface TaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editingTask?: CrmTask | null;
  relatedType: string;
  relatedId: string;
  companyId: string;
  userId: string;
  agents: AgentInfo[];
  onSaved: () => void;
  defaultDate?: string;
}

export function TaskDialog({
  open, onOpenChange, editingTask, relatedType, relatedId,
  companyId, userId, agents, onSaved, defaultDate,
}: TaskDialogProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);

  const [title, setTitle] = useState("");
  const [taskType, setTaskType] = useState("call");
  const [dueDate, setDueDate] = useState("");
  const [dueTime, setDueTime] = useState("");
  const [priority, setPriority] = useState("normal");
  const [assignedTo, setAssignedTo] = useState(userId);
  const [description, setDescription] = useState("");
  const [expectedOutcome, setExpectedOutcome] = useState("");
  const [reminderBefore, setReminderBefore] = useState<string>("0");
  const [repeatRule, setRepeatRule] = useState("none");

  useEffect(() => {
    if (open) {
      if (editingTask) {
        setTitle(editingTask.title);
        setTaskType(editingTask.task_type);
        setDueDate(editingTask.due_date);
        setDueTime(editingTask.due_time || "");
        setPriority(editingTask.priority);
        setAssignedTo(editingTask.assigned_to || userId);
        setDescription(editingTask.description || "");
        setExpectedOutcome(editingTask.expected_outcome || "");
        setReminderBefore(String(editingTask.reminder_before ?? 0));
        setRepeatRule(editingTask.repeat_rule || "none");
      } else {
        const date = defaultDate || format(new Date(), "yyyy-MM-dd");
        setTitle("");
        setTaskType("call");
        setDueDate(date);
        setDueTime("");
        setPriority("normal");
        setAssignedTo(userId);
        setDescription("");
        setExpectedOutcome("");
        setReminderBefore("0");
        setRepeatRule("none");
      }
    }
  }, [open, editingTask, defaultDate, userId]);

  function applyTemplate() {
    const tmpl = QUICK_TEMPLATES[taskType];
    if (tmpl) {
      if (!title) setTitle(tmpl.title);
      if (!description) setDescription(tmpl.description);
      if (!expectedOutcome) setExpectedOutcome(tmpl.expectedOutcome);
    }
  }

  function handleTypeChange(val: string) {
    setTaskType(val);
    // Auto-apply template if fields are empty
    const tmpl = QUICK_TEMPLATES[val];
    if (tmpl && !title) {
      setTitle(tmpl.title);
      setDescription(tmpl.description);
      setExpectedOutcome(tmpl.expectedOutcome);
    }
  }

  async function handleSave() {
    if (!dueDate || !title.trim()) return;
    setSaving(true);
    try {
      const payload = {
        company_id: companyId,
        related_type: relatedType,
        related_id: relatedId,
        title: title.trim(),
        task_type: taskType,
        due_date: dueDate,
        due_time: dueTime || null,
        priority,
        assigned_to: assignedTo || null,
        created_by: userId,
        description: description.trim() || null,
        expected_outcome: expectedOutcome.trim() || null,
        reminder_before: parseInt(reminderBefore) || null,
        repeat_rule: repeatRule === "none" ? null : repeatRule,
      };

      if (editingTask) {
        const { error } = await supabase
          .from("crm_tasks" as any)
          .update(payload as any)
          .eq("id", editingTask.id);
        if (error) throw error;
        toast({ title: "Task updated" });
      } else {
        const { error } = await supabase
          .from("crm_tasks" as any)
          .insert(payload as any);
        if (error) throw error;

        // Log activity if lead
        if (relatedType === "lead") {
          await supabase.from("lead_activities").insert({
            lead_id: relatedId,
            user_id: userId,
            activity_type: "follow_up",
            description: `${TASK_TYPES.find(t => t.value === taskType)?.label || "Task"}: ${title.trim()} — scheduled for ${format(new Date(dueDate), "MMM d, yyyy")}`,
            metadata: { task_type: taskType, due_date: dueDate, priority },
          });
        }
        toast({ title: "Task scheduled" });
      }

      onOpenChange(false);
      onSaved();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[580px] p-0 gap-0 overflow-hidden border-border dark-header-dialog max-h-[90vh] overflow-y-auto">
        <ModalDarkHeader
          icon={<ClipboardList className="w-5 h-5 text-accent-foreground" />}
          title={editingTask ? "Edit Task" : "Schedule Task"}
          description={editingTask ? "Update task details" : "Create a new CRM task"}
        />

        <div className="px-6 pb-4 space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Title</Label>
            <Input
              value={title}
              onChange={e => setTitle(e.target.value)}
              placeholder="e.g. Follow up on trip proposal"
              className="h-9"
              maxLength={200}
            />
          </div>

          {/* Type selector */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <Label className="text-xs font-medium">Type</Label>
              <Button type="button" variant="ghost" size="sm" onClick={applyTemplate} className="h-6 text-[10px] gap-1 text-muted-foreground">
                <Wand2 className="w-3 h-3" /> Apply template
              </Button>
            </div>
            <div className="grid grid-cols-5 gap-1.5">
              {TASK_TYPES.map(t => {
                const isActive = taskType === t.value;
                return (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => handleTypeChange(t.value)}
                    className={cn(
                      "flex flex-col items-center gap-1 py-2 px-1 rounded-lg border transition-all text-[10px] font-medium",
                      isActive
                        ? "border-accent bg-accent/10 text-accent"
                        : "border-border bg-card text-muted-foreground hover:bg-muted/50"
                    )}
                  >
                    <t.icon className="w-3.5 h-3.5" />
                    <span className="truncate w-full text-center">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Date / Time */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Due Date</Label>
              <Input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Due Time (optional)</Label>
              <Input type="time" value={dueTime} onChange={e => setDueTime(e.target.value)} className="h-9" />
            </div>
          </div>

          {/* Priority / Agent */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Priority</Label>
              <Select value={priority} onValueChange={setPriority}>
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
              <Select value={assignedTo} onValueChange={setAssignedTo}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {agents.map(a => (
                    <SelectItem key={a.userId} value={a.userId}>{a.fullName}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Reminder / Repeat */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">Reminder</Label>
              <Select value={reminderBefore} onValueChange={setReminderBefore}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REMINDER_OPTIONS.map(r => (
                    <SelectItem key={r.value} value={String(r.value)}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Repeat</Label>
              <Select value={repeatRule} onValueChange={setRepeatRule}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {REPEAT_OPTIONS.map(r => (
                    <SelectItem key={r.value} value={r.value}>{r.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label className="text-xs">Description</Label>
            <Textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What needs to be done?"
              rows={2}
              maxLength={1000}
              className="text-sm"
            />
          </div>

          {/* Expected Outcome */}
          <div className="space-y-1.5">
            <Label className="text-xs">Expected Outcome</Label>
            <Input
              value={expectedOutcome}
              onChange={e => setExpectedOutcome(e.target.value)}
              placeholder="e.g. Confirm travel dates"
              className="h-9"
              maxLength={500}
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border bg-muted/30 flex items-center justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-muted-foreground">Cancel</Button>
          <Button onClick={handleSave} disabled={!dueDate || !title.trim() || saving} className="gold-gradient text-accent-foreground gap-1.5 px-6">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
            {editingTask ? "Update" : "Schedule"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
