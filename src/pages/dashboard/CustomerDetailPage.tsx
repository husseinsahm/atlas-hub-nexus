import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft, Mail, Phone, Globe, Calendar, MapPin, User, Heart,
  FileText, Paperclip, Upload, Trash2, Send, MessageSquare,
  Tag, Star, Shield, Activity, Clock, Plane,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { FileAttachments } from "@/components/FileAttachments";

const PREFERENCE_COLORS: Record<string, string> = {
  Luxury: "bg-amber-100 text-amber-800 border-amber-200",
  VIP: "bg-amber-100 text-amber-800 border-amber-200",
  Family: "bg-blue-100 text-blue-800 border-blue-200",
  Honeymoon: "bg-pink-100 text-pink-800 border-pink-200",
  Adventure: "bg-emerald-100 text-emerald-800 border-emerald-200",
  Budget: "bg-slate-100 text-slate-700 border-slate-200",
  Cultural: "bg-violet-100 text-violet-700 border-violet-200",
};

function getTagColor(tag: string) {
  return PREFERENCE_COLORS[tag] || "bg-secondary text-secondary-foreground border-border";
}

interface CustomerDetail {
  id: string;
  full_name: string;
  email: string | null;
  phone: string | null;
  secondary_phone: string | null;
  nationality: string | null;
  date_of_birth: string | null;
  passport_number: string | null;
  address: string | null;
  city: string | null;
  country: string | null;
  preferences: string[];
  tags: string[];
  notes: string | null;
  source: string;
  lead_id: string | null;
  created_at: string;
  updated_at: string;
}

interface CustomerNote {
  id: string;
  note_type: string;
  content: string;
  created_at: string;
  user_id: string | null;
  userName?: string;
}

interface Attachment {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  created_at: string;
}

export default function CustomerDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const companyId = user?.activeMembership?.companyId;
  const isAdminOrAgent =
    user?.isSuperAdmin ||
    user?.activeMembership?.role === "company_admin" ||
    user?.activeMembership?.role === "agent";

  const [customer, setCustomer] = useState<CustomerDetail | null>(null);
  const [notes, setNotes] = useState<CustomerNote[]>([]);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");

  // Note input
  const [noteText, setNoteText] = useState("");
  const [noteType, setNoteType] = useState("general");
  const [addingNote, setAddingNote] = useState(false);

  useEffect(() => {
    if (id) {
      fetchCustomer();
      fetchNotes();
      fetchAttachments();
    }
  }, [id]);

  async function fetchCustomer() {
    if (!id) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.from("customers").select("*").eq("id", id).single();
      if (error) throw error;
      setCustomer({
        ...data,
        preferences: Array.isArray(data.preferences) ? data.preferences : [],
        tags: Array.isArray(data.tags) ? data.tags : [],
      } as CustomerDetail);
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
      navigate("/dashboard/customers");
    } finally {
      setLoading(false);
    }
  }

  async function fetchNotes() {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from("customer_notes")
        .select("*")
        .eq("customer_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;

      const userIds = [...new Set((data || []).map((n) => n.user_id).filter(Boolean))] as string[];
      let nameMap: Record<string, string> = {};
      if (userIds.length > 0) {
        const { data: profiles } = await supabase.from("profiles").select("id, full_name").in("id", userIds);
        (profiles || []).forEach((p) => { nameMap[p.id] = p.full_name || "Unknown"; });
      }

      setNotes((data || []).map((n) => ({ ...n, userName: n.user_id ? nameMap[n.user_id] || "Unknown" : "System" })));
    } catch {}
  }

  async function fetchAttachments() {
    if (!id) return;
    try {
      const { data, error } = await supabase
        .from("customer_attachments")
        .select("*")
        .eq("customer_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setAttachments(data || []);
    } catch {}
  }

  async function addNote() {
    if (!customer || !user || !noteText.trim()) return;
    setAddingNote(true);
    try {
      const { error } = await supabase.from("customer_notes").insert({
        customer_id: customer.id,
        user_id: user.id,
        note_type: noteType,
        content: noteText.trim(),
      });
      if (error) throw error;
      setNoteText("");
      fetchNotes();
      toast({ title: "Note added" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    } finally {
      setAddingNote(false);
    }
  }

  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    if (!customer || !user || !e.target.files?.length) return;
    const file = e.target.files[0];
    if (file.size > 10 * 1024 * 1024) {
      toast({ title: "File too large", description: "Max 10MB", variant: "destructive" });
      return;
    }

    try {
      const ext = file.name.split(".").pop();
      const path = `${companyId}/${customer.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from("company-assets").upload(path, file);
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage.from("company-assets").getPublicUrl(path);

      const { error } = await supabase.from("customer_attachments").insert({
        customer_id: customer.id,
        file_name: file.name,
        file_url: publicUrl,
        file_type: file.type,
        file_size: file.size,
        uploaded_by: user.id,
      });
      if (error) throw error;
      fetchAttachments();
      toast({ title: "File uploaded" });
    } catch (err: any) {
      toast({ title: "Upload error", description: err.message, variant: "destructive" });
    }
    e.target.value = "";
  }

  async function deleteAttachment(att: Attachment) {
    try {
      const { error } = await supabase.from("customer_attachments").delete().eq("id", att.id);
      if (error) throw error;
      fetchAttachments();
      toast({ title: "Attachment removed" });
    } catch (err: any) {
      toast({ title: "Error", description: err.message, variant: "destructive" });
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!customer) return null;

  const noteTypes = [
    { value: "general", label: "General" },
    { value: "preference", label: "Preference" },
    { value: "complaint", label: "Complaint" },
    { value: "follow_up", label: "Follow-up" },
    { value: "internal", label: "Internal" },
  ];

  const noteTypeColors: Record<string, string> = {
    general: "bg-muted text-muted-foreground",
    preference: "bg-blue-100 text-blue-800",
    complaint: "bg-red-100 text-red-700",
    follow_up: "bg-amber-100 text-amber-800",
    internal: "bg-purple-100 text-purple-800",
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start gap-3">
        <Button variant="ghost" size="icon" className="mt-1 shrink-0" onClick={() => navigate("/dashboard/customers")}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center text-lg font-bold text-accent shrink-0">
              {customer.full_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground font-display">{customer.full_name}</h1>
              <div className="flex items-center gap-3 mt-0.5 text-sm text-muted-foreground">
                {customer.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5" /> {customer.email}</span>}
                {customer.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {customer.phone}</span>}
              </div>
            </div>
          </div>
        </div>
        {customer.lead_id && (
          <Badge className="bg-amber-100 text-amber-800 border border-amber-200 shrink-0">
            <Star className="w-3 h-3 mr-1" /> From Lead
          </Badge>
        )}
      </div>

      {/* Preference Tags */}
      {customer.preferences.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {customer.preferences.map((p) => (
            <Badge key={p} className={`border ${getTagColor(p)} text-xs px-3 py-1`}>
              <Heart className="w-3 h-3 mr-1" /> {p}
            </Badge>
          ))}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Main Content */}
        <div className="lg:col-span-8">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="w-full justify-start bg-transparent border-b border-border rounded-none p-0 h-auto mb-6">
              <TabsTrigger value="overview" className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-sm">
                Overview
              </TabsTrigger>
              <TabsTrigger value="notes" className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-sm">
                Notes ({notes.length})
              </TabsTrigger>
              <TabsTrigger value="trips" className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-sm">
                Trip History
              </TabsTrigger>
              <TabsTrigger value="attachments" className="rounded-none border-b-2 border-transparent data-[state=active]:border-accent data-[state=active]:bg-transparent data-[state=active]:shadow-none px-4 py-2.5 text-sm">
                Attachments ({attachments.length})
              </TabsTrigger>
            </TabsList>

            {/* Overview */}
            <TabsContent value="overview" className="mt-0 space-y-6">
              {/* Personal Info */}
              <Card className="border border-border bg-card">
                <CardHeader className="pb-3">
                  <CardTitle className="text-base font-display flex items-center gap-2">
                    <User className="w-4 h-4 text-accent" /> Personal Information
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-4">
                    <InfoRow icon={User} label="Full Name" value={customer.full_name} />
                    <InfoRow icon={Mail} label="Email" value={customer.email} />
                    <InfoRow icon={Phone} label="Phone" value={customer.phone} />
                    {customer.secondary_phone && <InfoRow icon={Phone} label="Secondary Phone" value={customer.secondary_phone} />}
                    <InfoRow icon={Globe} label="Nationality" value={customer.nationality} />
                    <InfoRow icon={Calendar} label="Date of Birth" value={customer.date_of_birth ? format(new Date(customer.date_of_birth), "MMM d, yyyy") : null} />
                    <InfoRow icon={Shield} label="Passport" value={customer.passport_number} />
                    <InfoRow icon={Tag} label="Source" value={customer.source} />
                  </div>
                </CardContent>
              </Card>

              {/* Address */}
              {(customer.address || customer.city || customer.country) && (
                <Card className="border border-border bg-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-display flex items-center gap-2">
                      <MapPin className="w-4 h-4 text-accent" /> Address
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-foreground">
                      {[customer.address, customer.city, customer.country].filter(Boolean).join(", ")}
                    </p>
                  </CardContent>
                </Card>
              )}

              {/* Client Notes */}
              {customer.notes && (
                <Card className="border border-border bg-card">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base font-display flex items-center gap-2">
                      <FileText className="w-4 h-4 text-accent" /> Client Notes
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-foreground whitespace-pre-wrap bg-muted/50 rounded-lg p-3">{customer.notes}</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Notes Tab */}
            <TabsContent value="notes" className="mt-0 space-y-4">
              {/* Add Note */}
              {isAdminOrAgent && (
                <Card className="border border-border bg-card">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <Select value={noteType} onValueChange={setNoteType}>
                        <SelectTrigger className="w-36">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {noteTypes.map((t) => (
                            <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <Textarea
                      value={noteText}
                      onChange={(e) => setNoteText(e.target.value)}
                      placeholder="Write a note about this customer..."
                      rows={3}
                      maxLength={2000}
                      className="mb-3"
                    />
                    <Button size="sm" onClick={addNote} disabled={!noteText.trim() || addingNote} className="gap-1.5">
                      <Send className="w-3.5 h-3.5" /> {addingNote ? "Adding..." : "Add Note"}
                    </Button>
                  </CardContent>
                </Card>
              )}

              {/* Notes list */}
              {notes.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  <p className="text-sm">No notes yet</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {notes.map((n) => (
                    <Card key={n.id} className="border border-border bg-card">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center gap-2">
                            <Badge className={`text-[10px] border ${noteTypeColors[n.note_type] || noteTypeColors.general}`}>
                              {n.note_type}
                            </Badge>
                            <span className="text-xs text-muted-foreground">
                              {n.userName} · {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
                            </span>
                          </div>
                        </div>
                        <p className="text-sm text-foreground whitespace-pre-wrap">{n.content}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Trip History Tab */}
            <TabsContent value="trips" className="mt-0">
              <Card className="border border-border bg-card">
                <CardContent className="py-12">
                  <div className="text-center text-muted-foreground">
                    <Plane className="w-10 h-10 mx-auto mb-3 opacity-40" />
                    <p className="text-sm font-medium">Trip history will appear here</p>
                    <p className="text-xs mt-1">Once the Trips module is built, past and upcoming trips for this customer will be displayed</p>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Attachments Tab */}
            <TabsContent value="attachments" className="mt-0">
              <FileAttachments
                entityType="customer"
                entityId={customer.id}
                companyId={companyId || ""}
              />
            </TabsContent>
          </Tabs>
        </div>

        {/* Right Sidebar */}
        <div className="lg:col-span-4 space-y-4">
          {/* Quick Contact */}
          <Card className="border border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-display">Quick Contact</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {customer.email && (
                <Button variant="outline" size="sm" className="w-full justify-start gap-2" asChild>
                  <a href={`mailto:${customer.email}`}><Mail className="w-4 h-4" /> Send Email</a>
                </Button>
              )}
              {customer.phone && (
                <>
                  <Button variant="outline" size="sm" className="w-full justify-start gap-2" asChild>
                    <a href={`tel:${customer.phone}`}><Phone className="w-4 h-4" /> Call</a>
                  </Button>
                  <Button variant="outline" size="sm" className="w-full justify-start gap-2" asChild>
                    <a href={`https://wa.me/${encodeURIComponent(customer.phone.replace(/[\s\-()]/g, ""))}`} target="_blank" rel="noopener noreferrer">
                      <MessageSquare className="w-4 h-4" /> WhatsApp
                    </a>
                  </Button>
                </>
              )}
            </CardContent>
          </Card>

          {/* Summary */}
          <Card className="border border-border bg-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-display">Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Source</span>
                <span className="text-foreground capitalize">{customer.source}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Nationality</span>
                <span className="text-foreground">{customer.nationality || "—"}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Notes</span>
                <span className="text-foreground">{notes.length}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Attachments</span>
                <span className="text-foreground">{attachments.length}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Preferences</span>
                <span className="text-foreground">{customer.preferences.length}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Customer Since</span>
                <span className="text-foreground text-xs">{format(new Date(customer.created_at), "MMM d, yyyy")}</span>
              </div>
              <Separator />
              <div className="flex justify-between">
                <span className="text-muted-foreground">Last Update</span>
                <span className="text-foreground text-xs">{formatDistanceToNow(new Date(customer.updated_at), { addSuffix: true })}</span>
              </div>
            </CardContent>
          </Card>

          {/* Preferences */}
          {customer.preferences.length > 0 && (
            <Card className="border border-border bg-card">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-display flex items-center gap-2">
                  <Heart className="w-4 h-4 text-accent" /> Preferences
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex flex-wrap gap-1.5">
                  {customer.preferences.map((p) => (
                    <Badge key={p} className={`text-[10px] border ${getTagColor(p)}`}>{p}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-3">
      <div className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center shrink-0">
        <Icon className="w-4 h-4 text-muted-foreground" />
      </div>
      <div>
        <p className="text-[11px] text-muted-foreground uppercase tracking-wider">{label}</p>
        <p className="text-sm font-medium text-foreground capitalize">{value}</p>
      </div>
    </div>
  );
}
