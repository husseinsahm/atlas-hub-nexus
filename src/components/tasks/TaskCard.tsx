import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  CheckCircle2, Calendar, Edit2, Trash2, MoreHorizontal,
  Clock, RotateCcw, UserCheck, XCircle, AlertTriangle, ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { format, isPast, isToday, isTomorrow } from "date-fns";
import { TASK_TYPES, PRIORITY_OPTIONS, STATUS_OPTIONS, type CrmTask, type AgentInfo } from "./taskConstants";

interface TaskCardProps {
  task: CrmTask;
  agentMap: Record<string, string>;
  isAdminOrAgent: boolean;
  onComplete: (task: CrmTask) => void;
  onEdit: (task: CrmTask) => void;
  onReschedule: (task: CrmTask) => void;
  onCancel: (task: CrmTask) => void;
  onDelete: (id: string) => void;
  onOpenRelated?: (task: CrmTask) => void;
  showRelated?: boolean;
}

export function TaskCard({
  task, agentMap, isAdminOrAgent,
  onComplete, onEdit, onReschedule, onCancel, onDelete, onOpenRelated,
  showRelated = false,
}: TaskCardProps) {
  const typeConfig = TASK_TYPES.find(t => t.value === task.task_type) || TASK_TYPES[4];
  const priorityConfig = PRIORITY_OPTIONS.find(p => p.value === task.priority) || PRIORITY_OPTIONS[1];
  const statusConfig = STATUS_OPTIONS.find(s => s.value === task.status) || STATUS_OPTIONS[0];
  const isOverdue = !["completed", "cancelled"].includes(task.status) && isPast(new Date(task.due_date + "T23:59:59"));
  const isCompleted = task.status === "completed";
  const isCancelled = task.status === "cancelled";
  const TypeIcon = typeConfig.icon;

  const dueDateObj = new Date(task.due_date);
  let dateLabel = format(dueDateObj, "MMM d, yyyy");
  if (isToday(dueDateObj)) dateLabel = "Today";
  else if (isTomorrow(dueDateObj)) dateLabel = "Tomorrow";

  return (
    <div
      className={cn(
        "flex items-start gap-3 p-3 rounded-lg border transition-all group",
        isCompleted
          ? "border-border bg-muted/30 opacity-70"
          : isCancelled
          ? "border-border bg-muted/20 opacity-50"
          : isOverdue
          ? "border-destructive/30 bg-destructive/5"
          : "border-border bg-card hover:shadow-sm"
      )}
    >
      {/* Type icon / complete toggle */}
      <button
        onClick={() => !isCompleted && !isCancelled && onComplete(task)}
        disabled={isCompleted || isCancelled}
        className={cn(
          "w-8 h-8 rounded-full flex items-center justify-center shrink-0 transition-colors",
          isCompleted ? "bg-emerald-100 dark:bg-emerald-900/30" : "border",
          !isCompleted && !isCancelled && typeConfig.color
        )}
        title={isCompleted ? "Completed" : "Mark complete"}
      >
        {isCompleted ? (
          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
        ) : (
          <TypeIcon className="w-4 h-4" />
        )}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn("text-sm font-medium", (isCompleted || isCancelled) && "line-through text-muted-foreground")}>
            {task.title}
          </span>
          <Badge className={cn("text-[10px] border", priorityConfig.color)}>{priorityConfig.label}</Badge>
          <Badge className={cn("text-[10px] border", statusConfig.color)}>{statusConfig.label}</Badge>
          {isOverdue && !isCompleted && !isCancelled && (
            <Badge variant="destructive" className="text-[10px]">Overdue</Badge>
          )}
        </div>

        {task.description && (
          <p className={cn("text-xs mt-1 line-clamp-2", isCompleted ? "text-muted-foreground" : "text-foreground")}>
            {task.description}
          </p>
        )}

        {task.expected_outcome && (
          <p className="text-xs text-muted-foreground mt-0.5">
            Expected: {task.expected_outcome}
          </p>
        )}

        {task.completion_notes && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">
            ✓ {task.completion_notes}
          </p>
        )}

        <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground flex-wrap">
          <span className={cn("flex items-center gap-0.5", isOverdue && !isCompleted && "text-destructive font-medium")}>
            <Calendar className="w-2.5 h-2.5" />
            {dateLabel}
            {task.due_time && ` at ${task.due_time.slice(0, 5)}`}
          </span>
          {task.assigned_to && agentMap[task.assigned_to] && (
            <span className="flex items-center gap-0.5">
              <UserCheck className="w-2.5 h-2.5" />
              {agentMap[task.assigned_to]}
            </span>
          )}
          {showRelated && (
            <span className="capitalize">{task.related_type}</span>
          )}
          {task.repeat_rule && (
            <span className="flex items-center gap-0.5">
              <RotateCcw className="w-2.5 h-2.5" />
              {task.repeat_rule}
            </span>
          )}
        </div>
      </div>

      {/* Actions */}
      {isAdminOrAgent && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
              <MoreHorizontal className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-44">
            {!isCompleted && !isCancelled && (
              <>
                <DropdownMenuItem onClick={() => onComplete(task)}>
                  <CheckCircle2 className="w-3.5 h-3.5 mr-2" /> Complete
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onReschedule(task)}>
                  <Clock className="w-3.5 h-3.5 mr-2" /> Reschedule
                </DropdownMenuItem>
              </>
            )}
            <DropdownMenuItem onClick={() => onEdit(task)}>
              <Edit2 className="w-3.5 h-3.5 mr-2" /> Edit
            </DropdownMenuItem>
            {!isCompleted && !isCancelled && (
              <DropdownMenuItem onClick={() => onCancel(task)}>
                <XCircle className="w-3.5 h-3.5 mr-2" /> Cancel
              </DropdownMenuItem>
            )}
            {onOpenRelated && (
              <DropdownMenuItem onClick={() => onOpenRelated(task)}>
                <ExternalLink className="w-3.5 h-3.5 mr-2" /> Open {task.related_type}
              </DropdownMenuItem>
            )}
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={() => onDelete(task.id)} className="text-destructive">
              <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </div>
  );
}
