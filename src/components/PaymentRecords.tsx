import { useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Trash2, Loader2, CreditCard, Banknote,
  Building2, Smartphone, Receipt, DollarSign, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ModalDarkHeader } from "@/components/ui/modal-dark-header";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash", icon: Banknote },
  { value: "bank_transfer", label: "Bank Transfer", icon: Building2 },
  { value: "credit_card", label: "Credit Card", icon: CreditCard },
  { value: "mobile_payment", label: "Mobile Payment", icon: Smartphone },
  { value: "check", label: "Check", icon: Receipt },
  { value: "other", label: "Other", icon: DollarSign },
];

interface PaymentRecordsProps {
  bookingId: string;
  companyId: string;
  currency: string;
  sellingPrice: number;
  onTotalPaidChange?: (total: number) => void;
  /** When true, hides the summary cards and progress bar (used when embedded in a parent that already shows them) */
  compact?: boolean;
}

export function PaymentRecords({ bookingId, companyId, currency, sellingPrice, onTotalPaidChange }: PaymentRecordsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const { direction } = useLanguage();
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [deletingPaymentId, setDeletingPaymentId] = useState<string | null>(null);
  const [newPayment, setNewPayment] = useState({
    amount: "",
    payment_method: "cash",
    payment_date: new Date().toISOString().split("T")[0],
    reference_number: "",
    notes: "",
  });

  const { data: payments = [], isLoading } = useQuery({
    queryKey: ["payment-records", bookingId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_records")
        .select("*")
        .eq("booking_id", bookingId)
        .order("payment_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const remaining = sellingPrice - totalPaid;
  const paidPercentage = sellingPrice > 0 ? Math.min(100, Math.round((totalPaid / sellingPrice) * 100)) : 0;

  const validateForm = useCallback(() => {
    const errors: Record<string, string> = {};
    const amount = parseFloat(newPayment.amount);
    if (!newPayment.amount || isNaN(amount) || amount <= 0) {
      errors.amount = "Enter a valid amount greater than 0";
    } else if (amount > 999999999) {
      errors.amount = "Amount is too large";
    }
    if (!newPayment.payment_date) {
      errors.payment_date = "Payment date is required";
    }
    if (newPayment.reference_number.length > 100) {
      errors.reference_number = "Reference number too long (max 100)";
    }
    if (newPayment.notes.length > 500) {
      errors.notes = "Notes too long (max 500 characters)";
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }, [newPayment]);

  const resetForm = useCallback(() => {
    setNewPayment({
      amount: "",
      payment_method: "cash",
      payment_date: new Date().toISOString().split("T")[0],
      reference_number: "",
      notes: "",
    });
    setFormErrors({});
  }, []);

  const addPayment = useMutation({
    mutationFn: async () => {
      if (!validateForm()) throw new Error("Validation failed");

      const amount = parseFloat(newPayment.amount);
      const { error } = await supabase.from("payment_records").insert({
        booking_id: bookingId,
        company_id: companyId,
        amount,
        currency,
        payment_method: newPayment.payment_method,
        payment_date: newPayment.payment_date,
        reference_number: newPayment.reference_number.trim() || null,
        notes: newPayment.notes.trim() || null,
        recorded_by: user?.id,
      });
      if (error) throw error;

      const newTotal = totalPaid + amount;
      const status = newTotal >= sellingPrice ? "paid" : newTotal > 0 ? "partial" : "unpaid";
      await supabase.from("bookings").update({
        amount_paid: newTotal,
        payment_status: status,
      }).eq("id", bookingId);

      await supabase.from("booking_activities").insert({
        booking_id: bookingId,
        activity_type: "payment",
        title: `Payment of ${amount.toLocaleString()} ${currency} recorded`,
        description: `Method: ${newPayment.payment_method.replace("_", " ")}${newPayment.reference_number ? ` | Ref: ${newPayment.reference_number}` : ""}`,
        user_id: user?.id,
      });

      return newTotal;
    },
    onSuccess: (newTotal) => {
      queryClient.invalidateQueries({ queryKey: ["payment-records", bookingId] });
      queryClient.invalidateQueries({ queryKey: ["booking", bookingId] });
      queryClient.invalidateQueries({ queryKey: ["booking-activities", bookingId] });
      setShowAddDialog(false);
      resetForm();
      toast({ title: "Payment recorded successfully" });
      onTotalPaidChange?.(newTotal);
    },
    onError: (err: Error) => {
      if (err.message !== "Validation failed") {
        toast({ title: "Failed to record payment", description: err.message, variant: "destructive" });
      }
    },
  });

  const deletePayment = useMutation({
    mutationFn: async (paymentId: string) => {
      const payment = payments.find(p => p.id === paymentId);
      const { error } = await supabase.from("payment_records").delete().eq("id", paymentId);
      if (error) throw error;

      const newTotal = totalPaid - Number(payment?.amount || 0);
      const status = newTotal >= sellingPrice ? "paid" : newTotal > 0 ? "partial" : "unpaid";
      await supabase.from("bookings").update({
        amount_paid: Math.max(0, newTotal),
        payment_status: status,
      }).eq("id", bookingId);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-records", bookingId] });
      queryClient.invalidateQueries({ queryKey: ["booking", bookingId] });
      toast({ title: "Payment deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Failed to delete payment", description: err.message, variant: "destructive" });
    },
  });

  const getMethodIcon = (method: string) => {
    return PAYMENT_METHODS.find(pm => pm.value === method)?.icon || DollarSign;
  };

  const getMethodLabel = (method: string) => {
    return PAYMENT_METHODS.find(pm => pm.value === method)?.label || method;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Receipt className="w-4 h-4 text-accent" /> Payment Records
          {payments.length > 0 && (
            <Badge variant="secondary" className="text-[10px]">{payments.length}</Badge>
          )}
        </CardTitle>
        <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={() => setShowAddDialog(true)}>
          <Plus className="w-3 h-3" /> Record Payment
        </Button>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-lg border border-border p-2.5 text-center">
          <p className="text-[9px] text-muted-foreground uppercase font-medium tracking-wider">Total</p>
          <p className="text-sm font-bold font-mono text-foreground mt-0.5">{sellingPrice.toLocaleString()}</p>
          <p className="text-[9px] text-muted-foreground">{currency}</p>
        </div>
        <div className="rounded-lg border border-border p-2.5 text-center">
          <p className="text-[9px] text-muted-foreground uppercase font-medium tracking-wider">Paid</p>
          <p className="text-sm font-bold font-mono text-emerald-600 mt-0.5">{totalPaid.toLocaleString()}</p>
          <p className="text-[9px] text-muted-foreground">{currency}</p>
        </div>
        <div className={cn(
          "rounded-lg border p-2.5 text-center transition-colors",
          remaining > 0 ? "border-amber-200 bg-amber-50/50 dark:bg-amber-950/20" : "border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20"
        )}>
          <p className="text-[9px] text-muted-foreground uppercase font-medium tracking-wider">Remaining</p>
          <p className={cn("text-sm font-bold font-mono mt-0.5", remaining > 0 ? "text-amber-600" : "text-emerald-600")}>
            {Math.max(0, remaining).toLocaleString()}
          </p>
          <p className="text-[9px] text-muted-foreground">{currency}</p>
        </div>
      </div>

      {/* Progress bar */}
      {sellingPrice > 0 && (
        <div className="space-y-1">
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <motion.div
              className={cn("h-full rounded-full transition-colors", paidPercentage >= 100 ? "bg-emerald-500" : "bg-accent")}
              initial={{ width: 0 }}
              animate={{ width: `${paidPercentage}%` }}
              transition={{ duration: 0.6, ease: "easeOut" }}
            />
          </div>
          <div className="flex items-center justify-between">
            <p className="text-[10px] text-muted-foreground">
              {paidPercentage >= 100 ? "✓ Fully paid" : `${paidPercentage}% paid`}
            </p>
            {remaining > 0 && sellingPrice > 0 && (
              <p className="text-[10px] text-muted-foreground">
                {remaining.toLocaleString()} {currency} remaining
              </p>
            )}
          </div>
        </div>
      )}

      <Separator />

      {/* Payment list */}
      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-8 gap-2">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <p className="text-[10px] text-muted-foreground">Loading payments...</p>
        </div>
      ) : payments.length === 0 ? (
        <div className="text-center py-8 space-y-2">
          <div className="w-12 h-12 rounded-full bg-muted/50 flex items-center justify-center mx-auto">
            <CreditCard className="w-6 h-6 text-muted-foreground/30" />
          </div>
          <p className="text-xs font-medium text-muted-foreground">No payments recorded yet</p>
          <p className="text-[10px] text-muted-foreground max-w-[200px] mx-auto">
            Click "Record Payment" to track deposits and installments for this booking
          </p>
        </div>
      ) : (
        <div className="space-y-1.5">
          <AnimatePresence>
            {payments.map((payment: any, i: number) => {
              const Icon = getMethodIcon(payment.payment_method);
              return (
                <motion.div
                  key={payment.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, height: 0 }}
                  transition={{ delay: i * 0.03 }}
                  className="group flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold font-mono text-foreground">
                        +{Number(payment.amount).toLocaleString()} {payment.currency}
                      </span>
                      <Badge variant="outline" className="text-[9px] capitalize shrink-0">{getMethodLabel(payment.payment_method)}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground mt-0.5">
                      <span>{format(new Date(payment.payment_date), "MMM d, yyyy")}</span>
                      {payment.reference_number && (
                        <span className="font-mono truncate max-w-[120px]">Ref: {payment.reference_number}</span>
                      )}
                    </div>
                    {payment.notes && (
                      <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{payment.notes}</p>
                    )}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive/50 hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity shrink-0"
                    onClick={() => setDeletingPaymentId(payment.id)}
                    disabled={deletePayment.isPending}
                    title="Delete payment"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Add Payment Dialog */}
      <Dialog open={showAddDialog} onOpenChange={(v) => { if (!v) resetForm(); setShowAddDialog(v); }}>
        <DialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden dark-header-dialog">
          <ModalDarkHeader
            icon={<DollarSign className="w-5 h-5 text-accent-foreground" />}
            title="Record Payment"
            description={`Add a payment record in ${currency}`}
          />
          <div className="px-6 py-5 space-y-4">
            <div>
              <Label className="text-xs">Amount ({currency}) <span className="text-destructive">*</span></Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                max="999999999"
                value={newPayment.amount}
                onChange={e => { setNewPayment(p => ({ ...p, amount: e.target.value })); setFormErrors(prev => ({ ...prev, amount: "" })); }}
                placeholder="0.00"
                className={cn("h-9 text-sm font-mono", formErrors.amount && "border-destructive")}
                autoFocus
              />
              {formErrors.amount && (
                <p className="text-[10px] text-destructive mt-1 flex items-center gap-1">
                  <AlertCircle className="w-3 h-3" /> {formErrors.amount}
                </p>
              )}
              {remaining > 0 && (
                <button
                  type="button"
                  className="text-[10px] text-accent hover:underline mt-1 font-medium"
                  onClick={() => { setNewPayment(p => ({ ...p, amount: remaining.toString() })); setFormErrors(prev => ({ ...prev, amount: "" })); }}
                >
                  Fill remaining balance: {remaining.toLocaleString()} {currency}
                </button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Payment Method</Label>
                <Select value={newPayment.payment_method} onValueChange={v => setNewPayment(p => ({ ...p, payment_method: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PAYMENT_METHODS.map(m => (
                      <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Payment Date <span className="text-destructive">*</span></Label>
                <Input
                  type="date"
                  value={newPayment.payment_date}
                  onChange={e => { setNewPayment(p => ({ ...p, payment_date: e.target.value })); setFormErrors(prev => ({ ...prev, payment_date: "" })); }}
                  className={cn("h-9 text-sm", formErrors.payment_date && "border-destructive")}
                />
                {formErrors.payment_date && (
                  <p className="text-[10px] text-destructive mt-1 flex items-center gap-1">
                    <AlertCircle className="w-3 h-3" /> {formErrors.payment_date}
                  </p>
                )}
              </div>
            </div>
            <div>
              <Label className="text-xs">Reference / Receipt Number</Label>
              <Input
                value={newPayment.reference_number}
                onChange={e => setNewPayment(p => ({ ...p, reference_number: e.target.value }))}
                placeholder="Transaction or receipt number"
                className={cn("h-9 text-sm font-mono", formErrors.reference_number && "border-destructive")}
                maxLength={100}
              />
              {formErrors.reference_number && (
                <p className="text-[10px] text-destructive mt-1">{formErrors.reference_number}</p>
              )}
            </div>
            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs">Finance Notes</Label>
                <span className="text-[9px] text-muted-foreground">{newPayment.notes.length}/500</span>
              </div>
              <Textarea
                value={newPayment.notes}
                onChange={e => setNewPayment(p => ({ ...p, notes: e.target.value }))}
                placeholder="Internal finance notes — not visible to client..."
                rows={2}
                className={cn("text-xs", formErrors.notes && "border-destructive")}
                maxLength={500}
              />
              {formErrors.notes && (
                <p className="text-[10px] text-destructive mt-1">{formErrors.notes}</p>
              )}
            </div>
          </div>
          <div className="px-6 py-4 border-t border-border flex items-center justify-end gap-2">
            <Button variant="outline" size="sm" onClick={() => { resetForm(); setShowAddDialog(false); }}>
              Cancel
            </Button>
            <Button
              size="sm"
              disabled={addPayment.isPending}
              onClick={() => addPayment.mutate()}
              className="gap-1.5"
            >
              {addPayment.isPending ? (
                <><Loader2 className="w-3.5 h-3.5 animate-spin" /> Recording...</>
              ) : (
                "Record Payment"
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingPaymentId} onOpenChange={(open) => !open && setDeletingPaymentId(null)}>
        <AlertDialogContent className="sm:max-w-md p-0 gap-0 overflow-hidden">
          <div className="bg-[hsl(var(--sidebar-background))] px-6 py-5 flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl gold-gradient flex items-center justify-center shadow-lg">
              <Trash2 className="w-5 h-5 text-accent-foreground" />
            </div>
            <div>
              <AlertDialogTitle className="text-base font-bold text-white font-display">Delete Payment</AlertDialogTitle>
              <AlertDialogDescription className="text-xs text-white/60 mt-0.5">This action cannot be undone</AlertDialogDescription>
            </div>
          </div>
          <div className="px-6 py-5">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete this payment record? The booking balance will be recalculated automatically.
            </p>
          </div>
          <AlertDialogFooter className="px-6 py-4 border-t border-border">
            <AlertDialogCancel className="text-xs">Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 text-xs"
              disabled={deletePayment.isPending}
              onClick={() => {
                if (deletingPaymentId) {
                  deletePayment.mutate(deletingPaymentId, {
                    onSettled: () => setDeletingPaymentId(null),
                  });
                }
              }}
            >
              {deletePayment.isPending ? <><Loader2 className="w-3.5 h-3.5 animate-spin mr-1" /> Deleting...</> : "Delete Payment"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
