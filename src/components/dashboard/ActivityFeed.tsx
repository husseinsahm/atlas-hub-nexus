import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Bell, 
  User, 
  Calendar, 
  FileText,
  CheckCircle,
  AlertTriangle,
  Clock,
  MessageSquare
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

const mockActivities = [
  {
    id: "1",
    type: "booking_created",
    title: "New booking created",
    description: "Booking #BK-2024-001 for Sarah Johnson",
    user: "Ahmad Hassan",
    userAvatar: null,
    timestamp: new Date(Date.now() - 30 * 60 * 1000), // 30 minutes ago
    status: "success",
    icon: CheckCircle,
  },
  {
    id: "2",
    type: "lead_updated",
    title: "Lead status updated",
    description: "Michael Brown moved to 'Qualified' stage",
    user: "Fatima Ali",
    userAvatar: null,
    timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
    status: "info",
    icon: User,
  },
  {
    id: "3",
    type: "payment_received",
    title: "Payment received",
    description: "$2,500 payment for booking #BK-2024-002",
    user: "System",
    userAvatar: null,
    timestamp: new Date(Date.now() - 4 * 60 * 60 * 1000), // 4 hours ago
    status: "success",
    icon: CheckCircle,
  },
  {
    id: "4",
    type: "followup_due",
    title: "Follow-up reminder",
    description: "Schedule call with Emma Davis tomorrow",
    user: "System",
    userAvatar: null,
    timestamp: new Date(Date.now() - 6 * 60 * 60 * 1000), // 6 hours ago
    status: "warning",
    icon: AlertTriangle,
  },
  {
    id: "5",
    type: "quotation_sent",
    title: "Quotation sent",
    description: "Quote #QT-2024-015 sent to client",
    user: "Omar Khalil",
    userAvatar: null,
    timestamp: new Date(Date.now() - 8 * 60 * 60 * 1000), // 8 hours ago
    status: "info",
    icon: FileText,
  },
  {
    id: "6",
    type: "meeting_scheduled",
    title: "Meeting scheduled",
    description: "Site visit with VIP client next week",
    user: "Layla Ahmed",
    userAvatar: null,
    timestamp: new Date(Date.now() - 24 * 60 * 60 * 1000), // 1 day ago
    status: "info",
    icon: Calendar,
  }
];

const getStatusColor = (status: string) => {
  switch (status) {
    case "success":
      return "bg-green-100 text-green-700 border-green-200";
    case "warning":
      return "bg-yellow-100 text-yellow-700 border-yellow-200";
    case "error":
      return "bg-red-100 text-red-700 border-red-200";
    default:
      return "bg-blue-100 text-blue-700 border-blue-200";
  }
};

const getIconColor = (status: string) => {
  switch (status) {
    case "success":
      return "text-green-600";
    case "warning":
      return "text-yellow-600";
    case "error":
      return "text-red-600";
    default:
      return "text-blue-600";
  }
};

interface ActivityFeedProps {
  className?: string;
}

export function ActivityFeed({ className }: ActivityFeedProps) {
  return (
    <Card className={`luxury-card ${className}`}>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold flex items-center">
          <Bell className="w-5 h-5 mr-2 text-gold" />
          Recent Activity
        </CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <ScrollArea className="h-[400px] px-6">
          <div className="space-y-4">
            {mockActivities.map((activity, index) => {
              const Icon = activity.icon;
              const isLast = index === mockActivities.length - 1;
              
              return (
                <div key={activity.id} className="relative">
                  <div className="flex items-start gap-3">
                    <div className={`
                      p-2 rounded-full shrink-0 ${getIconColor(activity.status)} 
                      bg-background border-2 border-current/20
                    `}>
                      <Icon className="w-3 h-3" />
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="text-sm font-medium text-foreground leading-tight">
                          {activity.title}
                        </h4>
                        <Badge 
                          variant="outline" 
                          className={`text-xs px-2 py-0 ${getStatusColor(activity.status)}`}
                        >
                          {activity.status}
                        </Badge>
                      </div>
                      
                      <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                        {activity.description}
                      </p>
                      
                      <div className="flex items-center gap-2 mt-2">
                        <Avatar className="w-5 h-5">
                          <AvatarImage src={activity.userAvatar || undefined} />
                          <AvatarFallback className="text-xs">
                            {activity.user.split(' ').map(n => n[0]).join('')}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-xs text-muted-foreground">
                          {activity.user}
                        </span>
                        <span className="text-xs text-muted-foreground">•</span>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(activity.timestamp, { addSuffix: true })}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {!isLast && (
                    <div className="absolute left-6 top-12 bottom-0 w-px bg-border" />
                  )}
                </div>
              );
            })}
          </div>
        </ScrollArea>
        
        <div className="p-4 border-t border-border">
          <button className="w-full text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center justify-center gap-2">
            <MessageSquare className="w-3 h-3" />
            View All Activities
          </button>
        </div>
      </CardContent>
    </Card>
  );
}