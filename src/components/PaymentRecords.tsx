import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Trash2, Loader2, CreditCard, Banknote,
  Building2, Smartphone, Receipt, DollarSign,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
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
}

export function PaymentRecords({ bookingId, companyId, currency, sellingPrice, onTotalPaidChange }: PaymentRecordsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [showAddDialog, setShowAddDialog] = useState(false);
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

  const addPayment = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("payment_records").insert({
        booking_id: bookingId,
        company_id: companyId,
        amount: parseFloat(newPayment.amount) || 0,
        currency,
        payment_method: newPayment.payment_method,
        payment_date: newPayment.payment_date,
        reference_number: newPayment.reference_number || null,
        notes: newPayment.notes || null,
        recorded_by: user?.id,
      });
      if (error) throw error;

      // Update booking amount_paid and payment_status
      const newTotal = totalPaid + (parseFloat(newPayment.amount) || 0);
      const status = newTotal >= sellingPrice ? "paid" : newTotal > 0 ? "partial" : "unpaid";
      await supabase.from("bookings").update({
        amount_paid: newTotal,
        payment_status: status,
      }).eq("id", bookingId);

      // Log activity
      await supabase.from("booking_activities").insert({
        booking_id: bookingId,
        activity_type: "payment",
        title: `Payment of ${parseFloat(newPayment.amount).toLocaleString()} ${currency} recorded`,
        description: `Method: ${newPayment.payment_method.replace("_", " ")}${newPayment.reference_number ? ` | Ref: ${newPayment.reference_number}` : ""}`,
        user_id: user?.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["payment-records", bookingId] });
      queryClient.invalidateQueries({ queryKey: ["booking", bookingId] });
      queryClient.invalidateQueries({ queryKey: ["booking-activities", bookingId] });
      setShowAddDialog(false);
      setNewPayment({ amount: "", payment_method: "cash", payment_date: new Date().toISOString().split("T")[0], reference_number: "", notes: "" });
      toast({ title: "Payment recorded" });
      onTotalPaidChange?.(totalPaid + (parseFloat(newPayment.amount) || 0));
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
  });

  const getMethodIcon = (method: string) => {
    const m = PAYMENT_METHODS.find(pm => pm.value === method);
    return m ? m.icon : DollarSign;
  };

  const getMethodLabel = (method: string) => {
    return PAYMENT_METHODS.find(pm => pm.value === method)?.label || method;
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <CardTitle className="text-sm font-semibold flex items-center gap-2">
          <Receipt className="w-4 h-4 text-accent" /> Payment Records
        </CardTitle>
        <Button size="sm" variant="outline" className="h-7 text-[10px] gap-1" onClick={() => setShowAddDialog(true)}>
          <Plus className="w-3 h-3" /> Record Payment
        </Button>
      </div>

      {/* Summary bar */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg border border-border p-3 text-center">
          <p className="text-[10px] text-muted-foreground uppercase">Total</p>
          <p className="text-sm font-bold font-mono text-foreground">{sellingPrice.toLocaleString()}</p>
        </div>
        <div className="rounded-lg border border-border p-3 text-center">
          <p className="text-[10px] text-muted-foreground uppercase">Paid</p>
          <p className="text-sm font-bold font-mono text-emerald-600">{totalPaid.toLocaleString()}</p>
        </div>
        <div className={cn("rounded-lg border p-3 text-center", remaining > 0 ? "border-amber-200 bg-amber-50/50" : "border-emerald-200 bg-emerald-50/50")}>
          <p className="text-[10px] text-muted-foreground uppercase">Remaining</p>
          <p className={cn("text-sm font-bold font-mono", remaining > 0 ? "text-amber-600" : "text-emerald-600")}>
            {remaining > 0 ? remaining.toLocaleString() : "0"}
          </p>
        </div>
      </div>

      {/* Progress bar */}
      {sellingPrice > 0 && (
        <div className="space-y-1">
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <motion.div
              className="h-full rounded-full bg-emerald-500"
              initial={{ width: 0 }}
              animate={{ width: `${Math.min(100, (totalPaid / sellingPrice) * 100)}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground text-right">
            {Math.round((totalPaid / sellingPrice) * 100)}% paid
          </p>
        </div>
      )}

      <Separator />

      {/* Payment list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : payments.length === 0 ? (
        <div className="text-center py-6">
          <CreditCard className="w-8 h-8 text-muted-foreground/30 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">No payments recorded yet</p>
        </div>
      ) : (
        <div className="space-y-2">
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
                  className="flex items-center gap-3 p-3 rounded-lg border border-border hover:bg-muted/30 transition-colors"
                >
                  <div className="w-8 h-8 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
                    <Icon className="w-4 h-4 text-accent" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold font-mono text-foreground">
                        +{Number(payment.amount).toLocaleString()} {payment.currency}
                      </span>
                      <Badge variant="outline" className="text-[9px] capitalize">{getMethodLabel(payment.payment_method)}</Badge>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] text-muted-foreground">
                      <span>{format(new Date(payment.payment_date), "MMM d, yyyy")}</span>
                      {payment.reference_number && <span className="font-mono">Ref: {payment.reference_number}</span>}
                    </div>
                    {payment.notes && <p className="text-[10px] text-muted-foreground mt-0.5 truncate">{payment.notes}</p>}
                  </div>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-7 w-7 text-destructive hover:text-destructive shrink-0"
                    onClick={() => deletePayment.mutate(payment.id)}
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
      <Dialog open={showAddDialog} onOpenChange={setShowAddDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-accent" /> Record Payment
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label className="text-xs">Amount ({currency}) *</Label>
              <Input
                type="number"
                min="0"
                step="0.01"
                value={newPayment.amount}
                onChange={e => setNewPayment(p => ({ ...p, amount: e.target.value }))}
                placeholder="0.00"
                className="h-9 text-sm font-mono"
              />
              {remaining > 0 && (
                <button
                  type="button"
                  className="text-[10px] text-accent hover:underline mt-1"
                  onClick={() => setNewPayment(p => ({ ...p, amount: remaining.toString() }))}
                >
                  Fill remaining: {remaining.toLocaleString()} {currency}
                </button>
              )}
            </div>
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
              <Label className="text-xs">Payment Date</Label>
              <Input
                type="date"
                value={newPayment.payment_date}
                onChange={e => setNewPayment(p => ({ ...p, payment_date: e.target.value }))}
                className="h-9 text-sm"
              />
            </div>
            <div>
              <Label className="text-xs">Reference Number</Label>
              <Input
                value={newPayment.reference_number}
                onChange={e => setNewPayment(p => ({ ...p, reference_number: e.target.value }))}
                placeholder="Transaction/receipt number"
                className="h-9 text-sm font-mono"
              />
            </div>
            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea
                value={newPayment.notes}
                onChange={e => setNewPayment(p => ({ ...p, notes: e.target.value }))}
                placeholder="Internal finance notes..."
                rows={2}
                className="text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setShowAddDialog(false)}>Cancel</Button>
            <Button
              size="sm"
              disabled={!newPayment.amount || parseFloat(newPayment.amount) <= 0 || addPayment.isPending}
              onClick={() => addPayment.mutate()}
            >
              {addPayment.isPending ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
