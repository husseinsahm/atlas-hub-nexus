import { Globe, Check } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { SUPPORTED_LANGUAGES, type Language } from "@/i18n";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function LanguageSwitcher({ variant = "icon" }: { variant?: "icon" | "full" }) {
  const { language, setLanguage } = useLanguage();
  const current = SUPPORTED_LANGUAGES.find(l => l.code === language);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === "full" ? (
          <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground gap-2">
            <Globe className="w-4 h-4" />
            {current?.nativeLabel}
          </Button>
        ) : (
          <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
            <Globe className="w-4 h-4" />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-[160px]">
        {SUPPORTED_LANGUAGES.map((lang) => (
          <DropdownMenuItem
            key={lang.code}
            onClick={() => setLanguage(lang.code as Language)}
            className="flex items-center justify-between gap-3 cursor-pointer"
          >
            <div className="flex flex-col">
              <span className="text-sm font-medium">{lang.nativeLabel}</span>
              <span className="text-[10px] text-muted-foreground">{lang.label}</span>
            </div>
            {language === lang.code && <Check className="w-4 h-4 text-accent shrink-0" />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
