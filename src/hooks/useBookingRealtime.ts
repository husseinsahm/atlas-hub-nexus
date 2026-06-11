import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";

export interface PresenceMember {
  user_id: string;
  full_name: string;
  avatar_url?: string;
  email?: string;
  online_at: string;
}

/**
 * Subscribes to a booking's realtime channel and:
 *   1. Invalidates react-query caches when any related row changes
 *   2. Tracks who is currently viewing the booking via Presence
 */
export function useBookingRealtime(bookingId: string | undefined) {
  const qc = useQueryClient();
  const { user } = useAuth();
  const [members, setMembers] = useState<PresenceMember[]>([]);

  useEffect(() => {
    if (!bookingId || !user) return;

    const invalidate = () => {
      qc.invalidateQueries({ queryKey: ["booking", bookingId] });
      qc.invalidateQueries({ queryKey: ["booking-days", bookingId] });
      qc.invalidateQueries({ queryKey: ["booking-services", bookingId] });
      qc.invalidateQueries({ queryKey: ["booking-activities", bookingId] });
      qc.invalidateQueries({ queryKey: ["payment-records-sum", bookingId] });
      qc.invalidateQueries({ queryKey: ["internal-comments", bookingId] });
    };

    const channel = supabase
      .channel(`booking:${bookingId}`, {
        config: { presence: { key: user.id } },
      })
      .on("postgres_changes",
        { event: "*", schema: "public", table: "bookings", filter: `id=eq.${bookingId}` },
        invalidate,
      )
      .on("postgres_changes",
        { event: "*", schema: "public", table: "booking_day_items" },
        invalidate,
      )
      .on("postgres_changes",
        { event: "*", schema: "public", table: "booking_activities", filter: `booking_id=eq.${bookingId}` },
        invalidate,
      )
      .on("postgres_changes",
        { event: "*", schema: "public", table: "internal_comments" },
        invalidate,
      )
      .on("presence", { event: "sync" }, () => {
        const state = channel.presenceState() as Record<string, PresenceMember[]>;
        const list: PresenceMember[] = [];
        for (const arr of Object.values(state)) {
          if (arr && arr[0]) list.push(arr[0]);
        }
        setMembers(list);
      })
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          await channel.track({
            user_id: user.id,
            full_name: user.fullName || user.email,
            avatar_url: user.avatarUrl,
            email: user.email,
            online_at: new Date().toISOString(),
          });
        }
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [bookingId, user?.id, qc]);

  return { members };
}
