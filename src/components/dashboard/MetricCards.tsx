import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { 
  DollarSign, 
  Users, 
  Calendar, 
  TrendingUp,
  TrendingDown,
  FileText,
  CheckCircle,
  Clock,
  AlertTriangle
} from "lucide-react";

interface MetricData {
  id: string;
  title: string;
  value: string | number;
  change: number;
  changeType: "increase" | "decrease" | "neutral";
  icon: React.ComponentType<{ className?: string }>;
  description?: string;
  progress?: number;
  target?: number;
  color: "gold" | "primary" | "success" | "warning" | "danger";
}

const mockMetrics: MetricData[] = [
  {
    id: "revenue",
    title: "Monthly Revenue",
    value: "$89,432",
    change: 12.5,
    changeType: "increase",
    icon: DollarSign,
    description: "vs last month",
    progress: 74,
    target: 120000,
    color: "gold"
  },
  {
    id: "bookings",
    title: "Active Bookings",
    value: 28,
    change: 8.2,
    changeType: "increase",
    icon: Calendar,
    description: "this month",
    progress: 56,
    target: 50,
    color: "primary"
  },
  {
    id: "leads",
    title: "New Leads",
    value: 156,
    change: -3.1,
    changeType: "decrease",
    icon: Users,
    description: "this week",
    progress: 78,
    target: 200,
    color: "success"
  },
  {
    id: "conversion",
    title: "Conversion Rate",
    value: "24.8%",
    change: 2.4,
    changeType: "increase",
    icon: TrendingUp,
    description: "this quarter",
    progress: 85,
    target: 30,
    color: "warning"
  }
];

const getChangeIcon = (type: "increase" | "decrease" | "neutral") => {
  switch (type) {
    case "increase":
      return <TrendingUp className="w-3 h-3" />;
    case "decrease":
      return <TrendingDown className="w-3 h-3" />;
    default:
      return <TrendingUp className="w-3 h-3" />;
  }
};

const getChangeColor = (type: "increase" | "decrease" | "neutral") => {
  switch (type) {
    case "increase":
      return "text-green-600";
    case "decrease":
      return "text-red-600";
    default:
      return "text-muted-foreground";
  }
};

const getCardAccent = (color: string) => {
  switch (color) {
    case "gold":
      return "border-l-4 border-l-gold";
    case "primary":
      return "border-l-4 border-l-primary";
    case "success":
      return "border-l-4 border-l-green-500";
    case "warning":
      return "border-l-4 border-l-yellow-500";
    default:
      return "border-l-4 border-l-primary";
  }
};

interface MetricCardsProps {
  className?: string;
}

export function MetricCards({ className }: MetricCardsProps) {
  return (
    <div className={`grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-6 ${className}`}>
      {mockMetrics.map((metric) => {
        const Icon = metric.icon;
        
        return (
          <Card key={metric.id} className={`luxury-card ${getCardAccent(metric.color)}`}>
            <CardHeader className="pb-2">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  {metric.title}
                </CardTitle>
                <div className={`
                  p-2 rounded-lg 
                  ${metric.color === 'gold' ? 'bg-gold/10 text-gold' : ''}
                  ${metric.color === 'primary' ? 'bg-primary/10 text-primary' : ''}
                  ${metric.color === 'success' ? 'bg-green-100 text-green-600' : ''}
                  ${metric.color === 'warning' ? 'bg-yellow-100 text-yellow-600' : ''}
                `}>
                  <Icon className="w-4 h-4" />
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="space-y-3">
                <div className="flex items-baseline gap-2">
                  <span className="text-2xl font-bold text-foreground">
                    {metric.value}
                  </span>
                  <Badge 
                    variant="outline"
                    className={`text-xs px-2 py-0 ${getChangeColor(metric.changeType)}`}
                  >
                    {getChangeIcon(metric.changeType)}
                    <span className="ml-1">
                      {Math.abs(metric.change)}%
                    </span>
                  </Badge>
                </div>
                
                {metric.description && (
                  <p className="text-xs text-muted-foreground">
                    {metric.description}
                  </p>
                )}
                
                {metric.progress !== undefined && (
                  <div className="space-y-1">
                    <div className="flex justify-between text-xs">
                      <span className="text-muted-foreground">Progress</span>
                      <span className="text-muted-foreground">
                        {metric.progress}%
                      </span>
                    </div>
                    <Progress 
                      value={metric.progress} 
                      className="h-2"
                    />
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}

// Additional dashboard status cards
interface StatusCardsProps {
  className?: string;
}

export function StatusCards({ className }: StatusCardsProps) {
  const statusData = [
    {
      title: "Pending Tasks",
      count: 7,
      icon: Clock,
      color: "warning" as const,
      items: ["Follow-up with Sarah", "Complete booking docs", "Send quotation"]
    },
    {
      title: "Completed Today",
      count: 12,
      icon: CheckCircle,
      color: "success" as const,
      items: ["Payment processed", "Booking confirmed", "Client meeting"]
    },
    {
      title: "Urgent Items",
      count: 3,
      icon: AlertTriangle,
      color: "danger" as const,
      items: ["Flight confirmation needed", "Visa documentation", "Hotel booking"]
    }
  ];

  return (
    <div className={`grid grid-cols-1 sm:grid-cols-3 gap-4 ${className}`}>
      {statusData.map((status) => {
        const Icon = status.icon;
        
        return (
          <Card key={status.title} className="luxury-card">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-3">
                <div className={`
                  p-2 rounded-lg
                  ${status.color === 'warning' ? 'bg-yellow-100 text-yellow-600' : ''}
                  ${status.color === 'success' ? 'bg-green-100 text-green-600' : ''}
                  ${status.color === 'danger' ? 'bg-red-100 text-red-600' : ''}
                `}>
                  <Icon className="w-4 h-4" />
                </div>
                <div>
                  <CardTitle className="text-sm font-medium">
                    {status.title}
                  </CardTitle>
                  <div className="text-2xl font-bold text-foreground">
                    {status.count}
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent className="pt-0">
              <ul className="space-y-1">
                {status.items.map((item, index) => (
                  <li key={index} className="text-xs text-muted-foreground">
                    • {item}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}