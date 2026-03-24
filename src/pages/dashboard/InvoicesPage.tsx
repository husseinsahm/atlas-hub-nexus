import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { LockOverlay } from "@/components/plan/LockOverlay";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { ModalDarkHeader } from "@/components/ui/modal-dark-header";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import {
  Search, Receipt, Loader2, Calendar, DollarSign, Eye, Plus,
  TrendingUp, AlertTriangle, CheckCircle2, Clock, FileText,
  Send, MoreVertical, Trash2, Copy,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { format, isPast } from "date-fns";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

type InvoiceStatus = "draft" | "sent" | "paid" | "partial" | "overdue" | "cancelled";

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; className: string; icon: typeof Receipt }> = {
  draft: { label: "Draft", className: "bg-muted text-muted-foreground", icon: FileText },
  sent: { label: "Sent", className: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", icon: Send },
  paid: { label: "Paid", className: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", icon: CheckCircle2 },
  partial: { label: "Partial", className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", icon: Clock },
  overdue: { label: "Overdue", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400", icon: AlertTriangle },
  cancelled: { label: "Cancelled", className: "bg-muted text-muted-foreground line-through", icon: FileText },
};

export default function InvoicesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const { hasFeature } = usePlanLimits();
  const companyId = user?.activeMembership?.companyId;
  const isLocked = !hasFeature("invoicing");

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form state
  const [formCustomerId, setFormCustomerId] = useState("");
  const [formBookingId, setFormBookingId] = useState("");
  const [formSubtotal, setFormSubtotal] = useState("0");
  const [formTaxRate, setFormTaxRate] = useState("0");
  const [formDiscount, setFormDiscount] = useState("0");
  const [formNotes, setFormNotes] = useState("");
  const [formTerms, setFormTerms] = useState("");
  const [formDueDate, setFormDueDate] = useState("");
  const [formCurrency, setFormCurrency] = useState("USD");

  // Fetch invoices
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices")
        .select("*, customers(full_name), bookings(booking_number, title)")
        .eq("company_id", companyId!)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!companyId,
  });

  // Fetch customers for dropdown
  const { data: customers = [] } = useQuery({
    queryKey: ["customers-list", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("customers")
        .select("id, full_name")
        .eq("company_id", companyId!)
        .is("deleted_at", null)
        .order("full_name");
      return data || [];
    },
    enabled: !!companyId,
  });

  // Fetch bookings for dropdown
  const { data: bookings = [] } = useQuery({
    queryKey: ["bookings-list", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("bookings")
        .select("id, booking_number, title, customer_id, selling_price, currency")
        .eq("company_id", companyId!)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(100);
      return data || [];
    },
    enabled: !!companyId,
  });

  // Fetch company settings for prefix/sequence
  const { data: settings } = useQuery({
    queryKey: ["company-settings", companyId],
    queryFn: async () => {
      const { data } = await supabase
        .from("company_settings")
        .select("*")
        .eq("company_id", companyId!)
        .single();
      return data;
    },
    enabled: !!companyId,
  });

  // Auto-detect overdue invoices on load
  useMemo(() => {
    invoices.forEach((inv: any) => {
      if (inv.status === "sent" && inv.due_date && isPast(new Date(inv.due_date))) {
        supabase
          .from("invoices")
          .update({ status: "overdue" } as any)
          .eq("id", inv.id)
          .then(() => queryClient.invalidateQueries({ queryKey: ["invoices", companyId] }));
      }
    });
  }, [invoices]);

  // Create invoice
  const handleCreate = async () => {
    if (!companyId) return;
    setCreating(true);

    try {
      const subtotal = parseFloat(formSubtotal) || 0;
      const taxRate = parseFloat(formTaxRate) || 0;
      const discount = parseFloat(formDiscount) || 0;
      const taxAmount = subtotal * (taxRate / 100);
      const totalAmount = subtotal + taxAmount - discount;

      const prefix = settings?.invoice_prefix || "INV";
      const nextNum = settings?.invoice_next_number || 1;
      const invoiceNumber = `${prefix}-${String(nextNum).padStart(5, "0")}`;

      const { error } = await supabase.from("invoices").insert({
        company_id: companyId,
        customer_id: formCustomerId || null,
        booking_id: formBookingId && formBookingId !== "none" ? formBookingId : null,
        invoice_number: invoiceNumber,
        subtotal,
        tax_rate: taxRate,
        tax_amount: taxAmount,
        discount_amount: discount,
        total_amount: totalAmount,
        currency: formCurrency,
        notes: formNotes || null,
        terms: formTerms || settings?.default_payment_terms || null,
        due_date: formDueDate || null,
        created_by: user?.id,
        status: "draft",
      } as any);

      if (error) throw error;

      // Increment sequence
      await supabase
        .from("company_settings")
        .update({ invoice_next_number: nextNum + 1 } as any)
        .eq("company_id", companyId);

      toast({ title: "Invoice created successfully" });
      queryClient.invalidateQueries({ queryKey: ["invoices", companyId] });
      queryClient.invalidateQueries({ queryKey: ["company-settings", companyId] });
      setShowCreate(false);
      resetForm();
    } catch (err: any) {
      console.error("Invoice creation error:", err);
      toast({ title: "Failed to create invoice", description: err.message, variant: "destructive" });
    } finally {
      setCreating(false);
    }
  };

  const resetForm = () => {
    setFormCustomerId("");
    setFormBookingId("");
    setFormSubtotal("0");
    setFormTaxRate("0");
    setFormDiscount("0");
    setFormNotes("");
    setFormTerms("");
    setFormDueDate("");
    setFormCurrency("USD");
  };

  // Delete invoice (soft)
  const deleteInvoice = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.rpc("soft_delete_invoice", { _invoice_id: id });
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: "Invoice deleted" });
      queryClient.invalidateQueries({ queryKey: ["invoices", companyId] });
    },
    onError: (e: any) => toast({ title: "Delete failed", description: e.message, variant: "destructive" }),
  });

  // Duplicate invoice
  const duplicateInvoice = useMutation({
    mutationFn: async (inv: any) => {
      const prefix = settings?.invoice_prefix || "INV";
      const nextNum = settings?.invoice_next_number || 1;
      const invoiceNumber = `${prefix}-${String(nextNum).padStart(5, "0")}`;

      const { error } = await supabase.from("invoices").insert({
        company_id: companyId!,
        customer_id: inv.customer_id,
        booking_id: inv.booking_id,
        invoice_number: invoiceNumber,
        subtotal: inv.subtotal,
        tax_rate: inv.tax_rate,
        tax_amount: inv.tax_amount,
        discount_amount: inv.discount_amount,
        total_amount: inv.total_amount,
        currency: inv.currency,
        notes: inv.notes,
        terms: inv.terms,
        created_by: user?.id,
        status: "draft",
      } as any);
      if (error) throw error;

      await supabase
        .from("company_settings")
        .update({ invoice_next_number: nextNum + 1 } as any)
        .eq("company_id", companyId!);
    },
    onSuccess: () => {
      toast({ title: "Invoice duplicated" });
      queryClient.invalidateQueries({ queryKey: ["invoices", companyId] });
      queryClient.invalidateQueries({ queryKey: ["company-settings", companyId] });
    },
  });

  // When booking selected, auto-fill
  const handleBookingSelect = (bookingId: string) => {
    setFormBookingId(bookingId);
    const bk = bookings.find((b: any) => b.id === bookingId);
    if (bk) {
      if (bk.customer_id) setFormCustomerId(bk.customer_id);
      if (bk.selling_price) setFormSubtotal(String(bk.selling_price));
      if (bk.currency) setFormCurrency(bk.currency);
    }
  };

  // Computed status including overdue detection
  const getDisplayStatus = (inv: any): InvoiceStatus => {
    if (inv.status === "sent" && inv.due_date && isPast(new Date(inv.due_date))) return "overdue";
    if (inv.amount_paid > 0 && inv.amount_paid < inv.total_amount && inv.status !== "paid") return "partial";
    return inv.status as InvoiceStatus;
  };

  const filtered = useMemo(() => {
    return invoices.filter((inv: any) => {
      const status = getDisplayStatus(inv);
      if (filterStatus !== "all" && status !== filterStatus) return false;
      if (search) {
        const s = search.toLowerCase();
        return (
          inv.invoice_number.toLowerCase().includes(s) ||
          (inv.customers?.full_name || "").toLowerCase().includes(s) ||
          (inv.bookings?.booking_number || "").toLowerCase().includes(s)
        );
      }
      return true;
    });
  }, [invoices, search, filterStatus]);

  const stats = useMemo(() => {
    const total = invoices.length;
    const paid = invoices.filter((i: any) => i.status === "paid").length;
    const overdue = invoices.filter((i: any) => getDisplayStatus(i) === "overdue").length;
    const totalRevenue = invoices.filter((i: any) => i.status === "paid").reduce((s: number, i: any) => s + Number(i.total_amount || 0), 0);
    const outstanding = invoices
      .filter((i: any) => ["sent", "partial", "overdue"].includes(getDisplayStatus(i)))
      .reduce((s: number, i: any) => s + Number(i.total_amount || 0) - Number(i.amount_paid || 0), 0);
    return { total, paid, overdue, totalRevenue, outstanding };
  }, [invoices]);

  return (
    <div className="space-y-6 relative">
      {isLocked && <LockOverlay planRequired="Starter" featureName="Invoicing" />}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Invoices</h1>
          <p className="text-sm text-muted-foreground mt-1">Create, manage, and track invoices</p>
        </div>
        <Button onClick={() => { resetForm(); setShowCreate(true); }} className="gap-2 h-9 text-xs">
          <Plus className="w-3.5 h-3.5" /> New Invoice
        </Button>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        {[
          { label: "Total", value: stats.total, icon: Receipt, color: "text-accent bg-accent/10" },
          { label: "Paid", value: stats.paid, icon: CheckCircle2, color: "text-emerald-600 bg-emerald-500/10" },
          { label: "Overdue", value: stats.overdue, icon: AlertTriangle, color: "text-red-600 bg-red-500/10" },
          { label: "Revenue", value: `${stats.totalRevenue.toLocaleString()}`, icon: TrendingUp, color: "text-emerald-600 bg-emerald-500/10", isMoney: true },
          { label: "Outstanding", value: `${stats.outstanding.toLocaleString()}`, icon: Clock, color: "text-amber-600 bg-amber-500/10", isMoney: true },
        ].map((stat, idx) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: idx * 0.04 }}>
            <Card className="border-border">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", stat.color)}>
                  <stat.icon className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[10px] text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                  <p className="text-lg font-bold font-display text-foreground leading-none">{stat.value}</p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Filters + Table */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by invoice #, customer, or booking..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="ps-9 h-9"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full sm:w-36 h-9">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-4 space-y-3">
              {[...Array(5)].map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
            </div>
          ) : filtered.length === 0 ? (
            <div className="text-center py-16 px-4">
              <div className="w-14 h-14 rounded-full bg-muted/50 flex items-center justify-center mx-auto mb-4">
                <Receipt className="w-7 h-7 text-muted-foreground/30" />
              </div>
              {invoices.length === 0 ? (
                <>
                  <p className="text-sm font-medium text-foreground">No invoices yet</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-[280px] mx-auto">
                    Create your first invoice by clicking "New Invoice" above
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-foreground">No matching invoices</p>
                  <Button variant="outline" size="sm" className="mt-3 text-xs" onClick={() => { setSearch(""); setFilterStatus("all"); }}>
                    Clear Filters
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">Invoice #</TableHead>
                    <TableHead className="text-xs">Customer</TableHead>
                    <TableHead className="text-xs hidden md:table-cell">Booking</TableHead>
                    <TableHead className="text-xs text-end">Amount</TableHead>
                    <TableHead className="text-xs text-end hidden sm:table-cell">Paid</TableHead>
                    <TableHead className="text-xs hidden sm:table-cell">Due Date</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="w-10" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((inv: any) => {
                    const displayStatus = getDisplayStatus(inv);
                    const sc = STATUS_CONFIG[displayStatus] || STATUS_CONFIG.draft;
                    const balance = Number(inv.total_amount || 0) - Number(inv.amount_paid || 0);
                    return (
                      <TableRow
                        key={inv.id}
                        className="cursor-pointer hover:bg-muted/30 transition-colors group"
                        onClick={() => navigate(`/dashboard/invoices/${inv.id}`)}
                      >
                        <TableCell className="font-mono text-xs font-semibold">{inv.invoice_number}</TableCell>
                        <TableCell className="text-xs">{inv.customers?.full_name || <span className="text-muted-foreground">—</span>}</TableCell>
                        <TableCell className="text-xs text-muted-foreground hidden md:table-cell">
                          {inv.bookings ? (
                            <span className="truncate max-w-[180px] block">{inv.bookings.booking_number}</span>
                          ) : "—"}
                        </TableCell>
                        <TableCell className="text-end font-mono text-xs font-semibold">
                          {inv.currency} {Number(inv.total_amount || 0).toLocaleString()}
                        </TableCell>
                        <TableCell className="text-end font-mono text-xs hidden sm:table-cell">
                          <span className={cn(
                            Number(inv.amount_paid || 0) > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground"
                          )}>
                            {Number(inv.amount_paid || 0).toLocaleString()}
                          </span>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground hidden sm:table-cell">
                          {inv.due_date ? (
                            <span className={cn(displayStatus === "overdue" && "text-destructive font-medium")}>
                              {format(new Date(inv.due_date), "MMM d, yyyy")}
                            </span>
                          ) : "—"}
                        </TableCell>
                        <TableCell>
                          <Badge className={cn("text-[10px] border-0", sc.className)}>{sc.label}</Badge>
                        </TableCell>
                        <TableCell>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                              <Button size="icon" variant="ghost" className="h-7 w-7 opacity-0 group-hover:opacity-100">
                                <MoreVertical className="w-3.5 h-3.5" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={e => { e.stopPropagation(); navigate(`/dashboard/invoices/${inv.id}`); }}>
                                <Eye className="w-3.5 h-3.5 me-2" /> View
                              </DropdownMenuItem>
                              <DropdownMenuItem onClick={e => { e.stopPropagation(); duplicateInvoice.mutate(inv); }}>
                                <Copy className="w-3.5 h-3.5 me-2" /> Duplicate
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem
                                className="text-destructive"
                                onClick={e => { e.stopPropagation(); deleteInvoice.mutate(inv.id); }}
                              >
                                <Trash2 className="w-3.5 h-3.5 me-2" /> Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ─── Create Invoice Dialog ─── */}
      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent className="sm:max-w-lg p-0 dark-header-dialog">
          <ModalDarkHeader
            icon={<Receipt className="w-5 h-5 text-accent-foreground" />}
            title="New Invoice"
            description="Create a new invoice for a customer or booking"
          />
          <div className="space-y-4 p-6 pt-4">
            {/* Booking selector */}
            <div>
              <Label className="text-xs">Booking (optional — auto-fills customer & amount)</Label>
              <Select value={formBookingId} onValueChange={handleBookingSelect}>
                <SelectTrigger className="h-9 mt-1">
                  <SelectValue placeholder="Select booking..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {bookings.map((b: any) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.booking_number} — {b.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Customer */}
            <div>
              <Label className="text-xs">Customer *</Label>
              <Select value={formCustomerId} onValueChange={setFormCustomerId}>
                <SelectTrigger className="h-9 mt-1">
                  <SelectValue placeholder="Select customer..." />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Amount grid */}
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label className="text-xs">Subtotal *</Label>
                <Input type="number" className="h-9 mt-1 font-mono" value={formSubtotal} onChange={e => setFormSubtotal(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Tax Rate %</Label>
                <Input type="number" className="h-9 mt-1 font-mono" value={formTaxRate} onChange={e => setFormTaxRate(e.target.value)} />
              </div>
              <div>
                <Label className="text-xs">Discount</Label>
                <Input type="number" className="h-9 mt-1 font-mono" value={formDiscount} onChange={e => setFormDiscount(e.target.value)} />
              </div>
            </div>

            {/* Total preview */}
            <div className="p-3 rounded-lg bg-muted/50 border border-border flex items-center justify-between">
              <span className="text-xs text-muted-foreground font-medium">Total Amount</span>
              <span className="text-lg font-bold font-mono text-foreground">
                {formCurrency} {(
                  (parseFloat(formSubtotal) || 0) +
                  ((parseFloat(formSubtotal) || 0) * (parseFloat(formTaxRate) || 0) / 100) -
                  (parseFloat(formDiscount) || 0)
                ).toLocaleString()}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">Currency</Label>
                <Select value={formCurrency} onValueChange={setFormCurrency}>
                  <SelectTrigger className="h-9 mt-1">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {["USD", "EUR", "GBP", "EGP", "SAR", "AED", "JPY"].map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs">Due Date</Label>
                <Input type="date" className="h-9 mt-1" value={formDueDate} onChange={e => setFormDueDate(e.target.value)} />
              </div>
            </div>

            <div>
              <Label className="text-xs">Notes</Label>
              <Textarea className="mt-1 min-h-[60px]" value={formNotes} onChange={e => setFormNotes(e.target.value)} placeholder="Invoice notes..." />
            </div>
            <div>
              <Label className="text-xs">Payment Terms</Label>
              <Textarea
                className="mt-1 min-h-[60px]"
                value={formTerms}
                onChange={e => setFormTerms(e.target.value)}
                placeholder={settings?.default_payment_terms || "Payment terms..."}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating || !formCustomerId}>
              {creating && <Loader2 className="w-3.5 h-3.5 me-2 animate-spin" />}
              Create Invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
