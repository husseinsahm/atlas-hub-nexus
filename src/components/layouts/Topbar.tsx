import { Search, LogOut, Menu } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/NotificationBell";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { useIsMobile } from "@/hooks/use-mobile";

export function Topbar() {
  const { user, logout } = useAuth();
  const { t } = useLanguage();
  const isMobile = useIsMobile();

  const companyName = user?.activeMembership?.companyName;

  return (
    <header className="h-[52px] border-b border-border bg-card flex items-center justify-between px-3 sm:px-5 shrink-0 sticky top-0 z-20">
      {/* Left section */}
      <div className="flex items-center gap-2.5 flex-1 min-w-0">
        <SidebarTrigger className="lg:hidden text-muted-foreground hover:text-foreground">
          <Menu className="w-4 h-4" />
        </SidebarTrigger>

        {/* Search */}
        <div className="relative max-w-sm flex-1">
          <Search className="absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" style={{ insetInlineStart: 10 }} />
          <input
            type="text"
            placeholder={t("topbar.search") || "Search..."}
            className="w-full h-8 text-xs bg-secondary/60 border-0 rounded-lg pr-3 focus:outline-none focus:ring-1 focus:ring-ring transition-all"
            style={{ paddingInlineStart: 32 }}
          />
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1.5 shrink-0">
        <ThemeToggle />
        
        {!isMobile && <LanguageSwitcher />}

        <NotificationBell />

        {companyName && !isMobile && (
          <span className="text-[11px] bg-secondary text-secondary-foreground px-2.5 py-1 rounded-full font-medium hidden sm:inline-block max-w-32 truncate">
            {companyName}
          </span>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={logout}
          className="w-8 h-8 text-muted-foreground hover:text-destructive shrink-0"
        >
          <LogOut className="w-3.5 h-3.5" />
        </Button>
      </div>
    </header>
  );
}
