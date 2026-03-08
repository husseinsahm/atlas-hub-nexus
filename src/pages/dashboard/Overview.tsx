import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Map, Users, Building2, TrendingUp, ArrowUpRight } from "lucide-react";

const stats = [
  { label: "Active Trips", value: "127", change: "+12%", icon: Map, color: "text-gold" },
  { label: "Total Clients", value: "1,842", change: "+8%", icon: Users, color: "text-navy" },
  { label: "Revenue", value: "$284K", change: "+23%", icon: TrendingUp, color: "text-gold-dark" },
  { label: "Companies", value: "34", change: "+3", icon: Building2, color: "text-navy-light" },
];

export default function Overview() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const displayName = user?.profile.fullName?.split(" ")[0] || "there";
  const greeting = new Date().getHours() < 12 ? "Good morning" : new Date().getHours() < 18 ? "Good afternoon" : "Good evening";

  return (
    <div className="space-y-8 animate-fade-in">
      <div>
        <h1 className="text-2xl font-bold font-display text-foreground">
          {greeting}, {displayName}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Here's what's happening across your travel platform today.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats
          .filter((s) => s.label !== "Companies" || user?.isSuperAdmin)
          .map((stat) => (
            <div key={stat.label} className="luxury-card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">{stat.label}</p>
                  <p className="text-2xl font-bold font-display text-foreground mt-2">{stat.value}</p>
                </div>
                <div className={`w-10 h-10 rounded-lg bg-muted flex items-center justify-center ${stat.color}`}>
                  <stat.icon className="w-5 h-5" />
                </div>
              </div>
              <div className="flex items-center gap-1 mt-3 text-xs text-gold-dark font-medium">
                <ArrowUpRight className="w-3 h-3" />
                {stat.change} from last month
              </div>
            </div>
          ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 luxury-card p-6">
          <h3 className="font-semibold font-display text-foreground mb-4">Recent Activity</h3>
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="flex items-center gap-3 py-3 border-b border-border last:border-0">
                <div className="w-8 h-8 rounded-full bg-muted animate-pulse" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 bg-muted rounded w-3/4 animate-pulse" />
                  <div className="h-2.5 bg-muted rounded w-1/2 animate-pulse" />
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="luxury-card p-6">
          <h3 className="font-semibold font-display text-foreground mb-4">Upcoming Departures</h3>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="p-3 rounded-lg bg-muted/50 space-y-2">
                <div className="h-3 bg-muted rounded w-2/3 animate-pulse" />
                <div className="h-2.5 bg-muted rounded w-1/2 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
