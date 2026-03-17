import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NationalitySelect } from "@/components/ui/country-select";
import { PhoneInput } from "@/components/ui/phone-input";
import { Progress } from "@/components/ui/progress";
import { DestinationTagInput } from "@/components/ui/destination-tag-input";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  User, Phone, Mail, MessageCircle, Plane, DollarSign, Flame,
  FileText, ChevronRight, ChevronLeft, Check, Sparkles, UserPlus,
  Globe, Users, Calendar, MapPin, ChevronsUpDown,
} from "lucide-react";
import { cn } from "@/lib/utils";

type LeadStatus = "new" | "contacted" | "planning" | "awaiting_client" | "won" | "lost";
type LeadSource = "website" | "referral" | "social_media" | "walk_in" | "phone" | "email" | "partner" | "other";

const STATUS_CONFIG: Record<LeadStatus, { label: string }> = {
  new: { label: "New" },
  contacted: { label: "Contacted" },
  planning: { label: "Planning" },
  awaiting_client: { label: "Awaiting Client" },
  won: { label: "Won" },
  lost: { label: "Lost" },
};

const SOURCE_OPTIONS: { value: LeadSource; label: string }[] = [
  { value: "website", label: "Website" },
  { value: "referral", label: "Referral" },
  { value: "social_media", label: "Social Media" },
  { value: "walk_in", label: "Walk-in" },
  { value: "phone", label: "Phone" },
  { value: "email", label: "Email" },
  { value: "partner", label: "Partner" },
  { value: "other", label: "Other" },
];

const TRIP_TYPES = [
  "Leisure", "Honeymoon", "Family", "Adventure", "Business", "Group", "Luxury", "Budget", "Pilgrimage", "Other",
];

const URGENCY_OPTIONS = [
  { value: "low", label: "Low", dot: "bg-emerald-500" },
  { value: "normal", label: "Normal", dot: "bg-amber-500" },
  { value: "high", label: "High", dot: "bg-red-500" },
];

const LANGUAGE_OPTIONS = [
  { value: "ar", label: "Arabic", flag: "🇸🇦" },
  { value: "en", label: "English", flag: "🇺🇸" },
  { value: "ja", label: "Japanese", flag: "🇯🇵" },
  { value: "de", label: "German", flag: "🇩🇪" },
  { value: "fr", label: "French", flag: "🇫🇷" },
  { value: "it", label: "Italian", flag: "🇮🇹" },
  { value: "es", label: "Spanish", flag: "🇪🇸" },
  { value: "zh", label: "Chinese", flag: "🇨🇳" },
  { value: "ru", label: "Russian", flag: "🇷🇺" },
  { value: "tr", label: "Turkish", flag: "🇹🇷" },
];

// Map nationality codes to suggested language
const NATIONALITY_LANGUAGE_MAP: Record<string, string> = {
  SA: "ar", AE: "ar", EG: "ar", JO: "ar", LB: "ar", KW: "ar", QA: "ar",
  BH: "ar", OM: "ar", MA: "ar", TN: "ar", DZ: "ar", IQ: "ar", SY: "ar",
  PS: "ar", YE: "ar", LY: "ar", SD: "ar",
  US: "en", GB: "en", AU: "en", CA: "en", NZ: "en", IE: "en",
  JP: "ja",
  DE: "de", AT: "de", CH: "de",
  FR: "fr", BE: "fr",
  IT: "it",
  ES: "es", MX: "es", AR: "es", CO: "es",
  CN: "zh", TW: "zh", HK: "zh",
  RU: "ru",
  TR: "tr",
};

interface TeamMember {
  userId: string;
  fullName: string;
  role: string;
}

export interface LeadFormData {
  full_name: string;
  email: string;
  phone: string;
  whatsapp: string;
  nationality: string;
  preferred_language: string;
  travel_date: string;
  adults: number;
  children: number;
  destinations: string;
  trip_type: string;
  budget_min: string;
  budget_max: string;
  budget_currency: string;
  source: LeadSource;
  status: LeadStatus;
  urgency: string;
  assigned_to: string;
  notes: string;
}

interface LeadWizardProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  form: LeadFormData;
  setForm: (form: LeadFormData) => void;
  onSave: () => void;
  saving: boolean;
  editingId: string | null;
  agents: TeamMember[];
}

const STEPS = [
  { id: 0, title: "Personal", subtitle: "Who is the lead?", icon: User },
  { id: 1, title: "Contact", subtitle: "How to reach them", icon: Phone },
  { id: 2, title: "Travel", subtitle: "Trip preferences", icon: Plane },
  { id: 3, title: "Budget", subtitle: "Financial details", icon: DollarSign },
  { id: 4, title: "Pipeline", subtitle: "Status & assignment", icon: Flame },
];

export default function LeadWizard({
  open, onOpenChange, form, setForm, onSave, saving, editingId, agents,
}: LeadWizardProps) {
  const [step, setStep] = useState(0);

  const progress = ((step + 1) / STEPS.length) * 100;

  function handleOpenChange(val: boolean) {
    if (!val) setStep(0);
    onOpenChange(val);
  }

  function next() {
    if (step < STEPS.length - 1) setStep(step + 1);
  }
  function prev() {
    if (step > 0) setStep(step - 1);
  }

  function canProceed() {
    if (step === 0) return form.full_name.trim().length > 0;
    return true;
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[680px] p-0 gap-0 overflow-hidden border-border">
        {/* Top gradient bar */}
        <div className="h-1.5 gold-gradient w-full" />

        {/* Header */}
        <div className="px-8 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-11 h-11 rounded-xl gold-gradient flex items-center justify-center shadow-md">
              <UserPlus className="w-5 h-5 text-accent-foreground" />
            </div>
            <div>
              <h2 className="text-lg font-bold font-display text-foreground">
                {editingId ? "Edit Lead" : "New Lead"}
              </h2>
              <p className="text-xs text-muted-foreground">
                {STEPS[step].subtitle}
              </p>
            </div>
          </div>

          {/* Step indicators */}
          <div className="flex items-center gap-1 mb-2">
            {STEPS.map((s, i) => {
              const isActive = i === step;
              const isDone = i < step;
              const StepIcon = s.icon;
              return (
                <button
                  key={s.id}
                  onClick={() => {
                    if (isDone || (i <= step + 1 && canProceed())) setStep(i);
                  }}
                  className={cn(
                    "flex-1 group relative flex flex-col items-center gap-1.5 py-2 rounded-lg transition-all duration-200",
                    isActive && "bg-accent/10",
                    isDone && "cursor-pointer",
                  )}
                >
                  <div className={cn(
                    "w-9 h-9 rounded-full flex items-center justify-center transition-all duration-300 border-2",
                    isActive && "gold-gradient border-transparent text-accent-foreground shadow-md scale-110",
                    isDone && "bg-emerald-100 border-emerald-300 text-emerald-700",
                    !isActive && !isDone && "bg-muted border-transparent text-muted-foreground",
                  )}>
                    {isDone ? <Check className="w-4 h-4" /> : <StepIcon className="w-4 h-4" />}
                  </div>
                  <span className={cn(
                    "text-[10px] font-semibold uppercase tracking-wider transition-colors",
                    isActive ? "text-foreground" : "text-muted-foreground",
                  )}>
                    {s.title}
                  </span>
                </button>
              );
            })}
          </div>
          <Progress value={progress} className="h-1 bg-muted" />
        </div>

        {/* Form content area */}
        <div className="px-8 py-6 min-h-[320px] flex flex-col">
          <div className="flex-1 animate-fade-in" key={step}>
            {step === 0 && <StepPersonal form={form} setForm={setForm} />}
            {step === 1 && <StepContact form={form} setForm={setForm} />}
            {step === 2 && <StepTravel form={form} setForm={setForm} />}
            {step === 3 && <StepBudget form={form} setForm={setForm} />}
            {step === 4 && <StepPipeline form={form} setForm={setForm} agents={agents} />}
          </div>
        </div>

        {/* Footer */}
        <div className="px-8 py-5 border-t border-border bg-muted/30 flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={step === 0 ? () => handleOpenChange(false) : prev}
            className="gap-1.5 text-muted-foreground"
          >
            <ChevronLeft className="w-4 h-4" />
            {step === 0 ? "Cancel" : "Back"}
          </Button>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground font-medium">
              Step {step + 1} of {STEPS.length}
            </span>
            {step < STEPS.length - 1 ? (
              <Button
                onClick={next}
                disabled={!canProceed()}
                className="gold-gradient text-accent-foreground gap-1.5 shadow-md px-6"
              >
                Next <ChevronRight className="w-4 h-4" />
              </Button>
            ) : (
              <Button
                onClick={onSave}
                disabled={saving || !canProceed()}
                className="gold-gradient text-accent-foreground gap-1.5 shadow-md px-6"
              >
                {saving ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-accent-foreground/30 border-t-accent-foreground rounded-full animate-spin" />
                    Saving...
                  </span>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    {editingId ? "Update Lead" : "Create Lead"}
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ─── Step Components ─── */

function FieldGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("space-y-5", className)}>{children}</div>;
}

function FieldLabel({ children, required }: { children: React.ReactNode; required?: boolean }) {
  return (
    <Label className="text-sm font-medium text-foreground">
      {children}
      {required && <span className="text-destructive ml-0.5">*</span>}
    </Label>
  );
}

function StepPersonal({ form, setForm }: { form: LeadFormData; setForm: (f: LeadFormData) => void }) {
  const [langOpen, setLangOpen] = useState(false);

  // Auto-suggest language when nationality changes
  useEffect(() => {
    if (form.nationality && !form.preferred_language) {
      const suggested = NATIONALITY_LANGUAGE_MAP[form.nationality];
      if (suggested) {
        setForm({ ...form, preferred_language: suggested });
      }
    }
  }, [form.nationality]);

  const selectedLang = LANGUAGE_OPTIONS.find(l => l.value === form.preferred_language);

  return (
    <FieldGroup>
      <div className="text-center mb-2">
        <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-3">
          <User className="w-7 h-7 text-accent" />
        </div>
        <h3 className="font-display font-semibold text-foreground">Personal Information</h3>
        <p className="text-xs text-muted-foreground mt-1">Start with the lead's basic details</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="space-y-2 sm:col-span-2">
          <FieldLabel required>Full Name</FieldLabel>
          <Input
            value={form.full_name}
            onChange={(e) => setForm({ ...form, full_name: e.target.value })}
            placeholder="Enter the lead's full name"
            maxLength={200}
            className="h-11"
          />
        </div>
        <div className="space-y-2">
          <FieldLabel>Nationality</FieldLabel>
          <NationalitySelect
            value={form.nationality}
            onValueChange={(v) => {
              const suggestedLang = NATIONALITY_LANGUAGE_MAP[v];
              setForm({
                ...form,
                nationality: v,
                ...(suggestedLang && !form.preferred_language ? { preferred_language: suggestedLang } : {}),
              });
            }}
            placeholder="Select nationality"
          />
        </div>
        <div className="space-y-2">
          <FieldLabel>Preferred Language</FieldLabel>
          <Popover open={langOpen} onOpenChange={setLangOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                role="combobox"
                aria-expanded={langOpen}
                className="w-full h-11 justify-between font-normal"
              >
                {selectedLang ? (
                  <span className="flex items-center gap-2">
                    <span className="text-lg">{selectedLang.flag}</span>
                    <span>{selectedLang.label}</span>
                  </span>
                ) : (
                  <span className="flex items-center gap-2 text-muted-foreground">
                    <Globe className="w-4 h-4" />
                    Select language
                  </span>
                )}
                <ChevronsUpDown className="h-3.5 w-3.5 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-[240px] p-0" align="start">
              <Command>
                <CommandInput placeholder="Search language..." className="h-9" />
                <CommandList>
                  <CommandEmpty>No language found.</CommandEmpty>
                  <CommandGroup className="max-h-[200px] overflow-auto">
                    {LANGUAGE_OPTIONS.map((lang) => (
                      <CommandItem
                        key={lang.value}
                        value={`${lang.label} ${lang.flag}`}
                        onSelect={() => {
                          setForm({ ...form, preferred_language: lang.value });
                          setLangOpen(false);
                        }}
                        className="flex items-center gap-2"
                      >
                        <span className="text-lg">{lang.flag}</span>
                        <span className="flex-1">{lang.label}</span>
                        {form.preferred_language === lang.value && (
                          <Check className="h-4 w-4 text-accent" />
                        )}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>
    </FieldGroup>
  );
}

function StepContact({ form, setForm }: { form: LeadFormData; setForm: (f: LeadFormData) => void }) {
  const [sameAsPhone, setSameAsPhone] = useState(false);

  // Sync WhatsApp when "same as phone" is checked
  useEffect(() => {
    if (sameAsPhone && form.phone) {
      setForm({ ...form, whatsapp: form.phone });
    }
  }, [sameAsPhone, form.phone]);

  return (
    <FieldGroup>
      <div className="text-center mb-2">
        <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-3">
          <Phone className="w-7 h-7 text-accent" />
        </div>
        <h3 className="font-display font-semibold text-foreground">Contact Details</h3>
        <p className="text-xs text-muted-foreground mt-1">How can you reach this lead?</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="space-y-2">
          <FieldLabel>Email Address</FieldLabel>
          <div className="relative">
            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="john@example.com"
              maxLength={255}
              className="pl-10 h-11"
            />
          </div>
        </div>
        <div className="space-y-2">
          <FieldLabel>Phone Number</FieldLabel>
          <PhoneInput
            value={form.phone}
            onValueChange={(v) => {
              const updates: Partial<LeadFormData> = { phone: v };
              if (sameAsPhone) updates.whatsapp = v;
              setForm({ ...form, ...updates });
            }}
            defaultCountry="AE"
          />
        </div>
        <div className="space-y-2 sm:col-span-2">
          <div className="flex items-center justify-between">
            <FieldLabel>
              <span className="flex items-center gap-1.5">
                <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                WhatsApp Number
              </span>
            </FieldLabel>
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={sameAsPhone}
                onCheckedChange={(checked) => {
                  const isChecked = checked === true;
                  setSameAsPhone(isChecked);
                  if (isChecked && form.phone) {
                    setForm({ ...form, whatsapp: form.phone });
                  }
                }}
              />
              <span className="text-xs font-medium text-muted-foreground">Same as phone</span>
            </label>
          </div>
          <PhoneInput
            value={form.whatsapp}
            onValueChange={(v) => setForm({ ...form, whatsapp: v })}
            defaultCountry="AE"
            disabled={sameAsPhone}
          />
        </div>
      </div>
    </FieldGroup>
  );
}

function StepTravel({ form, setForm }: { form: LeadFormData; setForm: (f: LeadFormData) => void }) {
  return (
    <FieldGroup>
      <div className="text-center mb-2">
        <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-3">
          <Plane className="w-7 h-7 text-accent" />
        </div>
        <h3 className="font-display font-semibold text-foreground">Travel Preferences</h3>
        <p className="text-xs text-muted-foreground mt-1">Where and when do they want to go?</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="space-y-2">
          <FieldLabel>Travel Date</FieldLabel>
          <div className="relative">
            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
            <Input
              type="date"
              value={form.travel_date}
              onChange={(e) => setForm({ ...form, travel_date: e.target.value })}
              className="pl-10 h-11"
            />
          </div>
        </div>
        <div className="space-y-2">
          <FieldLabel>Trip Type</FieldLabel>
          <Select value={form.trip_type || "none"} onValueChange={(v) => setForm({ ...form, trip_type: v === "none" ? "" : v })}>
            <SelectTrigger className="h-11"><SelectValue placeholder="Select type" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Not specified</SelectItem>
              {TRIP_TYPES.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2 sm:col-span-2">
          <FieldLabel>Destination Interests</FieldLabel>
          <DestinationTagInput
            value={form.destinations ? form.destinations.split(",").map(d => d.trim()).filter(Boolean) : []}
            onChange={(tags) => setForm({ ...form, destinations: tags.join(", ") })}
            placeholder="Type a destination and press Enter"
          />
          <p className="text-xs text-muted-foreground">Select from suggestions or type a custom destination</p>
        </div>
        <div className="grid grid-cols-2 gap-4 sm:col-span-2">
          <div className="space-y-2">
            <FieldLabel>Adults</FieldLabel>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="number"
                min={1}
                max={50}
                value={form.adults}
                onChange={(e) => setForm({ ...form, adults: parseInt(e.target.value) || 1 })}
                className="pl-10 h-11"
              />
            </div>
          </div>
          <div className="space-y-2">
            <FieldLabel>Children</FieldLabel>
            <div className="relative">
              <Users className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                type="number"
                min={0}
                max={50}
                value={form.children}
                onChange={(e) => setForm({ ...form, children: parseInt(e.target.value) || 0 })}
                className="pl-10 h-11"
              />
            </div>
          </div>
        </div>
      </div>
    </FieldGroup>
  );
}

function StepBudget({ form, setForm }: { form: LeadFormData; setForm: (f: LeadFormData) => void }) {
  return (
    <FieldGroup>
      <div className="text-center mb-2">
        <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-3">
          <DollarSign className="w-7 h-7 text-accent" />
        </div>
        <h3 className="font-display font-semibold text-foreground">Budget & Notes</h3>
        <p className="text-xs text-muted-foreground mt-1">Set budget expectations and additional info</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <div className="space-y-2">
          <FieldLabel>Currency</FieldLabel>
          <Select value={form.budget_currency} onValueChange={(v) => setForm({ ...form, budget_currency: v })}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              {["USD", "EUR", "GBP", "SAR", "AED", "EGP"].map(c => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <FieldLabel>Minimum Budget</FieldLabel>
          <Input
            type="number"
            min={0}
            value={form.budget_min}
            onChange={(e) => setForm({ ...form, budget_min: e.target.value })}
            placeholder="1,000"
            className="h-11"
          />
        </div>
        <div className="space-y-2">
          <FieldLabel>Maximum Budget</FieldLabel>
          <Input
            type="number"
            min={0}
            value={form.budget_max}
            onChange={(e) => setForm({ ...form, budget_max: e.target.value })}
            placeholder="5,000"
            className="h-11"
          />
        </div>
      </div>
      <div className="space-y-2 mt-2">
        <FieldLabel>Notes</FieldLabel>
        <Textarea
          value={form.notes}
          onChange={(e) => setForm({ ...form, notes: e.target.value })}
          placeholder="Any additional notes about this lead..."
          rows={4}
          maxLength={2000}
          className="resize-none"
        />
      </div>
    </FieldGroup>
  );
}

function StepPipeline({ form, setForm, agents }: { form: LeadFormData; setForm: (f: LeadFormData) => void; agents: TeamMember[] }) {
  return (
    <FieldGroup>
      <div className="text-center mb-2">
        <div className="w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mx-auto mb-3">
          <Flame className="w-7 h-7 text-accent" />
        </div>
        <h3 className="font-display font-semibold text-foreground">Pipeline & Assignment</h3>
        <p className="text-xs text-muted-foreground mt-1">Configure lead tracking and ownership</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <div className="space-y-2">
          <FieldLabel>Lead Source</FieldLabel>
          <Select value={form.source} onValueChange={(v) => setForm({ ...form, source: v as LeadSource })}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              {SOURCE_OPTIONS.map(s => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <FieldLabel>Status</FieldLabel>
          <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as LeadStatus })}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              {Object.entries(STATUS_CONFIG).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <FieldLabel>Urgency</FieldLabel>
          <Select value={form.urgency} onValueChange={(v) => setForm({ ...form, urgency: v })}>
            <SelectTrigger className="h-11"><SelectValue /></SelectTrigger>
            <SelectContent>
              {URGENCY_OPTIONS.map(u => (
                <SelectItem key={u.value} value={u.value}>
                  <span className="flex items-center gap-2">
                    <span className={cn("w-2.5 h-2.5 rounded-full", u.dot)} />
                    {u.label}
                  </span>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <FieldLabel>Assigned Agent</FieldLabel>
          <Select value={form.assigned_to || "none"} onValueChange={(v) => setForm({ ...form, assigned_to: v === "none" ? "" : v })}>
            <SelectTrigger className="h-11"><SelectValue placeholder="Unassigned" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">Unassigned</SelectItem>
              {agents
                .filter(a => ["company_admin", "agent"].includes(a.role))
                .map(a => <SelectItem key={a.userId} value={a.userId}>{a.fullName}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>
    </FieldGroup>
  );
}
