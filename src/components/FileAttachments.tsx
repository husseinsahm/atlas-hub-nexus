import { useState, useRef, useCallback, useMemo } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { motion, AnimatePresence } from "framer-motion";
import {
  Upload, Trash2, Download, FileText, Image as ImageIcon,
  File, Loader2, Eye, Paperclip, Tag, AlertCircle,
  FileSpreadsheet, Receipt, Ticket, Shield, BookOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { format } from "date-fns";

interface FileAttachmentsProps {
  entityType: "lead" | "customer" | "trip" | "booking";
  entityId: string;
  companyId: string;
  className?: string;
}

interface Attachment {
  id: string;
  file_name: string;
  file_url: string;
  file_type: string | null;
  file_size: number | null;
  category: string;
  uploaded_by: string | null;
  created_at: string;
}

const CATEGORIES = [
  { value: "passport", label: "Passport", icon: Shield },
  { value: "quotation", label: "Quotation", icon: FileSpreadsheet },
  { value: "voucher", label: "Voucher", icon: BookOpen },
  { value: "ticket", label: "Ticket", icon: Ticket },
  { value: "invoice", label: "Invoice", icon: Receipt },
  { value: "other", label: "Other", icon: File },
];

const getCategoryConfig = (cat: string) =>
  CATEGORIES.find(c => c.value === cat) || CATEGORIES[CATEGORIES.length - 1];

const formatFileSize = (bytes: number | null) => {
  if (!bytes) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const isImage = (type: string | null) =>
  type?.startsWith("image/") || false;

const isPdf = (type: string | null) =>
  type === "application/pdf";

export function FileAttachments({ entityType, entityId, companyId, className }: FileAttachmentsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [uploadCategory, setUploadCategory] = useState("other");
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewType, setPreviewType] = useState<string | null>(null);
  const [previewName, setPreviewName] = useState("");

  // Fetch attachments
  const { data: attachments = [], isLoading } = useQuery({
    queryKey: ["entity-attachments", entityType, entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("entity_attachments")
        .select("*")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data || []) as Attachment[];
    },
    enabled: !!entityId,
  });

  // Fetch profiles for uploader names
  const { data: profiles = [] } = useQuery({
    queryKey: ["profiles-attachments", companyId],
    queryFn: async () => {
      const { data: memberships } = await supabase
        .from("company_memberships")
        .select("user_id")
        .eq("company_id", companyId)
        .eq("is_active", true);
      if (!memberships?.length) return [];
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", memberships.map(m => m.user_id));
      return data || [];
    },
    enabled: !!companyId,
  });

  const getUploaderName = useCallback((userId: string | null) => {
    if (!userId) return "Unknown";
    return profiles.find(p => p.id === userId)?.full_name || "Team member";
  }, [profiles]);

  // Upload handler with enhanced error handling and progress
  const handleUpload = useCallback(async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    if (!user) {
      toast({ title: "Please log in to upload files", variant: "destructive" });
      return;
    }

    setUploading(true);
    setUploadProgress(0);
    
    const fileArray = Array.from(files);
    let successCount = 0;
    let failCount = 0;

    try {
      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        setUploadProgress(((i + 1) / fileArray.length) * 100);

        // Validate file size (10MB limit)
        if (file.size > 10 * 1024 * 1024) {
          toast({ 
            title: `File too large: ${file.name}`, 
            description: "Maximum file size is 10MB",
            variant: "destructive" 
          });
          failCount++;
          continue;
        }

        // Validate file type
        const allowedTypes = [
          'image/*', 'application/pdf', 'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          'application/vnd.ms-excel', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
          'text/plain', 'text/csv'
        ];
        
        const isValidType = allowedTypes.some(type => {
          if (type.endsWith('*')) {
            return file.type.startsWith(type.slice(0, -1));
          }
          return file.type === type;
        });

        if (!isValidType) {
          toast({ 
            title: `Invalid file type: ${file.name}`, 
            description: "Only images, PDFs, and office documents are allowed",
            variant: "destructive" 
          });
          failCount++;
          continue;
        }

        // Create sanitized file path
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substring(2, 8);
        const sanitizedName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_');
        const storagePath = `${companyId}/${entityType}/${entityId}/${timestamp}_${randomSuffix}_${sanitizedName}`;

        try {
          // First create database record
          const { data: dbRecord, error: dbError } = await supabase
            .from("entity_attachments")
            .insert({
              entity_type: entityType,
              entity_id: entityId,
              company_id: companyId,
              file_name: file.name,
              file_url: storagePath,
              file_type: file.type,
              file_size: file.size,
              category: uploadCategory,
              uploaded_by: user.id,
            })
            .select()
            .single();

          if (dbError) {
            console.error('Database error:', dbError);
            toast({ 
              title: `Database error for ${file.name}`, 
              description: dbError.message,
              variant: "destructive" 
            });
            failCount++;
            continue;
          }

          // Then upload file to storage
          const { error: uploadError } = await supabase.storage
            .from("attachments")
            .upload(storagePath, file, { 
              contentType: file.type,
              cacheControl: '3600'
            });

          if (uploadError) {
            console.error('Storage error:', uploadError);
            // Rollback database record if upload fails
            await supabase.from("entity_attachments").delete().eq('id', dbRecord.id);
            toast({ 
              title: `Storage error for ${file.name}`, 
              description: uploadError.message,
              variant: "destructive" 
            });
            failCount++;
            continue;
          }

          successCount++;
        } catch (error) {
          console.error('Upload error:', error);
          toast({ 
            title: `Failed to upload ${file.name}`, 
            description: error instanceof Error ? error.message : "Unknown error",
            variant: "destructive" 
          });
          failCount++;
        }
      }

      // Show final result
      if (successCount > 0) {
        queryClient.invalidateQueries({ queryKey: ["entity-attachments", entityType, entityId] });
        toast({ 
          title: `Successfully uploaded ${successCount} file${successCount === 1 ? '' : 's'}`,
          ...(failCount > 0 && { description: `${failCount} file${failCount === 1 ? '' : 's'} failed` })
        });
      }
      
      if (successCount === 0 && failCount > 0) {
        toast({ title: "All uploads failed", variant: "destructive" });
      }

    } catch (error) {
      console.error('Upload handler error:', error);
      toast({ 
        title: "Upload failed", 
        description: error instanceof Error ? error.message : "Unknown error occurred",
        variant: "destructive" 
      });
    } finally {
      setUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [companyId, entityType, entityId, uploadCategory, user, toast, queryClient]);

  // Delete handler with better error handling
  const deleteAttachment = useMutation({
    mutationFn: async (attachment: Attachment) => {
      // First delete from database
      const { error: dbError } = await supabase
        .from("entity_attachments")
        .delete()
        .eq("id", attachment.id);
      
      if (dbError) throw new Error(`Database error: ${dbError.message}`);
      
      // Then remove from storage
      const { error: storageError } = await supabase.storage
        .from("attachments")
        .remove([attachment.file_url]);
      
      if (storageError) {
        console.warn('Storage cleanup failed:', storageError);
        // Don't throw here as the database record is already deleted
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["entity-attachments", entityType, entityId] });
      toast({ title: "File deleted successfully" });
    },
    onError: (error) => {
      toast({ 
        title: "Failed to delete file", 
        description: error instanceof Error ? error.message : "Unknown error",
        variant: "destructive" 
      });
    },
  });

  // Get signed URL for download/preview with error handling
  const getSignedUrl = useCallback(async (path: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("attachments")
        .createSignedUrl(path, 3600);
      
      if (error) {
        console.error('Failed to create signed URL:', error);
        toast({ 
          title: "File access error", 
          description: "Unable to access file. Please try again.",
          variant: "destructive" 
        });
        return null;
      }
      
      return data?.signedUrl || null;
    } catch (error) {
      console.error('Signed URL error:', error);
      return null;
    }
  }, [toast]);

  const handleDownload = useCallback(async (attachment: Attachment) => {
    try {
      const url = await getSignedUrl(attachment.file_url);
      if (url) {
        const a = document.createElement("a");
        a.href = url;
        a.download = attachment.file_name;
        a.target = "_blank"; // Fallback for some browsers
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
      }
    } catch (error) {
      toast({ 
        title: "Download failed", 
        description: "Unable to download file. Please try again.",
        variant: "destructive" 
      });
    }
  }, [getSignedUrl, toast]);

  const handlePreview = useCallback(async (attachment: Attachment) => {
    try {
      const url = await getSignedUrl(attachment.file_url);
      if (url) {
        setPreviewUrl(url);
        setPreviewType(attachment.file_type);
        setPreviewName(attachment.file_name);
      } else {
        toast({ 
          title: "Preview unavailable", 
          description: "Unable to generate preview for this file.",
          variant: "destructive" 
        });
      }
    } catch (error) {
      toast({ 
        title: "Preview failed", 
        description: "Unable to preview file. Please try again.",
        variant: "destructive" 
      });
    }
  }, [getSignedUrl, toast]);

  // Group by category
  const grouped = useMemo(() => {
    const map: Record<string, Attachment[]> = {};
    attachments.forEach(a => {
      if (!map[a.category]) map[a.category] = [];
      map[a.category].push(a);
    });
    return map;
  }, [attachments]);

  const fileIcon = (type: string | null) => {
    if (isImage(type)) return ImageIcon;
    if (isPdf(type)) return FileText;
    return File;
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-accent" />
          <h3 className="text-sm font-semibold text-foreground">Attachments</h3>
          <Badge variant="secondary" className="text-[10px]">{attachments.length}</Badge>
        </div>
      </div>

      {/* Upload area */}
      <div className="flex items-center gap-2">
        <Select value={uploadCategory} onValueChange={setUploadCategory}>
          <SelectTrigger className="h-8 text-[11px] w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map(c => (
              <SelectItem key={c.value} value={c.value} className="text-xs">
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={e => handleUpload(e.target.files)}
          accept="image/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt"
        />
        <Button
          size="sm"
          variant="outline"
          className="h-8 text-[11px] gap-1.5 flex-1"
          disabled={uploading || !user}
          onClick={() => fileInputRef.current?.click()}
        >
          {uploading ? (
            <><Loader2 className="w-3 h-3 animate-spin" /> Uploading...</>
          ) : (
            <><Upload className="w-3 h-3" /> Upload Files</>
          )}
        </Button>
      </div>

      {/* Drag and drop zone */}
      <div
        className="border-2 border-dashed border-border rounded-lg p-4 text-center cursor-pointer hover:border-accent/50 hover:bg-accent/5 transition-colors"
        onClick={() => fileInputRef.current?.click()}
        onDragOver={e => { e.preventDefault(); e.stopPropagation(); }}
        onDrop={e => {
          e.preventDefault();
          e.stopPropagation();
          handleUpload(e.dataTransfer.files);
        }}
      >
        <Upload className="w-5 h-5 text-muted-foreground mx-auto mb-1" />
        <p className="text-[10px] text-muted-foreground">Drag & drop files here or click to browse</p>
        <p className="text-[9px] text-muted-foreground mt-0.5">Max 10MB per file · Images, PDF, Documents</p>
      </div>

      {/* Files list grouped by category */}
      {isLoading ? (
        <div className="flex items-center justify-center py-6">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : attachments.length === 0 ? (
        <div className="text-center py-6">
          <Paperclip className="w-8 h-8 text-muted-foreground/20 mx-auto mb-1" />
          <p className="text-xs text-muted-foreground">No attachments yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {Object.entries(grouped).map(([category, files]) => {
            const catConfig = getCategoryConfig(category);
            const CatIcon = catConfig.icon;
            return (
              <div key={category}>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <CatIcon className="w-3 h-3 text-muted-foreground" />
                  <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                    {catConfig.label}
                  </span>
                  <span className="text-[9px] text-muted-foreground">({files.length})</span>
                </div>
                <div className="space-y-1">
                  <AnimatePresence>
                    {files.map((file, idx) => {
                      const FIcon = fileIcon(file.file_type);
                      return (
                        <motion.div
                          key={file.id}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ delay: idx * 0.02 }}
                          className="group flex items-center gap-2 p-2 rounded-lg border border-border hover:bg-muted/30 transition-colors"
                        >
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center shrink-0",
                            isImage(file.file_type) ? "bg-blue-50" : isPdf(file.file_type) ? "bg-red-50" : "bg-muted"
                          )}>
                            <FIcon className={cn(
                              "w-4 h-4",
                              isImage(file.file_type) ? "text-blue-500" : isPdf(file.file_type) ? "text-red-500" : "text-muted-foreground"
                            )} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-medium text-foreground truncate">{file.file_name}</p>
                            <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
                              <span>{formatFileSize(file.file_size)}</span>
                              <span>·</span>
                              <span>{getUploaderName(file.uploaded_by)}</span>
                              <span>·</span>
                              <span>{format(new Date(file.created_at), "MMM d, yyyy")}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
                            {(isImage(file.file_type) || isPdf(file.file_type)) && (
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-6 w-6"
                                onClick={() => handlePreview(file)}
                              >
                                <Eye className="w-3 h-3" />
                              </Button>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => handleDownload(file)}
                            >
                              <Download className="w-3 h-3" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-destructive/60 hover:text-destructive"
                              onClick={() => deleteAttachment.mutate(file)}
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          </div>
                        </motion.div>
                      );
                    })}
                  </AnimatePresence>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={!!previewUrl} onOpenChange={v => { if (!v) setPreviewUrl(null); }}>
        <DialogContent className="sm:max-w-3xl max-h-[85vh]">
          <DialogHeader>
            <DialogTitle className="text-sm truncate">{previewName}</DialogTitle>
          </DialogHeader>
          <div className="flex items-center justify-center overflow-auto max-h-[70vh]">
            {previewType && isImage(previewType) ? (
              <img src={previewUrl!} alt={previewName} className="max-w-full max-h-[65vh] object-contain rounded" />
            ) : previewType && isPdf(previewType) ? (
              <iframe src={previewUrl!} className="w-full h-[65vh] rounded border-0" title={previewName} />
            ) : (
              <div className="text-center py-12">
                <File className="w-12 h-12 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">Preview not available</p>
                <Button variant="outline" size="sm" className="mt-3" onClick={() => {
                  if (previewUrl) window.open(previewUrl, "_blank");
                }}>
                  <Download className="w-3.5 h-3.5 mr-1.5" /> Download
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
