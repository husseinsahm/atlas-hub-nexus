import { useState, useRef, useCallback, useMemo, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { createNotification } from "@/hooks/useNotifications";
import { motion, AnimatePresence } from "framer-motion";
import {
  MessageSquare, Send, Loader2, Trash2, AtSign, Reply, CornerDownRight, Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";
import { format, formatDistanceToNow } from "date-fns";

interface InternalCommentsProps {
  entityType: "lead" | "trip" | "booking";
  entityId: string;
  companyId: string;
  className?: string;
}

interface Comment {
  id: string;
  content: string;
  user_id: string;
  mentions: string[];
  parent_id: string | null;
  created_at: string;
}

interface TeamMember {
  id: string;
  full_name: string | null;
  role: string;
}

export function InternalComments({ entityType, entityId, companyId, className }: InternalCommentsProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [content, setContent] = useState("");
  const [replyTo, setReplyTo] = useState<Comment | null>(null);
  const [showMentions, setShowMentions] = useState(false);
  const [mentionSearch, setMentionSearch] = useState("");
  const [cursorPos, setCursorPos] = useState(0);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Fetch comments
  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["internal-comments", entityType, entityId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("internal_comments")
        .select("*")
        .eq("entity_type", entityType)
        .eq("entity_id", entityId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data || []) as Comment[];
    },
    enabled: !!entityId,
  });

  // Fetch team members for mentions
  const { data: teamMembers = [] } = useQuery({
    queryKey: ["team-members-comments", companyId],
    queryFn: async () => {
      const { data: memberships } = await supabase
        .from("company_memberships")
        .select("user_id, role")
        .eq("company_id", companyId)
        .eq("is_active", true);
      if (!memberships?.length) return [];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", memberships.map(m => m.user_id));
      return (profiles || []).map(p => ({
        ...p,
        role: memberships.find(m => m.user_id === p.id)?.role || "agent",
      })) as TeamMember[];
    },
    enabled: !!companyId,
  });

  const getMemberName = useCallback((userId: string) => {
    return teamMembers.find(m => m.id === userId)?.full_name || "Team member";
  }, [teamMembers]);

  const getMemberRole = useCallback((userId: string) => {
    return teamMembers.find(m => m.id === userId)?.role || "agent";
  }, [teamMembers]);

  const getInitials = useCallback((name: string) => {
    return name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
  }, []);

  // Group comments into threads
  const threads = useMemo(() => {
    const topLevel = comments.filter(c => !c.parent_id);
    return topLevel.map(parent => ({
      parent,
      replies: comments.filter(c => c.parent_id === parent.id),
    }));
  }, [comments]);

  // Add comment mutation
  const addComment = useMutation({
    mutationFn: async () => {
      // Extract mentions from content
      const mentionRegex = /@(\w[\w\s]*?)(?=\s@|\s|$)/g;
      const mentionedNames: string[] = [];
      let match;
      while ((match = mentionRegex.exec(content)) !== null) {
        mentionedNames.push(match[1].trim());
      }
      const mentionedIds = teamMembers
        .filter(m => mentionedNames.some(name =>
          m.full_name?.toLowerCase().includes(name.toLowerCase())
        ))
        .map(m => m.id);

      const { error } = await supabase.from("internal_comments").insert({
        entity_type: entityType,
        entity_id: entityId,
        company_id: companyId,
        user_id: user!.id,
        content: content.trim(),
        mentions: mentionedIds,
        parent_id: replyTo?.id || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["internal-comments", entityType, entityId] });
      // Notify mentioned users
      const mentionRegex = /@(\w[\w\s]*?)(?=\s@|\s|$)/g;
      const mentionedNames: string[] = [];
      let m;
      while ((m = mentionRegex.exec(content)) !== null) {
        mentionedNames.push(m[1].trim());
      }
      const mentionedIds = teamMembers
        .filter(tm => mentionedNames.some(name =>
          tm.full_name?.toLowerCase().includes(name.toLowerCase())
        ))
        .map(tm => tm.id)
        .filter(uid => uid !== user?.id);

      for (const uid of mentionedIds) {
        createNotification({
          userId: uid,
          companyId,
          type: "mention",
          title: `${user?.profile.fullName || "Someone"} mentioned you`,
          message: content.trim().substring(0, 120),
          entityType,
          entityId,
        });
      }
      setContent("");
      setReplyTo(null);
    },
    onError: () => {
      toast({ title: "Failed to add comment", variant: "destructive" });
    },
  });

  const deleteComment = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase.from("internal_comments").delete().eq("id", commentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["internal-comments", entityType, entityId] });
      toast({ title: "Comment deleted" });
    },
  });

  // Mention handling
  const handleTextChange = useCallback((value: string) => {
    setContent(value);
    const pos = textareaRef.current?.selectionStart || 0;
    setCursorPos(pos);

    // Check if we're typing a mention
    const textBefore = value.slice(0, pos);
    const lastAt = textBefore.lastIndexOf("@");
    if (lastAt !== -1 && !textBefore.slice(lastAt).includes("\n")) {
      const searchTerm = textBefore.slice(lastAt + 1);
      if (searchTerm.length <= 20 && !/\s{2}/.test(searchTerm)) {
        setMentionSearch(searchTerm);
        setShowMentions(true);
        return;
      }
    }
    setShowMentions(false);
  }, []);

  const insertMention = useCallback((member: TeamMember) => {
    const textBefore = content.slice(0, cursorPos);
    const lastAt = textBefore.lastIndexOf("@");
    const before = content.slice(0, lastAt);
    const after = content.slice(cursorPos);
    const newContent = `${before}@${member.full_name} ${after}`;
    setContent(newContent);
    setShowMentions(false);
    textareaRef.current?.focus();
  }, [content, cursorPos]);

  const filteredMembers = useMemo(() => {
    if (!mentionSearch) return teamMembers;
    return teamMembers.filter(m =>
      m.full_name?.toLowerCase().includes(mentionSearch.toLowerCase())
    );
  }, [teamMembers, mentionSearch]);

  // Render content with highlighted mentions
  const renderContent = useCallback((text: string) => {
    const parts = text.split(/(@\w[\w\s]*?)(?=\s@|\s|$)/g);
    return parts.map((part, i) => {
      if (part.startsWith("@")) {
        const name = part.slice(1).trim();
        const isMember = teamMembers.some(m =>
          m.full_name?.toLowerCase().includes(name.toLowerCase())
        );
        if (isMember) {
          return (
            <span key={i} className="text-accent font-semibold bg-accent/10 rounded px-0.5">
              {part}
            </span>
          );
        }
      }
      return <span key={i}>{part}</span>;
    });
  }, [teamMembers]);

  const ROLE_LABELS: Record<string, string> = {
    company_admin: "Admin",
    agent: "Agent",
    operations: "Ops",
    finance: "Finance",
    viewer: "Viewer",
    super_admin: "Super Admin",
  };

  const renderComment = (comment: Comment, isReply = false) => {
    const name = getMemberName(comment.user_id);
    const role = getMemberRole(comment.user_id);
    const isOwn = comment.user_id === user?.id;

    return (
      <motion.div
        key={comment.id}
        initial={{ opacity: 0, y: 4 }}
        animate={{ opacity: 1, y: 0 }}
        className={cn("group", isReply && "ml-8 pl-3 border-l-2 border-border")}
      >
        <div className="flex gap-2.5">
          <Avatar className="w-7 h-7 shrink-0 mt-0.5">
            <AvatarFallback className={cn(
              "text-[10px] font-bold",
              isOwn ? "bg-accent/20 text-accent" : "bg-muted text-muted-foreground"
            )}>
              {getInitials(name)}
            </AvatarFallback>
          </Avatar>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-foreground">{name}</span>
              <Badge variant="outline" className="text-[9px] h-4 px-1 border-border">
                <Shield className="w-2 h-2 mr-0.5" />
                {ROLE_LABELS[role] || role}
              </Badge>
              <span className="text-[10px] text-muted-foreground">
                {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
              </span>
            </div>
            <p className="text-xs text-foreground mt-1 whitespace-pre-line leading-relaxed">
              {renderContent(comment.content)}
            </p>
            <div className="flex items-center gap-1 mt-1.5 opacity-0 group-hover:opacity-100 transition-opacity">
              {!isReply && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 text-[10px] px-1.5 text-muted-foreground hover:text-foreground"
                  onClick={() => setReplyTo(comment)}
                >
                  <Reply className="w-2.5 h-2.5 mr-0.5" /> Reply
                </Button>
              )}
              {isOwn && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-5 text-[10px] px-1.5 text-destructive/60 hover:text-destructive"
                  onClick={() => deleteComment.mutate(comment.id)}
                >
                  <Trash2 className="w-2.5 h-2.5 mr-0.5" /> Delete
                </Button>
              )}
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <MessageSquare className="w-4 h-4 text-accent" />
        <h3 className="text-sm font-semibold text-foreground">Internal Comments</h3>
        <Badge variant="secondary" className="text-[10px]">{comments.length}</Badge>
        <Badge variant="outline" className="text-[9px] border-amber-300 text-amber-600 bg-amber-50">
          Internal Only
        </Badge>
      </div>

      {/* Comment input */}
      <div className="space-y-2">
        {replyTo && (
          <div className="flex items-center gap-2 text-[10px] text-muted-foreground bg-muted/50 rounded px-2 py-1.5">
            <CornerDownRight className="w-3 h-3" />
            <span>Replying to <strong className="text-foreground">{getMemberName(replyTo.user_id)}</strong></span>
            <Button variant="ghost" size="sm" className="h-4 w-4 p-0 ml-auto" onClick={() => setReplyTo(null)}>
              <Trash2 className="w-2.5 h-2.5" />
            </Button>
          </div>
        )}
        <div className="relative">
          <Textarea
            ref={textareaRef}
            value={content}
            onChange={e => handleTextChange(e.target.value)}
            placeholder="Write a comment... use @ to mention team members"
            rows={2}
            className="text-xs pr-20 resize-none"
          />
          <div className="absolute right-2 bottom-2 flex items-center gap-1">
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={() => {
                setContent(prev => prev + "@");
                setShowMentions(true);
                setMentionSearch("");
                textareaRef.current?.focus();
              }}
            >
              <AtSign className="w-3.5 h-3.5 text-muted-foreground" />
            </Button>
            <Button
              size="icon"
              className="h-6 w-6"
              disabled={!content.trim() || addComment.isPending}
              onClick={() => addComment.mutate()}
            >
              {addComment.isPending ? <Loader2 className="w-3 h-3 animate-spin" /> : <Send className="w-3 h-3" />}
            </Button>
          </div>

          {/* Mentions dropdown */}
          {showMentions && filteredMembers.length > 0 && (
            <div className="absolute bottom-full mb-1 left-0 w-64 bg-popover border border-border rounded-lg shadow-lg z-50 overflow-hidden">
              <ScrollArea className="max-h-40">
                {filteredMembers.map(m => (
                  <button
                    key={m.id}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-accent/10 transition-colors"
                    onClick={() => insertMention(m)}
                  >
                    <Avatar className="w-5 h-5">
                      <AvatarFallback className="text-[8px] bg-muted">{getInitials(m.full_name || "?")}</AvatarFallback>
                    </Avatar>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground truncate">{m.full_name}</p>
                      <p className="text-[9px] text-muted-foreground capitalize">{ROLE_LABELS[m.role] || m.role}</p>
                    </div>
                  </button>
                ))}
              </ScrollArea>
            </div>
          )}
        </div>
      </div>

      {/* Comments list */}
      {isLoading ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
        </div>
      ) : threads.length === 0 ? (
        <div className="text-center py-8 space-y-1">
          <MessageSquare className="w-8 h-8 text-muted-foreground/20 mx-auto" />
          <p className="text-xs text-muted-foreground">No comments yet</p>
          <p className="text-[10px] text-muted-foreground">Start the conversation — visible to your team only</p>
        </div>
      ) : (
        <div className="space-y-4">
          {threads.map(({ parent, replies }) => (
            <div key={parent.id} className="space-y-2">
              {renderComment(parent)}
              {replies.map(reply => renderComment(reply, true))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
