import { supabase } from "@/integrations/supabase/client";
import { createNotification } from "@/hooks/useNotifications";

// ─── Types ───
export type TriggerType =
  | "booking_status_changed"
  | "payment_received";

export type ActionType =
  | "create_task"
  | "notify_role"
  | "change_status"
  | "create_followup_reminder";

export interface AutomationAction {
  type: ActionType;
  config: Record<string, any>;
}

export interface AutomationRow {
  id: string;
  company_id: string;
  name: string;
  description: string | null;
  trigger_type: TriggerType;
  trigger_config: Record<string, any>;
  actions: AutomationAction[];
  is_active: boolean;
  run_count: number;
  last_run_at: string | null;
}

export interface AutomationContext {
  event: TriggerType;
  booking: {
    id: string;
    company_id: string;
    title: string;
    booking_number: string;
    assigned_to?: string | null;
    created_by?: string | null;
    customer_id?: string | null;
    selling_price?: number | null;
    currency?: string;
    [key: string]: any;
  };
  /** Event-specific payload (e.g. { from_status, to_status }) */
  payload?: Record<string, any>;
  /** Current user triggering the change */
  actorUserId?: string | null;
}

// ─── Catalogs ───
export const TRIGGER_CATALOG: Array<{ value: TriggerType; label: string; labelAr: string }> = [
  { value: "booking_status_changed", label: "Booking status changes", labelAr: "تغيّر حالة الحجز" },
];

export const ACTION_CATALOG: Array<{ value: ActionType; label: string; labelAr: string }> = [
  { value: "create_task", label: "Create CRM task", labelAr: "إنشاء مهمة" },
  { value: "notify_role", label: "Notify role", labelAr: "إشعار دور معيّن" },
  { value: "create_followup_reminder", label: "Create follow-up", labelAr: "إنشاء متابعة" },
];

export const BOOKING_STATUSES = [
  "tentative",
  "confirmed",
  "in_operation",
  "completed",
  "cancelled",
] as const;

// ─── Engine ───
function matchesTrigger(a: AutomationRow, ctx: AutomationContext): boolean {
  if (a.trigger_type !== ctx.event) return false;
  if (ctx.event === "booking_status_changed") {
    const wantedTo = a.trigger_config?.to_status;
    if (wantedTo && ctx.payload?.to_status !== wantedTo) return false;
    const wantedFrom = a.trigger_config?.from_status;
    if (wantedFrom && ctx.payload?.from_status !== wantedFrom) return false;
  }
  return true;
}

async function runAction(
  action: AutomationAction,
  ctx: AutomationContext,
): Promise<{ ok: boolean; detail?: string; error?: string }> {
  try {
    switch (action.type) {
      case "create_task": {
        const dueOffsetDays = Number(action.config?.due_in_days ?? 1);
        const due = new Date();
        due.setDate(due.getDate() + dueOffsetDays);
        const dueDate = due.toISOString().slice(0, 10);

        const assignee =
          action.config?.assign_to === "creator"
            ? ctx.booking.created_by
            : action.config?.assign_to === "assigned_agent"
              ? ctx.booking.assigned_to
              : action.config?.assign_to_user_id || null;

        const title = (action.config?.title || "Follow-up on {{booking_number}}")
          .replace("{{booking_number}}", ctx.booking.booking_number)
          .replace("{{booking_title}}", ctx.booking.title);

        const { error } = await supabase.from("crm_tasks").insert({
          company_id: ctx.booking.company_id,
          related_type: "booking",
          related_id: ctx.booking.id,
          title,
          description: action.config?.description || null,
          task_type: action.config?.task_type || "task",
          due_date: dueDate,
          priority: action.config?.priority || "normal",
          assigned_to: assignee,
          created_by: ctx.actorUserId,
        });
        if (error) throw error;
        return { ok: true, detail: `Task created: ${title}` };
      }

      case "create_followup_reminder": {
        const dueOffsetDays = Number(action.config?.due_in_days ?? 3);
        const due = new Date();
        due.setDate(due.getDate() + dueOffsetDays);
        const { error } = await supabase.from("crm_tasks").insert({
          company_id: ctx.booking.company_id,
          related_type: "booking",
          related_id: ctx.booking.id,
          title: action.config?.title || `Follow up on ${ctx.booking.booking_number}`,
          task_type: "follow_up",
          due_date: due.toISOString().slice(0, 10),
          priority: "normal",
          assigned_to: ctx.booking.assigned_to || ctx.actorUserId,
          created_by: ctx.actorUserId,
        });
        if (error) throw error;
        return { ok: true, detail: "Follow-up reminder created" };
      }

      case "notify_role": {
        const role = action.config?.role; // 'company_admin' | 'agent' | 'operations' | 'finance'
        if (!role) return { ok: false, error: "missing role" };
        const { data: members, error } = await supabase
          .from("company_memberships")
          .select("user_id")
          .eq("company_id", ctx.booking.company_id)
          .eq("role", role)
          .eq("is_active", true);
        if (error) throw error;
        const msg = (action.config?.message || `Booking ${ctx.booking.booking_number} needs attention`)
          .replace("{{booking_number}}", ctx.booking.booking_number)
          .replace("{{booking_title}}", ctx.booking.title);
        for (const m of members || []) {
          await createNotification({
            userId: m.user_id,
            companyId: ctx.booking.company_id,
            type: "automation",
            title: action.config?.title || "Automation alert",
            message: msg,
            entityType: "booking",
            entityId: ctx.booking.id,
          });
        }
        return { ok: true, detail: `Notified ${members?.length || 0} ${role} member(s)` };
      }

      case "change_status": {
        const next = action.config?.to_status;
        if (!next) return { ok: false, error: "missing status" };
        const { error } = await supabase
          .from("bookings")
          .update({ status: next })
          .eq("id", ctx.booking.id);
        if (error) throw error;
        return { ok: true, detail: `Status → ${next}` };
      }
    }
    return { ok: false, error: "unknown action" };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
}

/**
 * Public entry point. Call after a triggering event has been persisted.
 * Runs all matching, active automations for the company. Logs each run.
 * Designed to be fire-and-forget — never throws.
 */
export async function runAutomations(ctx: AutomationContext): Promise<void> {
  try {
    const { data: automations, error } = await supabase
      .from("automations")
      .select("*")
      .eq("company_id", ctx.booking.company_id)
      .eq("trigger_type", ctx.event)
      .eq("is_active", true);
    if (error || !automations?.length) return;

    for (const raw of automations) {
      const a = raw as unknown as AutomationRow;
      if (!matchesTrigger(a, ctx)) continue;

      const results: Array<{ type: ActionType; ok: boolean; detail?: string; error?: string }> = [];
      let anyError = false;

      for (const action of a.actions || []) {
        const r = await runAction(action, ctx);
        results.push({ type: action.type, ...r });
        if (!r.ok) anyError = true;
      }

      await supabase.from("automation_runs").insert({
        automation_id: a.id,
        company_id: ctx.booking.company_id,
        booking_id: ctx.booking.id,
        trigger_payload: (ctx.payload || {}) as any,
        actions_executed: results as any,
        status: anyError ? "partial_error" : "success",
        error_message: anyError ? results.find((r) => !r.ok)?.error : null,
      });

      await supabase
        .from("automations")
        .update({
          run_count: (a.run_count || 0) + 1,
          last_run_at: new Date().toISOString(),
        })
        .eq("id", a.id);
    }
  } catch (e) {
    // never throw from automation engine
    console.error("[automations] runAutomations failed", e);
  }
}
