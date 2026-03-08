import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { usePlanLimits } from "@/hooks/usePlanLimits";
import { Sparkles, Users, Building2, Map, ArrowRight } from "lucide-react";

interface LimitReachedDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  type: "users" | "branches" | "trips";
}

export function LimitReachedDialog({ open, onOpenChange, type }: LimitReachedDialogProps) {
  const { limits } = usePlanLimits();
  const navigate = useNavigate();

  const configs = {
    users: {
      icon: Users,
      title: "User limit reached",
      description: `Your ${limits.planName} plan allows a maximum of ${limits.maxUsers} users. To add more team members, please upgrade to a higher plan.`,
      current: limits.currentUsers,
      max: limits.maxUsers,
    },
    branches: {
      icon: Building2,
      title: "Branch limit reached",
      description: `Your ${limits.planName} plan allows a maximum of ${limits.maxBranches} branches. To add more branches, please upgrade to a higher plan.`,
      current: limits.currentBranches,
      max: limits.maxBranches,
    },
    trips: {
      icon: Map,
      title: "Monthly trip limit reached",
      description: `Your ${limits.planName} plan allows ${limits.maxTripsPerMonth} trips per month. You've already created ${limits.tripsThisMonth} trips this month. Upgrade to create more.`,
      current: limits.tripsThisMonth,
      max: limits.maxTripsPerMonth,
    },
  };

  const config = configs[type];
  const Icon = config.icon;

  const handleUpgrade = () => {
    onOpenChange(false);
    navigate("/dashboard/settings?tab=billing");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center sm:text-center">
          <div className="mx-auto w-14 h-14 rounded-full bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center mb-4">
            <Icon className="w-7 h-7 text-amber-600 dark:text-amber-400" />
          </div>
          <DialogTitle className="text-xl">{config.title}</DialogTitle>
          <DialogDescription className="text-center mt-2">
            {config.description}
          </DialogDescription>
        </DialogHeader>

        {/* Usage bar */}
        <div className="my-4 p-4 rounded-lg bg-muted/50 border border-border">
          <div className="flex items-center justify-between text-sm mb-2">
            <span className="text-muted-foreground">Current usage</span>
            <span className="font-semibold text-foreground">
              {config.current} / {config.max === null ? "∞" : config.max}
            </span>
          </div>
          <div className="h-2 rounded-full bg-muted overflow-hidden">
            <div 
              className="h-full rounded-full bg-amber-500"
              style={{ width: "100%" }}
            />
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)} className="flex-1">
            Maybe later
          </Button>
          <Button onClick={handleUpgrade} className="gold-gradient text-accent-foreground gap-2 flex-1">
            <Sparkles className="w-4 h-4" />
            Upgrade Plan
            <ArrowRight className="w-4 h-4" />
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
