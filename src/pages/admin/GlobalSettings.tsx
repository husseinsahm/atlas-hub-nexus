import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Save, Settings } from "lucide-react";

export default function GlobalSettings() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [trialDays, setTrialDays] = useState(14);
  const [defaultPlan, setDefaultPlan] = useState("free");
  const [gracePeriod, setGracePeriod] = useState(0);
  const [supportEmail, setSupportEmail] = useState("support@safar.app");

  const { data: settings, isLoading } = useQuery({
    queryKey: ["global-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("global_settings").select("*");
      return data || [];
    },
  });

  const { data: plans = [] } = useQuery({
    queryKey: ["admin-plans-select"],
    queryFn: async () => {
      const { data } = await supabase.from("plans").select("slug, name").eq("is_active", true).is("deleted_at", null).order("sort_order");
      return data || [];
    },
  });

  useEffect(() => {
    if (settings) {
      const get = (key: string) => settings.find((s: any) => s.key === key)?.value;
      setTrialDays(get("trial_duration_days") ?? 14);
      setDefaultPlan(get("default_plan_slug") ?? "free");
      setGracePeriod(get("grace_period_days") ?? 0);
      setSupportEmail(get("support_email") ?? "support@safar.app");
    }
  }, [settings]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const updates = [
        { key: "trial_duration_days", value: trialDays, updated_by: user?.id },
        { key: "default_plan_slug", value: defaultPlan, updated_by: user?.id },
        { key: "grace_period_days", value: gracePeriod, updated_by: user?.id },
        { key: "support_email", value: supportEmail, updated_by: user?.id },
      ];
      for (const u of updates) {
        const { error } = await supabase.from("global_settings").upsert({
          key: u.key,
          value: u.value as any,
          updated_at: new Date().toISOString(),
          updated_by: u.updated_by,
        }, { onConflict: "key" });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["global-settings"] });
      toast({ title: "Settings saved" });
    },
    onError: (e: any) => toast({ title: "Error", description: e.message, variant: "destructive" }),
  });

  if (isLoading) return <div className="flex items-center justify-center min-h-[50vh]"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">Global Settings</h1>
        <p className="text-sm text-muted-foreground">System-wide configuration for all tenants</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Settings className="w-4 h-4" /> Trial & Subscription Settings
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <Label className="text-xs">Trial Duration (days)</Label>
              <Input type="number" min={0} max={365} value={trialDays}
                onChange={(e) => setTrialDays(parseInt(e.target.value) || 0)} className="mt-1" />
              <p className="text-[10px] text-muted-foreground mt-1">Number of days for new company trials</p>
            </div>
            <div>
              <Label className="text-xs">Default Plan for New Companies</Label>
              <Select value={defaultPlan} onValueChange={setDefaultPlan}>
                <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {plans.map((p: any) => (
                    <SelectItem key={p.slug} value={p.slug}>{p.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-muted-foreground mt-1">Plan assigned when a new company signs up</p>
            </div>
            <div>
              <Label className="text-xs">Grace Period After Trial Expires (days)</Label>
              <Input type="number" min={0} max={90} value={gracePeriod}
                onChange={(e) => setGracePeriod(parseInt(e.target.value) || 0)} className="mt-1" />
              <p className="text-[10px] text-muted-foreground mt-1">Days before data becomes read-only after trial expires</p>
            </div>
            <div>
              <Label className="text-xs">Support Email</Label>
              <Input value={supportEmail} onChange={(e) => setSupportEmail(e.target.value)} className="mt-1" />
              <p className="text-[10px] text-muted-foreground mt-1">Shown in upgrade prompts and trial expiry overlays</p>
            </div>
          </div>

          <div className="flex justify-end pt-4 border-t border-border">
            <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending} className="gap-2">
              {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              Save Settings
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
