import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClipboardList, Loader2, Search, AlertTriangle, Clock, CheckCircle2, Calendar, Plus } from "lucide-react";
import { isPast, isToday } from "date-fns";
import { getMutationErrorMessage, runMutationWithRetry } from "@/lib/supabaseMutation";
import { TaskCard } from "@/components/tasks/TaskCard";
import { TaskDialog } from "@/components/tasks/TaskDialog";
import { TaskCompletionDialog } from "@/components/tasks/TaskCompletionDialog";
import { TaskRescheduleDialog } from "@/components/tasks/TaskRescheduleDialog";
import { TASK_TYPES, PRIORITY_OPTIONS, STATUS_OPTIONS, type CrmTask, type AgentInfo } from "@/components/tasks/taskConstants";

export default function TasksPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [tasks, setTasks] = useState<CrmTask[]>([]);
  const [loading, setLoading] = useState(true);
  const [agents, setAgents] = useState<AgentInfo[]>([]);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [filterType, setFilterType] = useState("all");
  const [filterPriority, setFilterPriority] = useState("all");
  const [filterAgent, setFilterAgent] = useState("all");
  const [activeTab, setActiveTab] = useState("active");

  // Dialogs
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<CrmTask | null>(null);
  const [completingTask, setCompletingTask] = useState<CrmTask | null>(null);
  const [reschedulingTask, setReschedulingTask] = useState<CrmTask | null>(null);

  const companyId = user?.activeMembership?.companyId;
  const userId = user?.id || "";
  const isAdminOrAgent = ["company_admin", "agent"].includes(user?.activeMembership?.role || "");

  const agentMap: Record<string, string> = {};
  agents.forEach(a => { agentMap[a.userId] = a.fullName; });

  useEffect(() => {
    if (companyId) {
      fetchTasks();
      fetchAgents();
    }
  }, [companyId]);

  async function fetchTasks() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("crm_tasks" as any)
        .select("*")
        .eq("company_id", companyId)
        .order("due_date", { ascending: true });
      if (error) throw error;
      setTasks((data || []) as unknown as CrmTask[]);
    } catch {
    } finally {
      setLoading(false);
    }
  }

  async function fetchAgents() {
    try {
      const { data: memberships, error: membershipError } = await supabase
        .from("company_memberships")
        .select("user_id, role")
        .eq("company_id", companyId)
        .eq("is_active", true);

      if (membershipError) throw membershipError;
      const userIds = (memberships || []).map((m) => m.user_id);

      if (userIds.length === 0) {
        setAgents([]);
        return;
      }

      const { data: profiles, error: profileError } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", userIds);

      if (profileError) throw profileError;

      const profileMap = new Map((profiles || []).map((profile) => [profile.id, profile.full_name || "Unknown"]));
      setAgents(
        (memberships || []).map((member) => ({
          userId: member.user_id,
          fullName: profileMap.get(member.user_id) || "Unknown",
          role: member.role,
        })),
      );
    } catch (error) {
      console.error("Failed to fetch agents", error);
    }
  }

  async function handleCancel(t: CrmTask) {
    try {
      await runMutationWithRetry(
        {
          table: "crm_tasks",
          operation: "update",
          payload: { status: "cancelled" },
          userId,
          companyId,
          fallback: {
            filters: [{ column: "id", value: t.id }],
            select: "id",
            single: true,
          },
        },
        async () =>
          (await supabase
            .from("crm_tasks" as any)
            .update({ status: "cancelled" } as any)
            .eq("id", t.id)
            .select("id")
            .single()) as any,
      );
      toast({ title: "Task cancelled" });
      fetchTasks();
    } catch (err: unknown) {
      toast({ title: "Error", description: getMutationErrorMessage(err), variant: "destructive" });
    }
  }

  async function handleDelete(id: string) {
    try {
      await runMutationWithRetry(
        {
          table: "crm_tasks",
          operation: "delete",
          payload: { id },
          userId,
          companyId,
          fallback: {
            filters: [{ column: "id", value: id }],
            select: "id",
            single: true,
          },
        },
        async () =>
          (await supabase
            .from("crm_tasks" as any)
            .delete()
            .eq("id", id)
            .select("id")
            .single()) as any,
      );
      toast({ title: "Task deleted" });
      fetchTasks();
    } catch (err: unknown) {
      toast({ title: "Error", description: getMutationErrorMessage(err), variant: "destructive" });
    }
  }

  function openRelated(t: CrmTask) {
    const routes: Record<string, string> = {
      lead: `/dashboard/leads/${t.related_id}`,
      booking: `/dashboard/bookings/${t.related_id}`,
      quotation: `/dashboard/quotations/${t.related_id}`,
      customer: `/dashboard/customers/${t.related_id}`,
    };
    const path = routes[t.related_type];
    if (path) navigate(path);
  }

  // Filter logic
  const filtered = tasks.filter(t => {
    if (searchQuery && !t.title.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    if (filterStatus !== "all" && t.status !== filterStatus) return false;
    if (filterType !== "all" && t.task_type !== filterType) return false;
    if (filterPriority !== "all" && t.priority !== filterPriority) return false;
    if (filterAgent !== "all" && t.assigned_to !== filterAgent) return false;
    return true;
  });

  const activeTasks = filtered.filter(t => !["completed", "cancelled"].includes(t.status));
  const completedTasks = filtered.filter(t => t.status === "completed");
  const cancelledTasks = filtered.filter(t => t.status === "cancelled");

  const todayTasks = activeTasks.filter(t => isToday(new Date(t.due_date)));
  const overdueTasks = activeTasks.filter(t => isPast(new Date(t.due_date + "T23:59:59")) && !isToday(new Date(t.due_date)));
  const upcomingTasks = activeTasks.filter(t => !isPast(new Date(t.due_date + "T23:59:59")) && !isToday(new Date(t.due_date)));
  const highPriorityTasks = activeTasks.filter(t => t.priority === "urgent" || t.priority === "high");

  const tabTasks = activeTab === "active" ? activeTasks
    : activeTab === "today" ? todayTasks
    : activeTab === "overdue" ? overdueTasks
    : activeTab === "completed" ? completedTasks
    : activeTasks;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Tasks</h1>
          <p className="text-sm text-muted-foreground">Manage all CRM tasks and follow-ups</p>
        </div>
        {isAdminOrAgent && (
          <Button onClick={() => { setEditingTask(null); setDialogOpen(true); }} className="gap-1.5">
            <Plus className="w-4 h-4" /> New Task
          </Button>
        )}
      </div>

      {/* Stats cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab("overdue")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-destructive/10 flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-destructive" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{overdueTasks.length}</p>
              <p className="text-xs text-muted-foreground">Overdue</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab("today")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
              <Calendar className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{todayTasks.length}</p>
              <p className="text-xs text-muted-foreground">Today</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab("active")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Clock className="w-5 h-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{highPriorityTasks.length}</p>
              <p className="text-xs text-muted-foreground">High Priority</p>
            </div>
          </CardContent>
        </Card>
        <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => setActiveTab("completed")}>
          <CardContent className="p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{completedTasks.length}</p>
              <p className="text-xs text-muted-foreground">Completed</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                placeholder="Search tasks..."
                className="pl-9 h-9"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Status" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                {STATUS_OPTIONS.map(s => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[140px] h-9"><SelectValue placeholder="Type" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                {TASK_TYPES.map(t => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterPriority} onValueChange={setFilterPriority}>
              <SelectTrigger className="w-[130px] h-9"><SelectValue placeholder="Priority" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Priorities</SelectItem>
                {PRIORITY_OPTIONS.map(p => (
                  <SelectItem key={p.value} value={p.value}>{p.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={filterAgent} onValueChange={setFilterAgent}>
              <SelectTrigger className="w-[150px] h-9"><SelectValue placeholder="Agent" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Agents</SelectItem>
                {agents.map(a => (
                  <SelectItem key={a.userId} value={a.userId}>{a.fullName}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Task tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="active" className="gap-1.5">
            Active <Badge variant="secondary" className="text-[10px] ml-1">{activeTasks.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="today" className="gap-1.5">
            Today <Badge variant="secondary" className="text-[10px] ml-1">{todayTasks.length}</Badge>
          </TabsTrigger>
          <TabsTrigger value="overdue" className="gap-1.5">
            Overdue
            {overdueTasks.length > 0 && (
              <Badge variant="destructive" className="text-[10px] ml-1">{overdueTasks.length}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="completed" className="gap-1.5">
            Completed <Badge variant="secondary" className="text-[10px] ml-1">{completedTasks.length}</Badge>
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab} className="mt-4">
          {tabTasks.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <ClipboardList className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm font-medium">No tasks found</p>
              <p className="text-xs mt-1">
                {activeTab === "overdue" ? "Great! No overdue tasks" : "Create a new task to get started"}
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {tabTasks.map(t => (
                <TaskCard
                  key={t.id}
                  task={t}
                  agentMap={agentMap}
                  isAdminOrAgent={isAdminOrAgent}
                  onComplete={setCompletingTask}
                  onEdit={task => { setEditingTask(task); setDialogOpen(true); }}
                  onReschedule={setReschedulingTask}
                  onCancel={handleCancel}
                  onDelete={handleDelete}
                  onOpenRelated={openRelated}
                  showRelated
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Dialogs - need a dummy related for create from this page */}
      {dialogOpen && (
        <TaskDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          editingTask={editingTask}
          relatedType={editingTask?.related_type || "lead"}
          relatedId={editingTask?.related_id || ""}
          companyId={companyId || ""}
          userId={userId}
          agents={agents}
          onSaved={fetchTasks}
        />
      )}

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
