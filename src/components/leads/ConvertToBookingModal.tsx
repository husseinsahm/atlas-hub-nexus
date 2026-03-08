import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Plane, User, Calendar, MapPin, Users, DollarSign, UserCheck,
  FileText, CheckCircle2, Loader2, ArrowRight, Sparkles, X,
} from "lucide-react";
import { CityAutocomplete, cities } from "@/components/ui/city-autocomplete";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

interface LeadData {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  nationality: string | null;
  preferred_language: string | null;
  travel_date: string | null;
  adults: number;
  children: number;
  destinations: string[];
  budget_min: number | null;
  budget_max: number | null;
  budget_currency: string;
  source: string;
  assigned_to: string | null;
  notes: string | null;
}

interface AgentInfo {
  userId: string;
  fullName: string;
  role: string;
}

interface ConvertToBookingModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: LeadData;
  agents: AgentInfo[];
  companyId: string;
  userId: string;
}

type BookingStatus = "tentative" | "confirmed" | "in_progress";

export default function ConvertToBookingModal({
  open, onOpenChange, lead, agents, companyId, userId,
}: ConvertToBookingModalProps) {
  const { toast } = useToast();
  const navigate = useNavigate();

  const [step, setStep] = useState<"form" | "converting" | "success">("form");
  const [bookingId, setBookingId] = useState<string | null>(null);
  const [bookingNumber, setBookingNumber] = useState("");

  // Form state
  const [customerName, setCustomerName] = useState(lead.full_name);
  const [customerEmail, setCustomerEmail] = useState(lead.email || "");
  const [customerPhone, setCustomerPhone] = useState(lead.phone || "");
  const [assignedTo, setAssignedTo] = useState(lead.assigned_to || userId);
  const [status, setStatus] = useState<BookingStatus>("tentative");
  const [arrivalDate, setArrivalDate] = useState(lead.travel_date || "");
  const [departureDate, setDepartureDate] = useState("");
  const [destinations, setDestinations] = useState<string[]>(lead.destinations?.length ? lead.destinations : []);
  const [itineraryNotes, setItineraryNotes] = useState(lead.notes || "");
  const [adults, setAdults] = useState(lead.adults);
  const [children, setChildren] = useState(lead.children);
  const [estimatedBudget, setEstimatedBudget] = useState(
    lead.budget_max?.toString() || lead.budget_min?.toString() || ""
  );
  const [currency, setCurrency] = useState(lead.budget_currency || "USD");

  function handleOpenChange(val: boolean) {
    if (step === "converting") return;
    if (!val) {
      setStep("form");
      setBookingId(null);
    }
    onOpenChange(val);
  }

  async function handleConvert() {
    setStep("converting");
    try {
      // Get company settings for booking number
      const { data: settings } = await supabase
        .from("company_settings")
        .select("booking_prefix, booking_next_number")
        .eq("company_id", companyId)
        .single();

      const prefix = settings?.booking_prefix || "BKG";
      const nextNum = settings?.booking_next_number || 1;
      const bNumber = `${prefix}-${String(nextNum).padStart(4, "0")}`;

      // Create customer from lead
      const { data: customer, error: custErr } = await supabase
        .from("customers")
        .insert({
          company_id: companyId,
          full_name: customerName,
          email: customerEmail || null,
          phone: customerPhone || null,
          nationality: lead.nationality,
          lead_id: lead.id,
          created_by: userId,
          source: lead.source,
        })
        .select("id")
        .single();
      if (custErr) throw custErr;

      // Calculate total days
      let totalDays = 1;
      if (arrivalDate && departureDate) {
        const diff = Math.ceil(
          (new Date(departureDate).getTime() - new Date(arrivalDate).getTime()) / 86400000
        );
        if (diff > 0) totalDays = diff;
      }

      // Create booking file
      const { data: booking, error: bookErr } = await supabase
        .from("bookings")
        .insert({
          company_id: companyId,
          booking_number: bNumber,
          title: `${customerName} - ${destinations.length ? destinations.join(", ") : "Trip"}`,
          customer_id: customer.id,
          lead_id: lead.id,
          source: lead.source,
          arrival_date: arrivalDate || null,
          departure_date: departureDate || null,
          start_date: arrivalDate || null,
          end_date: departureDate || null,
          adults,
          children,
          total_days: totalDays,
          itinerary_notes: itineraryNotes || null,
          internal_notes: lead.notes,
          status: status as any,
          selling_price: estimatedBudget ? parseFloat(estimatedBudget) : null,
          currency,
          created_by: userId,
          assigned_to: assignedTo || userId,
        })
        .select("id")
        .single();
      if (bookErr) throw bookErr;

      // Update booking number counter
      await supabase
        .from("company_settings")
        .update({ booking_next_number: nextNum + 1 })
        .eq("company_id", companyId);

      // Mark lead as won
      await supabase.from("leads").update({ status: "won" }).eq("id", lead.id);

      // Log activities
      await Promise.all([
        supabase.from("lead_activities").insert({
          lead_id: lead.id,
          user_id: userId,
          activity_type: "converted",
          description: `Lead converted to Booking File ${bNumber}`,
          metadata: { booking_id: booking.id, booking_number: bNumber },
        }),
        supabase.from("booking_activities").insert({
          booking_id: booking.id,
          activity_type: "created",
          title: "Booking file created from lead conversion",
          description: `Converted from lead: ${lead.full_name}`,
          user_id: userId,
          metadata: { lead_id: lead.id },
        }),
      ]);

      setBookingId(booking.id);
      setBookingNumber(bNumber);
      setStep("success");
    } catch (err: any) {
      toast({ title: "Conversion failed", description: err.message, variant: "destructive" });
      setStep("form");
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-[640px] p-0 gap-0 overflow-hidden border-border">
        <div className="h-1.5 gold-gradient w-full" />

        <AnimatePresence mode="wait">
          {step === "form" && (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              <div className="px-6 pt-5 pb-3">
                <DialogHeader>
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl gold-gradient flex items-center justify-center shadow-md">
                      <Plane className="w-5 h-5 text-accent-foreground" />
                    </div>
                    <div>
                      <DialogTitle className="font-display text-lg">Convert to Booking File</DialogTitle>
                      <DialogDescription className="text-xs mt-0.5">
                        Create a booking from <span className="font-medium text-foreground">{lead.full_name}</span>'s lead
                      </DialogDescription>
                    </div>
                  </div>
                </DialogHeader>
              </div>

              <div className="px-6 pb-4 max-h-[60vh] overflow-y-auto space-y-5">
                {/* Customer Info */}
                <div>
                  <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5" /> Customer Information
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Full Name</Label>
                      <Input value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Email</Label>
                      <Input value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} className="h-9" />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs">Phone</Label>
                      <Input value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} className="h-9" />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Booking Details */}
                <div>
                  <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5" /> Booking Details
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Assigned Agent</Label>
                      <Select value={assignedTo || "none"} onValueChange={setAssignedTo}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {agents.map((a) => (
                            <SelectItem key={a.userId} value={a.userId}>{a.fullName}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Booking Status</Label>
                      <Select value={status} onValueChange={(v) => setStatus(v as BookingStatus)}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="tentative">Tentative</SelectItem>
                          <SelectItem value="confirmed">Confirmed</SelectItem>
                          <SelectItem value="in_progress">In Progress</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Arrival Date</Label>
                      <Input type="date" value={arrivalDate} onChange={(e) => setArrivalDate(e.target.value)} className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Departure Date</Label>
                      <Input type="date" value={departureDate} onChange={(e) => setDepartureDate(e.target.value)} className="h-9" />
                    </div>
                    <div className="space-y-1.5 sm:col-span-2">
                      <Label className="text-xs">Destination</Label>
                      <Input
                        value={destination}
                        onChange={(e) => setDestination(e.target.value)}
                        placeholder="e.g. Paris, Rome"
                        className="h-9"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Travelers & Budget */}
                <div>
                  <h4 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold mb-3 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5" /> Travelers & Budget
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="space-y-1.5">
                      <Label className="text-xs">Adults</Label>
                      <Input type="number" min={1} max={50} value={adults} onChange={(e) => setAdults(parseInt(e.target.value) || 1)} className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Children</Label>
                      <Input type="number" min={0} max={50} value={children} onChange={(e) => setChildren(parseInt(e.target.value) || 0)} className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Est. Budget</Label>
                      <Input type="number" value={estimatedBudget} onChange={(e) => setEstimatedBudget(e.target.value)} placeholder="0" className="h-9" />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-xs">Currency</Label>
                      <Select value={currency} onValueChange={setCurrency}>
                        <SelectTrigger className="h-9"><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {["USD", "EUR", "GBP", "SAR", "AED", "KWD", "BHD", "QAR", "OMR", "JOD"].map(c => (
                            <SelectItem key={c} value={c}>{c}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>

                <Separator />

                {/* Notes */}
                <div className="space-y-1.5">
                  <Label className="text-xs">Initial Itinerary Notes</Label>
                  <Textarea
                    value={itineraryNotes}
                    onChange={(e) => setItineraryNotes(e.target.value)}
                    placeholder="Add any initial notes for the itinerary..."
                    rows={3}
                    maxLength={2000}
                    className="text-sm"
                  />
                </div>
              </div>

              <div className="px-6 py-4 border-t border-border bg-muted/30 flex items-center justify-between">
                <Button variant="ghost" onClick={() => handleOpenChange(false)} className="text-muted-foreground">
                  Cancel
                </Button>
                <Button
                  onClick={handleConvert}
                  disabled={!customerName.trim()}
                  className="gold-gradient text-accent-foreground gap-2 shadow-md px-6"
                >
                  <Plane className="w-4 h-4" />
                  Convert to Booking
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </div>
            </motion.div>
          )}

          {step === "converting" && (
            <motion.div
              key="converting"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-16 px-8"
            >
              <div className="w-16 h-16 rounded-full gold-gradient flex items-center justify-center mb-4 animate-pulse">
                <Loader2 className="w-7 h-7 text-accent-foreground animate-spin" />
              </div>
              <h3 className="text-lg font-display font-semibold text-foreground mb-1">Creating Booking File...</h3>
              <p className="text-sm text-muted-foreground text-center">
                Setting up customer record, booking file, and linking lead history
              </p>
            </motion.div>
          )}

          {step === "success" && (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="flex flex-col items-center justify-center py-12 px-8"
            >
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: 0.1, type: "spring", stiffness: 400, damping: 15 }}
                className="w-16 h-16 rounded-full bg-emerald-100 flex items-center justify-center mb-4"
              >
                <CheckCircle2 className="w-8 h-8 text-emerald-600" />
              </motion.div>
              <h3 className="text-lg font-display font-semibold text-foreground mb-1">Booking Created!</h3>
              <p className="text-sm text-muted-foreground text-center mb-2">
                Booking <span className="font-semibold text-foreground">{bookingNumber}</span> has been created successfully
              </p>
              <div className="flex flex-wrap gap-2 mt-2 mb-6">
                <Badge variant="secondary" className="text-xs gap-1"><User className="w-3 h-3" /> Customer Created</Badge>
                <Badge variant="secondary" className="text-xs gap-1"><FileText className="w-3 h-3" /> Booking File Ready</Badge>
                <Badge variant="secondary" className="text-xs gap-1"><Sparkles className="w-3 h-3" /> Lead Marked Won</Badge>
              </div>
              <Button
                onClick={() => {
                  handleOpenChange(false);
                  if (bookingId) navigate(`/dashboard/bookings/${bookingId}`);
                }}
                className="gold-gradient text-accent-foreground gap-2 shadow-md px-8"
                size="lg"
              >
                <ArrowRight className="w-4 h-4" />
                Open Booking File
              </Button>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
