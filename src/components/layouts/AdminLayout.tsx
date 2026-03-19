import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { NavLink } from "@/components/NavLink";
import { useLanguage } from "@/contexts/LanguageContext";
import {
  LayoutDashboard, CreditCard, DollarSign, BarChart3, Settings, ArrowLeft, ArrowRight, Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const adminNav = [
  { title: "Overview", url: "/admin", icon: LayoutDashboard, end: true },
  { title: "Plans", url: "/admin/plans", icon: DollarSign },
  { title: "Subscriptions", url: "/admin/subscriptions", icon: CreditCard },
  { title: "Revenue", url: "/admin/revenue", icon: BarChart3 },
  { title: "Settings", url: "/admin/settings", icon: Settings },
];

export function AdminLayout() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const { direction } = useLanguage();
  const isRTL = direction === "rtl";

  if (!user?.isSuperAdmin) {
    navigate("/dashboard", { replace: true });
    return null;
  }

  const BackIcon = isRTL ? ArrowRight : ArrowLeft;

  return (
    <div className="min-h-screen flex bg-background" dir={direction}>
      {/* Sidebar — warm dark brown, slightly different from dashboard */}
      <aside className="w-56 border-e border-sidebar-border flex flex-col shrink-0" style={{ background: 'hsl(20 15% 10%)' }}>
        <div className="p-4 border-b border-sidebar-border">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary flex items-center justify-center">
              <Shield className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <div>
              <h2 className="text-sm font-bold font-display text-white">Super Admin</h2>
              <p className="text-[10px] text-sidebar-foreground/50 uppercase tracking-[0.08em]">System Management</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {adminNav.map((item) => {
            const Icon = item.icon;
            const active = item.end
              ? location.pathname === item.url
              : location.pathname.startsWith(item.url);
            return (
              <NavLink
                key={item.url}
                to={item.url}
                end={item.end}
                className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-lg text-[13px] transition-colors",
                  active
                    ? "bg-primary/12 text-primary font-medium"
                    : "text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent"
                )}
              >
                <Icon className="w-4 h-4" />
                <span>{item.title}</span>
              </NavLink>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border">
          <Button
            variant="ghost"
            size="sm"
            className="w-full justify-start gap-2 text-xs text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent"
            onClick={() => navigate("/dashboard")}
          >
            <BackIcon className="w-3.5 h-3.5" /> Back to Dashboard
          </Button>
        </div>
      </aside>

      {/* Content */}
      <main className="flex-1 overflow-auto">
        <div className="p-6 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
