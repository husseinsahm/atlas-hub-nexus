import { Search, LogOut } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useLanguage } from "@/contexts/LanguageContext";
import { Button } from "@/components/ui/button";
import { NotificationBell } from "@/components/NotificationBell";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";

export function Topbar() {
  const { user, logout } = useAuth();
  const { t } = useLanguage();

  const companyName = user?.activeMembership?.companyName;

  return (
    <header className="h-14 border-b border-border bg-card/80 backdrop-blur-sm flex items-center justify-between px-6 shrink-0 sticky top-0 z-20">
      {/* Search */}
      <div className="relative max-w-md flex-1">
        <Search className="absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" style={{ insetInlineStart: 12 }} />
        <input
          type="text"
          placeholder={t("topbar.search")}
          className="luxury-input w-full h-9 text-sm rounded-lg"
          style={{ paddingInlineStart: 36 }}
        />
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        <LanguageSwitcher />

        <NotificationBell />

        {companyName && (
          <span className="text-xs bg-secondary text-secondary-foreground px-3 py-1.5 rounded-full font-medium hidden sm:inline-block">
            {companyName}
          </span>
        )}

        <Button
          variant="ghost"
          size="icon"
          onClick={logout}
          className="text-muted-foreground hover:text-destructive"
        >
          <LogOut className="w-4 h-4" />
        </Button>
      </div>
    </header>
  );
}
