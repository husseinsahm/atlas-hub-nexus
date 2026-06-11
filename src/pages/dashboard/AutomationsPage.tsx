import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { motion } from "framer-motion";
import {
  Zap,
  Plus,
  Loader2,
  Trash2,
  Power,
  PowerOff,
  ClipboardList,
  Bell,
  ArrowRight,
  Sparkles,
  Activity,
  ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
} from "@/components/ui/dialog";
import { ModalDarkHeader } from "@/components/ui/modal-dark-header";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { format } from "date-fns";
import {
  TRIGGER_CATALOG,
  ACTION_CATALOG,
  BOOKING_STATUSES,
  type AutomationAction,
  type TriggerType,
} from "@/lib/automations";

const STATUS_LABELS: Record<string, { en: string; ar: string }> = {
  tentative: { en: "Tentative", ar: "مبدئي" },
  confirmed: { en: "Confirmed", ar: "مؤكد" },
  in_operation: { en: "In Operation", ar: "قيد التنفيذ" },
  completed: { en: "Completed", ar: "مكتمل" },
  cancelled: { en: "Cancelled", ar: "ملغي" },
};

const ROLE_OPTIONS = [
  { value: "company_admin", en: "Admins", ar: "المدراء" },
  { value: "agent", en: "Agents", ar: "وكلاء المبيعات" },
  { value: "operations", en: "Operations", ar: "العمليات" },
  { value: "finance", en: "Finance", ar: "المالية" },
];

const ACTION_ICON: Record<string, any> = {
  create_task: ClipboardList,
  create_followup_reminder: ClipboardList,
  notify_role: Bell,
  change_status: ArrowRight,
};

interface FormState {
  name: string;
  description: string;
  trigger_type: TriggerType;
  to_status: string;
  is_active: boolean;
  actions: AutomationAction[];
}

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  trigger_type: "booking_status_changed",
  to_status: "confirmed",
  is_active: true,
  actions: [],
};

const PRESETS: Array<{ name: string; nameAr: string; build: () => FormState }> = [
  {
    name: "On Confirmation → create deposit task",
    nameAr: "عند التأكيد → مهمة تحصيل العربون",
    build: () => ({
      ...EMPTY_FORM,
      name: "Collect deposit on confirmation",
      to_status: "confirmed",
      actions: [
        {
          type: "create_task",
          config: {
            title: "Collect deposit for {{booking_number}}",
            assign_to: "assigned_agent",
            due_in_days: 2,
            priority: "high",
            task_type: "task",
          },
        },
        {
          type: "notify_role",
          config: { role: "finance", title: "New booking confirmed", message: "{{booking_title}} confirmed" },
        },
      ],
    }),
  },
  {
    name: "On In Operation → alert operations team",
    nameAr: "عند بدء التنفيذ → تنبيه فريق العمليات",
    build: () => ({
      ...EMPTY_FORM,
      name: "Notify operations when trip starts",
      to_status: "in_operation",
      actions: [
        {
          type: "notify_role",
          config: {
            role: "operations",
            title: "Trip starting",
            message: "{{booking_title}} is now in operation",
          },
        },
      ],
    }),
  },
  {
    name: "On Completed → schedule feedback follow-up",
    nameAr: "عند الإكمال → جدولة متابعة لطلب الرأي",
    build: () => ({
      ...EMPTY_FORM,
      name: "Post-trip feedback follow-up",
      to_status: "completed",
      actions: [
        {
          type: "create_followup_reminder",
          config: {
            title: "Request feedback from client of {{booking_number}}",
            due_in_days: 3,
          },
        },
      ],
    }),
  },
];

export default function AutomationsPage() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const isArabic = language === "ar";
  const companyId = user?.activeMembership?.companyId;

  const [showDialog, setShowDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [saving, setSaving] = useState(false);

  const { data: automations = [], isLoading } = useQuery({
    queryKey: ["automations", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automations")
        .select("*")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: recentRuns = [] } = useQuery({
    queryKey: ["automation-runs", companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("automation_runs")
        .select("*, automations(name), bookings(booking_number, title)")
        .eq("company_id", companyId)
        .order("created_at", { ascending: false })
        .limit(15);
      if (error) throw error;
      return data || [];
    },
  });

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setShowDialog(true);
  };

  const openPreset = (build: () => FormState) => {
    setEditingId(null);
    setForm(build());
    setShowDialog(true);
  };

  const openEdit = (a: any) => {
    setEditingId(a.id);
    setForm({
      name: a.name,
      description: a.description || "",
      trigger_type: a.trigger_type,
      to_status: a.trigger_config?.to_status || "confirmed",
      is_active: a.is_active,
      actions: (a.actions || []) as AutomationAction[],
    });
    setShowDialog(true);
  };

  const handleSave = async () => {
    if (!companyId || !user?.id || !form.name.trim() || form.actions.length === 0) {
      toast({
        title: isArabic ? "أدخل اسماً وأضف إجراء واحداً على الأقل" : "Add a name and at least one action",
        variant: "destructive",
      });
      return;
    }
    setSaving(true);
    try {
      const payload = {
        company_id: companyId,
        name: form.name.trim(),
        description: form.description.trim() || null,
        trigger_type: form.trigger_type,
        trigger_config: { to_status: form.to_status },
        actions: form.actions as any,
        is_active: form.is_active,
        created_by: user.id,
      };
      const { error } = editingId
        ? await supabase.from("automations").update(payload).eq("id", editingId)
        : await supabase.from("automations").insert(payload);
      if (error) throw error;
      toast({ title: isArabic ? "تم الحفظ" : "Automation saved" });
      setShowDialog(false);
      queryClient.invalidateQueries({ queryKey: ["automations", companyId] });
    } catch (e: any) {
      toast({ title: e?.message || "Failed", variant: "destructive" });
    } finally {
      setSaving(false);
    }
  };

  const toggleActive = async (id: string, next: boolean) => {
    await supabase.from("automations").update({ is_active: next }).eq("id", id);
    queryClient.invalidateQueries({ queryKey: ["automations", companyId] });
  };

  const handleDelete = async (id: string) => {
    if (!confirm(isArabic ? "حذف هذه الأتمتة؟" : "Delete this automation?")) return;
    const { error } = await supabase.from("automations").delete().eq("id", id);
    if (error) {
      toast({ title: error.message, variant: "destructive" });
      return;
    }
    queryClient.invalidateQueries({ queryKey: ["automations", companyId] });
  };

  const addAction = (type: AutomationAction["type"]) => {
    setForm((f) => ({ ...f, actions: [...f.actions, { type, config: {} }] }));
  };

  const updateAction = (idx: number, patch: Partial<AutomationAction>) => {
    setForm((f) => ({
      ...f,
      actions: f.actions.map((a, i) => (i === idx ? { ...a, ...patch, config: { ...a.config, ...(patch.config || {}) } } : a)),
    }));
  };

  const removeAction = (idx: number) => {
    setForm((f) => ({ ...f, actions: f.actions.filter((_, i) => i !== idx) }));
  };

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto">
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display flex items-center gap-2">
            <Zap className="w-6 h-6 text-primary" />
            {isArabic ? "الأتمتة" : "Automations"}
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            {isArabic
              ? "وفّر وقت فريقك — اربط الأحداث بإجراءات تلقائية"
              : "Save your team's time — connect events to automatic actions"}
          </p>
        </div>
        <Button onClick={openCreate} className="gap-2">
          <Plus className="w-4 h-4" />
          {isArabic ? "أتمتة جديدة" : "New Automation"}
        </Button>
      </motion.div>

      {/* Quick start presets */}
      {automations.length === 0 && !isLoading && (
        <Card className="border-dashed">
          <CardContent className="p-6">
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-4 h-4 text-primary" />
              <h3 className="font-semibold">{isArabic ? "ابدأ بقالب جاهز" : "Start from a template"}</h3>
            </div>
            <div className="grid md:grid-cols-3 gap-3">
              {PRESETS.map((p) => (
                <button
                  key={p.name}
                  onClick={() => openPreset(p.build)}
                  className="text-start border rounded-[14px] p-4 hover:border-primary/40 hover:shadow-sm transition-all bg-card"
                >
                  <p className="font-medium text-sm">{isArabic ? p.nameAr : p.name}</p>
                  <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
                    {isArabic ? "استخدم القالب" : "Use template"}
                    <ChevronRight className="w-3 h-3" />
                  </p>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* List */}
      <div className="space-y-3">
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : automations.length === 0 ? (
          <Card>
            <CardContent className="p-12 text-center text-muted-foreground">
              <Zap className="w-10 h-10 mx-auto mb-3 opacity-30" />
              <p className="font-medium">{isArabic ? "لا توجد أتمتة بعد" : "No automations yet"}</p>
              <p className="text-sm mt-1">{isArabic ? "اختر قالباً أعلاه أو أنشئ من الصفر" : "Pick a template above or start from scratch"}</p>
            </CardContent>
          </Card>
        ) : (
          automations.map((a: any) => (
            <Card key={a.id} className={!a.is_active ? "opacity-60" : ""}>
              <CardContent className="p-5">
                <div className="flex items-start gap-4">
                  <div className={`w-10 h-10 rounded-[10px] flex items-center justify-center shrink-0 ${a.is_active ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                    <Zap className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-semibold">{a.name}</h3>
                      {a.is_active ? (
                        <Badge variant="secondary" className="text-xs">{isArabic ? "نشطة" : "Active"}</Badge>
                      ) : (
                        <Badge variant="outline" className="text-xs">{isArabic ? "متوقفة" : "Paused"}</Badge>
                      )}
                      {a.run_count > 0 && (
                        <Badge variant="outline" className="text-xs gap-1">
                          <Activity className="w-3 h-3" />
                          {a.run_count}× {isArabic ? "تشغيل" : "runs"}
                        </Badge>
                      )}
                    </div>
                    {a.description && <p className="text-sm text-muted-foreground mt-1">{a.description}</p>}
                    <div className="flex flex-wrap items-center gap-2 mt-3 text-xs">
                      <span className="px-2 py-1 rounded-md bg-muted">
                        {isArabic ? "عند: " : "When: "}
                        {a.trigger_type === "booking_status_changed"
                          ? `${isArabic ? "الحالة" : "status"} → ${STATUS_LABELS[a.trigger_config?.to_status]?.[isArabic ? "ar" : "en"] || a.trigger_config?.to_status}`
                          : a.trigger_type}
                      </span>
                      <ArrowRight className="w-3 h-3 text-muted-foreground" />
                      {(a.actions || []).map((ac: any, i: number) => {
                        const Icon = ACTION_ICON[ac.type] || ClipboardList;
                        const cat = ACTION_CATALOG.find((c) => c.value === ac.type);
                        return (
                          <span key={i} className="px-2 py-1 rounded-md bg-primary/10 text-primary flex items-center gap-1.5">
                            <Icon className="w-3 h-3" />
                            {isArabic ? cat?.labelAr : cat?.label}
                          </span>
                        );
                      })}
                    </div>
                    {a.last_run_at && (
                      <p className="text-xs text-muted-foreground mt-2">
                        {isArabic ? "آخر تشغيل:" : "Last run:"} {format(new Date(a.last_run_at), "MMM d, yyyy HH:mm")}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Switch checked={a.is_active} onCheckedChange={(v) => toggleActive(a.id, v)} />
                    <Button size="sm" variant="outline" onClick={() => openEdit(a)}>
                      {isArabic ? "تعديل" : "Edit"}
                    </Button>
                    <Button size="sm" variant="ghost" className="text-destructive hover:text-destructive" onClick={() => handleDelete(a.id)}>
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Recent Runs */}
      {recentRuns.length > 0 && (
        <Card>
          <CardContent className="p-5">
            <h3 className="font-semibold mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4" />
              {isArabic ? "آخر عمليات التشغيل" : "Recent runs"}
            </h3>
            <div className="space-y-2">
              {recentRuns.map((r: any) => (
                <div key={r.id} className="flex items-center justify-between gap-3 text-sm border-b last:border-0 pb-2 last:pb-0">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{r.automations?.name || "Unknown"}</p>
                    <p className="text-xs text-muted-foreground truncate">
                      {r.bookings?.booking_number} · {r.bookings?.title}
                      {r.error_message && ` · ${r.error_message}`}
                    </p>
                  </div>
                  <Badge variant={r.status === "success" ? "secondary" : "destructive"} className="text-xs shrink-0">
                    {r.status}
                  </Badge>
                  <span className="text-xs text-muted-foreground shrink-0 tabular-nums">
                    {format(new Date(r.created_at), "MMM d, HH:mm")}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Editor Dialog */}
      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl p-0 overflow-hidden gap-0 max-h-[90vh] flex flex-col">
          <ModalDarkHeader
            icon={<Zap className="w-5 h-5" />}
            title={editingId ? (isArabic ? "تعديل الأتمتة" : "Edit Automation") : isArabic ? "أتمتة جديدة" : "New Automation"}
            description={isArabic ? "اربط حدثاً بإجراءات تلقائية" : "Link an event to automatic actions"}
          />
          <div className="overflow-y-auto p-6 space-y-5">
            <div className="space-y-2">
              <Label>{isArabic ? "الاسم" : "Name"} *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>{isArabic ? "الوصف" : "Description"}</Label>
              <Textarea rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>

            <div className="border rounded-[14px] p-4 bg-muted/30 space-y-3">
              <div className="flex items-center gap-2">
                <Badge className="bg-primary text-primary-foreground">WHEN</Badge>
                <p className="text-sm font-medium">{isArabic ? "الحدث المُحفّز" : "Trigger event"}</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label className="text-xs">{isArabic ? "النوع" : "Type"}</Label>
                  <Select value={form.trigger_type} onValueChange={(v) => setForm({ ...form, trigger_type: v as TriggerType })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TRIGGER_CATALOG.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{isArabic ? t.labelAr : t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">{isArabic ? "الحالة الجديدة" : "New status"}</Label>
                  <Select value={form.to_status} onValueChange={(v) => setForm({ ...form, to_status: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {BOOKING_STATUSES.map((s) => (
                        <SelectItem key={s} value={s}>{STATUS_LABELS[s]?.[isArabic ? "ar" : "en"] || s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="border rounded-[14px] p-4 bg-muted/30 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Badge className="bg-secondary text-secondary-foreground">DO</Badge>
                  <p className="text-sm font-medium">{isArabic ? "الإجراءات" : "Actions"}</p>
                </div>
                <Select onValueChange={(v) => addAction(v as any)}>
                  <SelectTrigger className="w-48"><SelectValue placeholder={isArabic ? "إضافة إجراء" : "Add action"} /></SelectTrigger>
                  <SelectContent>
                    {ACTION_CATALOG.map((a) => (
                      <SelectItem key={a.value} value={a.value}>{isArabic ? a.labelAr : a.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {form.actions.length === 0 && (
                <p className="text-xs text-muted-foreground text-center py-4">
                  {isArabic ? "لم تضف أي إجراء بعد" : "No actions yet"}
                </p>
              )}

              {form.actions.map((action, idx) => (
                <div key={idx} className="border rounded-[10px] p-3 bg-card space-y-2">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium">
                      {ACTION_CATALOG.find((c) => c.value === action.type)?.[isArabic ? "labelAr" : "label"]}
                    </p>
                    <Button size="sm" variant="ghost" onClick={() => removeAction(idx)}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                  {(action.type === "create_task" || action.type === "create_followup_reminder") && (
                    <div className="grid grid-cols-2 gap-2">
                      <div className="col-span-2">
                        <Label className="text-xs">{isArabic ? "عنوان المهمة" : "Task title"}</Label>
                        <Input
                          value={action.config.title || ""}
                          onChange={(e) => updateAction(idx, { config: { title: e.target.value } })}
                          placeholder="Collect deposit for {{booking_number}}"
                        />
                      </div>
                      <div>
                        <Label className="text-xs">{isArabic ? "بعد كم يوم" : "Due in days"}</Label>
                        <Input
                          type="number"
                          value={action.config.due_in_days ?? 2}
                          onChange={(e) => updateAction(idx, { config: { due_in_days: Number(e.target.value) } })}
                        />
                      </div>
                      <div>
                        <Label className="text-xs">{isArabic ? "تعيين إلى" : "Assign to"}</Label>
                        <Select
                          value={action.config.assign_to || "assigned_agent"}
                          onValueChange={(v) => updateAction(idx, { config: { assign_to: v } })}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="assigned_agent">{isArabic ? "الوكيل المخصص" : "Assigned agent"}</SelectItem>
                            <SelectItem value="creator">{isArabic ? "منشئ الحجز" : "Booking creator"}</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                  )}
                  {action.type === "notify_role" && (
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <Label className="text-xs">{isArabic ? "الدور" : "Role"}</Label>
                        <Select
                          value={action.config.role || ""}
                          onValueChange={(v) => updateAction(idx, { config: { role: v } })}
                        >
                          <SelectTrigger><SelectValue placeholder={isArabic ? "اختر دوراً" : "Select role"} /></SelectTrigger>
                          <SelectContent>
                            {ROLE_OPTIONS.map((r) => (
                              <SelectItem key={r.value} value={r.value}>{isArabic ? r.ar : r.en}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="col-span-2">
                        <Label className="text-xs">{isArabic ? "نص الإشعار" : "Message"}</Label>
                        <Input
                          value={action.config.message || ""}
                          onChange={(e) => updateAction(idx, { config: { message: e.target.value } })}
                          placeholder="{{booking_title}} needs attention"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}

              <p className="text-[11px] text-muted-foreground">
                {isArabic
                  ? "متغيرات متاحة: {{booking_number}} ، {{booking_title}}"
                  : "Variables: {{booking_number}}, {{booking_title}}"}
              </p>
            </div>

            <div className="flex items-center justify-between border-t pt-4">
              <Label className="flex items-center gap-2 cursor-pointer">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                {form.is_active ? (
                  <>
                    <Power className="w-4 h-4 text-emerald-600" />
                    {isArabic ? "نشطة" : "Active"}
                  </>
                ) : (
                  <>
                    <PowerOff className="w-4 h-4 text-muted-foreground" />
                    {isArabic ? "متوقفة" : "Paused"}
                  </>
                )}
              </Label>
            </div>
          </div>
          <div className="flex justify-end gap-2 p-4 border-t bg-muted/30">
            <Button variant="outline" onClick={() => setShowDialog(false)} disabled={saving}>
              {isArabic ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleSave} disabled={saving}>
              {saving && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
              {isArabic ? "حفظ" : "Save"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
