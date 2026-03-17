import { useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ModalDarkHeader } from "@/components/ui/modal-dark-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, Loader2, ArrowRight } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, addDays } from "date-fns";
import { getMutationErrorMessage, runMutationWithRetry } from "@/lib/supabaseMutation";
import type { CrmTask } from "./taskConstants";

interface TaskCompletionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  task: CrmTask;
  userId: string;
  onCompleted: () => void;
}

export function TaskCompletionDialog({ open, onOpenChange, task, userId, onCompleted }: TaskCompletionDialogProps) {
  const { toast } = useToast();
  const [saving, setSaving] = useState(false);
  const [notes, setNotes] = useState("");
  const [scheduleNext, setScheduleNext] = useState(false);
  const [nextDate, setNextDate] = useState(format(addDays(new Date(), 2), "yyyy-MM-dd"));

  async function handleComplete(action: "complete" | "complete_next") {
    setSaving(true);
    try {
      const completionPayload = {
        status: "completed",
        completed_at: new Date().toISOString(),
        completed_by: userId,
        completion_notes: notes.trim() || null,
      };

      await runMutationWithRetry(
        {
          table: "crm_tasks",
          operation: "update",
          payload: completionPayload,
          userId,
          companyId: task.company_id,
        },
        async () =>
          (await supabase
            .from("crm_tasks" as any)
            .update(completionPayload as any)
            .eq("id", task.id)
            .select("id")
            .single()) as any,
      );

      if (task.related_type === "lead") {
        await runMutationWithRetry(
          {
            table: "lead_activities",
            operation: "insert",
            payload: { task_id: task.id, action: "completed" },
            userId,
            companyId: task.company_id,
          },
          async () =>
            (await supabase
              .from("lead_activities")
              .insert({
                lead_id: task.related_id,
                user_id: userId,
                activity_type: "follow_up",
                description: `Completed: ${task.title}${notes.trim() ? ` — ${notes.trim().slice(0, 100)}` : ""}`,
                metadata: { task_id: task.id, action: "completed" },
              })
              .select("id")
              .single()) as any,
        );
      }

      if (action === "complete_next" && nextDate) {
        const nextPayload = {
          company_id: task.company_id,
          related_type: task.related_type,
          related_id: task.related_id,
          title: `Follow-up: ${task.title}`,
          task_type: task.task_type,
          due_date: nextDate,
          priority: task.priority,
          assigned_to: task.assigned_to,
          created_by: userId,
          description: `Follow-up to: ${task.title}`,
        };

        await runMutationWithRetry(
          {
            table: "crm_tasks",
            operation: "insert",
            payload: nextPayload,
            userId,
            companyId: task.company_id,
          },
          async () =>
            (await supabase
              .from("crm_tasks" as any)
              .insert(nextPayload as any)
              .select("id")
              .single()) as any,
        );
      }

      toast({ title: action === "complete_next" ? "Completed & next scheduled" : "Task completed" });
      onOpenChange(false);
      onCompleted();
    } catch (err: unknown) {
      toast({ title: "Error", description: getMutationErrorMessage(err), variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[460px] p-0 gap-0 overflow-hidden border-border dark-header-dialog">
        <ModalDarkHeader
          icon={<CheckCircle2 className="w-5 h-5 text-accent-foreground" />}
          title="Complete Task"
          description={task.title}
        />

        <div className="px-6 pb-4 space-y-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Completion Notes</Label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="What was the outcome? How did the client respond?"
              rows={3}
              maxLength={1000}
              className="text-sm"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-medium">Schedule Next Follow-up</Label>
            <Input
              type="date"
              value={nextDate}
              onChange={e => setNextDate(e.target.value)}
              className="h-9"
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-border bg-muted/30 flex items-center justify-between gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-muted-foreground">Cancel</Button>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => handleComplete("complete")} disabled={saving} className="gap-1.5">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              Complete
            </Button>
            <Button onClick={() => handleComplete("complete_next")} disabled={saving || !nextDate} className="gold-gradient text-accent-foreground gap-1.5">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
              Complete & Next
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
