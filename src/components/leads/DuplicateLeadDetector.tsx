import { useState } from "react";
import { Dialog, DialogContent, DialogFooter } from "@/components/ui/dialog";
import { ModalDarkHeader } from "@/components/ui/modal-dark-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertTriangle, User, Mail, Phone, Calendar, Eye, GitMerge, ArrowRight, Loader2, CheckCircle2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { format, formatDistanceToNow } from "date-fns";

interface DuplicateLead {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  status: string;
  updated_at: string;
  assigned_to: string | null;
}

interface DuplicateLeadDetectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  duplicates: DuplicateLead[];
  onContinue: () => void;
  onMerge: (targetLeadId: string) => void;
  newLeadName: string;
  agentMap: Record<string, string>;
}

const STATUS_LABELS: Record<string, string> = {
  new: "New",
  contacted: "Contacted",
  planning: "Planning",
  awaiting_client: "Awaiting",
  won: "Won",
  lost: "Lost",
};

export default function DuplicateLeadDetector({
  open, onOpenChange, duplicates, onContinue, onMerge, newLeadName, agentMap,
}: DuplicateLeadDetectorProps) {
  const navigate = useNavigate();
  const [merging, setMerging] = useState<string | null>(null);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[540px] p-0 gap-0 overflow-hidden border-border">
        <ModalDarkHeader
          icon={<AlertTriangle className="w-5 h-5 text-accent-foreground" />}
          title="Possible Duplicates Found"
          description={<>We found {duplicates.length} existing lead{duplicates.length > 1 ? "s" : ""} matching the contact details for "{newLeadName}"</>}
        />

        <div className="px-6 pb-4 max-h-[50vh] overflow-y-auto space-y-3">
          {duplicates.map(dup => (
            <div key={dup.id} className="p-3 rounded-lg border border-border bg-card hover:shadow-sm transition-shadow">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-9 h-9 rounded-full bg-muted flex items-center justify-center text-xs font-bold text-muted-foreground shrink-0">
                    {dup.full_name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2)}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-foreground truncate">{dup.full_name}</p>
                    <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-muted-foreground">
                      {dup.email && <span className="flex items-center gap-1"><Mail className="w-3 h-3" /> {dup.email}</span>}
                      {dup.phone && <span className="flex items-center gap-1"><Phone className="w-3 h-3" /> {dup.phone}</span>}
                    </div>
                    <div className="flex items-center gap-2 mt-1.5">
                      <Badge variant="secondary" className="text-[10px]">{STATUS_LABELS[dup.status] || dup.status}</Badge>
                      <span className="text-[10px] text-muted-foreground">
                        Updated {formatDistanceToNow(new Date(dup.updated_at), { addSuffix: true })}
                      </span>
                      {dup.assigned_to && agentMap[dup.assigned_to] && (
                        <span className="text-[10px] text-muted-foreground">
                          • {agentMap[dup.assigned_to]}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 mt-3 pt-2 border-t border-border">
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs gap-1 h-7"
                  onClick={() => {
                    onOpenChange(false);
                    navigate(`/dashboard/leads/${dup.id}`);
                  }}
                >
                  <Eye className="w-3 h-3" /> Open Lead
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-xs gap-1 h-7"
                  onClick={() => onMerge(dup.id)}
                  disabled={merging === dup.id}
                >
                  {merging === dup.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <GitMerge className="w-3 h-3" />}
                  Merge Into This
                </Button>
              </div>
            </div>
          ))}
        </div>

        <div className="px-6 py-4 border-t border-border bg-muted/30 flex items-center justify-between">
          <Button variant="ghost" onClick={() => onOpenChange(false)} className="text-muted-foreground">
            Cancel
          </Button>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
              onContinue();
            }}
            className="gap-1.5"
          >
            Create Anyway <ArrowRight className="w-4 h-4" />
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Helper to check for duplicates
export async function checkDuplicateLeads(
  companyId: string,
  email: string | null,
  phone: string | null,
  excludeId?: string
): Promise<DuplicateLead[]> {
  if (!email && !phone) return [];

  let query = supabase
    .from("leads")
    .select("id, full_name, email, phone, status, updated_at, assigned_to")
    .eq("company_id", companyId)
    .is("deleted_at", null);

  // Build OR conditions
  const conditions: string[] = [];
  if (email) conditions.push(`email.eq.${email}`);
  if (phone) conditions.push(`phone.eq.${phone}`);

  if (conditions.length === 0) return [];

  // We need to do separate queries since .or() with multiple fields is tricky
  const results: DuplicateLead[] = [];
  const seenIds = new Set<string>();

  if (email) {
    const { data } = await supabase
      .from("leads")
      .select("id, full_name, email, phone, status, updated_at, assigned_to")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .eq("email", email);
    (data || []).forEach(d => {
      if (!seenIds.has(d.id) && d.id !== excludeId) {
        seenIds.add(d.id);
        results.push(d as DuplicateLead);
      }
    });
  }

  if (phone) {
    const { data } = await supabase
      .from("leads")
      .select("id, full_name, email, phone, status, updated_at, assigned_to")
      .eq("company_id", companyId)
      .is("deleted_at", null)
      .eq("phone", phone);
    (data || []).forEach(d => {
      if (!seenIds.has(d.id) && d.id !== excludeId) {
        seenIds.add(d.id);
        results.push(d as DuplicateLead);
      }
    });
  }

  return results;
}

// Merge helper
export async function mergeLeads(
  sourceLeadId: string,
  targetLeadId: string,
  companyId: string,
  userId: string,
): Promise<void> {
  // Get both leads
  const [{ data: source }, { data: target }] = await Promise.all([
    supabase.from("leads").select("*").eq("id", sourceLeadId).single(),
    supabase.from("leads").select("*").eq("id", targetLeadId).single(),
  ]);

  if (!source || !target) throw new Error("Lead not found");

  // Merge: keep latest updated fields, combine notes
  const mergedNotes = [target.notes, source.notes].filter(Boolean).join("\n\n---\n\n");

  const updates: Record<string, any> = { notes: mergedNotes || null };

  // Use source data for any null fields in target
  const fieldsToMerge = [
    "email", "phone", "whatsapp", "nationality", "preferred_language",
    "travel_date", "trip_type", "budget_min", "budget_max",
  ];
  fieldsToMerge.forEach(field => {
    if (!(target as any)[field] && (source as any)[field]) {
      updates[field] = (source as any)[field];
    }
  });

  // Use higher traveler count
  if (source.adults > target.adults) updates.adults = source.adults;
  if (source.children > target.children) updates.children = source.children;

  // Merge destinations
  const targetDests = Array.isArray(target.destinations) ? target.destinations : [];
  const sourceDests = Array.isArray(source.destinations) ? source.destinations : [];
  const mergedDests = [...new Set([...targetDests, ...sourceDests])];
  updates.destinations = mergedDests;

  await supabase.from("leads").update(updates).eq("id", targetLeadId);

  // Move follow-ups
  await supabase
    .from("lead_followups")
    .update({ lead_id: targetLeadId })
    .eq("lead_id", sourceLeadId);

  // Move activities (copy reference)
  await supabase.from("lead_activities").insert({
    lead_id: targetLeadId,
    user_id: userId,
    activity_type: "updated",
    description: `Merged with lead "${source.full_name}" (duplicate)`,
    metadata: { merged_lead_id: sourceLeadId, action: "merge" },
  });

  // Soft-delete source lead
  await supabase
    .from("leads")
    .update({ deleted_at: new Date().toISOString() })
    .eq("id", sourceLeadId);
}
