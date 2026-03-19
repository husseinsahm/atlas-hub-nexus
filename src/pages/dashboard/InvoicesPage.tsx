import { useState, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { LockOverlay } from "@/components/plan/LockOverlay";
import { PageHeader } from "@/components/layouts/PageHeader";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search, Receipt, Loader2, Calendar, DollarSign, Eye, Plus,
  TrendingUp, Clock, CheckCircle2, AlertCircle, Send, FileText,
  MoreHorizontal, Pencil, Trash2, Ban, ChevronRight, Copy, Bell,
  ArrowUpDown, ChevronLeft,
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuSeparator, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { format } from "date-fns";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

type InvoiceStatus = "draft" | "sent" | "paid" | "partial" | "overdue" | "cancelled" | "void";
type SortField = "invoice_number" | "issue_date" | "due_date" | "total_amount" | "balance" | "status";
type SortDir = "asc" | "desc";

const STATUS_CONFIG: Record<InvoiceStatus, { label: string; icon: React.ElementType; className: string; dotColor: string }> = {
  draft: { label: "Draft", icon: FileText, className: "bg-muted text-muted-foreground", dotColor: "bg-muted-foreground/50" },
  sent: { label: "Sent", icon: Send, className: "bg-blue-100/80 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400", dotColor: "bg-blue-500" },
  paid: { label: "Paid", icon: CheckCircle2, className: "bg-emerald-100/80 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400", dotColor: "bg-emerald-500" },
  partial: { label: "Partial", icon: Clock, className: "bg-amber-100/80 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400", dotColor: "bg-amber-500" },
  overdue: { label: "Overdue", icon: AlertCircle, className: "bg-destructive/10 text-destructive", dotColor: "bg-destructive" },
  cancelled: { label: "Cancelled", icon: Ban, className: "bg-muted text-muted-foreground", dotColor: "bg-muted-foreground/40" },
  void: { label: "Void", icon: Ban, className: "bg-muted text-muted-foreground line-through", dotColor: "bg-muted-foreground/30" },
};

const PAGE_SIZE = 20;

export default function InvoicesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const { language } = useLanguage();
  const queryClient = useQueryClient();
  const { limits, hasFeature } = usePlanLimits();
  const companyId = user?.activeMembership?.companyId;
  const isArabic = language === "ar";
  const isLocked = !hasFeature("invoicing") && limits.planSlug === "free";

  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [showNewDialog, setShowNewDialog] = useState(false);
  const [saving, setSaving] = useState(false);
  const [page, setPage] = useState(1);
  const [sortField, setSortField] = useState<SortField>("issue_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Form state
  const [form, setForm] = useState({
    booking_id: "",
    customer_id: "",
    issue_date: new Date().toISOString().split("T")[0],
    due_date: "",
    subtotal: "",
    tax_rate: "0",
    discount_amount: "0",
    notes: "",
    terms: "Payment is due within the specified due date. Late payments may incur additional charges.",
    currency: "USD",
  });

  // Fetch invoices
  const { data: invoices = [], isLoading } = useQuery({
    queryKey: ["invoices", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoices" as any)
        .select("*")
        .eq("company_id", companyId!)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!companyId,
  });

  // Fetch bookings for dropdown
  const { data: bookings = [] } = useQuery({
    queryKey: ["invoices-bookings", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("id, booking_number, title, selling_price, currency, customer_id, customers(full_name)")
        .eq("company_id", companyId!)
        .is("deleted_at", null)
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!companyId,
  });

  // Fetch customers for dropdown
  const { data: customers = [] } = useQuery({
    queryKey: ["invoices-customers", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("customers")
        .select("id, full_name, email")
        .eq("company_id", companyId!)
        .is("deleted_at", null)
        .order("full_name");
      if (error) throw error;
      return (data || []) as any[];
    },
    enabled: !!companyId,
  });

  // Fetch company settings for invoice prefix/number
  const { data: companySettings } = useQuery({
    queryKey: ["company-settings-inv", companyId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("company_settings")
        .select("invoice_prefix, invoice_next_number, default_currency")
        .eq("company_id", companyId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!companyId,
  });

  // Calculate totals from form
  const calculatedTotals = useMemo(() => {
    const subtotal = parseFloat(form.subtotal) || 0;
    const taxRate = parseFloat(form.tax_rate) || 0;
    const discount = parseFloat(form.discount_amount) || 0;
    const taxAmount = subtotal * (taxRate / 100);
    const total = subtotal + taxAmount - discount;
    return { subtotal, taxRate, taxAmount, discount, total: Math.max(0, total) };
  }, [form.subtotal, form.tax_rate, form.discount_amount]);

  // Create invoice
  async function handleCreate() {
    if (!companyId || !form.customer_id) {
      toast({ title: "Missing info", description: "Please select a customer", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      const prefix = companySettings?.invoice_prefix || "INV";
      const nextNum = companySettings?.invoice_next_number || 1;
      const invoiceNumber = `${prefix}-${String(nextNum).padStart(4, "0")}`;

      const { error } = await supabase.from("invoices" as any).insert({
        company_id: companyId,
        booking_id: form.booking_id || null,
        customer_id: form.customer_id,
        invoice_number: invoiceNumber,
        issue_date: form.issue_date,
        due_date: form.due_date || null,
        subtotal: calculatedTotals.subtotal,
        tax_rate: calculatedTotals.taxRate,
        tax_amount: calculatedTotals.taxAmount,
        discount_amount: calculatedTotals.discount,
        total_amount: calculatedTotals.total,
        currency: form.currency || companySettings?.default_currency || "USD",
        notes: form.notes || null,
        terms: form.terms || null,
        created_by: user?.id,
        status: "draft",
      } as any);
      if (error) throw error;

      // Increment invoice number
      await supabase
        .from("company_settings")
        .update({ invoice_next_number: nextNum + 1 })
        .eq("company_id", companyId);

      toast({ title: "Invoice created", description: `${invoiceNumber} has been created as draft` });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["company-settings-inv"] });
      setShowNewDialog(false);
      resetForm();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  // Status update
  async function updateStatus(id: string, status: string) {
    try {
      const { error } = await supabase
        .from("invoices" as any)
        .update({ status } as any)
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Status updated" });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  // Soft delete
  async function softDelete(id: string) {
    try {
      const { error } = await supabase
        .from("invoices" as any)
        .update({ deleted_at: new Date().toISOString() } as any)
        .eq("id", id);
      if (error) throw error;
      toast({ title: "Invoice deleted" });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  // Copy invoice
  async function copyInvoice(inv: any) {
    if (!companyId) return;
    try {
      const prefix = companySettings?.invoice_prefix || "INV";
      const nextNum = companySettings?.invoice_next_number || 1;
      const invoiceNumber = `${prefix}-${String(nextNum).padStart(4, "0")}`;

      const { error } = await supabase.from("invoices" as any).insert({
        company_id: companyId,
        booking_id: inv.booking_id || null,
        customer_id: inv.customer_id,
        invoice_number: invoiceNumber,
        issue_date: new Date().toISOString().split("T")[0],
        due_date: inv.due_date || null,
        subtotal: inv.subtotal,
        tax_rate: inv.tax_rate,
        tax_amount: inv.tax_amount,
        discount_amount: inv.discount_amount,
        total_amount: inv.total_amount,
        currency: inv.currency,
        notes: inv.notes || null,
        terms: inv.terms || null,
        created_by: user?.id,
        status: "draft",
        amount_paid: 0,
      } as any);
      if (error) throw error;

      await supabase.from("company_settings").update({ invoice_next_number: nextNum + 1 }).eq("company_id", companyId);

      toast({ title: "Invoice copied", description: `${invoiceNumber} created as draft` });
      queryClient.invalidateQueries({ queryKey: ["invoices"] });
      queryClient.invalidateQueries({ queryKey: ["company-settings-inv"] });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  // Send reminder (mark as overdue)
  async function sendReminder(id: string) {
    await updateStatus(id, "overdue");
    toast({ title: "Reminder sent", description: "Invoice marked as overdue" });
  }

  function resetForm() {
    setForm({
      booking_id: "",
      customer_id: "",
      issue_date: new Date().toISOString().split("T")[0],
      due_date: "",
      subtotal: "",
      tax_rate: "0",
      discount_amount: "0",
      notes: "",
      terms: "Payment is due within the specified due date. Late payments may incur additional charges.",
      currency: companySettings?.default_currency || "USD",
    });
  }

  // When booking is selected, auto-fill
  function onBookingSelect(bookingId: string) {
    const b = bookings.find((bk: any) => bk.id === bookingId);
    if (b) {
      setForm(prev => ({
        ...prev,
        booking_id: bookingId,
        customer_id: b.customer_id || prev.customer_id,
        subtotal: String(b.selling_price || 0),
        currency: b.currency || prev.currency,
      }));
    }
  }

  // Toggle sort
  function toggleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(d => d === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDir("desc");
    }
    setPage(1);
  }

  // Filter, sort, paginate
  const filtered = useMemo(() => {
    let list = invoices.filter((inv: any) => {
      if (filterStatus !== "all" && inv.status !== filterStatus) return false;
      if (search) {
        const s = search.toLowerCase();
        const customerName = customers.find((c: any) => c.id === inv.customer_id)?.full_name || "";
        return inv.invoice_number?.toLowerCase().includes(s) || customerName.toLowerCase().includes(s);
      }
      return true;
    });

    // Sort
    list = [...list].sort((a: any, b: any) => {
      let va: any, vb: any;
      switch (sortField) {
        case "invoice_number": va = a.invoice_number || ""; vb = b.invoice_number || ""; break;
        case "issue_date": va = a.issue_date || ""; vb = b.issue_date || ""; break;
        case "due_date": va = a.due_date || ""; vb = b.due_date || ""; break;
        case "total_amount": va = Number(a.total_amount || 0); vb = Number(b.total_amount || 0); break;
        case "balance": va = Number(a.total_amount || 0) - Number(a.amount_paid || 0); vb = Number(b.total_amount || 0) - Number(b.amount_paid || 0); break;
        case "status": va = a.status || ""; vb = b.status || ""; break;
        default: va = a.issue_date || ""; vb = b.issue_date || "";
      }
      if (va < vb) return sortDir === "asc" ? -1 : 1;
      if (va > vb) return sortDir === "asc" ? 1 : -1;
      return 0;
    });

    return list;
  }, [invoices, search, filterStatus, sortField, sortDir, customers]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paginated = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // Stats
  const stats = useMemo(() => {
    const total = invoices.length;
    const totalValue = invoices.reduce((s: number, i: any) => s + Number(i.total_amount || 0), 0);
    const paid = invoices.filter((i: any) => i.status === "paid").reduce((s: number, i: any) => s + Number(i.total_amount || 0), 0);
    const outstanding = invoices
      .filter((i: any) => ["sent", "partial", "overdue"].includes(i.status))
      .reduce((s: number, i: any) => s + Number(i.total_amount || 0) - Number(i.amount_paid || 0), 0);
    return { total, totalValue, paid, outstanding };
  }, [invoices]);

  // Pipeline counts
  const pipelineCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    invoices.forEach((i: any) => { counts[i.status] = (counts[i.status] || 0) + 1; });
    return counts;
  }, [invoices]);

  const pipelineOrder: InvoiceStatus[] = ["draft", "sent", "partial", "paid", "overdue"];

  function SortableHeader({ field, children }: { field: SortField; children: React.ReactNode }) {
    const active = sortField === field;
    return (
      <TableHead className="text-xs cursor-pointer select-none hover:text-foreground transition-colors" onClick={() => toggleSort(field)}>
        <span className="inline-flex items-center gap-1">
          {children}
          <ArrowUpDown className={cn("w-3 h-3", active ? "text-foreground" : "text-muted-foreground/40")} />
        </span>
      </TableHead>
    );
  }

  return (
    <div className="space-y-6 relative">
      {isLocked && <LockOverlay planRequired="Starter" featureName="Invoicing" />}

      {/* Breadcrumb */}
      <nav className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <button onClick={() => navigate("/dashboard")} className="hover:text-foreground transition-colors">
          {isArabic ? "لوحة التحكم" : "Dashboard"}
        </button>
        <ChevronRight className="w-3 h-3" />
        <span className="hover:text-foreground transition-colors">
          {isArabic ? "المالية" : "Finance"}
        </span>
        <ChevronRight className="w-3 h-3" />
        <span className="text-foreground font-medium">{isArabic ? "الفواتير" : "Invoices"}</span>
      </nav>

      {/* Header */}
      <PageHeader
        title={isArabic ? "الفواتير" : "Invoices"}
        subtitle={isArabic ? "إدارة الفواتير والمدفوعات" : "Create, track, and manage invoices for your bookings"}
        actions={
          <Button onClick={() => { resetForm(); setShowNewDialog(true); }} className="gap-1.5">
            <Plus className="w-4 h-4" />
            {isArabic ? "فاتورة جديدة" : "New Invoice"}
          </Button>
        }
      />

      {/* Pipeline Bar */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div className="flex h-10">
            {pipelineOrder.map((status, idx) => {
              const count = pipelineCounts[status] || 0;
              const sc = STATUS_CONFIG[status];
              const total = invoices.length || 1;
              const pct = Math.max(8, (count / total) * 100);
              return (
                <button
                  key={status}
                  onClick={() => { setFilterStatus(filterStatus === status ? "all" : status); setPage(1); }}
                  className={cn(
                    "flex items-center justify-center gap-1.5 text-xs font-medium transition-all relative",
                    filterStatus === status ? "ring-1 ring-inset ring-foreground/10" : "",
                    idx === 0 ? "rounded-l-lg" : "",
                    idx === pipelineOrder.length - 1 ? "rounded-r-lg" : "",
                    sc.className,
                  )}
                  style={{ width: `${pct}%` }}
                >
                  <span className="truncate">{sc.label}</span>
                  <span className="font-bold">{count}</span>
                </button>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: isArabic ? "إجمالي الفواتير" : "Total Invoices", value: stats.total, icon: Receipt, color: "text-primary", bg: "bg-primary/10" },
          { label: isArabic ? "القيمة الإجمالية" : "Total Value", value: `${stats.totalValue.toLocaleString()}`, icon: DollarSign, color: "text-secondary", bg: "bg-secondary/10" },
          { label: isArabic ? "المحصل" : "Collected", value: `${stats.paid.toLocaleString()}`, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-500/10" },
          { label: isArabic ? "المستحق" : "Outstanding", value: `${stats.outstanding.toLocaleString()}`, icon: AlertCircle, color: stats.outstanding > 0 ? "text-amber-600" : "text-muted-foreground", bg: stats.outstanding > 0 ? "bg-amber-500/10" : "bg-muted/50" },
        ].map((stat, i) => (
          <motion.div key={stat.label} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }}>
            <Card className="border-border">
              <CardContent className="p-4 flex items-center gap-3">
                <div className={cn("w-9 h-9 rounded-lg flex items-center justify-center shrink-0", stat.bg)}>
                  <stat.icon className={cn("w-4 h-4", stat.color)} />
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
                placeholder={isArabic ? "بحث برقم الفاتورة أو اسم العميل..." : "Search by invoice number or customer..."}
                value={search}
                onChange={e => { setSearch(e.target.value); setPage(1); }}
                className="ps-9 h-9"
              />
            </div>
            <Select value={filterStatus} onValueChange={v => { setFilterStatus(v); setPage(1); }}>
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
                  <p className="text-sm font-medium text-foreground">{isArabic ? "لا توجد فواتير بعد" : "No invoices yet"}</p>
                  <p className="text-xs text-muted-foreground mt-1 max-w-[280px] mx-auto">
                    {isArabic ? "أنشئ فاتورتك الأولى من زر 'فاتورة جديدة'" : "Create your first invoice to start tracking payments"}
                  </p>
                  <Button size="sm" className="mt-4 gap-1.5" onClick={() => { resetForm(); setShowNewDialog(true); }}>
                    <Plus className="w-3.5 h-3.5" /> {isArabic ? "فاتورة جديدة" : "New Invoice"}
                  </Button>
                </>
              ) : (
                <>
                  <p className="text-sm font-medium text-foreground">No matching invoices</p>
                  <p className="text-xs text-muted-foreground mt-1">Try adjusting your search or filter</p>
                  <Button variant="outline" size="sm" className="mt-3 text-xs" onClick={() => { setSearch(""); setFilterStatus("all"); setPage(1); }}>
                    Clear Filters
                  </Button>
                </>
              )}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <SortableHeader field="invoice_number">Invoice #</SortableHeader>
                      <TableHead className="text-xs">Customer</TableHead>
                      <TableHead className="text-xs hidden md:table-cell">Booking</TableHead>
                      <SortableHeader field="issue_date"><span className="hidden sm:inline">Issue Date</span><span className="sm:hidden">Date</span></SortableHeader>
                      <SortableHeader field="due_date"><span className="hidden lg:inline">Due Date</span></SortableHeader>
                      <SortableHeader field="total_amount"><span className="text-end">Total</span></SortableHeader>
                      <SortableHeader field="balance"><span className="text-end hidden sm:inline">Balance</span></SortableHeader>
                      <SortableHeader field="status">Status</SortableHeader>
                      <TableHead className="w-10" />
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginated.map((inv: any) => {
                      const sc = STATUS_CONFIG[inv.status as InvoiceStatus] || STATUS_CONFIG.draft;
                      const isOverdue = inv.due_date && new Date(inv.due_date) < new Date() && ["sent", "partial"].includes(inv.status);
                      const customerName = customers.find((c: any) => c.id === inv.customer_id)?.full_name || "—";
                      const bookingNum = bookings.find((b: any) => b.id === inv.booking_id)?.booking_number || "";
                      const balance = Number(inv.total_amount || 0) - Number(inv.amount_paid || 0);

                      return (
                        <TableRow
                          key={inv.id}
                          className={cn(
                            "cursor-pointer transition-colors",
                            isOverdue ? "border-s-2 border-s-destructive bg-destructive/[0.03] hover:bg-destructive/[0.06]" : "hover:bg-muted/30"
                          )}
                          onClick={() => navigate(`/dashboard/invoices/${inv.id}`)}
                        >
                          <TableCell className="font-mono text-xs font-medium">{inv.invoice_number}</TableCell>
                          <TableCell className="text-xs">{customerName}</TableCell>
                          <TableCell className="text-xs text-muted-foreground hidden md:table-cell">
                            {bookingNum ? (
                              <button
                                onClick={(e) => { e.stopPropagation(); navigate(`/dashboard/bookings/${inv.booking_id}`); }}
                                className="text-primary hover:underline"
                              >
                                {bookingNum}
                              </button>
                            ) : "—"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground hidden sm:table-cell">
                            {format(new Date(inv.issue_date), "MMM d, yyyy")}
                          </TableCell>
                          <TableCell className="text-xs hidden lg:table-cell">
                            {inv.due_date ? (
                              <span className={cn(isOverdue && "text-destructive font-medium")}>
                                {format(new Date(inv.due_date), "MMM d, yyyy")}
                                {isOverdue && " ⚠"}
                              </span>
                            ) : "—"}
                          </TableCell>
                          <TableCell className="text-end font-mono text-xs font-semibold">
                            {inv.currency} {Number(inv.total_amount || 0).toLocaleString()}
                          </TableCell>
                          <TableCell className="text-end font-mono text-xs hidden sm:table-cell">
                            <span className={cn(balance > 0 ? "text-amber-600 font-semibold" : "text-muted-foreground")}>
                              {balance > 0 ? `${inv.currency} ${balance.toLocaleString()}` : "—"}
                            </span>
                          </TableCell>
                          <TableCell>
                            <Badge className={cn("text-[10px] border-0 gap-1", sc.className)}>
                              <div className={cn("w-1.5 h-1.5 rounded-full", sc.dotColor)} />
                              {sc.label}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                                <Button size="icon" variant="ghost" className="h-7 w-7">
                                  <MoreHorizontal className="w-3.5 h-3.5" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-48" onClick={e => e.stopPropagation()}>
                                <DropdownMenuItem onClick={() => navigate(`/dashboard/invoices/${inv.id}`)}>
                                  <Eye className="w-3.5 h-3.5 me-2" /> View Details
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => copyInvoice(inv)}>
                                  <Copy className="w-3.5 h-3.5 me-2" /> Copy Invoice
                                </DropdownMenuItem>
                                {inv.status === "draft" && (
                                  <DropdownMenuItem onClick={() => updateStatus(inv.id, "sent")}>
                                    <Send className="w-3.5 h-3.5 me-2" /> Mark as Sent
                                  </DropdownMenuItem>
                                )}
                                {["sent", "partial", "overdue"].includes(inv.status) && (
                                  <DropdownMenuItem onClick={() => updateStatus(inv.id, "paid")}>
                                    <CheckCircle2 className="w-3.5 h-3.5 me-2" /> Mark as Paid
                                  </DropdownMenuItem>
                                )}
                                {["sent", "partial"].includes(inv.status) && (
                                  <DropdownMenuItem onClick={() => sendReminder(inv.id)}>
                                    <Bell className="w-3.5 h-3.5 me-2" /> Send Reminder
                                  </DropdownMenuItem>
                                )}
                                {inv.booking_id && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem onClick={() => navigate(`/dashboard/bookings/${inv.booking_id}`)}>
                                      <Eye className="w-3.5 h-3.5 me-2" /> View Booking
                                    </DropdownMenuItem>
                                  </>
                                )}
                                <DropdownMenuSeparator />
                                {inv.status === "draft" && (
                                  <DropdownMenuItem onClick={() => updateStatus(inv.id, "cancelled")} className="text-destructive">
                                    <Ban className="w-3.5 h-3.5 me-2" /> Cancel
                                  </DropdownMenuItem>
                                )}
                                <DropdownMenuItem onClick={() => softDelete(inv.id)} className="text-destructive">
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

              {/* Pagination */}
              {filtered.length > PAGE_SIZE && (
                <div className="flex items-center justify-between px-4 py-3 border-t border-border">
                  <p className="text-xs text-muted-foreground">
                    Showing {((page - 1) * PAGE_SIZE) + 1}–{Math.min(page * PAGE_SIZE, filtered.length)} of {filtered.length}
                  </p>
                  <div className="flex items-center gap-1">
                    <Button size="icon" variant="outline" className="h-7 w-7" disabled={page === 1} onClick={() => setPage(p => p - 1)}>
                      <ChevronLeft className="w-3.5 h-3.5" />
                    </Button>
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      let pageNum: number;
                      if (totalPages <= 5) { pageNum = i + 1; }
                      else if (page <= 3) { pageNum = i + 1; }
                      else if (page >= totalPages - 2) { pageNum = totalPages - 4 + i; }
                      else { pageNum = page - 2 + i; }
                      return (
                        <Button
                          key={pageNum}
                          size="icon"
                          variant={page === pageNum ? "default" : "outline"}
                          className="h-7 w-7 text-xs"
                          onClick={() => setPage(pageNum)}
                        >
                          {pageNum}
                        </Button>
                      );
                    })}
                    <Button size="icon" variant="outline" className="h-7 w-7" disabled={page === totalPages} onClick={() => setPage(p => p + 1)}>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Create Invoice Dialog */}
      <Dialog open={showNewDialog} onOpenChange={setShowNewDialog}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">{isArabic ? "فاتورة جديدة" : "Create New Invoice"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Booking (optional) */}
            <div className="space-y-1.5">
              <Label className="text-xs">{isArabic ? "ملف الحجز (اختياري)" : "Booking (optional)"}</Label>
              <Select value={form.booking_id} onValueChange={onBookingSelect}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={isArabic ? "ربط بحجز..." : "Link to a booking..."} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">No booking</SelectItem>
                  {bookings.map((b: any) => (
                    <SelectItem key={b.id} value={b.id}>
                      {b.booking_number} — {b.title}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Customer */}
            <div className="space-y-1.5">
              <Label className="text-xs">{isArabic ? "العميل" : "Customer"} *</Label>
              <Select value={form.customer_id} onValueChange={v => setForm(f => ({ ...f, customer_id: v }))}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder={isArabic ? "اختر عميل..." : "Select customer..."} />
                </SelectTrigger>
                <SelectContent>
                  {customers.map((c: any) => (
                    <SelectItem key={c.id} value={c.id}>{c.full_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{isArabic ? "تاريخ الإصدار" : "Issue Date"}</Label>
                <Input type="date" value={form.issue_date} onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))} className="h-9" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{isArabic ? "تاريخ الاستحقاق" : "Due Date"}</Label>
                <Input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className="h-9" />
              </div>
            </div>

            {/* Amount */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{isArabic ? "المبلغ الفرعي" : "Subtotal"} *</Label>
                <Input type="number" value={form.subtotal} onChange={e => setForm(f => ({ ...f, subtotal: e.target.value }))} className="h-9" placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{isArabic ? "العملة" : "Currency"}</Label>
                <Select value={form.currency} onValueChange={v => setForm(f => ({ ...f, currency: v }))}>
                  <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {["USD", "EUR", "GBP", "SAR", "AED", "EGP", "JOD", "KWD"].map(c => (
                      <SelectItem key={c} value={c}>{c}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Tax & Discount */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">{isArabic ? "نسبة الضريبة %" : "Tax Rate %"}</Label>
                <Input type="number" value={form.tax_rate} onChange={e => setForm(f => ({ ...f, tax_rate: e.target.value }))} className="h-9" placeholder="0" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">{isArabic ? "الخصم" : "Discount"}</Label>
                <Input type="number" value={form.discount_amount} onChange={e => setForm(f => ({ ...f, discount_amount: e.target.value }))} className="h-9" placeholder="0" />
              </div>
            </div>

            {/* Calculated Total */}
            <div className="rounded-lg bg-muted/40 border border-border p-3 space-y-1.5">
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>Subtotal</span>
                <span>{form.currency} {calculatedTotals.subtotal.toLocaleString()}</span>
              </div>
              {calculatedTotals.taxAmount > 0 && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Tax ({calculatedTotals.taxRate}%)</span>
                  <span>{form.currency} {calculatedTotals.taxAmount.toLocaleString()}</span>
                </div>
              )}
              {calculatedTotals.discount > 0 && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Discount</span>
                  <span>-{form.currency} {calculatedTotals.discount.toLocaleString()}</span>
                </div>
              )}
              <div className="border-t border-border pt-1.5 flex justify-between text-sm font-semibold">
                <span>Total</span>
                <span className="font-display">{form.currency} {calculatedTotals.total.toLocaleString()}</span>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-1.5">
              <Label className="text-xs">{isArabic ? "ملاحظات" : "Notes"}</Label>
              <Textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={2} placeholder={isArabic ? "ملاحظات اختيارية..." : "Optional notes..."} />
            </div>

            {/* Terms */}
            <div className="space-y-1.5">
              <Label className="text-xs">{isArabic ? "الشروط" : "Terms & Conditions"}</Label>
              <Textarea value={form.terms} onChange={e => setForm(f => ({ ...f, terms: e.target.value }))} rows={2} />
            </div>
          </div>
          <DialogFooter className="pt-3">
            <Button variant="outline" onClick={() => setShowNewDialog(false)}>
              {isArabic ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleCreate} disabled={saving || !form.customer_id || !form.subtotal}>
              {saving && <Loader2 className="w-4 h-4 me-2 animate-spin" />}
              {isArabic ? "إنشاء فاتورة" : "Create Invoice"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
