import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Bell, Plus, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { format, addDays, isPast } from "date-fns";
import { TaskDialog } from "./TaskDialog";
import { TaskCompletionDialog } from "./TaskCompletionDialog";
import { TaskRescheduleDialog } from "./TaskRescheduleDialog";
import { TaskCard } from "./TaskCard";
import type { CrmTask, AgentInfo } from "./taskConstants";

interface TaskTimelineProps {
  relatedType: string;
  relatedId: string;
  companyId: string;
  userId: string;
  agents: AgentInfo[];
  isAdminOrAgent: boolean;
}

export function TaskTimeline({ relatedType, relatedId, companyId, userId, agents, isAdminOrAgent }: TaskTimelineProps) {
  const { toast } = useToast();
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<CrmTask | null>(null);
  const [completingTask, setCompletingTask] = useState<CrmTask | null>(null);
  const [reschedulingTask, setReschedulingTask] = useState<CrmTask | null>(null);
  const [defaultDate, setDefaultDate] = useState<string | undefined>();

  const agentMap: Record<string, string> = {};
  agents.forEach(a => { agentMap[a.userId] = a.fullName; });

  useEffect(() => { fetchTasks(); }, [relatedId]);

  async function fetchTasks() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("crm_tasks" as any)
        .select("*")
        .eq("related_type", relatedType)
        .eq("related_id", relatedId)
        .order("due_date", { ascending: true });
      if (error) throw error;
      setTasks((data || []) as unknown as CrmTask[]);
    } catch {
    } finally {
      setLoading(false);
    }
  }

  function openCreate(daysFromNow?: number) {
    setEditingTask(null);
    setDefaultDate(daysFromNow !== undefined ? format(addDays(new Date(), daysFromNow), "yyyy-MM-dd") : undefined);
    setDialogOpen(true);
  }

  function openEdit(t: CrmTask) {
    setEditingTask(t);
    setDialogOpen(true);
  }

  async function handleCancel(t: CrmTask) {
    try {
      const { error } = await supabase
        .from("crm_tasks" as any)
        .update({ status: "cancelled" } as any)
        .eq("id", t.id);
      if (error) throw error;
      toast({ title: "Task cancelled" });
      fetchTasks();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  async function handleDelete(id: string) {
    try {
      const { error } = await supabase.from("crm_tasks" as any).delete().eq("id", id);
      if (error) throw error;
      toast({ title: "Task deleted" });
      fetchTasks();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  const activeTasks = tasks.filter(t => !["completed", "cancelled"].includes(t.status));
  const completedTasks = tasks.filter(t => ["completed", "cancelled"].includes(t.status));
  const overdueCount = activeTasks.filter(t => isPast(new Date(t.due_date + "T23:59:59"))).length;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Quick actions */}
      {isAdminOrAgent && (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="sm" onClick={() => openCreate()} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" /> New Task
          </Button>
          <div className="flex gap-1.5">
            <Button size="sm" variant="outline" onClick={() => openCreate(0)} className="text-xs h-8">Today</Button>
            <Button size="sm" variant="outline" onClick={() => openCreate(1)} className="text-xs h-8">Tomorrow</Button>
            <Button size="sm" variant="outline" onClick={() => openCreate(7)} className="text-xs h-8">Next Week</Button>
          </div>
        </div>
      )}

      {/* Overdue alert */}
      {overdueCount > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-lg border border-destructive/30 bg-destructive/5">
          <AlertTriangle className="w-5 h-5 text-destructive shrink-0" />
          <div>
            <p className="text-sm font-medium text-destructive">
              {overdueCount} overdue task{overdueCount > 1 ? "s" : ""}
            </p>
            <p className="text-xs text-destructive/80">Please take action on overdue items</p>
          </div>
        </div>
      )}

      {/* Task lists */}
      {activeTasks.length === 0 && completedTasks.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground">
          <Bell className="w-8 h-8 mx-auto mb-2 opacity-40" />
          <p className="text-sm">No tasks scheduled</p>
          <p className="text-xs mt-1">Use the buttons above to create one</p>
        </div>
      ) : (
        <>
          {activeTasks.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Active ({activeTasks.length})</h4>
              {activeTasks.map(t => (
                <TaskCard
                  key={t.id}
                  task={t}
                  agentMap={agentMap}
                  isAdminOrAgent={isAdminOrAgent}
                  onComplete={setCompletingTask}
                  onEdit={openEdit}
                  onReschedule={setReschedulingTask}
                  onCancel={handleCancel}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
          {completedTasks.length > 0 && (
            <div className="space-y-2">
              <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Completed / Cancelled ({completedTasks.length})</h4>
              {completedTasks.map(t => (
                <TaskCard
                  key={t.id}
                  task={t}
                  agentMap={agentMap}
                  isAdminOrAgent={isAdminOrAgent}
                  onComplete={setCompletingTask}
                  onEdit={openEdit}
                  onReschedule={setReschedulingTask}
                  onCancel={handleCancel}
                  onDelete={handleDelete}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Dialogs */}
      <TaskDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        editingTask={editingTask}
        relatedType={relatedType}
        relatedId={relatedId}
        companyId={companyId}
        userId={userId}
        agents={agents}
        onSaved={fetchTasks}
        defaultDate={defaultDate}
      />

      {completingTask && (
        <TaskCompletionDialog
          open={!!completingTask}
          onOpenChange={() => setCompletingTask(null)}
          task={completingTask}
          userId={userId}
          onCompleted={fetchTasks}
        />
      )}

      {reschedulingTask && (
        <TaskRescheduleDialog
          open={!!reschedulingTask}
          onOpenChange={() => setReschedulingTask(null)}
          task={reschedulingTask}
          userId={userId}
          onRescheduled={fetchTasks}
        />
      )}
    </div>
  );
}

// Badge for lists
export function TaskBadge({ count, overdueCount }: { count: number; overdueCount: number }) {
  if (count === 0) return null;
  return (
    <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${
      overdueCount > 0 ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground"
    }`}>
      <Bell className="w-2.5 h-2.5" />
      {count}
    </span>
  );
}
