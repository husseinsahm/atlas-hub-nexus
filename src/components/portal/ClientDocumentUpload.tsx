import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Upload, FileText, Image as ImageIcon, Loader2, CheckCircle2, Shield } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const CATEGORIES = [
  { value: "passport", en: "Passport", ar: "جواز السفر" },
  { value: "visa", en: "Visa", ar: "التأشيرة" },
  { value: "ticket", en: "Flight ticket", ar: "تذكرة طيران" },
  { value: "voucher", en: "Voucher", ar: "قسيمة" },
  { value: "other", en: "Other", ar: "أخرى" },
];

const ALLOWED = ["image/jpeg", "image/png", "image/webp", "application/pdf"];
const MAX_BYTES = 8 * 1024 * 1024;

interface Props {
  token: string;
  isRtl: boolean;
  isArabic: boolean;
  defaultUploaderName?: string;
  onUploaded?: (a: { id: string; file_name: string; category: string; created_at: string }) => void;
}

interface UploadedFile {
  id: string;
  file_name: string;
  category: string;
  created_at: string;
}

export function ClientDocumentUpload({ token, isArabic, defaultUploaderName, onUploaded }: Props) {
  const { toast } = useToast();
  const [category, setCategory] = useState("passport");
  const [uploaderName, setUploaderName] = useState(defaultUploaderName || "");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState<UploadedFile[]>([]);

  const fileToBase64 = (f: File) =>
    new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const r = reader.result as string;
        resolve(r.split(",")[1] || "");
      };
      reader.onerror = reject;
      reader.readAsDataURL(f);
    });

  const handleUpload = async () => {
    if (!file) {
      toast({ title: isArabic ? "اختر ملفاً" : "Choose a file", variant: "destructive" });
      return;
    }
    if (!ALLOWED.includes(file.type)) {
      toast({
        title: isArabic ? "نوع ملف غير مدعوم" : "Unsupported file type",
        description: "JPG, PNG, WEBP, PDF",
        variant: "destructive",
      });
      return;
    }
    if (file.size > MAX_BYTES) {
      toast({ title: isArabic ? "الملف كبير جداً (8MB كحد أقصى)" : "File too large (max 8MB)", variant: "destructive" });
      return;
    }

    setUploading(true);
    try {
      const data_base64 = await fileToBase64(file);
      const res = await fetch(`${SUPABASE_URL}/functions/v1/client-portal-upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({
          token,
          file_name: file.name,
          file_type: file.type,
          category,
          uploader_name: uploaderName,
          data_base64,
        }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || "Upload failed");
      toast({
        title: isArabic ? "تم رفع المستند بنجاح" : "Document uploaded successfully",
      });
      setUploaded((u) => [body.attachment, ...u]);
      setFile(null);
      onUploaded?.(body.attachment);
      // Reset file input
      const input = document.getElementById("client-doc-input") as HTMLInputElement | null;
      if (input) input.value = "";
    } catch (e: any) {
      toast({ title: isArabic ? "تعذر الرفع" : "Upload failed", description: e?.message, variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-card p-5 md:p-6 shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <Shield className="w-4 h-4 text-primary" />
        <h3 className="font-bold font-display text-foreground">
          {isArabic ? "رفع المستندات" : "Upload Travel Documents"}
        </h3>
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        {isArabic
          ? "أرسل جواز السفر، التأشيرة وأي وثائق سفر بشكل آمن. سيراها فريق الوكالة فقط."
          : "Securely send your passport, visa and travel documents. Only the agency team will see them."}
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label className="text-xs">{isArabic ? "نوع المستند" : "Document type"}</Label>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger><SelectValue /></SelectTrigger>
            <SelectContent>
              {CATEGORIES.map((c) => (
                <SelectItem key={c.value} value={c.value}>{isArabic ? c.ar : c.en}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs">{isArabic ? "اسمك" : "Your name"}</Label>
          <Input
            value={uploaderName}
            onChange={(e) => setUploaderName(e.target.value)}
            placeholder={isArabic ? "اختياري" : "Optional"}
          />
        </div>
        <div className="space-y-1.5 md:col-span-2">
          <Label className="text-xs">{isArabic ? "الملف" : "File"} (JPG, PNG, PDF · 8MB)</Label>
          <Input
            id="client-doc-input"
            type="file"
            accept={ALLOWED.join(",")}
            onChange={(e) => setFile(e.target.files?.[0] || null)}
          />
        </div>
      </div>

      <Button onClick={handleUpload} disabled={uploading || !file} className="mt-4 w-full md:w-auto">
        {uploading ? <Loader2 className="w-4 h-4 me-2 animate-spin" /> : <Upload className="w-4 h-4 me-2" />}
        {isArabic ? "رفع المستند" : "Upload Document"}
      </Button>

      {uploaded.length > 0 && (
        <div className="mt-5 pt-4 border-t space-y-2">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {isArabic ? "مرفوع" : "Uploaded"}
          </p>
          {uploaded.map((f) => {
            const Icon = f.file_name.toLowerCase().endsWith(".pdf") ? FileText : ImageIcon;
            return (
              <div key={f.id} className="flex items-center gap-2 text-sm">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="flex-1 truncate">{f.file_name}</span>
                <span className="text-xs text-muted-foreground capitalize">{f.category}</span>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
