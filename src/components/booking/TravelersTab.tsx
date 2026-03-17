import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users, User, Baby, Plus, Pencil, Trash2, ChevronDown, ChevronUp,
  Globe, Shield, Calendar, CheckCircle2, UserPlus, Sparkles, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface TravelerSlot {
  index: number;
  label: string;
  isAdult: boolean;
  isCustomer: boolean;
  traveler: any | null;
}

interface TravelersTabProps {
  travelers: any[];
  isArabic: boolean;
  onAdd: (prefill?: Partial<any>) => void;
  onEdit: (traveler: any) => void;
  onDelete: (id: string) => void;
  adultsCount: number;
  childrenCount: number;
  customer?: any;
  onAddCustomerAsTraveler?: () => void;
}

export function TravelersTab({
  travelers,
  isArabic,
  onAdd,
  onEdit,
  onDelete,
  adultsCount,
  childrenCount,
  customer,
  onAddCustomerAsTraveler,
}: TravelersTabProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const totalSlots = adultsCount + childrenCount;

  // Build slots: match existing travelers to slots
  const slots = useMemo<TravelerSlot[]>(() => {
    const adultTravelers = travelers.filter((t) => t.is_adult !== false);
    const childTravelers = travelers.filter((t) => t.is_adult === false);
    const result: TravelerSlot[] = [];

    for (let i = 0; i < adultsCount; i++) {
      result.push({
        index: i,
        label: isArabic ? `بالغ ${i + 1}` : `Adult ${i + 1}`,
        isAdult: true,
        isCustomer: i === 0,
        traveler: adultTravelers[i] || null,
      });
    }
    for (let i = 0; i < childrenCount; i++) {
      result.push({
        index: adultsCount + i,
        label: isArabic ? `طفل ${i + 1}` : `Child ${i + 1}`,
        isAdult: false,
        isCustomer: false,
        traveler: childTravelers[i] || null,
      });
    }
    return result;
  }, [travelers, adultsCount, childrenCount, isArabic]);

  const completedCount = slots.filter((s) => s.traveler).length;
  const progressPercent = totalSlots > 0 ? (completedCount / totalSlots) * 100 : 0;
  const allComplete = completedCount === totalSlots;

  // Check if customer is already added as traveler
  const customerAlreadyAdded = customer && travelers.some(
    (t) => t.is_lead_traveler || t.full_name === customer.full_name
  );

  const getFieldCompleteness = (t: any) => {
    const fields = ["full_name", "passport_number", "nationality", "date_of_birth"];
    const filled = fields.filter((f) => t[f]);
    return { filled: filled.length, total: fields.length, complete: filled.length === fields.length };
  };

  return (
    <div className="space-y-6">
      {/* ─── Progress Header ─── */}
      <Card className="border-border/60 shadow-sm overflow-hidden">
        <CardContent className="p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                <Users className="w-5 h-5 text-primary" />
              </div>
              <div>
                <h3 className="text-sm font-semibold text-foreground">
                  {isArabic ? "إدارة المسافرين" : "Traveler Management"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {isArabic
                    ? `${completedCount} من ${totalSlots} مسافرين مكتملين`
                    : `${completedCount} of ${totalSlots} Travelers Completed`}
                </p>
              </div>
            </div>
            {allComplete && (
              <Badge className="bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-400 border-0 gap-1">
                <CheckCircle2 className="w-3 h-3" />
                {isArabic ? "مكتمل" : "Complete"}
              </Badge>
            )}
          </div>
          <div className="space-y-2">
            <Progress value={progressPercent} className="h-2.5 bg-muted" />
            <div className="flex justify-between text-[10px] text-muted-foreground">
              <span>{adultsCount} {isArabic ? "بالغين" : "Adults"} · {childrenCount} {isArabic ? "أطفال" : "Children"}</span>
              <span className="font-mono font-semibold text-foreground">{Math.round(progressPercent)}%</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ─── Add Customer as Traveler ─── */}
      {customer && !customerAlreadyAdded && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-3 p-3.5 rounded-xl border border-primary/20 bg-primary/5"
        >
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
            <UserPlus className="w-4 h-4 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-foreground">{customer.full_name}</p>
            <p className="text-[11px] text-muted-foreground">
              {isArabic ? "أضف العميل كمسافر رئيسي" : "Add customer as lead traveler"}
            </p>
          </div>
          <Button
            size="sm"
            className="text-xs gap-1.5 shrink-0"
            onClick={onAddCustomerAsTraveler}
          >
            <UserPlus className="w-3.5 h-3.5" />
            {isArabic ? "إضافة" : "Add as Traveler"}
          </Button>
        </motion.div>
      )}

      {/* ─── Traveler Cards Grid ─── */}
      {totalSlots === 0 ? (
        <div className="text-center py-16 space-y-4">
          <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto">
            <Users className="w-8 h-8 text-muted-foreground/40" />
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">
              {isArabic ? "لا يوجد مسافرون" : "No travelers expected"}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {isArabic ? "عدد البالغين والأطفال يساوي صفر" : "Adults and children count is zero"}
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {slots.map((slot, idx) => (
            <motion.div
              key={`slot-${idx}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.06, duration: 0.3 }}
            >
              {slot.traveler ? (
                <FilledTravelerCard
                  slot={slot}
                  isArabic={isArabic}
                  expanded={expandedId === slot.traveler.id}
                  onToggle={() => setExpandedId(expandedId === slot.traveler.id ? null : slot.traveler.id)}
                  onEdit={() => onEdit(slot.traveler)}
                  onDelete={() => onDelete(slot.traveler.id)}
                  completeness={getFieldCompleteness(slot.traveler)}
                />
              ) : (
                <EmptyTravelerCard
                  slot={slot}
                  isArabic={isArabic}
                  onAdd={() => onAdd({ is_adult: slot.isAdult, _isNew: true, full_name: "" })}
                />
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* ─── Actions Footer ─── */}
      {totalSlots > 0 && (
        <div className="flex items-center justify-between pt-2">
          <Button
            variant="outline"
            size="sm"
            className="text-xs gap-1.5"
            onClick={() => onAdd({ _isNew: true, full_name: "", is_adult: true })}
          >
            <Plus className="w-3.5 h-3.5" />
            {isArabic ? "مسافر إضافي" : "Add Extra Traveler"}
          </Button>

          {travelers.length === 0 && totalSlots > 0 && (
            <Button
              size="sm"
              className="text-xs gap-1.5"
              onClick={() => {
                // Auto-generate empty slots
                for (let i = 0; i < adultsCount; i++) {
                  onAdd({ _isNew: true, full_name: "", is_adult: true, is_lead_traveler: i === 0 });
                }
                for (let i = 0; i < childrenCount; i++) {
                  onAdd({ _isNew: true, full_name: "", is_adult: false });
                }
              }}
            >
              <Sparkles className="w-3.5 h-3.5" />
              {isArabic ? "توليد المسافرين" : "Generate Travelers"}
            </Button>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Filled Traveler Card ───

function FilledTravelerCard({
  slot,
  isArabic,
  expanded,
  onToggle,
  onEdit,
  onDelete,
  completeness,
}: {
  slot: TravelerSlot;
  isArabic: boolean;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  completeness: { filled: number; total: number; complete: boolean };
}) {
  const t = slot.traveler;
  const isAdult = slot.isAdult;

  return (
    <Card
      className={cn(
        "border shadow-sm overflow-hidden transition-all duration-200 hover:shadow-md",
        isAdult
          ? "border-blue-200/60 dark:border-blue-800/40"
          : "border-emerald-200/60 dark:border-emerald-800/40"
      )}
    >
      <CardContent className="p-0">
        {/* Card Header */}
        <div
          className={cn(
            "flex items-center gap-3 p-4 cursor-pointer transition-colors",
            isAdult
              ? "bg-blue-50/50 dark:bg-blue-950/20 hover:bg-blue-50/80 dark:hover:bg-blue-950/30"
              : "bg-emerald-50/50 dark:bg-emerald-950/20 hover:bg-emerald-50/80 dark:hover:bg-emerald-950/30"
          )}
          onClick={onToggle}
        >
          {/* Avatar */}
          <div
            className={cn(
              "w-11 h-11 rounded-xl flex items-center justify-center text-lg shrink-0 shadow-sm",
              isAdult
                ? "bg-blue-100 dark:bg-blue-900/50"
                : "bg-emerald-100 dark:bg-emerald-900/50"
            )}
          >
            {isAdult ? "👤" : "🧒"}
          </div>

          {/* Info */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-foreground truncate">
                {t.full_name || slot.label}
              </p>
              {slot.isCustomer && t.is_lead_traveler && (
                <Badge className="text-[9px] bg-primary/10 text-primary border-0 gap-0.5">
                  <Shield className="w-2.5 h-2.5" />
                  {isArabic ? "عميل" : "Customer"}
                </Badge>
              )}
              {t.is_lead_traveler && !slot.isCustomer && (
                <Badge className="text-[9px] bg-accent/10 text-accent border-0">
                  {isArabic ? "رئيسي" : "Lead"}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-3 mt-0.5 text-[10px] text-muted-foreground">
              <span className={cn(
                "font-medium",
                isAdult ? "text-blue-600 dark:text-blue-400" : "text-emerald-600 dark:text-emerald-400"
              )}>
                {slot.label}
              </span>
              {t.nationality && (
                <span className="flex items-center gap-0.5">
                  <Globe className="w-2.5 h-2.5" /> {t.nationality}
                </span>
              )}
              {t.passport_number && (
                <span className="font-mono">{t.passport_number}</span>
              )}
            </div>
          </div>

          {/* Actions & Expand */}
          <div className="flex items-center gap-1 shrink-0">
            {!completeness.complete && (
              <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400 me-1" title="Incomplete fields">
                <AlertCircle className="w-3.5 h-3.5" />
                <span className="text-[10px] font-medium">{completeness.filled}/{completeness.total}</span>
              </div>
            )}
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={(e) => { e.stopPropagation(); onEdit(); }}
            >
              <Pencil className="w-3 h-3" />
            </Button>
            {!t.is_lead_traveler && (
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-destructive hover:text-destructive"
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
              >
                <Trash2 className="w-3 h-3" />
              </Button>
            )}
            {expanded ? (
              <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            )}
          </div>
        </div>

        {/* Expanded Details */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <Separator />
              <div className="p-4 bg-card space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: isArabic ? "الاسم الكامل" : "Full Name", val: t.full_name, icon: User },
                    { label: isArabic ? "الجنسية" : "Nationality", val: t.nationality, icon: Globe },
                    { label: isArabic ? "رقم الجواز" : "Passport Number", val: t.passport_number, icon: Shield, mono: true },
                    { label: isArabic ? "تاريخ الميلاد" : "Date of Birth", val: t.date_of_birth ? format(new Date(t.date_of_birth), "MMM d, yyyy") : null, icon: Calendar },
                    { label: isArabic ? "انتهاء الجواز" : "Passport Expiry", val: t.passport_expiry ? format(new Date(t.passport_expiry), "MMM d, yyyy") : null, icon: Calendar },
                    { label: isArabic ? "بلد الإصدار" : "Issuing Country", val: t.passport_country, icon: Globe },
                    { label: isArabic ? "الجنس" : "Gender", val: t.gender },
                    { label: isArabic ? "تفضيل الغرفة" : "Room Preference", val: t.room_preference },
                  ].map((field, fidx) => (
                    <div key={fidx} className="space-y-0.5">
                      <Label className="text-[10px] text-muted-foreground uppercase tracking-wider flex items-center gap-1">
                        {field.icon && <field.icon className="w-2.5 h-2.5" />}
                        {field.label}
                      </Label>
                      {field.val ? (
                        <p className={cn("text-xs font-medium text-foreground", field.mono && "font-mono")}>
                          {field.val}
                        </p>
                      ) : (
                        <p className="text-xs text-muted-foreground/50 italic">
                          {isArabic ? "غير محدد" : "Not set"}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
                {t.special_requirements && (
                  <div className="pt-2 border-t border-border/50">
                    <Label className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      {isArabic ? "متطلبات خاصة" : "Special Requirements"}
                    </Label>
                    <p className="text-xs text-foreground mt-0.5">{t.special_requirements}</p>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}

// ─── Empty Traveler Card ───

function EmptyTravelerCard({
  slot,
  isArabic,
  onAdd,
}: {
  slot: TravelerSlot;
  isArabic: boolean;
  onAdd: () => void;
}) {
  const isAdult = slot.isAdult;

  return (
    <Card
      className={cn(
        "border border-dashed shadow-none transition-all duration-200 hover:shadow-sm cursor-pointer group",
        isAdult
          ? "border-blue-200/80 dark:border-blue-800/50 hover:border-blue-300 dark:hover:border-blue-700"
          : "border-emerald-200/80 dark:border-emerald-800/50 hover:border-emerald-300 dark:hover:border-emerald-700"
      )}
      onClick={onAdd}
    >
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          {/* Avatar placeholder */}
          <div
            className={cn(
              "w-11 h-11 rounded-xl flex items-center justify-center text-lg shrink-0 transition-colors",
              isAdult
                ? "bg-blue-50 dark:bg-blue-950/30 group-hover:bg-blue-100 dark:group-hover:bg-blue-900/40"
                : "bg-emerald-50 dark:bg-emerald-950/30 group-hover:bg-emerald-100 dark:group-hover:bg-emerald-900/40"
            )}
          >
            {isAdult ? "👤" : "🧒"}
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
              {slot.label}
            </p>
            {slot.isCustomer && (
              <p className="text-[10px] text-muted-foreground/60">
                {isArabic ? "العميل الرئيسي" : "Primary customer"}
              </p>
            )}
            <div className="flex items-center gap-1 mt-1">
              {["First Name", "Last Name", "Passport", "DOB"].map((f, i) => (
                <div
                  key={i}
                  className="h-1.5 flex-1 rounded-full bg-muted/60 max-w-[40px]"
                />
              ))}
            </div>
          </div>

          <div
            className={cn(
              "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
              isAdult
                ? "bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400 group-hover:bg-blue-200"
                : "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400 group-hover:bg-emerald-200"
            )}
          >
            <Plus className="w-4 h-4" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
