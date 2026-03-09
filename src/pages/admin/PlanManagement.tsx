import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Plus, Edit, Power, DollarSign } from "lucide-react";

const FEATURE_OPTIONS = [
  "itinerary_builder", "client_portal", "invoicing", "basic_reporting",
  "advanced_reporting", "custom_branding", "api_access", "operations",
  "custom_templates", "white_label",
];

interface PlanForm {
  id?: string;
  name: string;
  slug: string;
  description: string;
  price_monthly: number;
  price_yearly: number;
  currency: string;
  max_users: number | null;
  max_branches: number | null;
  max_trips: number | null;
  features: string[];
  sort_order: number;
  is_active: boolean;
}

const emptyForm: PlanForm = {
  name: "", slug: "", description: "", price_monthly: 0, price_yearly: 0,
  currency: "USD", max_users: 1, max_branches: 0, max_trips: 5,
  features: [], sort_order: 0, is_active: true,
};

export default function PlanManagement() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [dialog, setDialog] = useState(false);
  const [form, setForm] = useState<PlanForm>(emptyForm);
  const [isEdit, setIsEdit] = useState(false);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ["admin-plans"],
    queryFn: async () => {
      const { data } = await supabase.from("plans").select("*").is("deleted_at", null).order("sort_order");
      return data || [];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (plan: PlanForm) => {
      // Validate unique slug
      if (!isEdit) {
        const { data: existing } = await supabase.from("plans").select("id").eq("slug", plan.slug).is("deleted_at", null);
        if (existing && existing.length > 0) throw new Error("A plan with this slug already exists");
      }
      if (plan.price_monthly < 0 || plan.price_yearly < 0) throw new Error("Prices must be positive");

      const payload = {
        name: plan.name, slug: plan.slug, description: plan.description || null,
        price_monthly: plan.price_monthly, price_yearly: plan.price_yearly, currency: plan.currency,
        max_users: plan.max_users, max_branches: plan.max_branches, max_trips: plan.max_trips,
        features: plan.features, sort_order: plan.sort_order, is_active: plan.is_active,
      };

      if (isEdit && plan.id) {
        const { error } = await supabase.from("plans").update(payload).eq("id", plan.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("plans").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-plans"] });
      setDialog(false);
      toast({ title: isEdit ? "Plan updated" : "Plan created" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  const toggleActive = useMutation({
    mutationFn: async ({ id, active }: { id: string; active: boolean }) => {
      const { error } = await supabase.from("plans").update({ is_active: active }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-plans"] });
      toast({ title: "Plan status updated" });
    },
  });

  const openEdit = (plan: any) => {
    setForm({
      id: plan.id, name: plan.name, slug: plan.slug, description: plan.description || "",
      price_monthly: plan.price_monthly, price_yearly: plan.price_yearly, currency: plan.currency,
      max_users: plan.max_users, max_branches: plan.max_branches, max_trips: plan.max_trips,
      features: Array.isArray(plan.features) ? plan.features : [], sort_order: plan.sort_order,
      is_active: plan.is_active,
    });
    setIsEdit(true);
    setDialog(true);
  };

  const openNew = () => { setForm(emptyForm); setIsEdit(false); setDialog(true); };

  if (isLoading) return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold font-display text-foreground">Plan Management</h1>
          <p className="text-sm text-muted-foreground">Configure subscription plans and pricing</p>
        </div>
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" /> Add New Plan</Button>
      </div>

      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Slug</TableHead>
                <TableHead>Monthly</TableHead>
                <TableHead>Yearly</TableHead>
                <TableHead>Users</TableHead>
                <TableHead>Branches</TableHead>
                <TableHead>Bookings/mo</TableHead>
                <TableHead>Features</TableHead>
                <TableHead>Order</TableHead>
                <TableHead>Status</TableHead>
                <TableHead></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {plans.map((plan: any) => (
                <TableRow key={plan.id}>
                  <TableCell className="font-medium">{plan.name}</TableCell>
                  <TableCell className="font-mono text-xs">{plan.slug}</TableCell>
                  <TableCell>${plan.price_monthly}</TableCell>
                  <TableCell>${plan.price_yearly}</TableCell>
                  <TableCell>{plan.max_users ?? "∞"}</TableCell>
                  <TableCell>{plan.max_branches ?? "∞"}</TableCell>
                  <TableCell>{plan.max_trips ?? "∞"}</TableCell>
                  <TableCell>
                    <div className="flex flex-wrap gap-1">
                      {(Array.isArray(plan.features) ? plan.features : []).slice(0, 3).map((f: string) => (
                        <Badge key={f} variant="secondary" className="text-[9px]">{f}</Badge>
                      ))}
                      {(Array.isArray(plan.features) ? plan.features : []).length > 3 && (
                        <Badge variant="secondary" className="text-[9px]">+{plan.features.length - 3}</Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell>{plan.sort_order}</TableCell>
                  <TableCell>
                    <Badge variant={plan.is_active ? "default" : "secondary"}>
                      {plan.is_active ? "Active" : "Inactive"}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(plan)}>
                        <Edit className="w-3.5 h-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8"
                        onClick={() => toggleActive.mutate({ id: plan.id, active: !plan.is_active })}>
                        <Power className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Plan Edit Dialog */}
      <Dialog open={dialog} onOpenChange={setDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{isEdit ? "Edit Plan" : "New Plan"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Plan Name *</Label>
                <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Slug *</Label>
                <Input value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") })}
                  className="mt-1 font-mono" disabled={isEdit} />
              </div>
            </div>
            <div>
              <Label className="text-xs">Description</Label>
              <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="mt-1" />
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label className="text-xs">Monthly Price</Label>
                <Input type="number" min={0} value={form.price_monthly}
                  onChange={(e) => setForm({ ...form, price_monthly: parseFloat(e.target.value) || 0 })} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Yearly Price</Label>
                <Input type="number" min={0} value={form.price_yearly}
                  onChange={(e) => setForm({ ...form, price_yearly: parseFloat(e.target.value) || 0 })} className="mt-1" />
              </div>
              <div>
                <Label className="text-xs">Currency</Label>
                <Input value={form.currency} onChange={(e) => setForm({ ...form, currency: e.target.value })} className="mt-1" />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              {(["max_users", "max_branches", "max_trips"] as const).map((field) => {
                const labels = { max_users: "Max Users", max_branches: "Max Branches", max_trips: "Max Bookings/mo" };
                const isUnlimited = form[field] === null;
                return (
                  <div key={field}>
                    <Label className="text-xs">{labels[field]}</Label>
                    <div className="flex items-center gap-2 mt-1">
                      {isUnlimited ? (
                        <span className="text-sm text-muted-foreground flex-1">Unlimited</span>
                      ) : (
                        <Input type="number" min={0} value={form[field] ?? 0}
                          onChange={(e) => setForm({ ...form, [field]: parseInt(e.target.value) || 0 })} className="flex-1" />
                      )}
                      <Button variant="outline" size="sm" className="text-[10px] shrink-0"
                        onClick={() => setForm({ ...form, [field]: isUnlimited ? 1 : null })}>
                        {isUnlimited ? "Set limit" : "∞"}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>

            <div>
              <Label className="text-xs mb-2 block">Features</Label>
              <div className="grid grid-cols-2 gap-2">
                {FEATURE_OPTIONS.map((f) => (
                  <label key={f} className="flex items-center gap-2 text-sm cursor-pointer">
                    <Checkbox
                      checked={form.features.includes(f)}
                      onCheckedChange={(checked) => {
                        setForm({
                          ...form,
                          features: checked ? [...form.features, f] : form.features.filter((x) => x !== f),
                        });
                      }}
                    />
                    <span className="text-xs">{f.replace(/_/g, " ")}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-xs">Sort Order</Label>
                <Input type="number" value={form.sort_order}
                  onChange={(e) => setForm({ ...form, sort_order: parseInt(e.target.value) || 0 })} className="mt-1" />
              </div>
              <div className="flex items-center gap-2 pt-5">
                <Switch checked={form.is_active} onCheckedChange={(v) => setForm({ ...form, is_active: v })} />
                <Label className="text-xs">Active</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(false)}>Cancel</Button>
            <Button onClick={() => saveMutation.mutate(form)} disabled={!form.name || !form.slug || saveMutation.isPending}>
              {saveMutation.isPending && <Loader2 className="w-4 h-4 animate-spin mr-2" />}
              {isEdit ? "Update Plan" : "Create Plan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
