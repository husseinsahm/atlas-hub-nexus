import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Phone, Mail, MapPin, Clock, Trophy, XCircle, Sparkles,
  Eye, Edit2, Calendar, Users, DollarSign, ChevronRight,
} from "lucide-react";
import { format } from "date-fns";

type LeadStatus = "new" | "contacted" | "planning" | "awaiting_client" | "won" | "lost";

const STATUS_CONFIG: Record<LeadStatus, { label: string; color: string; headerBg: string; icon: React.ElementType }> = {
  new: { label: "New", color: "text-blue-700", headerBg: "bg-blue-50 border-blue-200", icon: Sparkles },
  contacted: { label: "Contacted", color: "text-cyan-700", headerBg: "bg-cyan-50 border-cyan-200", icon: Phone },
  planning: { label: "Planning", color: "text-amber-700", headerBg: "bg-amber-50 border-amber-200", icon: MapPin },
  awaiting_client: { label: "Awaiting", color: "text-purple-700", headerBg: "bg-purple-50 border-purple-200", icon: Clock },
  won: { label: "Won", color: "text-emerald-700", headerBg: "bg-emerald-50 border-emerald-200", icon: Trophy },
  lost: { label: "Lost", color: "text-red-600", headerBg: "bg-red-50 border-red-200", icon: XCircle },
};

const PIPELINE_ORDER: LeadStatus[] = ["new", "contacted", "planning", "awaiting_client", "won", "lost"];

interface Lead {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  travel_date: string | null;
  adults: number;
  children: number;
  destinations: string[];
  budget_min: number | null;
  budget_max: number | null;
  budget_currency: string;
  status: LeadStatus;
  source: string;
  urgency: string | null;
  created_at: string;
  assigned_to: string | null;
}

interface LeadKanbanProps {
  leads: Lead[];
  agentNameMap: Record<string, string>;
  onView: (id: string) => void;
  onEdit: (lead: Lead) => void;
  onMoveStatus: (leadId: string, newStatus: LeadStatus) => void;
}

function getInitials(name: string) {
  return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
}

function getInitialColor(name: string) {
  const colors = [
    "bg-blue-100 text-blue-700",
    "bg-emerald-100 text-emerald-700",
    "bg-amber-100 text-amber-700",
    "bg-purple-100 text-purple-700",
    "bg-rose-100 text-rose-700",
    "bg-cyan-100 text-cyan-700",
  ];
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
}

const URGENCY_DOT: Record<string, string> = {
  high: "bg-red-500",
  normal: "bg-amber-400",
  low: "bg-green-400",
};

export default function LeadKanban({ leads, agentNameMap, onView, onEdit, onMoveStatus }: LeadKanbanProps) {
  const columns = PIPELINE_ORDER.map(status => ({
    status,
    config: STATUS_CONFIG[status],
    leads: leads.filter(l => l.status === status),
  }));

  return (
    <div className="flex gap-4 overflow-x-auto pb-4 -mx-2 px-2">
      {columns.map(col => (
        <div key={col.status} className="flex-shrink-0 w-72">
          {/* Column header */}
          <div className={`rounded-t-xl border px-3 py-2.5 flex items-center justify-between ${col.config.headerBg}`}>
            <div className="flex items-center gap-2">
              <col.config.icon className={`w-4 h-4 ${col.config.color}`} />
              <span className={`text-sm font-semibold ${col.config.color}`}>{col.config.label}</span>
            </div>
            <span className={`text-xs font-bold ${col.config.color} bg-white/60 px-2 py-0.5 rounded-full`}>
              {col.leads.length}
            </span>
          </div>

          {/* Cards */}
          <div className="border border-t-0 border-border rounded-b-xl bg-muted/20 p-2 space-y-2 min-h-[200px]">
            {col.leads.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-8">No leads</p>
            ) : (
              col.leads.map(lead => (
                <Card
                  key={lead.id}
                  className="p-3 border border-border bg-card hover:shadow-md transition-shadow cursor-pointer group"
                  onClick={() => onView(lead.id)}
                >
                  {/* Top row: avatar + name + urgency */}
                  <div className="flex items-start gap-2.5 mb-2">
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 ${getInitialColor(lead.full_name)}`}>
                      {getInitials(lead.full_name)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{lead.full_name}</p>
                      {lead.email && (
                        <p className="text-[11px] text-muted-foreground truncate">{lead.email}</p>
                      )}
                    </div>
                    {lead.urgency && lead.urgency !== "normal" && (
                      <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 mt-1 ${URGENCY_DOT[lead.urgency] || ""}`} title={`${lead.urgency} urgency`} />
                    )}
                  </div>

                  {/* Details chips */}
                  <div className="flex flex-wrap gap-1.5 text-[10px]">
                    {lead.travel_date && (
                      <span className="inline-flex items-center gap-0.5 bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                        <Calendar className="w-2.5 h-2.5" />
                        {format(new Date(lead.travel_date), "MMM d")}
                      </span>
                    )}
                    {(lead.adults > 0 || lead.children > 0) && (
                      <span className="inline-flex items-center gap-0.5 bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                        <Users className="w-2.5 h-2.5" />
                        {lead.adults}A{lead.children > 0 ? `+${lead.children}C` : ""}
                      </span>
                    )}
                    {(lead.budget_min || lead.budget_max) && (
                      <span className="inline-flex items-center gap-0.5 bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                        <DollarSign className="w-2.5 h-2.5" />
                        {lead.budget_currency} {lead.budget_min?.toLocaleString() || "0"}
                        {lead.budget_max ? `–${lead.budget_max.toLocaleString()}` : "+"}
                      </span>
                    )}
                  </div>

                  {/* Destinations */}
                  {lead.destinations.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {lead.destinations.slice(0, 2).map((d, i) => (
                        <span key={i} className="text-[10px] bg-accent/10 text-accent-foreground px-1.5 py-0.5 rounded font-medium">
                          {d}
                        </span>
                      ))}
                      {lead.destinations.length > 2 && (
                        <span className="text-[10px] text-muted-foreground">+{lead.destinations.length - 2}</span>
                      )}
                    </div>
                  )}

                  {/* Footer: agent + actions */}
                  <div className="flex items-center justify-between mt-2.5 pt-2 border-t border-border/50">
                    <span className="text-[10px] text-muted-foreground">
                      {lead.assigned_to ? agentNameMap[lead.assigned_to] || "Agent" : "Unassigned"}
                    </span>
                    <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onEdit(lead)}>
                        <Edit2 className="w-3 h-3" />
                      </Button>
                      {/* Move forward button */}
                      {col.status !== "won" && col.status !== "lost" && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6"
                          title="Move to next stage"
                          onClick={() => {
                            const idx = PIPELINE_ORDER.indexOf(col.status);
                            if (idx < PIPELINE_ORDER.length - 2) {
                              onMoveStatus(lead.id, PIPELINE_ORDER[idx + 1]);
                            }
                          }}
                        >
                          <ChevronRight className="w-3 h-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              ))
            )}
          </div>
        </div>
      ))}
    </div>
  );
}
