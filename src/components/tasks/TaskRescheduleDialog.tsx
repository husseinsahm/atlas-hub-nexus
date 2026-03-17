import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ModalDarkHeader } from "@/components/ui/modal-dark-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Calendar, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, addDays } from "date-fns";
import { getMutationErrorMessage, runMutationWithRetry } from "@/lib/supabaseMutation";
import type { CrmTask } from "./taskConstants";

interface TaskRescheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: CrmTask;
  userId: string;
  onRescheduled: () => void;
}

export function TaskRescheduleDialog({ open, onOpenChange, task, userId, onRescheduled }: TaskRescheduleDialogProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [newDate, setNewDate] = useState(format(addDays(new Date(), 1), "yyyy-MM-dd"));
  const [newTime, setNewTime] = useState(task.due_time || "");
  const [reason, setReason] = useState("");

  async function handleReschedule() {
    if (!newDate) return;
    setSaving(true);
    try {
      const payload = {
        due_date: newDate,
        due_time: newTime || null,
        status: "pending",
        metadata: {
          ...(task.metadata || {}),
          reschedule_history: [
            ...((task.metadata as any)?.reschedule_history || []),
            { from_date: task.due_date, from_time: task.due_time, to_date: newDate, to_time: newTime || null, reason: reason.trim(), by: userId, at: new Date().toISOString() },
          ],
        },
      };

      await runMutationWithRetry(
        {
          table: "crm_tasks",
          operation: "update",
          payload,
          userId,
          companyId: task.company_id,
          fallback: {
            filters: [{ column: "id", value: task.id }],
            select: "id",
            single: true,
          },
        },
        async () =>
          (await supabase
            .from("crm_tasks" as any)
            .update(payload as any)
            .eq("id", task.id)
            .select("id")
            .single()) as any,
      );

      if (task.related_type === "lead") {
        await runMutationWithRetry(
          {
            table: "lead_activities",
            operation: "insert",
            payload: { task_id: task.id, action: "rescheduled" },
            userId,
            companyId: task.company_id,
            fallback: {
              select: "id",
              single: true,
            },
          },
          async () =>
            (await supabase
              .from("lead_activities")
              .insert({
                lead_id: task.related_id,
                user_id: userId,
                activity_type: "follow_up",
                description: `Rescheduled "${task.title}" to ${format(new Date(newDate), "MMM d, yyyy")}${reason.trim() ? ` — ${reason.trim()}` : ""}`,
                metadata: { task_id: task.id, action: "rescheduled" },
              })
              .select("id")
              .single()) as any,
        );
      }

      toast({ title: "Task rescheduled" });
      onOpenChange(false);
      onRescheduled();
    } catch (err: unknown) {
      toast({ title: "Error", description: getMutationErrorMessage(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px] p-0 gap-0 overflow-hidden border-border dark-header-dialog">
        <ModalDarkHeader
          icon={<Calendar className="w-5 h-5 text-accent-foreground" />}
          title="Reschedule Task"
          description={task.title}
        />
        <div className="px-6 pb-4 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs">New Date</Label>
              <Input type="date" value={newDate} onChange={e => setNewDate(e.target.value)} className="h-9" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">New Time</Label>
              <Input type="time" value={newTime} onChange={e => setNewTime(e.target.value)} className="h-9" />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Reason (optional)</Label>
            <Textarea value={reason} onChange={e => setReason(e.target.value)} placeholder="Why is this being rescheduled?" rows={2} className="text-sm" maxLength={500} />
          </div>
        </div>
        <div className="px-6 py-4 border-t border-border bg-muted/30 flex items-center justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-muted-foreground">Cancel</Button>
          <Button onClick={handleReschedule} disabled={!newDate || saving} className="gold-gradient text-accent-foreground gap-1.5 px-6">
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Calendar className="w-4 h-4" />}
            Reschedule
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
