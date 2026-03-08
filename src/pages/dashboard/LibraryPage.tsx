import { useState, useMemo, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  Search, Plus, LayoutGrid, List, Sparkles, Tag, Clock, MapPin,
  DollarSign, MoreHorizontal, Pencil, Trash2, Eye, EyeOff,
  Landmark, Hotel, Bike, Car, UtensilsCrossed, UserCheck, FileText,
  Loader2, X, Wand2, ChevronDown, Star, Globe,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { ModalDarkHeader } from "@/components/ui/modal-dark-header";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";

type LibraryCategory = "attraction" | "hotel" | "activity" | "transfer" | "meal" | "guide" | "template";

interface LibraryItem {
  id: string;
  company_id: string;
  category: LibraryCategory;
  title: string;
  description: string | null;
  city: string | null;
  country: string | null;
  duration_minutes: number | null;
  price_amount: number | null;
  price_currency: string;
  price_type: string;
  photos: string[];
  internal_notes: string | null;
  is_active: boolean;
  is_template: boolean;
  tags: string[];
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

const CATEGORIES: { value: LibraryCategory; label: string; icon: React.ElementType; color: string }[] = [
  { value: "attraction", label: "Attractions", icon: Landmark, color: "text-amber-600 bg-amber-50" },
  { value: "hotel", label: "Hotels", icon: Hotel, color: "text-blue-600 bg-blue-50" },
  { value: "activity", label: "Activities", icon: Bike, color: "text-emerald-600 bg-emerald-50" },
  { value: "transfer", label: "Transfers", icon: Car, color: "text-purple-600 bg-purple-50" },
  { value: "meal", label: "Meals", icon: UtensilsCrossed, color: "text-red-600 bg-red-50" },
  { value: "guide", label: "Guides", icon: UserCheck, color: "text-cyan-600 bg-cyan-50" },
  { value: "template", label: "Templates", icon: FileText, color: "text-orange-600 bg-orange-50" },
];

const getCategoryMeta = (cat: LibraryCategory) => CATEGORIES.find(c => c.value === cat) || CATEGORIES[0];

const emptyForm = {
  category: "attraction" as LibraryCategory,
  title: "",
  description: "",
  city: "",
  country: "",
  duration_minutes: "",
  price_amount: "",
  price_currency: "USD",
  price_type: "per_person",
  internal_notes: "",
  is_active: true,
  is_template: false,
  tags: [] as string[],
};

export default function LibraryPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const companyId = user?.activeMembership?.companyId;

  const [view, setView] = useState<"grid" | "table">("grid");
  const [activeTab, setActiveTab] = useState<"all" | LibraryCategory>("all");
  const [search, setSearch] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LibraryItem | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [tagInput, setTagInput] = useState("");
  const [aiLoading, setAiLoading] = useState<string | null>(null);

  // Fetch items
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["library-items", companyId],
    queryFn: async () => {
      if (!companyId) return [];
      const { data, error } = await supabase
        .from("library_items")
        .select("*")
        .eq("company_id", companyId)
        .is("deleted_at", null)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []).map((d: any) => ({
        ...d,
        photos: Array.isArray(d.photos) ? d.photos : [],
        tags: Array.isArray(d.tags) ? d.tags : [],
        metadata: d.metadata || {},
      })) as LibraryItem[];
    },
    enabled: !!companyId,
  });

  // Filtered items
  const filtered = useMemo(() => {
    let list = items;
    if (activeTab !== "all") list = list.filter(i => i.category === activeTab);
    if (!showInactive) list = list.filter(i => i.is_active);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(i =>
        i.title.toLowerCase().includes(q) ||
        i.city?.toLowerCase().includes(q) ||
        i.country?.toLowerCase().includes(q) ||
        i.tags.some(t => t.toLowerCase().includes(q))
      );
    }
    return list;
  }, [items, activeTab, showInactive, search]);

  // Category counts
  const counts = useMemo(() => {
    const c: Record<string, number> = { all: items.filter(i => showInactive || i.is_active).length };
    CATEGORIES.forEach(cat => {
      c[cat.value] = items.filter(i => i.category === cat.value && (showInactive || i.is_active)).length;
    });
    return c;
  }, [items, showInactive]);

  // Save mutation
  const saveMutation = useMutation({
    mutationFn: async (data: typeof form & { id?: string }) => {
      const payload = {
        company_id: companyId!,
        category: data.category,
        title: data.title,
        description: data.description || null,
        city: data.city || null,
        country: data.country || null,
        duration_minutes: data.duration_minutes ? parseInt(data.duration_minutes as string) : null,
        price_amount: data.price_amount ? parseFloat(data.price_amount as string) : 0,
        price_currency: data.price_currency,
        price_type: data.price_type,
        internal_notes: data.internal_notes || null,
        is_active: data.is_active,
        is_template: data.is_template,
        tags: data.tags,
        created_by: user?.id,
      };
      if (data.id) {
        const { error } = await supabase.from("library_items").update(payload).eq("id", data.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("library_items").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library-items"] });
      setDialogOpen(false);
      setEditingItem(null);
      setForm(emptyForm);
      toast({ title: editingItem ? "Item updated" : "Item created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  // Toggle active
  const toggleActive = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase.from("library_items").update({ is_active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["library-items"] }),
  });

  // Soft delete
  const softDelete = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("library_items").update({ deleted_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["library-items"] });
      toast({ title: "Item deleted" });
    },
  });

  // Open edit
  const openEdit = useCallback((item: LibraryItem) => {
    setEditingItem(item);
    setForm({
      category: item.category,
      title: item.title,
      description: item.description || "",
      city: item.city || "",
      country: item.country || "",
      duration_minutes: item.duration_minutes?.toString() || "",
      price_amount: item.price_amount?.toString() || "",
      price_currency: item.price_currency,
      price_type: item.price_type,
      internal_notes: item.internal_notes || "",
      is_active: item.is_active,
      is_template: item.is_template,
      tags: item.tags,
    });
    setDialogOpen(true);
  }, []);

  const openCreate = useCallback(() => {
    setEditingItem(null);
    setForm({ ...emptyForm, category: activeTab === "all" ? "attraction" : activeTab });
    setDialogOpen(true);
  }, [activeTab]);

  // AI actions
  const callAI = useCallback(async (action: string) => {
    setAiLoading(action);
    try {
      const { data, error } = await supabase.functions.invoke("library-ai", {
        body: { action, data: { category: form.category, title: form.title, city: form.city, country: form.country, description: form.description, notes: form.internal_notes, hints: form.tags.join(", ") } },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      if (action === "generate_description") {
        setForm(f => ({ ...f, description: data.result }));
      } else if (action === "suggest_tags") {
        try {
          const tags = JSON.parse(data.result);
          if (Array.isArray(tags)) setForm(f => ({ ...f, tags: [...new Set([...f.tags, ...tags])] }));
        } catch {
          toast({ title: "Could not parse tags", variant: "destructive" });
        }
      } else if (action === "enhance_notes") {
        setForm(f => ({ ...f, internal_notes: data.result }));
      }
      toast({ title: "AI completed", description: `${action.replace(/_/g, " ")} done` });
    } catch (e: any) {
      toast({ title: "AI Error", description: e.message, variant: "destructive" });
    } finally {
      setAiLoading(null);
    }
  }, [form, toast]);

  const addTag = useCallback(() => {
    const t = tagInput.trim();
    if (t && !form.tags.includes(t)) {
      setForm(f => ({ ...f, tags: [...f.tags, t] }));
      setTagInput("");
    }
  }, [tagInput, form.tags]);

  const removeTag = useCallback((tag: string) => {
    setForm(f => ({ ...f, tags: f.tags.filter(t => t !== tag) }));
  }, []);

  const formatDuration = (mins: number | null) => {
    if (!mins) return null;
    if (mins < 60) return `${mins}m`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return m ? `${h}h ${m}m` : `${h}h`;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Product Library</h1>
          <p className="text-sm text-muted-foreground mt-1">Manage your travel services, templates and reusable components</p>
        </div>
        <Button onClick={openCreate} className="gold-gradient text-accent-foreground shadow-md hover:shadow-lg transition-shadow">
          <Plus className="w-4 h-4 mr-2" /> Add Item
        </Button>
      </div>

      {/* Category Tabs */}
      <div className="bg-card rounded-xl border border-border p-1.5 shadow-sm overflow-x-auto">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as any)}>
          <TabsList className="bg-transparent h-auto p-0 gap-1 flex-wrap">
            <TabsTrigger
              value="all"
              className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg px-4 py-2 text-sm font-medium"
            >
              All <span className="ml-1.5 text-xs opacity-70">{counts.all}</span>
            </TabsTrigger>
            {CATEGORIES.map(cat => (
              <TabsTrigger
                key={cat.value}
                value={cat.value}
                className="data-[state=active]:bg-primary data-[state=active]:text-primary-foreground rounded-lg px-3 py-2 text-sm font-medium gap-1.5"
              >
                <cat.icon className="w-3.5 h-3.5" />
                {cat.label}
                <span className="text-xs opacity-70">{counts[cat.value] || 0}</span>
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by title, city, tag..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <Switch id="show-inactive" checked={showInactive} onCheckedChange={setShowInactive} />
            <Label htmlFor="show-inactive" className="text-xs text-muted-foreground whitespace-nowrap">Show inactive</Label>
          </div>
          <div className="flex bg-muted rounded-lg p-0.5">
            <button
              onClick={() => setView("grid")}
              className={cn("p-2 rounded-md transition-colors", view === "grid" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              <LayoutGrid className="w-4 h-4" />
            </button>
            <button
              onClick={() => setView("table")}
              className={cn("p-2 rounded-md transition-colors", view === "table" ? "bg-card shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground")}
            >
              <List className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin text-accent" />
        </div>
      ) : filtered.length === 0 ? (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center py-20">
          <div className="w-16 h-16 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-4">
            <Sparkles className="w-8 h-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground mb-1">No items found</h3>
          <p className="text-sm text-muted-foreground mb-4">Start building your product library</p>
          <Button onClick={openCreate} variant="outline">
            <Plus className="w-4 h-4 mr-2" /> Add your first item
          </Button>
        </motion.div>
      ) : view === "grid" ? (
        <motion.div
          layout
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
        >
          <AnimatePresence mode="popLayout">
            {filtered.map((item, i) => {
              const meta = getCategoryMeta(item.category);
              return (
                <motion.div
                  key={item.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Card
                    className={cn(
                      "group cursor-pointer hover:shadow-lg transition-all duration-300 border-border overflow-hidden",
                      !item.is_active && "opacity-60"
                    )}
                    onClick={() => openEdit(item)}
                  >
                    {/* Color strip */}
                    <div className={cn("h-1.5", meta.color.split(" ")[1])} />
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={cn("w-8 h-8 rounded-lg flex items-center justify-center shrink-0", meta.color)}>
                            <meta.icon className="w-4 h-4" />
                          </div>
                          <div className="min-w-0">
                            <h3 className="text-sm font-semibold text-foreground truncate">{item.title}</h3>
                            {item.city && (
                              <p className="text-xs text-muted-foreground flex items-center gap-1 truncate">
                                <MapPin className="w-3 h-3 shrink-0" /> {item.city}{item.country ? `, ${item.country}` : ""}
                              </p>
                            )}
                          </div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                            <button className="opacity-0 group-hover:opacity-100 transition-opacity p-1 rounded-md hover:bg-muted">
                              <MoreHorizontal className="w-4 h-4 text-muted-foreground" />
                            </button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={e => { e.stopPropagation(); openEdit(item); }}>
                              <Pencil className="w-3.5 h-3.5 mr-2" /> Edit
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={e => { e.stopPropagation(); toggleActive.mutate({ id: item.id, is_active: !item.is_active }); }}>
                              {item.is_active ? <EyeOff className="w-3.5 h-3.5 mr-2" /> : <Eye className="w-3.5 h-3.5 mr-2" />}
                              {item.is_active ? "Deactivate" : "Activate"}
                            </DropdownMenuItem>
                            <DropdownMenuItem className="text-destructive" onClick={e => { e.stopPropagation(); softDelete.mutate(item.id); }}>
                              <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>

                      {item.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{item.description}</p>
                      )}

                      <div className="flex items-center gap-3 text-xs text-muted-foreground">
                        {item.price_amount != null && item.price_amount > 0 && (
                          <span className="flex items-center gap-1 font-medium text-foreground">
                            <DollarSign className="w-3 h-3" />
                            {item.price_amount} {item.price_currency}
                          </span>
                        )}
                        {item.duration_minutes && (
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> {formatDuration(item.duration_minutes)}
                          </span>
                        )}
                      </div>

                      {item.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1">
                          {item.tags.slice(0, 3).map(tag => (
                            <Badge key={tag} variant="secondary" className="text-[10px] px-1.5 py-0">
                              {tag}
                            </Badge>
                          ))}
                          {item.tags.length > 3 && (
                            <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                              +{item.tags.length - 3}
                            </Badge>
                          )}
                        </div>
                      )}

                      <div className="flex items-center gap-2">
                        {item.is_template && (
                          <Badge className="bg-accent/10 text-accent border-0 text-[10px]">
                            <Star className="w-2.5 h-2.5 mr-1" /> Template
                          </Badge>
                        )}
                        {!item.is_active && (
                          <Badge variant="outline" className="text-[10px] text-muted-foreground">Inactive</Badge>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </motion.div>
      ) : (
        /* Table View */
        <Card className="border-border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Item</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Location</TableHead>
                <TableHead>Price</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="w-10"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(item => {
                const meta = getCategoryMeta(item.category);
                return (
                  <TableRow key={item.id} className="cursor-pointer hover:bg-muted/50" onClick={() => openEdit(item)}>
                    <TableCell>
                      <div className="font-medium text-foreground">{item.title}</div>
                      {item.tags.length > 0 && (
                        <div className="flex gap-1 mt-1">
                          {item.tags.slice(0, 2).map(t => (
                            <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0">{t}</Badge>
                          ))}
                        </div>
                      )}
                    </TableCell>
                    <TableCell>
                      <div className={cn("inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium", meta.color)}>
                        <meta.icon className="w-3 h-3" /> {meta.label}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {item.city}{item.country ? `, ${item.country}` : ""}
                    </TableCell>
                    <TableCell className="text-sm font-medium">
                      {item.price_amount && item.price_amount > 0 ? `${item.price_amount} ${item.price_currency}` : "—"}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {formatDuration(item.duration_minutes) || "—"}
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.is_active ? "default" : "outline"} className={item.is_active ? "bg-emerald-100 text-emerald-700 border-0" : ""}>
                        {item.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild onClick={e => e.stopPropagation()}>
                          <button className="p-1 rounded hover:bg-muted"><MoreHorizontal className="w-4 h-4" /></button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={e => { e.stopPropagation(); openEdit(item); }}>
                            <Pencil className="w-3.5 h-3.5 mr-2" /> Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={e => { e.stopPropagation(); toggleActive.mutate({ id: item.id, is_active: !item.is_active }); }}>
                            {item.is_active ? "Deactivate" : "Activate"}
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive" onClick={e => { e.stopPropagation(); softDelete.mutate(item.id); }}>
                            <Trash2 className="w-3.5 h-3.5 mr-2" /> Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(open) => { setDialogOpen(open); if (!open) { setEditingItem(null); setForm(emptyForm); } }}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="font-display text-lg">
              {editingItem ? "Edit Item" : "Add New Item"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5">
            {/* Row 1: Category & Title */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Category</Label>
                <Select value={form.category} onValueChange={v => setForm(f => ({ ...f, category: v as LibraryCategory }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CATEGORIES.map(c => (
                      <SelectItem key={c.value} value={c.value}>
                        <span className="flex items-center gap-2"><c.icon className="w-3.5 h-3.5" /> {c.label}</span>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="sm:col-span-2 space-y-1.5">
                <Label className="text-xs font-medium">Title</Label>
                <Input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Burj Khalifa Observation Deck" />
              </div>
            </div>

            {/* Row 2: Location */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">City</Label>
                <Input value={form.city} onChange={e => setForm(f => ({ ...f, city: e.target.value }))} placeholder="Dubai" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Country</Label>
                <Input value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))} placeholder="UAE" />
              </div>
            </div>

            {/* Description + AI */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Description</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs gap-1.5 text-accent hover:text-accent"
                      onClick={() => callAI("generate_description")}
                      disabled={!!aiLoading || !form.title}
                    >
                      {aiLoading === "generate_description" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                      AI Generate
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent>Generate a description using AI based on title & location</TooltipContent>
                </Tooltip>
              </div>
              <Textarea
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                placeholder="Describe this service..."
                rows={3}
              />
            </div>

            {/* Pricing & Duration */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Price</Label>
                <Input type="number" min="0" step="0.01" value={form.price_amount} onChange={e => setForm(f => ({ ...f, price_amount: e.target.value }))} placeholder="0.00" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Currency</Label>
                <Select value={form.price_currency} onValueChange={v => setForm(f => ({ ...f, price_currency: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="USD">USD</SelectItem>
                    <SelectItem value="EUR">EUR</SelectItem>
                    <SelectItem value="GBP">GBP</SelectItem>
                    <SelectItem value="AED">AED</SelectItem>
                    <SelectItem value="SAR">SAR</SelectItem>
                    <SelectItem value="TRY">TRY</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Price Type</Label>
                <Select value={form.price_type} onValueChange={v => setForm(f => ({ ...f, price_type: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="per_person">Per person</SelectItem>
                    <SelectItem value="per_group">Per group</SelectItem>
                    <SelectItem value="per_night">Per night</SelectItem>
                    <SelectItem value="flat">Flat rate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">Duration (min)</Label>
                <Input type="number" min="0" value={form.duration_minutes} onChange={e => setForm(f => ({ ...f, duration_minutes: e.target.value }))} placeholder="120" />
              </div>
            </div>

            {/* Tags + AI */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Tags</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1.5 text-accent hover:text-accent"
                  onClick={() => callAI("suggest_tags")}
                  disabled={!!aiLoading || !form.title}
                >
                  {aiLoading === "suggest_tags" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                  AI Suggest
                </Button>
              </div>
              <div className="flex flex-wrap gap-1.5 mb-2">
                {form.tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="gap-1 pr-1">
                    {tag}
                    <button onClick={() => removeTag(tag)} className="hover:bg-muted-foreground/20 rounded-full p-0.5">
                      <X className="w-2.5 h-2.5" />
                    </button>
                  </Badge>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addTag(); } }}
                  placeholder="Add a tag..."
                  className="flex-1"
                />
                <Button type="button" variant="outline" size="sm" onClick={addTag}>
                  <Tag className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>

            {/* Internal Notes + AI */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label className="text-xs font-medium">Internal Notes</Label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs gap-1.5 text-accent hover:text-accent"
                  onClick={() => callAI("enhance_notes")}
                  disabled={!!aiLoading || !form.internal_notes}
                >
                  {aiLoading === "enhance_notes" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                  AI Enhance
                </Button>
              </div>
              <Textarea
                value={form.internal_notes}
                onChange={e => setForm(f => ({ ...f, internal_notes: e.target.value }))}
                placeholder="Internal operational notes..."
                rows={2}
              />
            </div>

            {/* Toggles */}
            <div className="flex items-center gap-6 pt-2 border-t border-border">
              <div className="flex items-center gap-2">
                <Switch id="is-active" checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
                <Label htmlFor="is-active" className="text-sm">Active</Label>
              </div>
              <div className="flex items-center gap-2">
                <Switch id="is-template" checked={form.is_template} onCheckedChange={v => setForm(f => ({ ...f, is_template: v }))} />
                <Label htmlFor="is-template" className="text-sm">Template</Label>
              </div>
            </div>
          </div>

          <DialogFooter className="mt-4">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
            <Button
              onClick={() => saveMutation.mutate({ ...form, id: editingItem?.id })}
              disabled={!form.title || saveMutation.isPending}
              className="gold-gradient text-accent-foreground"
            >
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              {editingItem ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
