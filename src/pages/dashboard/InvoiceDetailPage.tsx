import { useState, useMemo } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { motion } from "framer-motion";
import {
  ArrowLeft, Receipt, Calendar, DollarSign, Loader2,
  CheckCircle2, Clock, AlertTriangle, Send, Pencil,
  Printer, Download, Plus, Trash2, CreditCard, FileText,
  User, Building2, Hash, Mail,
} from "lucide-react";
import { DetailPageLoadingState } from "@/components/ui/loading-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { format, isPast } from "date-fns";

type InvoiceStatus = "draft" | "sent" | "paid" | "partial" | "overdue" | "cancelled";

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; color: string; bg: string }> = {
  draft: { label: "Draft", color: "text-muted-foreground", bg: "bg-muted" },
  sent: { label: "Sent", color: "text-blue-700 dark:text-blue-400", bg: "bg-blue-100 dark:bg-blue-900/30" },
  paid: { label: "Paid", color: "text-emerald-700 dark:text-emerald-400", bg: "bg-emerald-100 dark:bg-emerald-900/30" },
  partial: { label: "Partial", color: "text-amber-700 dark:text-amber-400", bg: "bg-amber-100 dark:bg-amber-900/30" },
  overdue: { label: "Overdue", color: "text-red-700 dark:text-red-400", bg: "bg-red-100 dark:bg-red-900/30" },
  cancelled: { label: "Cancelled", color: "text-muted-foreground", bg: "bg-muted" },
};

const PAYMENT_METHODS = [
  "Bank Transfer", "Cash", "Credit Card", "PayPal", "Check", "Wire Transfer", "Other",
];

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const companyId = user?.activeMembership?.companyId;

  const [showPayment, setShowPayment] = useState(false);
  const [payAmount, setPayAmount] = useState("");
  const [payMethod, setPayMethod] = useState("Bank Transfer");
  const [payRef, setPayRef] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [payDate, setPayDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [isEditing, setIsEditing] = useState(false);

  // Fetch invoice
  const { data: invoice, isLoading } = useQuery({
    queryKey: ["invoice", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, customers(full_name, email, phone, address, city, country), bookings(booking_number, title)")
        .eq("id", id!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  // Fetch payments
  const { data: payments = [] } = useQuery({
    queryKey: ["invoice-payments", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("payment_records")
        .select("*")
        .eq("invoice_id", id!)
        .order("payment_date", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!id,
  });

  // Fetch company
  const { data: company } = useQuery({
    queryKey: ["company-detail", companyId],
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("*").eq("id", companyId!).single();
      return data;
    },
    enabled: !!companyId,
  });

  // Update invoice
  const updateInvoice = useMutation({
    mutationFn: async (updates: Record<string, any>) => {
      const { error } = await supabase.from("invoices").update(updates as any).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      toast({ title: "Invoice updated" });
    },
    onError: (e: any) => toast({ title: "Update failed", description: e.message, variant: "destructive" }),
  });

  // Record payment
  const recordPayment = useMutation({
    mutationFn: async () => {
      const amount = parseFloat(payAmount) || 0;
      if (amount <= 0) throw new Error("Amount must be greater than 0");

      // Insert payment record
      const { error: payErr } = await supabase.from("payment_records").insert({
        company_id: companyId!,
        invoice_id: id!,
        booking_id: invoice?.booking_id || null,
        amount,
        currency: invoice?.currency || "USD",
        payment_method: payMethod,
        reference_number: payRef || null,
        notes: payNotes || null,
        payment_date: payDate,
        recorded_by: user?.id,
      } as any);
      if (payErr) throw payErr;

      // Update invoice amount_paid
      const newPaid = Number(invoice?.amount_paid || 0) + amount;
      const total = Number(invoice?.total_amount || 0);
      const newStatus = newPaid >= total ? "paid" : "partial";

      const { error: invErr } = await supabase
        .from("invoices")
        .update({ amount_paid: newPaid, status: newStatus } as any)
        .eq("id", id!);
      if (invErr) throw invErr;

      // Also update booking amount_paid if linked
      if (invoice?.booking_id) {
        const { data: booking } = await supabase.from("bookings").select("amount_paid").eq("id", invoice.booking_id).single();
        if (booking) {
          await supabase.from("bookings").update({
            amount_paid: Number(booking.amount_paid || 0) + amount,
            payment_status: newPaid >= total ? "paid" : "partial",
          } as any).eq("id", invoice.booking_id);
        }
      }
    },
    onSuccess: () => {
      toast({ title: "Payment recorded successfully" });
      queryClient.invalidateQueries({ queryKey: ["invoice", id] });
      queryClient.invalidateQueries({ queryKey: ["invoice-payments", id] });
      setShowPayment(false);
      setPayAmount("");
      setPayRef("");
      setPayNotes("");
    },
    onError: (e: any) => toast({ title: "Failed to record payment", description: e.message, variant: "destructive" }),
  });

  // Mark as sent
  const markSent = () => updateInvoice.mutate({ status: "sent" });

  // Export PDF
  const handleExportPDF = async () => {
    const el = document.getElementById("invoice-print");
    if (!el) return;
    const html2canvas = (await import("html2canvas")).default;
    const { jsPDF } = await import("jspdf");
    const canvas = await html2canvas(el, { scale: 2, useCORS: true, backgroundColor: "#ffffff" });
    const imgData = canvas.toDataURL("image/png");
    const pdf = new jsPDF("p", "mm", "a4");
    const pdfW = pdf.internal.pageSize.getWidth();
    const pdfH = (canvas.height * pdfW) / canvas.width;
    pdf.addImage(imgData, "PNG", 0, 0, pdfW, pdfH);
    pdf.save(`${invoice?.invoice_number || "invoice"}.pdf`);
  };

  if (isLoading) return <DetailPageLoadingState />;
  if (!invoice) {
    return (
      <div className="text-center py-20">
        <Receipt className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
        <p className="text-sm text-foreground font-medium">Invoice not found</p>
        <Button variant="outline" size="sm" className="mt-4" onClick={() => navigate("/dashboard/invoices")}>
          <ArrowLeft className="w-3.5 h-3.5 me-2" /> Back to Invoices
        </Button>
      </div>
    );
  }

  const displayStatus: InvoiceStatus = invoice.status === "sent" && invoice.due_date && isPast(new Date(invoice.due_date))
    ? "overdue"
    : Number(invoice.amount_paid || 0) > 0 && Number(invoice.amount_paid || 0) < Number(invoice.total_amount || 0) && invoice.status !== "paid"
    ? "partial"
    : invoice.status as InvoiceStatus;

  const sc = STATUS_CONFIG[displayStatus] || STATUS_CONFIG.draft;
  const balance = Number(invoice.total_amount || 0) - Number(invoice.amount_paid || 0);
  const paidPercent = Number(invoice.total_amount) > 0 ? (Number(invoice.amount_paid || 0) / Number(invoice.total_amount)) * 100 : 0;

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Top bar */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate("/dashboard/invoices")}>
            <ArrowLeft className="w-4 h-4" />
          </Button>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-xl font-bold font-display text-foreground">{invoice.invoice_number}</h1>
              <Badge className={cn("text-[10px] border-0", sc.bg, sc.color)}>{sc.label}</Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              Issued {format(new Date(invoice.issue_date || invoice.created_at), "MMM d, yyyy")}
              {invoice.due_date && ` · Due ${format(new Date(invoice.due_date), "MMM d, yyyy")}`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {invoice.status === "draft" && (
            <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={markSent}>
              <Send className="w-3 h-3" /> Mark as Sent
            </Button>
          )}
          {balance > 0 && invoice.status !== "cancelled" && (
            <Button size="sm" className="gap-1.5 text-xs h-8" onClick={() => { setPayAmount(String(balance)); setShowPayment(true); }}>
              <CreditCard className="w-3 h-3" /> Record Payment
            </Button>
          )}
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={() => window.print()}>
            <Printer className="w-3 h-3" /> Print
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 text-xs h-8" onClick={handleExportPDF}>
            <Download className="w-3 h-3" /> Export PDF
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ─── Main invoice view ─── */}
        <div className="lg:col-span-2 space-y-6">
          {/* Invoice card (printable) */}
          <Card className="border-border shadow-sm overflow-hidden print:shadow-none print:border-0" id="invoice-print">
            <CardContent className="p-6 md:p-8 space-y-6">
              {/* Company header */}
              <div className="flex items-start justify-between gap-4">
                <div>
                  {company?.logo_url && (
                    <img src={company.logo_url} alt={company.name} className="h-10 mb-2 object-contain" />
                  )}
                  <h2 className="text-lg font-bold text-foreground">{company?.name}</h2>
                  {company?.email && <p className="text-xs text-muted-foreground">{company.email}</p>}
                  {company?.phone && <p className="text-xs text-muted-foreground">{company.phone}</p>}
                  {company?.address && <p className="text-xs text-muted-foreground">{company.address}</p>}
                </div>
                <div className="text-end">
                  <p className="text-2xl font-bold text-foreground tracking-tight">INVOICE</p>
                  <p className="text-sm font-mono font-semibold text-muted-foreground mt-1">{invoice.invoice_number}</p>
                  <div className="mt-2 space-y-0.5 text-xs text-muted-foreground">
                    <p>Date: {format(new Date(invoice.issue_date || invoice.created_at), "MMM d, yyyy")}</p>
                    {invoice.due_date && <p>Due: {format(new Date(invoice.due_date), "MMM d, yyyy")}</p>}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Bill To */}
              <div className="grid grid-cols-2 gap-6">
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Bill To</p>
                  <p className="text-sm font-semibold text-foreground">{invoice.customers?.full_name || "—"}</p>
                  {invoice.customers?.email && <p className="text-xs text-muted-foreground">{invoice.customers.email}</p>}
                  {invoice.customers?.phone && <p className="text-xs text-muted-foreground">{invoice.customers.phone}</p>}
                  {invoice.customers?.address && <p className="text-xs text-muted-foreground">{invoice.customers.address}</p>}
                  {(invoice.customers?.city || invoice.customers?.country) && (
                    <p className="text-xs text-muted-foreground">{[invoice.customers.city, invoice.customers.country].filter(Boolean).join(", ")}</p>
                  )}
                </div>
                {invoice.bookings && (
                  <div>
                    <p className="text-[10px] uppercase tracking-wider text-muted-foreground font-semibold mb-2">Reference</p>
                    <p className="text-sm text-foreground">Booking: <span className="font-mono font-semibold">{invoice.bookings.booking_number}</span></p>
                    <p className="text-xs text-muted-foreground mt-0.5">{invoice.bookings.title}</p>
                  </div>
                )}
              </div>

              {/* Line items summary */}
              <div className="border border-border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-muted/40">
                      <TableHead className="text-[10px] uppercase tracking-wider">Description</TableHead>
                      <TableHead className="text-[10px] uppercase tracking-wider text-end">Amount</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    <TableRow>
                      <TableCell className="text-sm">
                        {invoice.bookings
                          ? `Services for ${invoice.bookings.title} (${invoice.bookings.booking_number})`
                          : `Professional services`}
                      </TableCell>
                      <TableCell className="text-end font-mono font-semibold text-sm">
                        {invoice.currency} {Number(invoice.subtotal || 0).toLocaleString()}
                      </TableCell>
                    </TableRow>
                  </TableBody>
                </Table>

                {/* Totals */}
                <div className="border-t border-border bg-muted/20 p-4 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">Subtotal</span>
                    <span className="font-mono">{invoice.currency} {Number(invoice.subtotal || 0).toLocaleString()}</span>
                  </div>
                  {Number(invoice.tax_rate || 0) > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Tax ({invoice.tax_rate}%)</span>
                      <span className="font-mono">{invoice.currency} {Number(invoice.tax_amount || 0).toLocaleString()}</span>
                    </div>
                  )}
                  {Number(invoice.discount_amount || 0) > 0 && (
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Discount</span>
                      <span className="font-mono text-emerald-600">-{invoice.currency} {Number(invoice.discount_amount || 0).toLocaleString()}</span>
                    </div>
                  )}
                  <Separator className="my-2" />
                  <div className="flex justify-between text-sm font-bold">
                    <span>Total</span>
                    <span className="font-mono">{invoice.currency} {Number(invoice.total_amount || 0).toLocaleString()}</span>
                  </div>
                  {Number(invoice.amount_paid || 0) > 0 && (
                    <>
                      <div className="flex justify-between text-xs text-emerald-600 dark:text-emerald-400">
                        <span>Paid</span>
                        <span className="font-mono">-{invoice.currency} {Number(invoice.amount_paid || 0).toLocaleString()}</span>
                      </div>
                      <div className="flex justify-between text-sm font-bold">
                        <span className={cn(balance > 0 ? "text-amber-600" : "text-emerald-600")}>
                          {balance > 0 ? "Balance Due" : "Fully Paid"}
                        </span>
                        <span className={cn("font-mono", balance > 0 ? "text-amber-600" : "text-emerald-600")}>
                          {balance > 0 ? `${invoice.currency} ${balance.toLocaleString()}` : "—"}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>

              {/* Notes & Terms */}
              {(invoice.notes || invoice.terms) && (
                <div className="space-y-3 text-xs text-muted-foreground">
                  {invoice.notes && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-semibold mb-1 text-muted-foreground">Notes</p>
                      <p className="whitespace-pre-wrap">{invoice.notes}</p>
                    </div>
                  )}
                  {invoice.terms && (
                    <div>
                      <p className="text-[10px] uppercase tracking-wider font-semibold mb-1 text-muted-foreground">Payment Terms</p>
                      <p className="whitespace-pre-wrap">{invoice.terms}</p>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ─── Sidebar ─── */}
        <div className="space-y-4">
          {/* Payment progress */}
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <CreditCard className="w-3.5 h-3.5" /> Payment Status
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-center py-2">
                <p className="text-3xl font-bold font-mono text-foreground tabular-nums">
                  {Math.round(paidPercent)}%
                </p>
                <p className="text-[10px] text-muted-foreground mt-1">collected</p>
              </div>
              <Progress value={paidPercent} className="h-2" />
              <div className="flex justify-between text-[10px] text-muted-foreground">
                <span>Paid: <span className="font-mono font-semibold text-emerald-600">{Number(invoice.amount_paid || 0).toLocaleString()}</span></span>
                <span>Due: <span className="font-mono font-semibold text-amber-600">{balance > 0 ? balance.toLocaleString() : "0"}</span></span>
              </div>

              {/* Status update */}
              <div className="pt-2">
                <Label className="text-[10px] text-muted-foreground">Status</Label>
                <Select
                  value={invoice.status}
                  onValueChange={v => updateInvoice.mutate({ status: v })}
                >
                  <SelectTrigger className="h-8 mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Payment history */}
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <DollarSign className="w-3.5 h-3.5" /> Payment History
                <Badge variant="secondary" className="text-[9px] px-1.5 h-4 ms-auto">{payments.length}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent>
              {payments.length === 0 ? (
                <p className="text-xs text-muted-foreground text-center py-4">No payments recorded</p>
              ) : (
                <div className="space-y-2">
                  {payments.map((p: any) => (
                    <div key={p.id} className="flex items-center justify-between p-2.5 rounded-lg bg-muted/30 border border-border/50">
                      <div>
                        <p className="text-xs font-semibold text-foreground">
                          {p.currency} {Number(p.amount).toLocaleString()}
                        </p>
                        <p className="text-[10px] text-muted-foreground">{p.payment_method}</p>
                        {p.reference_number && <p className="text-[10px] text-muted-foreground font-mono">Ref: {p.reference_number}</p>}
                      </div>
                      <span className="text-[10px] text-muted-foreground">
                        {format(new Date(p.payment_date), "MMM d")}
                      </span>
                    </div>
                  ))}
                </div>
              )}

              {balance > 0 && invoice.status !== "cancelled" && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-3 gap-1.5 text-xs"
                  onClick={() => { setPayAmount(String(balance)); setShowPayment(true); }}
                >
                  <Plus className="w-3 h-3" /> Record Payment
                </Button>
              )}
            </CardContent>
          </Card>

          {/* Quick edit fields */}
          <Card className="border-border shadow-sm">
            <CardHeader className="pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Pencil className="w-3.5 h-3.5" /> Quick Edit
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div>
                <Label className="text-[10px] text-muted-foreground">Due Date</Label>
                <Input
                  type="date"
                  className="h-8 text-xs mt-1"
                  defaultValue={invoice.due_date || ""}
                  key={`due-${invoice.due_date}`}
                  onBlur={e => e.target.value !== (invoice.due_date || "") && updateInvoice.mutate({ due_date: e.target.value || null })}
                />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">Notes</Label>
                <Textarea
                  className="mt-1 min-h-[60px] text-xs"
                  defaultValue={invoice.notes || ""}
                  key={`notes-${invoice.notes}`}
                  onBlur={e => updateInvoice.mutate({ notes: e.target.value || null })}
                />
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* ─── Record Payment Dialog ─── */}
      <Dialog open={showPayment} onOpenChange={setShowPayment}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <CreditCard className="w-4 h-4 text-accent" /> Record Payment
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="p-3 rounded-lg bg-muted/50 border border-border text-center">
              <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Balance Due</p>
              <p className="text-2xl font-bold font-mono text-foreground mt-1">
                {invoice.currency} {balance.toLocaleString()}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Amount *</Label>
                <Input
                  type="number"
                  className="h-9 mt-1 font-mono"
                  value={payAmount}
                  onChange={e => setPayAmount(e.target.value)}
                  max={balance}
                />
              </div>
              <div>
                <Label className="text-xs">Date</Label>
                <Input type="date" className="h-9 mt-1" value={payDate} onChange={e => setPayDate(e.target.value)} />
              </div>
            </div>

            <div>
              <Label className="text-xs">Payment Method</Label>
              <Select value={payMethod} onValueChange={setPayMethod}>
                <SelectTrigger className="h-9 mt-1">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {PAYMENT_METHODS.map(m => (
                    <SelectItem key={m} value={m}>{m}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label className="text-xs">Reference Number</Label>
              <Input className="h-9 mt-1" value={payRef} onChange={e => setPayRef(e.target.value)} placeholder="Transaction ID, check #, etc." />
            </div>

            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea className="mt-1 min-h-[50px]" value={payNotes} onChange={e => setPayNotes(e.target.value)} placeholder="Payment notes..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowPayment(false)}>Cancel</Button>
            <Button onClick={() => recordPayment.mutate()} disabled={recordPayment.isPending || !payAmount}>
              {recordPayment.isPending && <Loader2 className="w-3.5 h-3.5 me-2 animate-spin" />}
              Record Payment
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
