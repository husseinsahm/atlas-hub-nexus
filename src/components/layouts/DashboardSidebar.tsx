import { NavLink } from "@/components/NavLink";
import { useAuth, type AppRole } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
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
import { useLocation } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";

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
      { title: "Settings", translationKey: "nav.settings", url: "/dashboard/settings", icon: Settings, roles: ["super_admin", "company_admin"] as AppRole[] },
    ]
  }
];

function getUserRole(user: ReturnType<typeof useAuth>["user"]): AppRole | null {
  if (!user) return null;
  if (user.isSuperAdmin) return "super_admin";
  return user.activeMembership?.role || null;
}

export function DashboardSidebar() {
  const { state } = useSidebar();
  const { user } = useAuth();
  const { t } = useLanguage();
  const location = useLocation();
  const currentPath = location.pathname;
  
  const collapsed = state === "collapsed";
  const currentRole = getUserRole(user);
  
  const isActive = (path: string, end = false) => {
    if (end) {
      return currentPath === path;
    }
    return currentPath.startsWith(path);
  };

  // Filter groups and items based on role
  const filteredGroups = navigationGroups.map(group => ({
    ...group,
    items: group.items.filter(item => currentRole && item.roles.includes(currentRole))
  })).filter(group => group.items.length > 0);

  const displayName = user?.profile?.fullName || user?.email || "User";
  const roleLabel = currentRole?.replace("_", " ") || "";
  const companyName = user?.activeMembership?.companyName;

  return (
    <Sidebar collapsible="icon" className="border-r border-border bg-sidebar-background">
      <SidebarHeader className="border-b border-sidebar-border p-4">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg gold-gradient flex items-center justify-center shrink-0">
            <Compass className="w-5 h-5 text-accent-foreground" />
          </div>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <h1 className="text-lg font-bold text-sidebar-foreground font-display">
                {t("app.name") || "Safar"}
              </h1>
              <p className="text-xs text-sidebar-foreground/60 uppercase tracking-wide">
                {t("app.tagline") || "Travel CRM"}
              </p>
            </div>
          )}
        </div>
        
        {companyName && !collapsed && (
          <div className="mt-3">
            <Badge variant="outline" className="bg-sidebar-accent text-sidebar-accent-foreground text-xs">
              {companyName}
            </Badge>
          </div>
        )}
      </SidebarHeader>

      <SidebarContent className="px-2">
        {filteredGroups.map((group) => {
          const hasActiveItem = group.items.some(item => 
            isActive(item.url, (item as any).end)
          );

          return (
            <SidebarGroup key={group.label}>
              {!collapsed && (
                <SidebarGroupLabel className="text-xs text-sidebar-foreground/70 font-medium px-2 py-2">
                  {group.label}
                </SidebarGroupLabel>
              )}
              
              <SidebarGroupContent>
                <SidebarMenu className="space-y-1">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const active = isActive(item.url, item.end);
                    
                    return (
                      <SidebarMenuItem key={item.title}>
                        <SidebarMenuButton asChild>
                          <NavLink 
                            to={item.url} 
                            end={item.end}
                            className={`
                              flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all duration-200
                              ${active 
                                ? 'bg-sidebar-primary text-sidebar-primary-foreground font-medium shadow-sm' 
                                : 'text-sidebar-foreground hover:text-sidebar-accent-foreground hover:bg-sidebar-accent'
                              }
                              ${collapsed ? 'justify-center' : ''}
                            `}
                          >
                            <Icon className="w-[18px] h-[18px] shrink-0" />
                            {!collapsed && (
                              <span className="truncate">{t(item.translationKey) || item.title}</span>
                            )}
                          </NavLink>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          );
        })}
      </SidebarContent>
      
      {/* User info footer */}
      <div className="border-t border-sidebar-border p-3">
        <div className={`flex items-center gap-3 ${collapsed ? 'justify-center' : ''}`}>
          <Avatar className="w-8 h-8 shrink-0">
            <AvatarImage src={user?.user_metadata?.avatar_url} />
            <AvatarFallback className="bg-sidebar-accent text-sidebar-accent-foreground text-xs">
              {displayName.charAt(0).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          {!collapsed && (
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-sidebar-foreground truncate">
                {displayName}
              </p>
              <p className="text-xs text-sidebar-foreground/60 capitalize truncate">
                {roleLabel}
              </p>
            </div>
          )}
        </div>
      </div>
    </Sidebar>
  );
}
