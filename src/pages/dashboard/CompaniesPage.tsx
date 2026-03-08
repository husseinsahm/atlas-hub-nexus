import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import {
  Plus, Search, Building2, MoreHorizontal, Pencil, Trash2,
  Eye, MapPin, CheckCircle, XCircle, Loader2, X
} from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle
} from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";

interface Company {
  id: string;
  name: string;
  slug: string;
  email: string | null;
  phone: string | null;
  address: string | null;
  is_active: boolean;
  deleted_at: string | null;
  created_at: string;
}

interface Branch {
  id: string;
  company_id: string;
  name: string;
  city: string | null;
  country: string | null;
  phone: string | null;
  email: string | null;
  address: string | null;
  is_main: boolean;
  is_active: boolean;
}

export default function CompaniesPage() {
  const { t } = useLanguage();
  const { toast } = useToast();
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editDialog, setEditDialog] = useState(false);
  const [branchDialog, setBranchDialog] = useState(false);
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [saving, setSaving] = useState(false);

  // Form state
  const [form, setForm] = useState({ name: "", slug: "", email: "", phone: "", address: "" });
  const [branchForm, setBranchForm] = useState({ name: "", city: "", country: "", phone: "", email: "", address: "", is_main: false });

  const fetchCompanies = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("companies")
      .select("*")
      .is("deleted_at", null)
      .order("created_at", { ascending: false });
    if (!error && data) setCompanies(data);
    setLoading(false);
  };

  const fetchBranches = async (companyId: string) => {
    const { data } = await supabase
      .from("company_branches")
      .select("*")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .order("is_main", { ascending: false });
    if (data) setBranches(data);
  };

  useEffect(() => { fetchCompanies(); }, []);

  const generateSlug = (name: string) =>
    name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");

  const handleSave = async () => {
    setSaving(true);
    const slug = form.slug || generateSlug(form.name);
    if (selectedCompany) {
      const { error } = await supabase
        .from("companies")
        .update({ name: form.name, slug, email: form.email || null, phone: form.phone || null, address: form.address || null })
        .eq("id", selectedCompany.id);
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else toast({ title: "Company updated" });
    } else {
      const { error } = await supabase
        .from("companies")
        .insert({ name: form.name, slug, email: form.email || null, phone: form.phone || null, address: form.address || null });
      if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
      else toast({ title: "Company created" });
    }
    setSaving(false);
    setEditDialog(false);
    fetchCompanies();
  };

  const handleDelete = async (company: Company) => {
    const { error } = await supabase
      .from("companies")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", company.id);
    if (!error) {
      toast({ title: "Company archived" });
      fetchCompanies();
    }
  };

  const toggleActive = async (company: Company) => {
    await supabase
      .from("companies")
      .update({ is_active: !company.is_active })
      .eq("id", company.id);
    fetchCompanies();
  };

  const openEdit = (company?: Company) => {
    if (company) {
      setSelectedCompany(company);
      setForm({ name: company.name, slug: company.slug, email: company.email || "", phone: company.phone || "", address: company.address || "" });
    } else {
      setSelectedCompany(null);
      setForm({ name: "", slug: "", email: "", phone: "", address: "" });
    }
    setEditDialog(true);
  };

  const openBranches = (company: Company) => {
    setSelectedCompany(company);
    fetchBranches(company.id);
    setBranchDialog(true);
  };

  const handleAddBranch = async () => {
    if (!selectedCompany || !branchForm.name.trim()) return;
    setSaving(true);
    const { error } = await supabase.from("company_branches").insert({
      company_id: selectedCompany.id,
      name: branchForm.name,
      city: branchForm.city || null,
      country: branchForm.country || null,
      phone: branchForm.phone || null,
      email: branchForm.email || null,
      address: branchForm.address || null,
      is_main: branchForm.is_main,
    });
    if (error) toast({ title: "Error", description: error.message, variant: "destructive" });
    else {
      toast({ title: "Branch added" });
      setBranchForm({ name: "", city: "", country: "", phone: "", email: "", address: "", is_main: false });
      fetchBranches(selectedCompany.id);
    }
    setSaving(false);
  };

  const handleDeleteBranch = async (branchId: string) => {
    if (!selectedCompany) return;
    await supabase.from("company_branches").update({ deleted_at: new Date().toISOString() }).eq("id", branchId);
    fetchBranches(selectedCompany.id);
  };

  const filtered = companies.filter((c) =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.slug.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">{t("nav.companies")}</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage all registered travel companies</p>
        </div>
        <Button onClick={() => openEdit()} className="gold-gradient border-0 text-accent-foreground font-semibold hover:opacity-90 gap-2">
          <Plus className="w-4 h-4" />
          Add Company
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-sm">
        <Search className="absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" style={{ insetInlineStart: 12 }} />
        <input
          type="text"
          placeholder="Search companies..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="luxury-input w-full h-10"
          style={{ paddingInlineStart: 36 }}
        />
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gold" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="luxury-card p-12 text-center">
          <Building2 className="w-10 h-10 text-muted-foreground mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">No companies found</p>
        </div>
      ) : (
        <div className="luxury-card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="text-start text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Company</th>
                  <th className="text-start text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Slug</th>
                  <th className="text-start text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Email</th>
                  <th className="text-start text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Status</th>
                  <th className="text-start text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Created</th>
                  <th className="text-end text-xs font-semibold text-muted-foreground uppercase tracking-wider px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((company) => (
                  <tr key={company.id} className="border-b border-border last:border-0 hover:bg-muted/20 transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-lg bg-navy/10 flex items-center justify-center">
                          <Building2 className="w-4 h-4 text-navy" />
                        </div>
                        <span className="font-medium text-sm text-foreground">{company.name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground font-mono">{company.slug}</td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">{company.email || "—"}</td>
                    <td className="px-4 py-3">
                      <button onClick={() => toggleActive(company)} className="inline-flex items-center gap-1.5">
                        {company.is_active ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-gold-dark bg-gold/10 px-2.5 py-1 rounded-full">
                            <CheckCircle className="w-3 h-3" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-destructive bg-destructive/10 px-2.5 py-1 rounded-full">
                            <XCircle className="w-3 h-3" /> Inactive
                          </span>
                        )}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {new Date(company.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-end">
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="w-4 h-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => openEdit(company)}>
                            <Pencil className="w-4 h-4 me-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => openBranches(company)}>
                            <MapPin className="w-4 h-4 me-2" /> Branches
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => handleDelete(company)} className="text-destructive">
                            <Trash2 className="w-4 h-4 me-2" /> Archive
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Edit/Create Dialog */}
      <Dialog open={editDialog} onOpenChange={setEditDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-display">
              {selectedCompany ? "Edit Company" : "Create Company"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground/80 uppercase tracking-wider">Company Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value, slug: generateSlug(e.target.value) })} className="luxury-input w-full" required maxLength={100} />
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground/80 uppercase tracking-wider">Slug</label>
              <input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="luxury-input w-full font-mono text-sm" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground/80 uppercase tracking-wider">Email</label>
                <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="luxury-input w-full" maxLength={255} />
              </div>
              <div className="space-y-2">
                <label className="text-xs font-medium text-foreground/80 uppercase tracking-wider">Phone</label>
                <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="luxury-input w-full" />
              </div>
            </div>
            <div className="space-y-2">
              <label className="text-xs font-medium text-foreground/80 uppercase tracking-wider">Address</label>
              <input value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="luxury-input w-full" />
            </div>
            <div className="flex gap-3 pt-2">
              <Button variant="ghost" onClick={() => setEditDialog(false)} className="flex-1">Cancel</Button>
              <Button onClick={handleSave} disabled={saving || !form.name.trim()} className="flex-1 gold-gradient border-0 text-accent-foreground font-semibold hover:opacity-90">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : selectedCompany ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Branches Dialog */}
      <Dialog open={branchDialog} onOpenChange={setBranchDialog}>
        <DialogContent className="sm:max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display">
              Branches — {selectedCompany?.name}
            </DialogTitle>
          </DialogHeader>

          {/* Existing branches */}
          <div className="space-y-2 mb-4">
            {branches.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">No branches yet</p>
            ) : (
              branches.map((b) => (
                <div key={b.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border border-border">
                  <div>
                    <p className="text-sm font-medium text-foreground flex items-center gap-2">
                      {b.name}
                      {b.is_main && <span className="text-[10px] bg-gold/20 text-gold-dark px-1.5 py-0.5 rounded-full uppercase font-semibold">Main</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">{[b.city, b.country].filter(Boolean).join(", ") || "No location set"}</p>
                  </div>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => handleDeleteBranch(b.id)}>
                    <Trash2 className="w-3.5 h-3.5 text-muted-foreground hover:text-destructive" />
                  </Button>
                </div>
              ))
            )}
          </div>

          {/* Add branch form */}
          <div className="border-t border-border pt-4 space-y-3">
            <h4 className="text-sm font-semibold text-foreground">Add Branch</h4>
            <input value={branchForm.name} onChange={(e) => setBranchForm({ ...branchForm, name: e.target.value })} placeholder="Branch name" className="luxury-input w-full" maxLength={100} />
            <div className="grid grid-cols-2 gap-3">
              <input value={branchForm.city} onChange={(e) => setBranchForm({ ...branchForm, city: e.target.value })} placeholder="City" className="luxury-input w-full" />
              <input value={branchForm.country} onChange={(e) => setBranchForm({ ...branchForm, country: e.target.value })} placeholder="Country" className="luxury-input w-full" />
            </div>
            <label className="flex items-center gap-2 text-sm text-foreground cursor-pointer">
              <input type="checkbox" checked={branchForm.is_main} onChange={(e) => setBranchForm({ ...branchForm, is_main: e.target.checked })} className="accent-gold w-4 h-4" />
              Main branch
            </label>
            <Button onClick={handleAddBranch} disabled={saving || !branchForm.name.trim()} className="w-full gold-gradient border-0 text-accent-foreground font-semibold hover:opacity-90">
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : "Add Branch"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
