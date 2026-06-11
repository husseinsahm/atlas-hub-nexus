import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Users, Radio } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PresenceMember } from "@/hooks/useBookingRealtime";

interface Props {
  members: PresenceMember[];
  currentUserId?: string;
  isArabic?: boolean;
}

function initials(name?: string) {
  if (!name) return "?";
  return name
    .split(/\s+/)
    .map(p => p[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

export function PresenceBar({ members, currentUserId, isArabic }: Props) {
  const others = members.filter(m => m.user_id !== currentUserId);
  const totalOnline = members.length;

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-2.5 py-1 shadow-sm">
      <div className="relative flex items-center gap-1">
        <Radio className="w-3 h-3 text-emerald-500" />
        <span className="absolute -top-0.5 -end-0.5 w-1.5 h-1.5 rounded-full bg-emerald-500 animate-ping" />
      </div>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {isArabic ? "متصلون" : "Live"}
      </span>
      <div className="flex -space-x-2 rtl:space-x-reverse">
        {members.slice(0, 5).map(m => (
          <Tooltip key={m.user_id}>
            <TooltipTrigger asChild>
              <Avatar className={cn(
                "h-6 w-6 ring-2 ring-card transition-transform hover:scale-110 hover:z-10",
                m.user_id === currentUserId && "ring-accent",
              )}>
                {m.avatar_url && <AvatarImage src={m.avatar_url} alt={m.full_name} />}
                <AvatarFallback className="text-[9px] font-bold bg-accent/10 text-accent">
                  {initials(m.full_name)}
                </AvatarFallback>
              </Avatar>
            </TooltipTrigger>
            <TooltipContent side="bottom" className="text-[10px]">
              <p className="font-semibold">{m.full_name}</p>
              {m.user_id === currentUserId && (
                <p className="text-muted-foreground">{isArabic ? "(أنت)" : "(you)"}</p>
              )}
            </TooltipContent>
          </Tooltip>
        ))}
        {members.length > 5 && (
          <div className="h-6 w-6 rounded-full bg-muted ring-2 ring-card flex items-center justify-center text-[9px] font-bold text-muted-foreground">
            +{members.length - 5}
          </div>
        )}
      </div>
      <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
        {totalOnline}
        {others.length > 0 && (
          <span className="ms-1 text-emerald-600 font-semibold">
            · {others.length} {isArabic ? "آخرين" : "other" + (others.length > 1 ? "s" : "")}
          </span>
        )}
      </span>
    </div>
  );
}
