import { useState, useEffect, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  Users, UserPlus, Search, Eye, Edit2, Phone, Mail, Globe,
  MapPin, Tag, Heart, Star, Calendar,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { CountrySelect, NationalitySelect } from "@/components/ui/country-select";
import { CityAutocomplete } from "@/components/ui/city-autocomplete";
import { PhoneInput } from "@/components/ui/phone-input";
import { NoCustomersEmptyState, NoSearchResultsEmptyState } from "@/components/ui/empty-state";
import { TableLoadingState, StatsGridLoadingState } from "@/components/ui/loading-state";
import { format } from "date-fns";

const PREFERENCE_OPTIONS = [
  "Luxury", "Budget", "Family", "Honeymoon", "Adventure", "Cultural",
  "Private Car", "Arabic Guide", "English Guide", "French Guide",
  "Halal Food", "Vegetarian", "VIP", "Group Tour", "Solo Traveler",
  "Beach", "Mountains", "Desert Safari", "Cruise", "Wellness & Spa",
];

const PREFERENCE_COLORS: Record<string, string> = {
  Luxury: "bg-amber-100 text-amber-800 border-amber-200",
  VIP: "bg-amber-100 text-amber-800 border-amber-200",
  Family: "bg-blue-100 text-blue-800 border-blue-200",
  Honeymoon: "bg-pink-100 text-pink-800 border-pink-200",
  Adventure: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Budget: "bg-slate-100 text-slate-700 border-slate-200",
};

function getTagColor(tag: string) {
  return PREFERENCE_COLORS[tag] || "bg-secondary text-secondary-foreground border-border";
}

interface Customer {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  nationality: string | null;
  preferences: string[];
  tags: string[];
  source: string;
  notes: string | null;
  created_at: string;
  lead_id: string | null;
}

const emptyForm = {
  full_name: "",
  email: "",
  phone: "",
  secondary_phone: "",
  nationality: "",
  date_of_birth: "",
  passport_number: "",
  address: "",
  city: "",
  country: "",
  source: "direct",
  notes: "",
  selectedPrefs: [] as string[],
};

export default function CustomersPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const companyId = user?.activeMembership?.companyId;
  const isAdminOrAgent =
    user?.isSuperAdmin ||
    user?.activeMembership?.role === "company_admin" ||
    user?.activeMembership?.role === "agent";

  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterPref, setFilterPref] = useState("all");

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (companyId) fetchCustomers();
  }, [companyId]);

  async function fetchCustomers() {
    if (!companyId) return;
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("customers")
        .select("*")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setCustomers(
        (data || []).map((d: any) => ({
          ...d,
          preferences: Array.isArray(d.preferences) ? d.preferences : [],
          tags: Array.isArray(d.tags) ? d.tags : [],
        }))
      );
    } catch (err: any) {
      toast({ title: "Error loading customers", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setFormOpen(true);
  }

  function openEdit(c: Customer) {
    setEditingId(c.id);
    setForm({
      full_name: c.full_name,
      email: c.email || "",
      phone: c.phone || "",
      secondary_phone: "",
      nationality: c.nationality || "",
      date_of_birth: "",
      passport_number: "",
      address: "",
      city: "",
      country: "",
      source: c.source || "direct",
      notes: c.notes || "",
      selectedPrefs: c.preferences,
    });
    setFormOpen(true);
  }

  function togglePref(pref: string) {
    setForm((prev) => ({
      ...prev,
      selectedPrefs: prev.selectedPrefs.includes(pref)
        ? prev.selectedPrefs.filter((p) => p !== pref)
        : [...prev.selectedPrefs, pref],
    }));
  }

  async function handleSave() {
    if (!companyId || !user) return;
    if (!form.full_name.trim()) {
      toast({ title: "Name is required", variant: "destructive" });
      return;
    }
    if (form.full_name.trim().length > 200) {
      toast({ title: "Name too long", variant: "destructive" });
      return;
    }
    if (form.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      toast({ title: "Invalid email", variant: "destructive" });
      return;
    }

    setSaving(true);
    const payload = {
      company_id: companyId,
      full_name: form.full_name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      secondary_phone: form.secondary_phone.trim() || null,
      nationality: form.nationality.trim() || null,
      date_of_birth: form.date_of_birth || null,
      passport_number: form.passport_number.trim() || null,
      address: form.address.trim() || null,
      city: form.city.trim() || null,
      country: form.country.trim() || null,
      source: form.source,
      notes: form.notes.trim() || null,
      preferences: form.selectedPrefs,
      tags: form.selectedPrefs,
    };

    try {
      if (editingId) {
        const { error } = await supabase.from("customers").update(payload).eq("id", editingId);
        if (error) throw error;
        toast({ title: "Customer updated" });
      } else {
        const { error } = await supabase.from("customers").insert({ ...payload, created_by: user.id });
        if (error) throw error;
        toast({ title: "Customer created" });
      }
      setFormOpen(false);
      fetchCustomers();
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const filtered = useMemo(() => {
    return customers.filter((c) => {
      if (filterPref !== "all" && !c.preferences.includes(filterPref)) return false;
      if (search) {
        const q = search.toLowerCase();
        return (
          c.full_name.toLowerCase().includes(q) ||
          (c.email && c.email.toLowerCase().includes(q)) ||
          (c.phone && c.phone.includes(q)) ||
          (c.nationality && c.nationality.toLowerCase().includes(q))
        );
      }
      return true;
    });
  }, [customers, search, filterPref]);

  // Unique preferences in use
  const usedPrefs = useMemo(() => {
    const s = new Set<string>();
    customers.forEach((c) => c.preferences.forEach((p) => s.add(p)));
    return Array.from(s).sort();
  }, [customers]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground font-display">Customers</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your customer database and relationships</p>
        </div>
        {isAdminOrAgent && (
          <Button onClick={openCreate} className="gold-gradient text-accent-foreground gap-2 shadow-md">
            <UserPlus className="w-4 h-4" /> New Customer
          </Button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Total Customers", value: customers.length, icon: Users, color: "text-primary" },
          { label: "From Leads", value: customers.filter((c) => c.lead_id).length, icon: Star, color: "text-amber-600" },
          { label: "With Email", value: customers.filter((c) => c.email).length, icon: Mail, color: "text-blue-600" },
          { label: "This Month", value: customers.filter((c) => new Date(c.created_at).getMonth() === new Date().getMonth() && new Date(c.created_at).getFullYear() === new Date().getFullYear()).length, icon: Calendar, color: "text-emerald-600" },
        ].map((s) => (
          <Card key={s.label} className="border border-border bg-card">
            <CardContent className="p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center">
                <s.icon className={`w-5 h-5 ${s.color}`} />
              </div>
              <div>
                <p className="text-2xl font-bold text-foreground">{s.value}</p>
                <p className="text-xs text-muted-foreground">{s.label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filters */}
      <Card className="border border-border bg-card">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, email, phone, or nationality..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterPref} onValueChange={setFilterPref}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Preference" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Preferences</SelectItem>
                {usedPrefs.map((p) => (
                  <SelectItem key={p} value={p}>{p}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Customers Table */}
      <Card className="border border-border bg-card">
        <CardContent className="p-0">
          {loading ? (
            <TableLoadingState rows={5} columns={6} className="p-4" />
          ) : filtered.length === 0 ? (
            search.trim() ? (
              <NoSearchResultsEmptyState query={search} onClear={() => setSearch("")} className="m-8" />
            ) : (
              <NoCustomersEmptyState onAction={isAdminOrAgent ? openCreate : undefined} className="m-8" />
            )
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <TableHead>Customer</TableHead>
                  <TableHead className="hidden md:table-cell">Contact</TableHead>
                  <TableHead className="hidden lg:table-cell">Nationality</TableHead>
                  <TableHead>Preferences</TableHead>
                  <TableHead className="hidden xl:table-cell">Source</TableHead>
                  <TableHead className="hidden xl:table-cell">Added</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c) => (
                  <TableRow
                    key={c.id}
                    className="cursor-pointer"
                    onClick={() => navigate(`/dashboard/customers/${c.id}`)}
                  >
                    <TableCell>
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full bg-accent/10 flex items-center justify-center text-sm font-bold text-accent shrink-0">
                          {c.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-foreground text-sm">{c.full_name}</p>
                          {c.lead_id && (
                            <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                              <Star className="w-2.5 h-2.5" /> Converted from lead
                            </span>
                          )}
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <div className="text-xs text-muted-foreground space-y-0.5">
                        {c.email && <p className="flex items-center gap-1"><Mail className="w-3 h-3" /> {c.email}</p>}
                        {c.phone && <p className="flex items-center gap-1"><Phone className="w-3 h-3" /> {c.phone}</p>}
                      </div>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell text-sm text-muted-foreground">
                      {c.nationality || "—"}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1 max-w-[200px]">
                        {c.preferences.slice(0, 3).map((p) => (
                          <Badge key={p} className={`text-[10px] border ${getTagColor(p)}`}>{p}</Badge>
                        ))}
                        {c.preferences.length > 3 && (
                          <Badge variant="outline" className="text-[10px]">+{c.preferences.length - 3}</Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell">
                      <Badge variant="outline" className="text-xs capitalize">{c.source}</Badge>
                    </TableCell>
                    <TableCell className="hidden xl:table-cell text-sm text-muted-foreground">
                      {format(new Date(c.created_at), "MMM d, yyyy")}
                    </TableCell>
                    <TableCell className="text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-end gap-1">
                        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => navigate(`/dashboard/customers/${c.id}`)}>
                          <Eye className="w-4 h-4" />
                        </Button>
                        {isAdminOrAgent && (
                          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(c)}>
                            <Edit2 className="w-4 h-4" />
                          </Button>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent className="sm:max-w-2xl p-0 gap-0 overflow-hidden max-h-[95vh] sm:max-h-[90vh]">
          {/* Premium header */}
          <div className="relative px-5 sm:px-6 pt-5 pb-4 bg-gradient-to-br from-card via-background to-secondary/30 border-b border-border">
            <div className="absolute top-0 left-0 right-0 h-1 gold-gradient" />
            <div className="absolute -top-16 -right-16 w-48 h-48 rounded-full opacity-[0.06] bg-[radial-gradient(circle,hsl(var(--gold)),transparent_70%)]" />
            <div className="relative flex items-center gap-3">
              <div className="w-11 h-11 rounded-xl gold-gradient flex items-center justify-center shadow-lg ring-4 ring-background shrink-0">
                <UserPlus className="w-5 h-5 text-accent-foreground" />
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground font-display">
                  {editingId ? "Edit Customer" : "New Customer"}
                </h2>
                <p className="text-[11px] text-muted-foreground">
                  {editingId ? "Update customer profile" : "Add a new customer to your database"}
                </p>
              </div>
            </div>
          </div>

          <div className="px-5 sm:px-6 py-5 space-y-6 overflow-y-auto flex-1" style={{ maxHeight: 'calc(95vh - 140px)' }}>
            {/* ─── Personal Info ─── */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                  <Users className="w-3.5 h-3.5 text-primary" />
                </div>
                <p className="text-xs font-semibold text-foreground">Personal Information</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs">Full Name <span className="text-destructive">*</span></Label>
                  <Input value={form.full_name} onChange={(e) => setForm({ ...form, full_name: e.target.value })} placeholder="John Smith" maxLength={200} className="h-11" autoFocus />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Date of Birth</Label>
                  <Input type="date" value={form.date_of_birth} onChange={(e) => setForm({ ...form, date_of_birth: e.target.value })} className="h-11" />
                </div>
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs">Nationality</Label>
                  <NationalitySelect
                    value={form.nationality}
                    onValueChange={(v) => setForm({ ...form, nationality: v })}
                    placeholder="Select nationality"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Passport Number</Label>
                  <Input value={form.passport_number} onChange={(e) => setForm({ ...form, passport_number: e.target.value })} placeholder="Optional" maxLength={30} className="h-11 font-mono" />
                </div>
              </div>
            </section>

            <div className="border-t border-border/50" />

            {/* ─── Contact ─── */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-md bg-accent/10 flex items-center justify-center">
                  <Phone className="w-3.5 h-3.5 text-accent" />
                </div>
                <p className="text-xs font-semibold text-foreground">Contact Details</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2 space-y-1.5">
                  <Label className="text-xs">Email</Label>
                  <div className="relative">
                    <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} placeholder="john@example.com" maxLength={255} className="h-11 pl-10" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Phone</Label>
                  <PhoneInput value={form.phone} onValueChange={(v) => setForm({ ...form, phone: v })} defaultCountry="AE" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Secondary Phone</Label>
                  <PhoneInput value={form.secondary_phone} onValueChange={(v) => setForm({ ...form, secondary_phone: v })} defaultCountry="AE" placeholder="Optional" />
                </div>
              </div>
            </section>

            <div className="border-t border-border/50" />

            {/* ─── Address ─── */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-md bg-primary/10 flex items-center justify-center">
                  <MapPin className="w-3.5 h-3.5 text-primary" />
                </div>
                <p className="text-xs font-semibold text-foreground">Address</p>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-3 space-y-1.5">
                  <Label className="text-xs">Street Address</Label>
                  <Input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} placeholder="Street address" maxLength={300} className="h-11" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Country</Label>
                  <CountrySelect value={form.country} onValueChange={(v) => setForm({ ...form, country: v })} placeholder="Select country" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">City</Label>
                  <CityAutocomplete value={form.city} onValueChange={(v) => setForm({ ...form, city: v })} filterByCountry={form.country} placeholder="Select city" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Source</Label>
                  <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v })}>
                    <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="direct">Direct</SelectItem>
                      <SelectItem value="lead">From Lead</SelectItem>
                      <SelectItem value="referral">Referral</SelectItem>
                      <SelectItem value="website">Website</SelectItem>
                      <SelectItem value="partner">Partner</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </section>

            <div className="border-t border-border/50" />

            {/* ─── Preferences ─── */}
            <section>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-md bg-accent/10 flex items-center justify-center">
                  <Tag className="w-3.5 h-3.5 text-accent" />
                </div>
                <p className="text-xs font-semibold text-foreground">Preferences & Tags</p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {PREFERENCE_OPTIONS.map((pref) => {
                  const selected = form.selectedPrefs.includes(pref);
                  return (
                    <button
                      key={pref}
                      type="button"
                      onClick={() => togglePref(pref)}
                      className={cn(
                        "px-3 py-1.5 rounded-full text-[11px] font-medium border transition-all",
                        selected
                          ? `${getTagColor(pref)} ring-1 ring-accent/30 shadow-sm`
                          : "bg-background text-muted-foreground border-border hover:bg-muted hover:text-foreground"
                      )}
                    >
                      {selected && <span className="mr-1">✓</span>}
                      {pref}
                    </button>
                  );
                })}
              </div>
            </section>

            {/* ─── Notes ─── */}
            <div className="space-y-1.5">
              <Label className="text-xs">Notes</Label>
              <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="Additional notes about this customer..." rows={2} maxLength={2000} className="resize-none" />
            </div>
          </div>

          {/* Footer */}
          <div className="px-5 sm:px-6 py-4 border-t border-border bg-muted/30 flex items-center justify-between shrink-0">
            <Button variant="ghost" size="sm" onClick={() => setFormOpen(false)} className="text-xs">Cancel</Button>
            <Button
              size="sm"
              onClick={handleSave}
              disabled={saving}
              className="gold-gradient text-accent-foreground text-xs gap-1.5 px-6 shadow-md"
            >
              {saving && <div className="w-3.5 h-3.5 border-2 border-accent-foreground/30 border-t-accent-foreground rounded-full animate-spin" />}
              {saving ? "Saving..." : editingId ? "Update Customer" : "Create Customer"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
