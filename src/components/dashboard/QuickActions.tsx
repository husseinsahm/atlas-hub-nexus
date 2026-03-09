import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { 
  Plus, 
  Users, 
  Calendar,
  FileText,
  Library,
  Settings,
  TrendingUp,
  MessageSquare
} from "lucide-react";
import { useNavigate } from "react-router-dom";

const quickActions = [
  {
    id: "new-booking",
    title: "New Booking",
    description: "Create a new booking",
    icon: Plus,
    href: "/dashboard/bookings?action=new",
    color: "gold",
    priority: "high"
  },
  {
    id: "add-lead",
    title: "Add Lead",
    description: "Capture new lead",
    icon: Users,
    href: "/dashboard/clients?action=new",
    color: "primary",
    priority: "high"
  },
  {
    id: "schedule",
    title: "Schedule",
    description: "View calendar",
    icon: Calendar,
    href: "/dashboard/operations",
    color: "secondary",
    priority: "medium"
  },
  {
    id: "quotation",
    title: "New Quote",
    description: "Create quotation",
    icon: FileText,
    href: "/dashboard/quotations?action=new",
    color: "accent",
    priority: "medium"
  },
  {
    id: "library",
    title: "Library",
    description: "Manage services",
    icon: Library,
    href: "/dashboard/library",
    color: "muted",
    priority: "low"
  },
  {
    id: "analytics",
    title: "Analytics",
    description: "View reports",
    icon: TrendingUp,
    href: "/dashboard/analytics",
    color: "secondary",
    priority: "low"
  },
];

interface QuickActionsProps {
  className?: string;
}

export function QuickActions({ className }: QuickActionsProps) {
  const navigate = useNavigate();

  const handleAction = (href: string) => {
    navigate(href);
  };

  return (
    <Card className={`luxury-card ${className}`}>
      <CardHeader className="pb-4">
        <CardTitle className="text-lg font-semibold flex items-center">
          <MessageSquare className="w-5 h-5 mr-2 text-gold" />
          Quick Actions
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2 gap-3">
          {quickActions.map((action) => {
            const Icon = action.icon;
            const isPriority = action.priority === "high";
            
            return (
              <Button
                key={action.id}
                variant={isPriority ? "premium" : "outline"}
                className={`
                  h-auto p-4 justify-start text-left hover:scale-105 transition-transform duration-200
                  ${isPriority ? "shadow-gold" : ""}
                `}
                onClick={() => handleAction(action.href)}
              >
                <div className="flex items-start gap-3 w-full">
                  <div className={`
                    p-2 rounded-lg shrink-0 transition-colors
                    ${isPriority 
                      ? "bg-background/20" 
                      : "bg-primary/10 text-primary"
                    }
                  `}>
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className={`
                      font-medium text-sm leading-tight
                      ${isPriority ? "text-primary-foreground" : "text-foreground"}
                    `}>
                      {action.title}
                    </div>
                    <div className={`
                      text-xs mt-1 leading-tight
                      ${isPriority 
                        ? "text-primary-foreground/80" 
                        : "text-muted-foreground"
                      }
                    `}>
                      {action.description}
                    </div>
                  </div>
                </div>
              </Button>
            );
          })}
        </div>

        <div className="mt-4 pt-4 border-t border-border">
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs text-muted-foreground hover:text-foreground"
            onClick={() => navigate("/dashboard/settings")}
          >
            <Settings className="w-3 h-3 mr-2" />
            More Settings
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}