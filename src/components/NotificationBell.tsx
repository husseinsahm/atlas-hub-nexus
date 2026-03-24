import { useState } from "react";
import { useNotifications, type Notification } from "@/hooks/useNotifications";
import { useNavigate } from "react-router-dom";
import { formatDistanceToNow } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, Check, CheckCheck, Trash2, UserPlus, MessageSquare,
  ClipboardCheck, Clock, ArrowRightLeft, X, AlertCircle,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { cn } from "@/lib/utils";

const typeConfig: Record<string, { icon: typeof Bell; color: string }> = {
  lead_assigned: { icon: UserPlus, color: "text-blue-500" },
  comment_added: { icon: MessageSquare, color: "text-emerald-500" },
  trip_approval: { icon: ClipboardCheck, color: "text-amber-500" },
  follow_up_reminder: { icon: Clock, color: "text-orange-500" },
  booking_status_change: { icon: ArrowRightLeft, color: "text-purple-500" },
  mention: { icon: MessageSquare, color: "text-cyan-500" },
  client_feedback_approval: { icon: CheckCheck, color: "text-emerald-600" },
  client_feedback_change_request: { icon: ArrowRightLeft, color: "text-amber-600" },
  client_feedback_comment: { icon: MessageSquare, color: "text-blue-600" },
};

function getEntityRoute(n: Notification): string | null {
  if (!n.entity_type || !n.entity_id) return null;
  switch (n.entity_type) {
    case "lead": return `/dashboard/leads/${n.entity_id}`;
    case "trip": return `/dashboard/trips/${n.entity_id}`;
    case "booking": return `/dashboard/bookings/${n.entity_id}`;
    case "customer": return `/dashboard/customers/${n.entity_id}`;
    default: return null;
  }
}

function NotificationItem({
  notification: n,
  onRead,
  onDelete,
  onNavigate,
}: {
  notification: Notification;
  onRead: (id: string) => void;
  onDelete: (id: string) => void;
  onNavigate: (path: string) => void;
}) {
  const config = typeConfig[n.type] || { icon: Bell, color: "text-muted-foreground" };
  const Icon = config.icon;
  const route = getEntityRoute(n);

  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0 }}
      className={cn(
        "group flex items-start gap-2.5 p-3 rounded-lg transition-colors cursor-pointer hover:bg-muted/40",
        !n.is_read && "bg-accent/5 border-s-2 border-accent"
      )}
      onClick={() => {
        if (!n.is_read) onRead(n.id);
        if (route) onNavigate(route);
      }}
    >
      <div className={cn("mt-0.5 w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-muted/50", config.color)}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className={cn("text-xs leading-relaxed", !n.is_read ? "font-semibold text-foreground" : "text-muted-foreground")}>
          {n.title}
        </p>
        {n.message && (
          <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
        )}
        <div className="flex items-center gap-2 mt-1">
          <span className="text-[9px] text-muted-foreground">
            {formatDistanceToNow(new Date(n.created_at), { addSuffix: true })}
          </span>
          {n.is_reminder && (
            <Badge variant="outline" className="text-[8px] px-1.5 py-0 h-3.5 gap-0.5">
              <Clock className="w-2 h-2" /> Reminder
            </Badge>
          )}
        </div>
      </div>
      <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity shrink-0">
        {!n.is_read && (
          <Button
            size="icon"
            variant="ghost"
            className="h-5 w-5"
            onClick={(e) => { e.stopPropagation(); onRead(n.id); }}
          >
            <Check className="w-2.5 h-2.5" />
          </Button>
        )}
        <Button
          size="icon"
          variant="ghost"
          className="h-5 w-5 text-destructive/60 hover:text-destructive"
          onClick={(e) => { e.stopPropagation(); onDelete(n.id); }}
        >
          <Trash2 className="w-2.5 h-2.5" />
        </Button>
      </div>
    </motion.div>
  );
}

export function NotificationBell() {
  const [open, setOpen] = useState(false);
  const navigate = useNavigate();
  const {
    notifications,
    unreadCount,
    reminders,
    isLoading,
    markAsRead,
    markAllAsRead,
    deleteNotification,
  } = useNotifications();

  const handleNavigate = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  const allNotifications = notifications.filter((n) => !n.is_reminder);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative text-muted-foreground hover:text-foreground">
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              className="absolute -top-0.5 -end-0.5 min-w-[16px] h-4 px-1 rounded-full bg-accent text-accent-foreground text-[9px] font-bold flex items-center justify-center"
            >
              {unreadCount > 99 ? "99+" : unreadCount}
            </motion.span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0" sideOffset={8}>
        <Tabs defaultValue="all" className="w-full">
          <div className="flex items-center justify-between px-4 pt-3 pb-1">
            <h3 className="text-sm font-semibold text-foreground">Notifications</h3>
            {unreadCount > 0 && (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 text-[10px] gap-1 text-muted-foreground"
                onClick={() => markAllAsRead.mutate()}
              >
                <CheckCheck className="w-3 h-3" /> Mark all read
              </Button>
            )}
          </div>
          <TabsList className="w-full h-8 px-4 bg-transparent justify-start gap-1">
            <TabsTrigger value="all" className="text-[10px] h-6 px-2.5 data-[state=active]:bg-muted">
              All {unreadCount > 0 && <Badge variant="secondary" className="ml-1 text-[8px] px-1 py-0 h-3.5">{unreadCount}</Badge>}
            </TabsTrigger>
            <TabsTrigger value="reminders" className="text-[10px] h-6 px-2.5 data-[state=active]:bg-muted">
              Reminders {reminders.length > 0 && <Badge variant="secondary" className="ml-1 text-[8px] px-1 py-0 h-3.5">{reminders.length}</Badge>}
            </TabsTrigger>
          </TabsList>

          <TabsContent value="all" className="mt-0">
            <ScrollArea className="max-h-[400px]">
              <div className="p-2 space-y-0.5">
                {isLoading ? (
                  <div className="py-8 text-center">
                    <div className="w-5 h-5 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto" />
                  </div>
                ) : allNotifications.length === 0 ? (
                  <div className="py-8 text-center">
                    <Bell className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">No notifications yet</p>
                  </div>
                ) : (
                  <AnimatePresence>
                    {allNotifications.map((n) => (
                      <NotificationItem
                        key={n.id}
                        notification={n}
                        onRead={(id) => markAsRead.mutate(id)}
                        onDelete={(id) => deleteNotification.mutate(id)}
                        onNavigate={handleNavigate}
                      />
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="reminders" className="mt-0">
            <ScrollArea className="max-h-[400px]">
              <div className="p-2 space-y-0.5">
                {reminders.length === 0 ? (
                  <div className="py-8 text-center">
                    <Clock className="w-8 h-8 text-muted-foreground/20 mx-auto mb-2" />
                    <p className="text-xs text-muted-foreground">No reminders</p>
                  </div>
                ) : (
                  <AnimatePresence>
                    {reminders.map((n) => (
                      <NotificationItem
                        key={n.id}
                        notification={n}
                        onRead={(id) => markAsRead.mutate(id)}
                        onDelete={(id) => deleteNotification.mutate(id)}
                        onNavigate={handleNavigate}
                      />
                    ))}
                  </AnimatePresence>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </PopoverContent>
    </Popover>
  );
}
