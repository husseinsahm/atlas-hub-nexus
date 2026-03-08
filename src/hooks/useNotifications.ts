import { useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface Notification {
  id: string;
  user_id: string;
  company_id: string;
  type: string;
  title: string;
  message: string | null;
  entity_type: string | null;
  entity_id: string | null;
  is_read: boolean;
  is_reminder: boolean;
  reminder_at: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export function useNotifications() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications = [], isLoading } = useQuery({
    queryKey: ["notifications", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data || []) as unknown as Notification[];
    },
    enabled: !!user?.id,
    refetchInterval: 30000,
  });

  // Realtime subscription
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel("notifications-realtime")
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${user.id}`,
        },
        () => {
          queryClient.invalidateQueries({ queryKey: ["notifications", user.id] });
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [user?.id, queryClient]);

  const unreadCount = notifications.filter((n) => !n.is_read).length;
  const reminders = notifications.filter((n) => n.is_reminder);

  const markAsRead = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true } as any)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });

  const markAllAsRead = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("notifications")
        .update({ is_read: true } as any)
        .eq("user_id", user!.id)
        .eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });

  const deleteNotification = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["notifications", user?.id] }),
  });

  return {
    notifications,
    unreadCount,
    reminders,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  };
}

// Helper to create a notification
export async function createNotification(params: {
  userId: string;
  companyId: string;
  type: string;
  title: string;
  message?: string;
  entityType?: string;
  entityId?: string;
  isReminder?: boolean;
  reminderAt?: string;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await supabase.from("notifications").insert({
    user_id: params.userId,
    company_id: params.companyId,
    type: params.type,
    title: params.title,
    message: params.message || null,
    entity_type: params.entityType || null,
    entity_id: params.entityId || null,
    is_reminder: params.isReminder || false,
    reminder_at: params.reminderAt || null,
    metadata: params.metadata || {},
  } as any);
  if (error) console.error("Failed to create notification:", error);
}
