import { NavLink } from "@/components/NavLink";
import { useAuth, type AppRole } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { useNavigate } from "react-router-dom";
import { 
  LayoutDashboard,
  Building2,
  Users,
  UserCog,
  Settings,
  CreditCard,
  BarChart3,
  FileText,
  Receipt,
  Compass,
  DollarSign,
  Heart,
  BookOpen,
  Briefcase,
  FolderOpen,
  ChevronsLeft,
  ChevronsRight,
  Shield,
} from "lucide-react";
import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { TrialBadge, PlanBadge } from "@/components/plan/TrialBadge";
import { useLocation, useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

const navigationGroups = [
  {
    label: "Main",
    items: [
      { title: "Dashboard", translationKey: "nav.dashboard", url: "/dashboard", icon: LayoutDashboard, roles: ["super_admin", "company_admin", "agent", "operations", "finance"] as AppRole[], end: true },
    ]
  },
  {
    label: "Admin",
    items: [
      { title: "Companies", translationKey: "nav.companies", url: "/dashboard/companies", icon: Building2, roles: ["super_admin"] as AppRole[] },
      { title: "Plans", translationKey: "nav.plans", url: "/dashboard/plans", icon: DollarSign, roles: ["super_admin"] as AppRole[] },
      { title: "Subscriptions", translationKey: "nav.subscriptions", url: "/dashboard/subscriptions", icon: CreditCard, roles: ["super_admin"] as AppRole[] },
    ]
  },
  {
    label: "Sales & CRM",
    items: [
      { title: "Leads", translationKey: "nav.clients", url: "/dashboard/clients", icon: Users, roles: ["company_admin", "agent"] as AppRole[] },
      { title: "Customers", translationKey: "nav.customers", url: "/dashboard/customers", icon: Heart, roles: ["company_admin", "agent"] as AppRole[] },
    ]
  },
  {
    label: "Operations",
    items: [
      { title: "Bookings", translationKey: "nav.bookings", url: "/dashboard/bookings", icon: Briefcase, roles: ["company_admin", "agent", "operations", "finance"] as AppRole[] },
      { title: "Operations", translationKey: "nav.operations", url: "/dashboard/operations", icon: Compass, roles: ["company_admin", "operations"] as AppRole[] },
    ]
  },
  {
    label: "Product",
    items: [
      { title: "Templates", translationKey: "nav.templates", url: "/dashboard/templates", icon: FolderOpen, roles: ["company_admin", "agent", "operations"] as AppRole[] },
      { title: "Library", translationKey: "nav.library", url: "/dashboard/library", icon: BookOpen, roles: ["company_admin", "agent", "operations"] as AppRole[] },
    ]
  },
  {
    label: "Finance",
    items: [
      { title: "Quotations", translationKey: "nav.quotations", url: "/dashboard/quotations", icon: FileText, roles: ["company_admin", "agent", "finance"] as AppRole[] },
      { title: "Invoices", translationKey: "nav.invoices", url: "/dashboard/invoices", icon: Receipt, roles: ["company_admin", "finance"] as AppRole[] },
    ]
  },
  {
    label: "Analytics",
    items: [
      { title: "Analytics", translationKey: "nav.analytics", url: "/dashboard/analytics", icon: BarChart3, roles: ["super_admin", "company_admin"] as AppRole[] },
    ]
  },
  {
    label: "Team & Settings",
    items: [
      { title: "Team", translationKey: "nav.staff", url: "/dashboard/staff", icon: UserCog, roles: ["company_admin"] as AppRole[] },
      { title: "Billing", translationKey: "nav.billing", url: "/dashboard/billing", icon: CreditCard, roles: ["company_admin"] as AppRole[] },
      { title: "Settings", translationKey: "nav.settings", url: "/dashboard/settings", icon: Settings, roles: ["super_admin", "company_admin"] as AppRole[] },
    ]
  }
];

function getUserRole(user: ReturnType<typeof useAuth>["user"]): AppRole | null {
  if (!user) return null;
  if (user.isSuperAdmin) return "super_admin";
  return user.activeMembership?.role || null;
}

function SidebarNavItem({ item, collapsed, active, t }: {
  item: typeof navigationGroups[0]["items"][0];
  collapsed: boolean;
  active: boolean;
  t: (key: string) => string;
}) {
  const Icon = item.icon;
  const itemEnd = (item as any).end;
  const label = t(item.translationKey) || item.title;

  const link = (
    <NavLink
      to={item.url}
      end={itemEnd}
      className={`
        flex items-center gap-3 px-3 py-2 rounded-lg text-[13px] transition-all duration-150
        ${active
          ? 'bg-sidebar-primary text-sidebar-primary-foreground font-medium'
          : 'text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent'
        }
        ${collapsed ? 'justify-center px-2' : ''}
      `}
    >
      <Icon className="w-[18px] h-[18px] shrink-0" />
      {!collapsed && <span className="truncate">{label}</span>}
    </NavLink>
  );

  if (collapsed) {
    return (
      <Tooltip delayDuration={0}>
        <TooltipTrigger asChild>
          {link}
        </TooltipTrigger>
        <TooltipContent side="right" className="text-xs">
          {label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return link;
}

export function DashboardSidebar() {
  const { state, toggleSidebar } = useSidebar();
  const { user } = useAuth();
  const { t } = useLanguage();
  const { limits } = usePlanLimits();
  const location = useLocation();
  const currentPath = location.pathname;

  const collapsed = state === "collapsed";
  const currentRole = getUserRole(user);

  const isActive = (path: string, end = false) => {
    if (end) return currentPath === path;
    return currentPath.startsWith(path);
  };

  const filteredGroups = navigationGroups.map(group => ({
    ...group,
    items: group.items.filter(item => currentRole && item.roles.includes(currentRole))
  })).filter(group => group.items.length > 0);

  const displayName = user?.profile?.fullName || user?.email || "User";
  const roleLabel = currentRole?.replace("_", " ") || "";
  const companyName = user?.activeMembership?.companyName;

  return (
    <TooltipProvider>
      <Sidebar collapsible="icon" className="border-e border-sidebar-border bg-sidebar-background">
        <SidebarHeader className="p-3 border-b border-sidebar-border">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-8 h-8 rounded-lg gold-gradient flex items-center justify-center shrink-0">
                <Compass className="w-4 h-4 text-accent-foreground" />
              </div>
              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <h1 className="text-sm font-bold text-sidebar-foreground font-display leading-tight">
                    {t("app.name") || "Safar"}
                  </h1>
                  <p className="text-[10px] text-sidebar-foreground/50 uppercase tracking-wider">
                    {t("app.tagline") || "Travel CRM"}
                  </p>
                </div>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleSidebar}
              className="w-7 h-7 text-sidebar-foreground/60 hover:text-sidebar-foreground hover:bg-sidebar-accent shrink-0 hidden lg:flex"
            >
              {collapsed ? (
                <ChevronsLeft className="w-4 h-4 scale-x-[-1] rtl:scale-x-[1]" />
              ) : (
                <ChevronsRight className="w-4 h-4 scale-x-[-1] rtl:scale-x-[1]" />
              )}
            </Button>
          </div>

          {companyName && !collapsed && (
            <div className="mt-2">
              <Badge variant="outline" className="bg-sidebar-accent text-sidebar-accent-foreground text-[10px] border-sidebar-border">
                {companyName}
              </Badge>
            </div>
          )}
        </SidebarHeader>

        <SidebarContent className="px-2 py-2 scrollbar-thin">
          {filteredGroups.map((group) => (
            <SidebarGroup key={group.label} className="py-1">
              {!collapsed && (
                <SidebarGroupLabel className="text-[10px] text-sidebar-foreground/50 font-semibold uppercase tracking-wider px-3 py-1.5">
                  {group.label}
                </SidebarGroupLabel>
              )}

              <SidebarGroupContent>
                <SidebarMenu className="space-y-0.5">
                  {group.items.map((item) => {
                    const active = isActive(item.url, (item as any).end);
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild>
                          <SidebarNavItem
                            item={item}
                            collapsed={collapsed}
                            active={active}
                            t={t}
                          />
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>

        {/* Admin Panel Link - super_admin only */}
        {user?.isSuperAdmin && (
          <div className="border-t border-sidebar-border px-3 py-2">
            <AdminPanelLink collapsed={collapsed} />
          </div>
        )}

        {/* Trial / Plan badge */}
        <div className="border-t border-sidebar-border px-3 py-2">
          <TrialBadge collapsed={collapsed} />
          {!limits.isTrialing && <PlanBadge collapsed={collapsed} />}
        </div>

        {/* User info footer */}
        <div className="border-t border-sidebar-border p-3">
          <div className={`flex items-center gap-2.5 ${collapsed ? 'justify-center' : ''}`}>
            <Avatar className="w-7 h-7 shrink-0">
              <AvatarImage src={user?.profile?.avatarUrl} />
              <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-[10px]">
                {displayName.charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            {!collapsed && (
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-sidebar-foreground truncate leading-tight">
                  {displayName}
                </p>
                <p className="text-[10px] text-sidebar-foreground/50 capitalize truncate">
                  {roleLabel}
                </p>
              </div>
            )}
          </div>
        </div>
      </Sidebar>
    </TooltipProvider>
  );
}
