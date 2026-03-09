import { Lock, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

interface LockOverlayProps {
  planRequired: string;
  featureName?: string;
  className?: string;
}

/**
 * Semi-transparent blur overlay for locked features.
 * Renders on top of content to indicate a plan upgrade is needed.
 */
export function LockOverlay({ planRequired, featureName, className }: LockOverlayProps) {
  const navigate = useNavigate();

  return (
    <div className={cn(
      "absolute inset-0 z-10 flex flex-col items-center justify-center",
      "bg-background/60 backdrop-blur-sm rounded-xl",
      className
    )}>
      <div className="w-14 h-14 rounded-full bg-muted/80 flex items-center justify-center mb-3">
        <Lock className="w-6 h-6 text-muted-foreground" />
      </div>
      <p className="text-sm font-semibold text-foreground mb-1">
        {featureName || "This feature"} requires {planRequired}
      </p>
      <p className="text-xs text-muted-foreground mb-4">
        Upgrade your plan to unlock this feature
      </p>
      <Button
        size="sm"
        onClick={() => navigate("/dashboard/billing")}
        className="bg-gradient-to-r from-accent to-amber-500 text-white border-0 gap-1.5"
      >
        <Sparkles className="w-3.5 h-3.5" />
        Upgrade Plan
      </Button>
    </div>
  );
}
