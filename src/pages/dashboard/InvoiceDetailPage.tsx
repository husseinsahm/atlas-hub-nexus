import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { motion } from "framer-motion";
import {
  ArrowLeft, Calendar, DollarSign, Loader2, Send, CheckCircle2, Clock,
  FileText, Trash2, Ban, Printer, Download, CreditCard, Banknote,
  Building2, Smartphone, Receipt, AlertCircle, MoreVertical, User,
  Phone, Mail, MapPin, Briefcase, ChevronRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

type InvoiceStatus = "draft" | "sent" | "paid" | "partial" | "overdue" | "cancelled" | "void";

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; labelAr: string; className: string; dotColor: string }> = {
  draft:     { label: "Draft",     labelAr: "مسودة",   className: "bg-muted text-muted-foreground",                                dotColor: "bg-muted-foreground/50" },
  sent:      { label: "Sent",      labelAr: "مُرسلة",  className: "bg-secondary/15 text-secondary dark:bg-secondary/25",           dotColor: "bg-secondary" },
  paid:      { label: "Paid",      labelAr: "مدفوعة",  className: "bg-[hsl(var(--success)/0.15)] text-[hsl(var(--success))]",      dotColor: "bg-[hsl(var(--success))]" },
  partial:   { label: "Partial",   labelAr: "جزئي",    className: "bg-[hsl(var(--warning)/0.15)] text-[hsl(var(--warning))]",      dotColor: "bg-[hsl(var(--warning))]" },
  overdue:   { label: "Overdue",   labelAr: "متأخرة",  className: "bg-destructive/10 text-destructive",                            dotColor: "bg-destructive" },
  cancelled: { label: "Cancelled", labelAr: "ملغاة",   className: "bg-muted text-muted-foreground",                                dotColor: "bg-muted-foreground/40" },
  void:      { label: "Void",      labelAr: "باطلة",   className: "bg-muted text-muted-foreground line-through",                   dotColor: "bg-muted-foreground/30" },
};

const PAYMENT_METHODS = [
  { value: "cash", label: "Cash", labelAr: "نقد", icon: Banknote },
  { value: "bank_transfer", label: "Bank Transfer", labelAr: "تحويل بنكي", icon: Building2 },
  { value: "credit_card", label: "Credit Card", labelAr: "بطاقة ائتمان", icon: CreditCard },
  { value: "mobile_payment", label: "Mobile Payment", labelAr: "دفع إلكتروني", icon: Smartphone },
  { value: "check", label: "Check", labelAr: "شيك", icon: Receipt },
  { value: "other", label: "Other", labelAr: "أخرى", icon: DollarSign },
];

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const companyId = user?.activeMembership?.companyId;
  const isArabic = language === "ar";
  const canEdit = ["company_admin", "agent", "finance"].includes(user?.activeMembership?.role || "");

  const [showPaymentDialog, setShowPaymentDialog] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [savingPayment, setSavingPayment] = useState(false);
  const [paymentForm, setPaymentForm] = useState({
    amount: "", payment_method: "cash",
    payment_date: new Date().toISOString().split("T")[0],
    reference_number: "", notes: "",
  });

  const { data: invoice, isLoading } = useQuery({
    queryKey: ["invoice-detail", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("invoices" as any).select("*").eq("id", id!).single();
      if (error) throw error;
      return data as any;
    },
    enabled: !!id,
  });

  const { data: customer } = useQuery({
    queryKey: ["invoice-customer", invoice?.customer_id],
    queryFn: async () => {
      const { data, error } = await supabase.from("customers").select("full_name, email, phone, address, city, country").eq("id", invoice.customer_id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!invoice?.customer_id,
  });

  const { data: booking } = useQuery({
    queryKey: ["invoice-booking", invoice?.booking_id],
    queryFn: async () => {
      const { data, error } = await supabase.from("bookings").select("booking_number, title, start_date, end_date").eq("id", invoice.booking_id).single();
      if (error) throw error;
      return data;
    },
    enabled: !!invoice?.booking_id,
  });

  const { data: company } = useQuery({
    queryKey: ["invoice-company", companyId],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("name, email, phone, address, logo_url").eq("id", companyId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  const { data: payments = [] } = useQuery({
    queryKey: ["invoice-payments", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("payment_records").select("*").eq("invoice_id", id!).order("payment_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  const totalAmount = Number(invoice?.total_amount || 0);
  const remaining = totalAmount - Number(invoice?.amount_paid || 0);
  const paidPct = totalAmount > 0 ? Math.min(100, Math.round((Number(invoice?.amount_paid || 0) / totalAmount) * 100)) : 0;

  async function updateStatus(status: string) {
    try {
      const { error } = await supabase.from("invoices" as any).update({ status } as any).eq("id", id!);
      if (error) throw error;
      toast({ title: isArabic ? "تم تحديث الحالة" : "Status updated" });
      queryClient.invalidateQueries({ queryKey: ["invoice-detail", id] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  async function handleRecordPayment() {
    const amount = parseFloat(paymentForm.amount);
    if (!amount || amount <= 0) {
      toast({ title: isArabic ? "مبلغ غير صحيح" : "Invalid amount", variant: "destructive" }); return;
    }
    setSavingPayment(true);
    try {
      const { error: payErr } = await supabase.from("payment_records").insert({
        booking_id: invoice?.booking_id || null,
        invoice_id: id, company_id: companyId, amount,
        currency: invoice?.currency || "USD",
        payment_method: paymentForm.payment_method,
        payment_date: paymentForm.payment_date,
        reference_number: paymentForm.reference_number.trim() || null,
        notes: paymentForm.notes.trim() || null,
        recorded_by: user?.id,
      } as any);
      if (payErr) throw payErr;

      const newPaid = Number(invoice?.amount_paid || 0) + amount;
      const newStatus = newPaid >= totalAmount ? "paid" : "partial";
      const { error: invErr } = await supabase.from("invoices" as any).update({ amount_paid: newPaid, status: newStatus } as any).eq("id", id!);
      if (invErr) throw invErr;

      if (invoice?.booking_id) {
        const { data: bk } = await supabase.from("bookings").select("amount_paid").eq("id", invoice.booking_id).single();
        if (bk) {
          await supabase.from("bookings").update({ amount_paid: Number(bk.amount_paid || 0) + amount }).eq("id", invoice.booking_id);
        }
      }

      toast({ title: isArabic ? "تم تسجيل الدفعة" : "Payment recorded" });
      queryClient.invalidateQueries({ queryKey: ["invoice-detail", id] });
      queryClient.invalidateQueries({ queryKey: ["invoice-payments", id] });
      setShowPaymentDialog(false);
      setPaymentForm({ amount: "", payment_method: "cash", payment_date: new Date().toISOString().split("T")[0], reference_number: "", notes: "" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSavingPayment(false);
    }
  }

  async function handleDelete() {
    try {
      const { error } = await supabase.from("invoices" as any).update({ deleted_at: new Date().toISOString() } as any).eq("id", id!);
      if (error) throw error;
      toast({ title: isArabic ? "تم حذف الفاتورة" : "Invoice deleted" });
      navigate("/dashboard/invoices");
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  function handlePrint() { window.print(); }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!invoice) {
    return (
      <div className="text-center py-20">
        <Receipt className="w-12 h-12 mx-auto mb-3 text-muted-foreground/30" />
        <p className="text-foreground font-medium">{isArabic ? "الفاتورة غير موجودة" : "Invoice not found"}</p>
        <Button variant="outline" className="mt-4" onClick={() => navigate("/dashboard/invoices")}>
          {isArabic ? "العودة للفواتير" : "Back to Invoices"}
        </Button>
      </div>
    );
  }

  const sc = STATUS_CONFIG[invoice.status as InvoiceStatus] || STATUS_CONFIG.draft;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <button onClick={() => navigate("/dashboard")} className="hover:text-foreground transition-colors">
          {isArabic ? "لوحة التحكم" : "Dashboard"}
        </button>
        <ChevronRight className="w-3 h-3 rtl:rotate-180" />
        <button onClick={() => navigate("/dashboard/invoices")} className="hover:text-foreground transition-colors">
          {isArabic ? "الفواتير" : "Invoices"}
        </button>
        <ChevronRight className="w-3 h-3 rtl:rotate-180" />
        <span className="text-foreground font-medium">{invoice.invoice_number}</span>
      </nav>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
        className="relative overflow-hidden border border-border rounded-xl bg-gradient-to-br from-card via-card to-muted/30"
      >
        <div className="absolute top-0 inset-x-0 h-[3px] bg-gradient-to-r from-primary via-secondary to-primary/40" />
        <div className="p-5">
          <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 mt-0.5" onClick={() => navigate("/dashboard/invoices")}>
                <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
              </Button>
              <div>
                <div className="flex items-center gap-2.5">
                  <h1 className="text-xl font-bold font-display text-foreground">{invoice.invoice_number}</h1>
                  <Badge className={cn("text-[10px] border-0 gap-1 rounded-full px-2.5", sc.className)}>
                    <div className={cn("w-1.5 h-1.5 rounded-full", sc.dotColor)} />
                    {isArabic ? sc.labelAr : sc.label}
                  </Badge>
                </div>
                {customer && <p className="text-sm text-muted-foreground mt-0.5">{customer.full_name}</p>}
                {booking && (
                  <button
                    onClick={() => navigate(`/dashboard/bookings/${invoice.booking_id}`)}
                    className="text-xs text-primary hover:underline mt-0.5 flex items-center gap-1"
                  >
                    <Briefcase className="w-3 h-3" /> {booking.booking_number} — {booking.title}
                  </button>
                )}
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0 flex-wrap">
              {invoice.status === "draft" && canEdit && (
                <Button size="sm" onClick={() => updateStatus("sent")} className="gap-1.5">
                  <Send className="w-3.5 h-3.5" /> {isArabic ? "إرسال" : "Send Invoice"}
                </Button>
              )}
              {["sent", "partial", "overdue"].includes(invoice.status) && canEdit && (
                <Button size="sm" onClick={() => setShowPaymentDialog(true)} className="gap-1.5">
                  <DollarSign className="w-3.5 h-3.5" /> {isArabic ? "تسجيل دفعة" : "Record Payment"}
                </Button>
              )}
              <Button size="sm" variant="outline" onClick={handlePrint} className="gap-1.5">
                <Printer className="w-3.5 h-3.5" /> {isArabic ? "طباعة" : "Print"}
              </Button>
              <Button size="sm" variant="outline" onClick={handlePrint} className="gap-1.5">
                <Download className="w-3.5 h-3.5" /> PDF
              </Button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="outline" className="h-8 w-8">
                    <MoreVertical className="w-3.5 h-3.5" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-44">
                  {invoice.status === "draft" && (
                    <DropdownMenuItem onClick={() => updateStatus("sent")}>
                      <Send className="w-3.5 h-3.5 me-2" /> {isArabic ? "وضع كمرسلة" : "Mark as Sent"}
                    </DropdownMenuItem>
                  )}
                  {["sent", "partial"].includes(invoice.status) && (
                    <DropdownMenuItem onClick={() => updateStatus("paid")}>
                      <CheckCircle2 className="w-3.5 h-3.5 me-2" /> {isArabic ? "وضع كمدفوعة" : "Mark as Paid"}
                    </DropdownMenuItem>
                  )}
                  {invoice.status !== "void" && invoice.status !== "cancelled" && (
                    <DropdownMenuItem onClick={() => updateStatus("void")}>
                      <Ban className="w-3.5 h-3.5 me-2" /> {isArabic ? "إبطال" : "Void Invoice"}
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setShowDeleteDialog(true)} className="text-destructive">
                    <Trash2 className="w-3.5 h-3.5 me-2" /> {isArabic ? "حذف" : "Delete"}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>

          {/* Quick Stats */}
          <div className="flex flex-wrap gap-3 mt-4">
            {[
              { label: isArabic ? "الإجمالي" : "Total", value: `${invoice.currency} ${totalAmount.toLocaleString()}`, icon: DollarSign, color: "text-foreground" },
              { label: isArabic ? "المدفوع" : "Paid", value: `${invoice.currency} ${Number(invoice.amount_paid || 0).toLocaleString()}`, icon: CheckCircle2, color: "text-[hsl(var(--success))]" },
              { label: isArabic ? "المتبقي" : "Remaining", value: `${invoice.currency} ${remaining.toLocaleString()}`, icon: AlertCircle, color: remaining > 0 ? "text-[hsl(var(--warning))]" : "text-muted-foreground" },
              { label: isArabic ? "تاريخ الإصدار" : "Issue Date", value: format(new Date(invoice.issue_date), "MMM d, yyyy"), icon: Calendar, color: "text-muted-foreground" },
              ...(invoice.due_date ? [{ label: isArabic ? "تاريخ الاستحقاق" : "Due Date", value: format(new Date(invoice.due_date), "MMM d, yyyy"), icon: Clock, color: new Date(invoice.due_date) < new Date() ? "text-destructive" : "text-muted-foreground" }] : []),
            ].map(s => (
              <div key={s.label} className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-muted/40 border border-border/50">
                <s.icon className={cn("w-3.5 h-3.5", s.color)} />
                <div>
                  <p className="text-[9px] uppercase tracking-wider text-muted-foreground font-body">{s.label}</p>
                  <p className={cn("text-xs font-semibold font-display", s.color)}>{s.value}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Payment Progress */}
          {totalAmount > 0 && (
            <div className="mt-4">
              <div className="flex justify-between items-center mb-1.5">
                <span className="text-[10px] uppercase tracking-wider text-muted-foreground font-body">{isArabic ? "تقدم الدفع" : "Payment Progress"}</span>
                <span className="text-xs font-semibold font-display">{paidPct}%</span>
              </div>
              <Progress value={paidPct} className="h-2" />
            </div>
          )}
        </div>
      </motion.div>

      {/* Print-ready Invoice Card */}
      <Card className="print:shadow-none print:border-0" id="invoice-print">
        <CardContent className="p-6 sm:p-8 space-y-6">
          {/* Company Header */}
          <div className="flex justify-between items-start">
            <div className="flex items-center gap-3">
              {company?.logo_url ? (
                <img src={company.logo_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
              ) : (
                <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Building2 className="w-6 h-6 text-primary" />
                </div>
              )}
              <div>
                <h2 className="text-lg font-bold font-display">{company?.name || "Company"}</h2>
                {company?.email && <p className="text-xs text-muted-foreground">{company.email}</p>}
                {company?.phone && <p className="text-xs text-muted-foreground">{company.phone}</p>}
                {company?.address && <p className="text-xs text-muted-foreground">{company.address}</p>}
              </div>
            </div>
            <div className="text-end">
              <h3 className="text-2xl font-bold font-display text-primary">{isArabic ? "فاتورة" : "INVOICE"}</h3>
              <p className="text-sm font-mono font-medium mt-1">{invoice.invoice_number}</p>
              <Badge className={cn("text-[10px] border-0 gap-1 mt-1 rounded-full px-2.5", sc.className)}>
                <div className={cn("w-1.5 h-1.5 rounded-full", sc.dotColor)} />
                {isArabic ? sc.labelAr : sc.label}
              </Badge>
            </div>
          </div>

          <Separator />

          {/* Dates + Bill To */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <div>
              <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2 font-body">{isArabic ? "فاتورة إلى" : "Bill To"}</h4>
              <div className="space-y-1">
                <p className="text-sm font-semibold">{customer?.full_name || "—"}</p>
                {customer?.email && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Mail className="w-3 h-3" />{customer.email}</p>
                )}
                {customer?.phone && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5"><Phone className="w-3 h-3" />{customer.phone}</p>
                )}
                {(customer?.address || customer?.city || customer?.country) && (
                  <p className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <MapPin className="w-3 h-3" />
                    {[customer?.address, customer?.city, customer?.country].filter(Boolean).join(", ")}
                  </p>
                )}
              </div>
            </div>
            <div className="sm:text-end space-y-1.5">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-body">{isArabic ? "تاريخ الإصدار" : "Issue Date"}</p>
                <p className="text-sm font-medium">{format(new Date(invoice.issue_date), "MMMM d, yyyy")}</p>
              </div>
              {invoice.due_date && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-body">{isArabic ? "تاريخ الاستحقاق" : "Due Date"}</p>
                  <p className={cn("text-sm font-medium", new Date(invoice.due_date) < new Date() && invoice.status !== "paid" && "text-destructive")}>
                    {format(new Date(invoice.due_date), "MMMM d, yyyy")}
                  </p>
                </div>
              )}
              {booking && (
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-body">{isArabic ? "مرجع الحجز" : "Booking Reference"}</p>
                  <p className="text-sm font-medium">{booking.booking_number} — {booking.title}</p>
                </div>
              )}
            </div>
          </div>

          {/* Line Items */}
          <div className="border border-border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="text-xs font-semibold">{isArabic ? "الوصف" : "Description"}</TableHead>
                  <TableHead className="text-xs font-semibold text-center w-20">{isArabic ? "الكمية" : "Qty"}</TableHead>
                  <TableHead className="text-xs font-semibold text-end w-28">{isArabic ? "سعر الوحدة" : "Unit Price"}</TableHead>
                  <TableHead className="text-xs font-semibold text-end w-28">{isArabic ? "الإجمالي" : "Total"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                <TableRow>
                  <TableCell className="text-sm">
                    {booking ? `${booking.title} (${booking.booking_number})` : (isArabic ? "خدمات مقدمة" : "Services rendered")}
                    {invoice.notes && <p className="text-xs text-muted-foreground mt-0.5">{invoice.notes}</p>}
                  </TableCell>
                  <TableCell className="text-sm text-center">1</TableCell>
                  <TableCell className="text-sm text-end font-display">{invoice.currency} {Number(invoice.subtotal || 0).toLocaleString()}</TableCell>
                  <TableCell className="text-sm text-end font-display font-medium">{invoice.currency} {Number(invoice.subtotal || 0).toLocaleString()}</TableCell>
                </TableRow>
              </TableBody>
            </Table>
          </div>

          {/* Totals */}
          <div className="flex justify-end">
            <div className="w-full max-w-xs space-y-1.5">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{isArabic ? "المبلغ الفرعي" : "Subtotal"}</span>
                <span className="font-display">{invoice.currency} {Number(invoice.subtotal || 0).toLocaleString()}</span>
              </div>
              {Number(invoice.tax_amount || 0) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{isArabic ? "الضريبة" : "Tax"} ({invoice.tax_rate}%)</span>
                  <span className="font-display">{invoice.currency} {Number(invoice.tax_amount || 0).toLocaleString()}</span>
                </div>
              )}
              {Number(invoice.discount_amount || 0) > 0 && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">{isArabic ? "الخصم" : "Discount"}</span>
                  <span className="font-display text-destructive">-{invoice.currency} {Number(invoice.discount_amount || 0).toLocaleString()}</span>
                </div>
              )}
              <Separator />
              <div className="flex justify-between text-base font-bold">
                <span>{isArabic ? "الإجمالي" : "Total"}</span>
                <span className="font-display">{invoice.currency} {totalAmount.toLocaleString()}</span>
              </div>
              {Number(invoice.amount_paid || 0) > 0 && (
                <>
                  <div className="flex justify-between text-sm text-[hsl(var(--success))]">
                    <span>{isArabic ? "المدفوع" : "Paid"}</span>
                    <span className="font-display">-{invoice.currency} {Number(invoice.amount_paid || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between text-base font-bold">
                    <span>{isArabic ? "الرصيد المستحق" : "Balance Due"}</span>
                    <span className={cn("font-display", remaining > 0 ? "text-[hsl(var(--warning))]" : "text-[hsl(var(--success))]")}>
                      {invoice.currency} {remaining.toLocaleString()}
                    </span>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* Terms */}
          {invoice.terms && (
            <div className="pt-4 border-t border-border">
              <h4 className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-1.5 font-body">{isArabic ? "الشروط والأحكام" : "Terms & Conditions"}</h4>
              <p className="text-xs text-muted-foreground whitespace-pre-line">{invoice.terms}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Payment History */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Receipt className="w-4 h-4 text-primary" />
              {isArabic ? "سجل الدفعات" : "Payment History"}
            </CardTitle>
            {["sent", "partial", "overdue"].includes(invoice.status) && canEdit && (
              <Button size="sm" variant="outline" onClick={() => setShowPaymentDialog(true)} className="gap-1.5 h-7 text-xs">
                <DollarSign className="w-3 h-3" /> {isArabic ? "تسجيل دفعة" : "Record Payment"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {payments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Banknote className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p className="text-xs">{isArabic ? "لم يتم تسجيل دفعات بعد" : "No payments recorded yet"}</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">{isArabic ? "التاريخ" : "Date"}</TableHead>
                  <TableHead className="text-xs">{isArabic ? "الطريقة" : "Method"}</TableHead>
                  <TableHead className="text-xs text-end">{isArabic ? "المبلغ" : "Amount"}</TableHead>
                  <TableHead className="text-xs hidden sm:table-cell">{isArabic ? "المرجع" : "Reference"}</TableHead>
                  <TableHead className="text-xs hidden md:table-cell">{isArabic ? "ملاحظات" : "Notes"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {payments.map((p: any) => {
                  const method = PAYMENT_METHODS.find(m => m.value === p.payment_method);
                  const MethodIcon = method?.icon || DollarSign;
                  return (
                    <TableRow key={p.id}>
                      <TableCell className="text-xs">{format(new Date(p.payment_date), "MMM d, yyyy")}</TableCell>
                      <TableCell className="text-xs">
                        <span className="flex items-center gap-1.5">
                          <MethodIcon className="w-3 h-3 text-muted-foreground" />
                          {isArabic ? method?.labelAr : method?.label || p.payment_method}
                        </span>
                      </TableCell>
                      <TableCell className="text-end font-display text-xs font-semibold text-[hsl(var(--success))]">
                        +{p.currency} {Number(p.amount).toLocaleString()}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground hidden sm:table-cell">{p.reference_number || "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground hidden md:table-cell truncate max-w-[200px]">{p.notes || "—"}</TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Record Payment Dialog */}
      <Dialog open={showPaymentDialog} onOpenChange={setShowPaymentDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">{isArabic ? "تسجيل دفعة" : "Record Payment"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="rounded-lg bg-muted/40 border border-border p-3 flex justify-between items-center">
              <span className="text-xs text-muted-foreground">{isArabic ? "الرصيد المتبقي" : "Remaining Balance"}</span>
              <span className={cn("text-sm font-bold font-display", remaining > 0 ? "text-[hsl(var(--warning))]" : "text-[hsl(var(--success))]")}>
                {invoice.currency} {remaining.toLocaleString()}
              </span>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{isArabic ? "المبلغ" : "Amount"} *</Label>
              <Input type="number" value={paymentForm.amount} onChange={e => setPaymentForm(f => ({ ...f, amount: e.target.value }))} placeholder="0.00" className="h-9" max={remaining} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{isArabic ? "طريقة الدفع" : "Payment Method"}</Label>
              <Select value={paymentForm.payment_method} onValueChange={v => setPaymentForm(f => ({ ...f, payment_method: v }))}>
                <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(m => (
                    <SelectItem key={m.value} value={m.value}>{isArabic ? m.labelAr : m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{isArabic ? "تاريخ الدفع" : "Payment Date"}</Label>
                <Input type="date" value={paymentForm.payment_date} onChange={e => setPaymentForm(f => ({ ...f, payment_date: e.target.value }))} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{isArabic ? "رقم المرجع" : "Reference #"}</Label>
                <Input value={paymentForm.reference_number} onChange={e => setPaymentForm(f => ({ ...f, reference_number: e.target.value }))} className="h-9" placeholder={isArabic ? "اختياري" : "Optional"} />
              </div>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">{isArabic ? "ملاحظات" : "Notes"}</Label>
              <Textarea value={paymentForm.notes} onChange={e => setPaymentForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder={isArabic ? "ملاحظات اختيارية..." : "Optional payment notes..."} />
            </div>
          </div>
          <DialogFooter className="pt-3">
            <Button variant="outline" onClick={() => setShowPaymentDialog(false)}>{isArabic ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={handleRecordPayment} disabled={savingPayment || !paymentForm.amount}>
              {savingPayment && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
              {isArabic ? "تسجيل الدفعة" : "Record Payment"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{isArabic ? "حذف الفاتورة؟" : "Delete Invoice?"}</AlertDialogTitle>
            <AlertDialogDescription>
              {isArabic
                ? `سيتم حذف الفاتورة ${invoice.invoice_number} نهائياً. لا يمكن التراجع عن هذا الإجراء.`
                : `This will permanently remove invoice ${invoice.invoice_number}. This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{isArabic ? "إلغاء" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isArabic ? "حذف" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #invoice-print, #invoice-print * { visibility: visible; }
          #invoice-print { position: absolute; left: 0; top: 0; width: 100%; }
          .print\\:shadow-none { box-shadow: none !important; }
          .print\\:border-0 { border: none !important; }
        }
      `}</style>
    </div>
  );
}
