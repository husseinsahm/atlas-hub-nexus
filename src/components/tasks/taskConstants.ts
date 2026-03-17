import {
  Phone, MessageCircle, Mail, Users as UsersIcon, CheckSquare, Bell,
  FileText, DollarSign, FolderOpen, PhoneCall,
} from "lucide-react";

export const TASK_TYPES = [
  { value: "call", label: "Call", icon: Phone, color: "text-blue-600 bg-blue-50 border-blue-200" },
  { value: "whatsapp", label: "WhatsApp", icon: MessageCircle, color: "text-emerald-600 bg-emerald-50 border-emerald-200" },
  { value: "email", label: "Email", icon: Mail, color: "text-purple-600 bg-purple-50 border-purple-200" },
  { value: "meeting", label: "Meeting", icon: UsersIcon, color: "text-amber-600 bg-amber-50 border-amber-200" },
  { value: "task", label: "Task", icon: CheckSquare, color: "text-cyan-600 bg-cyan-50 border-cyan-200" },
  { value: "reminder", label: "Reminder", icon: Bell, color: "text-rose-600 bg-rose-50 border-rose-200" },
  { value: "quotation_followup", label: "Quotation F/U", icon: FileText, color: "text-indigo-600 bg-indigo-50 border-indigo-200" },
  { value: "payment_followup", label: "Payment F/U", icon: DollarSign, color: "text-orange-600 bg-orange-50 border-orange-200" },
  { value: "document_request", label: "Doc Request", icon: FolderOpen, color: "text-teal-600 bg-teal-50 border-teal-200" },
  { value: "confirmation_call", label: "Confirm Call", icon: PhoneCall, color: "text-pink-600 bg-pink-50 border-pink-200" },
] as const;

export const PRIORITY_OPTIONS = [
  { value: "low", label: "Low", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { value: "normal", label: "Normal", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "high", label: "High", color: "bg-amber-100 text-amber-700 border-amber-200" },
  { value: "urgent", label: "Urgent", color: "bg-red-100 text-red-700 border-red-200" },
];

export const STATUS_OPTIONS = [
  { value: "pending", label: "Pending", color: "bg-slate-100 text-slate-700 border-slate-200" },
  { value: "in_progress", label: "In Progress", color: "bg-blue-100 text-blue-700 border-blue-200" },
  { value: "completed", label: "Completed", color: "bg-emerald-100 text-emerald-700 border-emerald-200" },
  { value: "cancelled", label: "Cancelled", color: "bg-gray-100 text-gray-600 border-gray-200" },
  { value: "overdue", label: "Overdue", color: "bg-red-100 text-red-700 border-red-200" },
  { value: "missed", label: "Missed", color: "bg-orange-100 text-orange-700 border-orange-200" },
];

export const REMINDER_OPTIONS = [
  { value: 0, label: "At due time" },
  { value: 15, label: "15 min before" },
  { value: 30, label: "30 min before" },
  { value: 60, label: "1 hour before" },
  { value: 120, label: "2 hours before" },
  { value: 1440, label: "1 day before" },
];

export const REPEAT_OPTIONS = [
  { value: "none", label: "No repeat" },
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-weekly" },
  { value: "monthly", label: "Monthly" },
];

export const QUICK_TEMPLATES: Record<string, { title: string; description: string; expectedOutcome: string }> = {
  call: { title: "Follow-up call", description: "Call client to discuss trip details", expectedOutcome: "Confirm travel dates and preferences" },
  whatsapp: { title: "WhatsApp check-in", description: "Send WhatsApp message to check on client", expectedOutcome: "Get client response on proposal" },
  email: { title: "Email follow-up", description: "Send follow-up email with trip details", expectedOutcome: "Client reviews and responds" },
  meeting: { title: "Client meeting", description: "Schedule meeting to finalize trip plan", expectedOutcome: "Finalize itinerary and pricing" },
  task: { title: "Internal task", description: "", expectedOutcome: "" },
  reminder: { title: "Reminder", description: "", expectedOutcome: "" },
  quotation_followup: { title: "Quotation follow-up", description: "Follow up on sent quotation", expectedOutcome: "Client accepts or provides feedback" },
  payment_followup: { title: "Payment follow-up", description: "Follow up on pending payment", expectedOutcome: "Payment received or date confirmed" },
  document_request: { title: "Request documents", description: "Request passport/visa documents from client", expectedOutcome: "Documents received" },
  confirmation_call: { title: "Pre-trip confirmation", description: "Confirm all trip details with client", expectedOutcome: "Client confirms everything is set" },
};

export interface CrmTask {
  id: string;
  company_id: string;
  related_type: string;
  related_id: string;
  title: string;
  description: string | null;
  expected_outcome: string | null;
  task_type: string;
  due_date: string;
  due_time: string | null;
  priority: string;
  assigned_to: string | null;
  created_by: string | null;
  status: string;
  reminder_before: number | null;
  repeat_rule: string | null;
  completed_at: string | null;
  completed_by: string | null;
  completion_notes: string | null;
  next_task_id: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export interface AgentInfo {
  userId: string;
  fullName: string;
  role: string;
}
