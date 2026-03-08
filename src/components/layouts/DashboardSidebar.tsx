import {
  LayoutDashboard,
  Building2,
  Map,
  Users,
  UserCog,
  Settings,
  CreditCard,
  BarChart3,
  FileText,
  Receipt,
  Compass,
  ChevronLeft,
  ChevronRight,
  DollarSign,
  Cog,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useAuth, type AppRole } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

interface NavItem {
  title: string;
  translationKey: string;
  url: string;
  icon: React.ElementType;
  roles: AppRole[];
}

const navItems: NavItem[] = [
  { title: "Dashboard", translationKey: "nav.dashboard", url: "/dashboard", icon: LayoutDashboard, roles: ["super_admin", "company_admin", "agent", "operations", "finance"] },
  { title: "Companies", translationKey: "nav.companies", url: "/dashboard/companies", icon: Building2, roles: ["super_admin"] },
  { title: "Subscriptions", translationKey: "nav.subscriptions", url: "/dashboard/subscriptions", icon: CreditCard, roles: ["super_admin"] },
  { title: "Analytics", translationKey: "nav.analytics", url: "/dashboard/analytics", icon: BarChart3, roles: ["super_admin", "company_admin"] },
  { title: "Trips", translationKey: "nav.trips", url: "/dashboard/trips", icon: Map, roles: ["company_admin", "agent", "operations"] },
  { title: "Itineraries", translationKey: "nav.itineraries", url: "/dashboard/itineraries", icon: FileText, roles: ["company_admin", "agent", "operations"] },
  { title: "Clients", translationKey: "nav.clients", url: "/dashboard/clients", icon: Users, roles: ["company_admin", "agent"] },
  { title: "Staff", translationKey: "nav.staff", url: "/dashboard/staff", icon: UserCog, roles: ["company_admin"] },
  { title: "Invoices", translationKey: "nav.invoices", url: "/dashboard/invoices", icon: Receipt, roles: ["company_admin", "finance"] },
  { title: "Settings", translationKey: "nav.settings", url: "/dashboard/settings", icon: Settings, roles: ["super_admin", "company_admin"] },
];

function getUserRole(user: ReturnType<typeof useAuth>["user"]): AppRole | null {
  if (!user) return null;
  if (user.isSuperAdmin) return "super_admin";
  return user.activeMembership?.role || null;
}

export function DashboardSidebar() {
  const { user } = useAuth();
  const { t, direction } = useLanguage();
  const [collapsed, setCollapsed] = useState(false);

  const currentRole = getUserRole(user);
  const filteredItems = navItems.filter((item) => currentRole && item.roles.includes(currentRole));
  const isRtl = direction === "rtl";

  const displayName = user?.profile.fullName || user?.email || "User";
  const roleLabel = currentRole?.replace("_", " ") || "";
  const companyName = user?.activeMembership?.companyName;

  return (
    <motion.aside
      initial={false}
      animate={{ width: collapsed ? 72 : 260 }}
      transition={{ duration: 0.3, ease: [0.4, 0, 0.2, 1] }}
      className="relative flex flex-col h-screen bg-sidebar border-sidebar-border shrink-0 overflow-hidden"
      style={{ borderInlineEnd: "1px solid hsl(var(--sidebar-border))" }}
    >
      {/* Logo area */}
      <div className="flex items-center h-16 px-4 gap-3">
        <div className="w-9 h-9 rounded-lg gold-gradient flex items-center justify-center shrink-0">
          <Compass className="w-5 h-5 text-accent-foreground" />
        </div>
        <AnimatePresence>
          {!collapsed && (
            <motion.div
              initial={{ opacity: 0, width: 0 }}
              animate={{ opacity: 1, width: "auto" }}
              exit={{ opacity: 0, width: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <h1 className="text-lg font-bold text-sidebar-accent-foreground font-display whitespace-nowrap">
                {t("app.name")}
              </h1>
              <p className="text-[10px] text-sidebar-foreground/50 uppercase tracking-widest whitespace-nowrap">
                {t("app.tagline")}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Company badge */}
      {companyName && !collapsed && (
        <div className="px-4 pb-3">
          <div className="px-3 py-1.5 rounded-md bg-sidebar-accent text-sidebar-accent-foreground text-xs font-medium truncate">
            {companyName}
          </div>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto scrollbar-thin">
        {filteredItems.map((item) => (
          <NavLink
            key={item.url}
            to={item.url}
            end={item.url === "/dashboard"}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200",
              "text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent",
              collapsed && "justify-center px-0"
            )}
            activeClassName="bg-sidebar-accent text-sidebar-primary font-medium"
          >
            <item.icon className="w-[18px] h-[18px] shrink-0" />
            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  className="whitespace-nowrap"
                >
                  {t(item.translationKey)}
                </motion.span>
              )}
            </AnimatePresence>
          </NavLink>
        ))}
      </nav>

      {/* User info */}
      <div className="p-3 border-t border-sidebar-border">
        <div className={cn("flex items-center gap-3", collapsed && "justify-center")}>
          <div className="w-8 h-8 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-semibold text-sidebar-primary shrink-0">
            {displayName.charAt(0).toUpperCase()}
          </div>
          <AnimatePresence>
            {!collapsed && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex-1 min-w-0"
              >
                <p className="text-xs font-medium text-sidebar-accent-foreground truncate">{displayName}</p>
                <p className="text-[10px] text-sidebar-foreground/60 capitalize truncate">{roleLabel}</p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Collapse toggle */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="absolute top-20 bg-sidebar-accent text-sidebar-foreground hover:text-sidebar-accent-foreground w-6 h-6 rounded-full flex items-center justify-center shadow-md transition-colors z-10"
        style={{ [isRtl ? "left" : "right"]: -12 }}
      >
        {(collapsed ? !isRtl : isRtl) ? (
          <ChevronRight className="w-3.5 h-3.5" />
        ) : (
          <ChevronLeft className="w-3.5 h-3.5" />
        )}
      </button>
    </motion.aside>
  );
}
