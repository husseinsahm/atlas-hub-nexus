import { Search, LogOut, Menu } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/NotificationBell";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";

export function Topbar() {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const isMobile = useIsMobile();

  const companyName = user?.activeMembership?.companyName;

  return (
    <header className="h-14 border-b border-border bg-card/80 backdrop-blur-sm flex items-center justify-between px-3 sm:px-6 shrink-0 sticky top-0 z-20">
      {/* Left section - Sidebar trigger and search */}
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <SidebarTrigger className="lg:hidden">
          <Menu className="w-4 h-4" />
        </SidebarTrigger>
        
        {/* Search */}
        <div className="relative max-w-md flex-1">
          <Search className="absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" style={{ insetInlineStart: 12 }} />
          <input
            type="text"
            placeholder={isMobile ? t("topbar.search") || "Search..." : t("topbar.search")}
            className="luxury-input w-full h-9 text-sm rounded-lg pr-4"
            style={{ paddingInlineStart: 36 }}
          />
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2 shrink-0">
        {!isMobile && <LanguageSwitcher />}

        <NotificationBell />

        {companyName && !isMobile && (
          <span className="text-xs bg-secondary text-secondary-foreground px-3 py-1.5 rounded-full font-medium hidden sm:inline-block max-w-32 truncate">
            {companyName}
          </span>
        )}

        <Button
          variant="ghost"
          size={isMobile ? "sm" : "icon"}
          onClick={logout}
          className="text-muted-foreground hover:text-destructive shrink-0"
        >
          <LogOut className="w-4 h-4" />
          {isMobile && <span className="ml-1 text-xs">Exit</span>}
        </Button>
      </div>
    </header>
  );
}